import { config } from '../config/index.js';
import { log } from './logger.service.js';

export interface AzureAdUser {
  id: string;
  email: string;
  name: string;
  displayName: string;
  avatar?: string | undefined;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string | undefined;
  id_token?: string | undefined;
}

export interface AzureAdProfile {
  sub: string;
  name?: string | undefined;
  email?: string | undefined;
  preferred_username?: string | undefined;
  oid?: string | undefined;
  picture?: string | undefined;
}

/**
 * Generate Azure AD authorization URL
 */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.azureAd.clientId,
    response_type: 'code',
    redirect_uri: config.azureAd.redirectUri,
    response_mode: 'query',
    scope: 'openid profile email User.Read',
    state,
  });

  return `https://login.microsoftonline.com/${config.azureAd.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const params = new URLSearchParams({
    client_id: config.azureAd.clientId,
    client_secret: config.azureAd.clientSecret,
    code,
    redirect_uri: config.azureAd.redirectUri,
    grant_type: 'authorization_code',
    scope: 'openid profile email User.Read',
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${config.azureAd.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json() as Promise<TokenResponse>;
}

/**
 * Generate a fallback avatar URL using UI Avatars service
 */
function generateFallbackAvatar(displayName: string): string {
  const encodedName = encodeURIComponent(displayName || 'User');
  return `https://ui-avatars.com/api/?name=${encodedName}&background=3b82f6&color=fff&size=128`;
}

/**
 * Get user profile from Microsoft Graph API
 */
export async function getUserProfile(accessToken: string): Promise<AzureAdUser> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user profile');
  }

  const profile = await response.json() as {
    id: string;
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
  };

  const displayName = profile.displayName ?? '';
  const email = profile.mail ?? profile.userPrincipalName ?? '';

  // Try to get user photo from Azure AD
  let avatar: string | undefined;
  try {
    const photoResponse = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (photoResponse.ok) {
      const photoBlob = await photoResponse.arrayBuffer();
      const base64 = Buffer.from(photoBlob).toString('base64');
      const contentType = photoResponse.headers.get('content-type') ?? 'image/jpeg';
      avatar = `data:${contentType};base64,${base64}`;
      log.debug('User avatar fetched from Azure AD', { userId: profile.id });
    } else {
      log.debug('Azure AD photo not available, using fallback', { 
        userId: profile.id, 
        status: photoResponse.status 
      });
    }
  } catch (err) {
    log.debug('Failed to fetch Azure AD photo, using fallback', { 
      userId: profile.id,
      error: err instanceof Error ? err.message : String(err)
    });
  }

  // Use fallback avatar if Azure photo not available
  if (!avatar) {
    avatar = generateFallbackAvatar(displayName);
  }

  return {
    id: profile.id,
    email,
    name: displayName,
    displayName,
    avatar,
  };
}

/**
 * Generate a random state for OAuth CSRF protection
 */
export function generateState(): string {
  return crypto.randomUUID();
}
