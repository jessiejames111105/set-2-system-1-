import { writable } from 'svelte/store';

// Toast store to manage notifications globally
function createToastStore() {
  const { subscribe, update } = writable([]);

  return {
    subscribe,
    // Add a new toast
    add: (message, type = 'success', duration = 3000) => {
      const id = Date.now() + Math.random();
      const toast = {
        id,
        message,
        type,
        duration
      };
      
      // Check for duplicate messages of the same type
      let shouldAdd = true;
      update(toasts => {
        const duplicateExists = toasts.some(t => t.message === message && t.type === type);
        if (duplicateExists) {
          shouldAdd = false;
          return toasts; // Don't add duplicate
        }
        return [...toasts, toast];
      });
      
      if (!shouldAdd) {
        return null; // Return null if duplicate was prevented
      }
      
      // Auto-remove toast after duration
      if (duration > 0) {
        setTimeout(() => {
          // Trigger the hiding animation first, then remove after animation completes
          setTimeout(() => {
            update(toasts => toasts.filter(t => t.id !== id));
          }, 300); // Match the slideOutBounce animation duration
        }, duration);
      }
      
      return id;
    },
    // Remove a specific toast
    remove: (id) => {
      update(toasts => toasts.filter(t => t.id !== id));
    },
    // Clear all toasts
    clear: () => {
      update(() => []);
    },
    // Convenience methods
    success: (message, duration = 3000) => {
      return toastStore.add(message, 'success', duration);
    },
    error: (message, duration = 4000) => {
      return toastStore.add(message, 'error', duration);
    },
    warning: (message, duration = 3500) => {
      return toastStore.add(message, 'warning', duration);
    },
    info: (message, duration = 3000) => {
      return toastStore.add(message, 'info', duration);
    }
  };
}

export const toastStore = createToastStore();

// Convenience functions for easy import
export const showToast = toastStore.add;
export const showSuccess = (message, duration) => toastStore.add(message, 'success', duration);
export const showError = (message, duration) => toastStore.add(message, 'error', duration);
export const showWarning = (message, duration) => toastStore.add(message, 'warning', duration);
export const showInfo = (message, duration) => toastStore.add(message, 'info', duration);