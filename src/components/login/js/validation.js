/**
 * ID Number validation function
 * @param {string} idNumber - ID Number to validate
 * @returns {string} Error message or empty string if valid
 */
export const validateIdNumber = (idNumber) => {
  // Pattern for account numbers like STU-2025-0001, FAC-2025-0001, etc.
  const idNumberRegex = /^[A-Z]{3}-\d{4}-\d{4}$/;
  if (!idNumber) return 'ID Number is required';
  if (!idNumberRegex.test(idNumber)) return 'Please enter a valid ID Number (e.g., STU-2025-0001)';
  return '';
};

/**
 * Password validation function
 * @param {string} password - Password to validate
 * @returns {string} Error message or empty string if valid
 */
export const validatePassword = (password) => {
  if (!password) return 'Password is required';
  return '';
};

/**
 * Generic field validation
 * @param {string} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @param {Object} rules - Validation rules object
 * @returns {string} Error message or empty string if valid
 */
export const validateField = (value, fieldName, rules = {}) => {
  if (rules.required && !value) {
    return `${fieldName} is required`;
  }
  
  if (rules.minLength && value.length < rules.minLength) {
    return `${fieldName} must be at least ${rules.minLength} characters long`;
  }
  
  if (rules.maxLength && value.length > rules.maxLength) {
    return `${fieldName} must be no more than ${rules.maxLength} characters long`;
  }
  
  if (rules.pattern && !rules.pattern.test(value)) {
    return rules.patternMessage || `${fieldName} format is invalid`;
  }
  
  return '';
};
