/**
 * @fileoverview Authentication routes for Azure Entra ID OAuth2 and development mode.
 * 
 * This module handles:
 * - OAuth2 login flow with Azure AD (PKCE)
 * - OAuth callback processing and token exchange
 * - Session management and logout
 * - Development mode authentication bypass
 * - Root user authentication for local deployments
 * 
 * Security features:
 * - CSRF protection via OAuth state parameter
 * - Session regeneration on login/logout
 * - In-memory state store with TTL for OAuth states
 * 
 * @module routes/auth
 */

import { Router, Request, Response } from 'express';
import { getCurrentUser } from '../middleware/auth.middleware.js';
import { config } from '../config/index.js';
import { log } from '../services/logger.service.js';
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getUserProfile,
  generateState,
} from '../services/auth.service.js';
import { userService } from '../services/user.service.js';

const router = Router();

// ============================================================================
// OAuth State Management
// ============================================================================

/**
 * OAuth state data stored in memory for CSRF protection.
 * This is the PRIMARY store since session cookies may not persist
 * across different ports (frontend proxy vs direct backend access).
 */
interface OAuthStateData {
  /** Timestamp when state was created (for TTL calculation) */
  timestamp: number;
  /** Optional redirect URL after successful login */
  redirectUrl?: string;
  /** Session ID associated with this state */
  sessionId?: string;
}

/** In-memory store for OAuth states with TTL cleanup */
const oauthStateStore = new Map<string, OAuthStateData>();

/** Time-to-live for OAuth states (10 minutes) */
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Periodic cleanup of expired OAuth states.
 * Runs every minute to prevent memory leaks.
 */
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  for (const [state, data] of oauthStateStore.entries()) {
    if (now - data.timestamp > STATE_TTL_MS) {
      oauthStateStore.delete(state);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    log.debug('Cleaned up expired OAuth states', { count: cleanedCount });
  }
}, 60 * 1000);

// ============================================================================
// Development Mode Configuration
// ============================================================================

/**
 * Development-only mock user for testing UI without Azure AD.
 * Only available when NODE_ENV === 'development'.
 */
const DEV_USER = config.nodeEnv === 'development' ? {
  id: 'dev-user-001',
  email: 'john.doe@contoso.com',
  name: 'John Doe',
  displayName: 'John Doe',
  avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=3b82f6&color=fff&size=128',
} : null;

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/auth/me
 * Get current authenticated user.
 * 
 * Returns user info that can be stored in shared storage for cross-subdomain access.
 * Includes _sharedStorage metadata for frontend synchronization.
 * 
 * @returns {Object} User object with shared storage metadata
 * @returns {401} If no user is authenticated
 */
