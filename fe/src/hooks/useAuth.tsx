import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface User {
  id: string;
  email: string;
  name: string;
  displayName: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  checkSession: () => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const checkSession = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      console.log('[Auth] Checking session...');
      
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        console.log('[Auth] Session valid:', userData.email);
        return true;
      }

      if (response.status === 401) {
        console.log('[Auth] Session not found or expired (401)');
        setUser(null);
        return false;
      }

      throw new Error(`Unexpected response: ${response.status}`);
    } catch (err) {
      console.error('[Auth] Error checking session:', err);
      setError(err instanceof Error ? err.message : 'Failed to check session');
      setUser(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    console.log('[Auth] Logging out...');
    setUser(null);
    setIsLoading(false);
    // Redirect to backend logout which will clear session and redirect to Azure AD logout
    window.location.href = `${API_BASE_URL}/api/auth/logout`;
  }, []);

  // Check session on initial mount only
  useEffect(() => {
    const publicPaths = ['/login', '/logout'];
    const isPublicPath = publicPaths.some(path => location.pathname.startsWith(path));

    // Skip auth check for public paths
    if (isPublicPath) {
      console.log('[Auth] Public path, skipping auth check:', location.pathname);
      setIsLoading(false);
      return;
    }

    // Always check session for protected paths
    console.log('[Auth] Protected path, checking session:', location.pathname);
    checkSession().then(isValid => {
      if (!isValid) {
        // Store the intended destination for redirect after login
        const redirectUrl = location.pathname + location.search;
        console.log('[Auth] Not authenticated, redirecting to login. Intended destination:', redirectUrl);
        navigate(`/login?redirect=${encodeURIComponent(redirectUrl)}`, { replace: true });
      }
    });
  }, [location.pathname, location.search, checkSession, navigate]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    checkSession,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default useAuth;
