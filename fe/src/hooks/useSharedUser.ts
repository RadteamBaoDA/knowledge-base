import { useEffect, useState, useCallback } from 'react';
import { 
  sharedStorage, 
  SharedUserInfo, 
  subscribeToUserInfoChanges 
} from '../services/shared-storage.service';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface UseSharedUserResult {
  user: SharedUserInfo | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  clear: () => void;
}

/**
 * Hook to access shared user info across subdomains
 * 
 * This hook:
 * 1. First checks shared storage (localStorage/cookie) for cached user
 * 2. Then fetches fresh data from backend /api/auth/me
 * 3. Stores the result in shared storage for other apps
 * 4. Subscribes to changes from other tabs/subdomains
 */
export function useSharedUser(): UseSharedUserResult {
  const [user, setUser] = useState<SharedUserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user from backend and store in shared storage
  const fetchAndStoreUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated, clear storage
          sharedStorage.clearUser();
          setUser(null);
          return;
        }
        throw new Error('Failed to fetch user info');
      }

      const userData = await response.json();
      
      const sharedUser: SharedUserInfo = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        displayName: userData.displayName,
        avatar: userData.avatar,
        lastUpdated: new Date().toISOString(),
        source: window.location.hostname,
      };

      // Store in shared storage
      sharedStorage.storeUser(sharedUser);
      setUser(sharedUser);
      
      console.log('[useSharedUser] User fetched and stored:', sharedUser.email);
    } catch (err) {
      console.error('[useSharedUser] Error fetching user:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load: check shared storage first, then fetch
  useEffect(() => {
    const initUser = async () => {
      // Check shared storage first
      const cachedUser = sharedStorage.getUser();
      if (cachedUser) {
        console.log('[useSharedUser] Found cached user:', cachedUser.email);
        setUser(cachedUser);
        setIsLoading(false);
        
        // Still refresh from backend in background
        fetchAndStoreUser();
      } else {
        // No cached user, fetch from backend
        await fetchAndStoreUser();
      }
    };

    initUser();
  }, [fetchAndStoreUser]);

  // Subscribe to changes from other tabs/subdomains
  useEffect(() => {
    const unsubscribe = subscribeToUserInfoChanges((updatedUser) => {
      console.log('[useSharedUser] Received user update from another source');
      setUser(updatedUser);
    });

    return unsubscribe;
  }, []);

  const clear = useCallback(() => {
    sharedStorage.clearUser();
    setUser(null);
  }, []);

  return {
    user,
    isLoading,
    error,
    refresh: fetchAndStoreUser,
    clear,
  };
}

/**
 * Get shared user info synchronously (from cache only)
 * Use this when you need immediate access without async
 */
export function getSharedUserSync(): SharedUserInfo | null {
  return sharedStorage.getUser();
}

/**
 * Store user info in shared storage
 * Call this after successful authentication
 */
export function setSharedUser(user: Omit<SharedUserInfo, 'lastUpdated' | 'source'>): void {
  sharedStorage.storeUser(user);
}

/**
 * Clear shared user info
 * Call this on logout
 */
export function clearSharedUser(): void {
  sharedStorage.clearUser();
}

export default useSharedUser;
