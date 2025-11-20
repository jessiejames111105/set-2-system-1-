import { get } from 'svelte/store';
import { authStore } from '../../../components/login/js/auth.js';

/**
 * Simplified fetch function that includes user authentication headers
 */
export async function authenticatedFetch(url, options = {}) {
  const authState = get(authStore);
  
  // Default headers
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // Add user headers if authenticated
  if (authState.isAuthenticated && authState.userData) {
    // Create user info object for x-user-info header
    const userInfo = {
      id: authState.userData.id,
      name: authState.userData.name,
      account_number: authState.userData.accountNumber,
      account_type: authState.userData.account_type || authState.userData.accountType
    };
    
    defaultHeaders['x-user-info'] = JSON.stringify(userInfo);
    
    // Keep individual headers for backward compatibility
    defaultHeaders['x-user-id'] = authState.userData.id.toString();
    defaultHeaders['x-user-account-number'] = authState.userData.accountNumber;
    defaultHeaders['x-user-name'] = encodeURIComponent(authState.userData.name);
  }
  
  // Merge options with enhanced headers
  const enhancedOptions = {
    ...options,
    headers: defaultHeaders
  };
  
  try {
    const response = await fetch(url, enhancedOptions);
    
    // Return the response object directly - let the caller handle parsing
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

/**
 * Convenience methods for common HTTP operations
 */
export const api = {
  get: async (url, options = {}) => {
    const response = await authenticatedFetch(url, { ...options, method: 'GET' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },
  post: async (url, data, options = {}) => {
    const response = await authenticatedFetch(url, { 
      ...options, 
      method: 'POST', 
      body: JSON.stringify(data) 
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },
  put: async (url, data, options = {}) => {
    const response = await authenticatedFetch(url, { 
      ...options, 
      method: 'PUT', 
      body: JSON.stringify(data) 
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },
  delete: async (url, data, options = {}) => {
    const response = await authenticatedFetch(url, { 
      ...options, 
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },
  patch: async (url, data, options = {}) => {
    const response = await authenticatedFetch(url, { 
      ...options, 
      method: 'PATCH', 
      body: JSON.stringify(data) 
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }
};