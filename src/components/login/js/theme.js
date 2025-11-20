/**
 * Theme management utilities
 */

/**
 * Get the current theme from the document
 * @returns {string} Current theme ('dark' or 'light')
 */
export const getCurrentTheme = () => {
  return document.documentElement.getAttribute('data-theme') || 'light';
};

/**
 * Set theme on document and save to localStorage
 * @param {string} theme - Theme to set ('dark' or 'light')
 */
export const setTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
};

/**
 * Toggle between dark and light themes
 * @returns {string} New theme after toggle
 */
export const toggleTheme = () => {
  const currentTheme = getCurrentTheme();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
  return newTheme;
};

/**
 * Initialize theme from localStorage or system preference
 * @returns {string} Initialized theme
 */
export const initializeTheme = () => {
  const savedTheme = localStorage.getItem('theme');
  
  if (savedTheme) {
    setTheme(savedTheme);
    return savedTheme;
  }
  
  // Check system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const systemTheme = prefersDark ? 'dark' : 'light';
  setTheme(systemTheme);
  return systemTheme;
};