router.get('/me', (req: Request, res: Response) => {
  const user = getCurrentUser(req);

  log.debug('Auth /me request', {
    hasUser: !!user,
    hasSessionUser: !!req.session?.user,
    sessionId: req.sessionID?.substring(0, 8),
    nodeEnv: config.nodeEnv,
    cookieHeader: req.headers.cookie?.substring(0, 50),
  });

  // Check if user exists in session (authenticated via Azure AD)
  if (user) {
    log.info('Returning authenticated user', { userId: user.id, email: user.email });
    res.json({
      ...user,
      _sharedStorage: {
        domain: config.sharedStorageDomain,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // No user in session - return 401
  // NOTE: Dev mode auto-login has been removed to fix logout issues
  // Use the "Continue as Dev User" button on the login page for development
  log.debug('No user in session, returning 401');
  res.status(401).json({ error: 'Not authenticated' });
});

/**
 * POST /api/auth/dev-login
 * Development only: Login as dev user without Azure AD.
 * 
 * This creates an actual session, unlike the removed auto-dev-user fallback.
 * Regenerates session to prevent session fixation attacks.
 * 
 * @body {string} [redirect] - Optional URL to redirect after login
 * @returns {Object} Success status, user object, and redirect URL
 * @returns {403} If not in development mode
 */
router.post('/dev-login', (req: Request, res: Response) => {
  // Only allow in development mode
  if (config.nodeEnv !== 'development' || !DEV_USER) {
    log.warn('Dev login attempted in non-development environment');
    res.status(403).json({ error: 'Dev login only available in development mode' });
    return;
  }

  const redirectUrl = req.body?.redirect as string | undefined;

  log.info('Dev user login initiated');

  // Regenerate session to prevent session fixation and ensure clean state
  req.session.regenerate((err) => {
    if (err) {
      log.error('Failed to regenerate session for dev login', { error: err.message });
      res.status(500).json({ error: 'Failed to create session' });
      return;
    }

    // Store dev user in session
    req.session.user = DEV_USER;

    req.session.save((err) => {
      if (err) {
        log.error('Failed to save dev user session', { error: err.message });
        res.status(500).json({ error: 'Failed to create session' });
        return;
      }

      log.info('Dev user logged in successfully', {
        userId: DEV_USER.id,
        sessionId: req.sessionID?.substring(0, 8),
      });

      res.json({
        success: true,
        user: DEV_USER,
        redirectUrl: redirectUrl || '/',
      });
    });
  });
});

/**
 * GET /api/auth/login
 * Initiate Azure Entra ID OAuth2 login flow.
 * 
 * Flow:
 * 1. Regenerate session for clean state
 * 2. Generate CSRF state token
 * 3. Store state in memory (primary) and session (fallback)
 * 4. Redirect to Azure AD authorization endpoint
 * 
 * @query {string} [redirect] - URL to redirect after successful login
 */
router.get('/login', (req: Request, res: Response) => {
  // Generate state for CSRF protection
  const state = generateState();
  const redirectUrl = req.query['redirect'] as string | undefined;

  // Regenerate session before starting OAuth flow to ensure clean state
  req.session.regenerate((err) => {
    if (err) {
      log.error('Failed to regenerate session for OAuth login', { error: err.message });
      res.redirect(`${config.frontendUrl}/login?error=session_error`);
      return;
    }

    // Store state in memory store (PRIMARY - always works)
    // Session-based state may fail due to port differences between frontend proxy and callback
    const stateData: OAuthStateData = {
      timestamp: Date.now(),
      sessionId: req.sessionID,
    };

    if (redirectUrl) {
      stateData.redirectUrl = redirectUrl;
    }

    oauthStateStore.set(state, stateData);

    // Also try to store in session (may not work across ports)
    req.session.oauthState = state;

    log.info('OAuth login initiated', {
      state: state.substring(0, 8) + '...',
      sessionId: req.sessionID?.substring(0, 8),
      redirect: redirectUrl,
      storeSize: oauthStateStore.size,
    });

    // Save session before redirect
    req.session.save((err) => {
      if (err) {
        log.error('Failed to save session before OAuth redirect', { error: err.message });
      }
      const authUrl = getAuthorizationUrl(state);
      log.debug('Redirecting to Azure AD', { authUrl: authUrl.substring(0, 100) + '...' });
      res.redirect(authUrl);
    });
  });
});

/**
 * GET /api/auth/callback
 * Handle OAuth callback from Azure Entra ID.
 * 
 * Processing steps:
 * 1. Validate OAuth state (CSRF protection)
 * 2. Exchange authorization code for tokens
 * 3. Fetch user profile from Microsoft Graph API
 * 4. Find or create user in database
 * 5. Store user in session with role/permissions
 * 6. Redirect to frontend
 * 
 * @query {string} code - Authorization code from Azure AD
 * @query {string} state - State parameter for CSRF validation
 * @query {string} [error] - Error code from Azure AD
 * @query {string} [error_description] - Error description from Azure AD
 */
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;

  // Get state data from memory store (PRIMARY method)
  const memoryStateData = typeof state === 'string' ? oauthStateStore.get(state) : undefined;
  const sessionState = req.session.oauthState;

  log.debug('OAuth callback received', {
    hasCode: !!code,
    hasState: !!state,
    hasError: !!error,
    receivedState: typeof state === 'string' ? state.substring(0, 8) : undefined,
    sessionState: sessionState?.substring(0, 8) ?? 'missing',
    memoryStateFound: !!memoryStateData,
    sessionId: req.sessionID?.substring(0, 8),
    storeSize: oauthStateStore.size,
    storedStates: Array.from(oauthStateStore.keys()).map(k => k.substring(0, 8)),
  });

  // Handle OAuth errors
  if (error) {
    log.error('OAuth error from Azure AD', { error, error_description });
    res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(String(error_description ?? error))}`);
    return;
  }

  // Validate state - memory store is PRIMARY, session is fallback
  // Memory store handles the case where session cookies don't persist across ports
  const stateValid = memoryStateData !== undefined || (state && state === sessionState);

  if (!state || !stateValid) {
    log.error('OAuth state validation failed', {
      receivedState: typeof state === 'string' ? state.substring(0, 8) : 'missing',
      sessionState: sessionState?.substring(0, 8) ?? 'missing',
      memoryStateFound: !!memoryStateData,
      sessionId: req.sessionID?.substring(0, 8),
      storeSize: oauthStateStore.size,
    });
    res.redirect(`${config.frontendUrl}/login?error=invalid_state`);
    return;
  }

  // Clean up state from memory store
  if (typeof state === 'string') {
    oauthStateStore.delete(state);
  }

  if (!code || typeof code !== 'string') {
    log.error('OAuth callback missing authorization code');
    res.redirect(`${config.frontendUrl}/login?error=missing_code`);
    return;
  }

  try {
    log.debug('Exchanging authorization code for tokens');

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    log.debug('Token exchange successful');

    // Get user profile from Microsoft Graph
    log.debug('Fetching user profile from Microsoft Graph');
    const user = await getUserProfile(tokens.access_token);
    log.info('User authenticated successfully', {
      userId: user.id,
      email: user.email,
      name: user.displayName,
    });

    // Store user in session
    // Auto-save user to database
    const dbUser = await userService.findOrCreateUser(user);

    // Merge Azure AD profile with DB user data (role, permissions)
    req.session.user = {
      ...user,
      role: dbUser.role,
      permissions: dbUser.permissions,
    };
    req.session.accessToken = tokens.access_token;

    // Clear OAuth state from session
    delete req.session.oauthState;

    // Save session before redirect
    req.session.save((err) => {
      if (err) {
        log.error('Failed to save session after login', { error: err.message });
      }

      // Get redirect URL from memory state data or default to frontend
      const redirectUrl = memoryStateData?.redirectUrl || config.frontendUrl;
      log.info('Login complete, redirecting', { redirectUrl });
      res.redirect(redirectUrl);
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error('OAuth callback error', { error: errorMessage, stack: err instanceof Error ? err.stack : undefined });
    res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
  }
});

/**
 * GET /api/auth/logout
 * Logout the current user (local session only, not Azure AD).
 * 
 * This performs a local logout only, allowing users to
 * login with a different Azure account without logging out of Azure.
 * 
 * Steps:
 * 1. Destroy server session
 * 2. Clear session cookie
 * 3. Redirect to login page
 */
router.get('/logout', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  log.info('User logout initiated', { userId: user?.id, email: user?.email });

  // Clear session first, then redirect to login page
  req.session.destroy((err) => {
    if (err) {
      log.error('Session destroy error during logout', { error: err.message });
    }

    // Clear session cookie
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: config.https.enabled,
      sameSite: 'lax',
      domain: config.sharedStorageDomain !== '.localhost' ? config.sharedStorageDomain : undefined,
    });

    // Redirect directly to login page (local logout only, not Azure AD logout)
    // This allows users to login with a different Azure account without logging out of Azure
    const loginPageUrl = `${config.frontendUrl}/login`;
    log.info('User logged out, redirecting to login page', { redirectUrl: loginPageUrl });
    res.redirect(loginPageUrl);
  });
});

/**
 * POST /api/auth/logout
 * Logout via POST (for programmatic logout from frontend).
 * 
 * Returns JSON response instead of redirect.
 * 
 * @returns {Object} Success message and redirect URL
 * @returns {500} If session destruction fails
 */
router.post('/logout', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  log.info('User logout (POST) initiated', { userId: user?.id, email: user?.email });

  req.session.destroy((err) => {
    if (err) {
      log.error('Session destroy error during POST logout', { error: err.message });
      res.status(500).json({ error: 'Logout failed' });
      return;
    }

    // Clear session cookie
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: config.https.enabled,
      sameSite: 'lax',
      domain: config.sharedStorageDomain !== '.localhost' ? config.sharedStorageDomain : undefined,
    });

    log.info('User logged out successfully');
    res.json({
      message: 'Logged out successfully',
      redirectUrl: `${config.frontendUrl}/login`,
    });
  });
});

/**
 * GET /api/auth/config
 * Get public authentication configuration.
 * 
 * Returns configuration flags for frontend authentication UI.
 * 
 * @returns {Object} Auth config with enableRootLogin flag
 */
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    enableRootLogin: config.enableRootLogin,
  });
});

/**
 * POST /api/auth/login/root
 * Login with root credentials (local deployment only).
 * 
 * Authenticates using KB_ROOT_USER and KB_ROOT_PASSWORD environment variables.
 * Only available when ENABLE_ROOT_LOGIN is true.
 * 
 * @body {string} username - Root username
 * @body {string} password - Root password
 * @returns {Object} Success status and user object
 * @returns {403} If root login is disabled
 * @returns {401} If credentials are invalid
 */
router.post('/login/root', async (req: Request, res: Response) => {
  if (!config.enableRootLogin) {
    res.status(403).json({ error: 'Root login is disabled' });
    return;
  }

  const { username, password } = req.body;
  const rootUser = process.env['KB_ROOT_USER'] || 'admin@localhost';
  const rootPass = process.env['KB_ROOT_PASSWORD'] || 'admin';

  if (username !== rootUser || password !== rootPass) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  try {
    // Find or create root user in DB to ensure consistency
    const user = await userService.findOrCreateUser({
      id: 'root-user',
      email: rootUser,
      name: 'System Administrator',
      displayName: 'System Administrator',
    });

    // Create session
    req.session.user = {
      id: user.id,
      email: user.email,
      name: 'System Administrator',
      displayName: user.display_name,
      role: 'admin',
      permissions: ['*'], // Root has all permissions
    };

    log.info('Root user logged in', { email: rootUser });
    res.json({ success: true, user: req.session.user });
  } catch (error) {
    log.error('Root login failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
