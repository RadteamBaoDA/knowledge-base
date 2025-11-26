/**
 * API utility with authentication interceptor
 * Handles 401 responses by redirecting to login page
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class AuthenticationError extends Error {
  constructor(message: string = 'Not authenticated') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Handles 401 responses by redirecting to login
 */
function handleUnauthorized(): never {
  const currentPath = window.location.pathname + window.location.search;
  const loginUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;
  
  console.log('[API] Unauthorized (401), redirecting to login:', loginUrl);
  
  // Use window.location to force a full page redirect
  window.location.href = loginUrl;
  
  // Throw to stop execution (redirect will happen)
  throw new AuthenticationError();
}

interface FetchOptions extends RequestInit {
  skipAuthCheck?: boolean;
}

/**
 * Fetch wrapper with authentication handling
 * Automatically handles 401 responses by redirecting to login
 */
export async function apiFetch<T = unknown>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuthCheck = false, ...fetchOptions } = options;
  
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...fetchOptions,
    credentials: 'include', // Always include cookies for session
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });
  
  // Handle 401 Unauthorized - redirect to login
  if (response.status === 401 && !skipAuthCheck) {
    handleUnauthorized();
  }
  
  // Handle other errors
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }
  
  // Return JSON response
  return response.json() as Promise<T>;
}

/**
 * API methods for common operations
 */
export const api = {
  get: <T = unknown>(endpoint: string, options?: FetchOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }),
    
  post: <T = unknown>(endpoint: string, data?: unknown, options?: FetchOptions) => {
    const body = data ? JSON.stringify(data) : null;
    return apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body,
    });
  },
    
  put: <T = unknown>(endpoint: string, data?: unknown, options?: FetchOptions) => {
    const body = data ? JSON.stringify(data) : null;
    return apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body,
    });
  },
    
  delete: <T = unknown>(endpoint: string, options?: FetchOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),
};

export default api;
