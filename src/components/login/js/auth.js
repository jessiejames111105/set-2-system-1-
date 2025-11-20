import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

// Storage key for authentication data
const AUTH_STORAGE_KEY = 'authState';

// Get initial state from localStorage if available
function getInitialState() {
  if (browser) {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        // Validate the stored state structure
        if (parsedState && typeof parsedState.isAuthenticated === 'boolean') {
          return parsedState;
        }
      }
    } catch (error) {
      console.warn('Failed to parse stored auth state:', error);
      // Clear invalid data
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }
  
  return {
    isAuthenticated: false,
    userType: null, // 'student', 'teacher', 'admin'
    userData: null
  };
}

// Save state to localStorage
function saveToStorage(state) {
  if (browser) {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save auth state to localStorage:', error);
    }
  }
}

// Authentication state store
function createAuthStore() {
  const initialState = getInitialState();
  const { subscribe, set, update } = writable(initialState);

  return {
    subscribe,
    // Login function
    login: (userType, userData) => {
      const newState = {
        isAuthenticated: true,
        userType,
        userData
      };
      set(newState);
      saveToStorage(newState);
    },
    // Logout function
    logout: async () => {
      // Get current user data before logout for activity logging
      const currentState = get(authStore);
      
      // Log logout activity only for admin users
      if (currentState.isAuthenticated && currentState.userData && currentState.userType === 'admin') {
        try {
          await fetch('/api/activity-logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              activity_type: 'user_logout',
              user_id: currentState.userData.id,
              user_account_number: currentState.userData.accountNumber,
              activity_data: {
                full_name: currentState.userData.name,
                account_type: currentState.userType
              }
            })
          });
        } catch (error) {
          console.error('Failed to log logout activity:', error);
        }
      }
      
      const newState = {
        isAuthenticated: false,
        userType: null,
        userData: null
      };
      set(newState);
      saveToStorage(newState);
    },
    // Update user data
    updateUserData: (userData) => {
      update(state => {
        const newState = {
          ...state,
          userData
        };
        saveToStorage(newState);
        return newState;
      });
    },
    // Initialize from storage (called on app start)
    initialize: () => {
      const storedState = getInitialState();
      set(storedState);
    }
  };
}

export const authStore = createAuthStore();