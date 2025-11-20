import { authStore } from './auth.js';
import { showSuccess } from '../../common/js/toastStore.js';

/**
 * Simulate API call with delay
 * @param {number} delay - Delay in milliseconds
 * @returns {Promise} Promise that resolves after delay
 */
const simulateAPICall = (delay) => {
  return new Promise(resolve => setTimeout(resolve, delay));
};

/**
 * Detect if the user is on a mobile device
 * @returns {boolean} True if the device is a mobile device
 */
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  
  // Check user agent for mobile devices
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // Common mobile device patterns
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  
  // Check user agent
  if (mobileRegex.test(userAgent)) {
    return true;
  }
  
  // Check screen width (mobile devices typically have smaller screens)
  // This is a fallback check
  if (window.innerWidth <= 768) {
    // Additional check: touch support (most mobile devices have touch)
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      return true;
    }
  }
  
  return false;
};

// Predefined test accounts
const testAccounts = {
  'student@school.edu': {
    password: 'student123',
    userType: 'student',
    userData: {
      name: 'John Student',
      id: '2024-001234',
      email: 'student@school.edu',
      profileImage: null
    }
  },
  'teacher@school.edu': {
    password: 'teacher123',
    userType: 'teacher',
    userData: {
      name: 'Jane Teacher',
      id: 'TEACH-001',
      email: 'teacher@school.edu',
      profileImage: null
    }
  },
  'admin@school.edu': {
    password: 'admin123',
    userType: 'admin',
    userData: {
      name: 'System Admin',
      id: 'ADM001',
      email: 'admin@school.edu',
      profileImage: null
    }
  }
};

/**
 * Handle user login
 * @param {Object} loginData - Login data object
 * @param {string} loginData.accountNumber - User account number
 * @param {string} loginData.password - User password  
 * @returns {Promise<Object>} Promise that resolves with user data or rejects with error
 */
export const handleLogin = async ({ accountNumber, password }) => {
  try {
    // Make API call to authenticate with account number
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ accountNumber, password })
    });

    const data = await response.json();

    if (data.success) {
      // Check if admin is trying to access from mobile device
      if (data.user.accountType === 'admin' && isMobileDevice()) {
        const error = new Error('Admin access is restricted to desktop devices only. Please use a PC to access the admin portal.');
        throw error;
      }
      
      // Store user data in localStorage
      const userData = {
        id: data.user.id,
        name: data.user.name,
        firstName: data.user.firstName,
        gender: data.user.gender,
        accountNumber: data.user.accountNumber,
        accountType: data.user.accountType,
        isAuthenticated: true
      };
      
      // Update auth store with the user type and data
      authStore.login(userData.accountType, userData);
      
      // Show success message
      showSuccess(`Login successful! Welcome back, ${userData.name}`);
      
      console.log('Login successful:', { accountNumber, userType: userData.accountType });
      
      return userData;
    } else {
      // Create error object with additional properties
      const error = new Error(data.error || 'Invalid credentials. Please try again.');
      error.attemptsLeft = data.attemptsLeft;
      error.isLocked = data.isLocked;
      throw error;
    }
  } catch (error) {
    // Check if it's a network/fetch error
    if (error.message === 'Failed to fetch' || error instanceof TypeError) {
      throw new Error('Connection failed. Please check your internet connection and try again.');
    }
    
    // Preserve error properties if they exist
    const enhancedError = new Error(error.message || 'Network error. Please try again.');
    if (error.attemptsLeft !== undefined) enhancedError.attemptsLeft = error.attemptsLeft;
    if (error.isLocked !== undefined) enhancedError.isLocked = error.isLocked;
    
    throw enhancedError;
  }
};

/**
 * Create form submission handler
 * @param {Object} formState - Form state object containing accountNumber, password, etc.
 * @param {Function} setErrors - Function to set form errors
 * @param {Function} setLoading - Function to set loading state
 * @param {Function} validateAccountNumber - Account number validation function
 * @param {Function} validatePassword - Password validation function
 * @returns {Function} Form submit handler function
 */
export const createSubmitHandler = (formState, setErrors, setLoading, validateAccountNumber, validatePassword) => {
  return async (event) => {
    event.preventDefault();
    
    const { accountNumber, password, userType } = formState;
    
    // Reset errors
    setErrors({ accountNumber: '', password: '', general: '' });
    
    // Validate inputs
    const accountNumberError = validateAccountNumber(accountNumber);
    const passwordError = validatePassword(password);
    
    if (accountNumberError || passwordError) {
      setErrors({ accountNumber: accountNumberError, password: passwordError, general: '' });
      return;
    }
    
    setLoading(true);
    
    try {
      await handleLogin({ accountNumber, password, userType });
    } catch (error) {
      setErrors(prev => ({ ...prev, general: error.message }));
    } finally {
      setLoading(false);
    }
  };
};
