import { writable } from 'svelte/store';

// Modal store to manage modals globally
function createModalStore() {
  const { subscribe, update } = writable([]);

  return {
    subscribe,
    // Open a new modal
    open: (component, props = {}, options = {}) => {
      const id = Date.now() + Math.random();
      const modal = {
        id,
        component,
        props,
        options: {
          closable: true,
          backdrop: true,
          size: 'medium',
          ...options
        }
      };
      
      update(modals => [...modals, modal]);
      
      return id;
    },
    // Close a specific modal
    close: (id) => {
      update(modals => modals.filter(m => m.id !== id));
    },
    // Close the topmost modal
    closeTop: () => {
      update(modals => {
        if (modals.length > 0) {
          return modals.slice(0, -1);
        }
        return modals;
      });
    },
    // Close all modals
    closeAll: () => {
      update(() => []);
    },
    // Convenience methods for different modal types
    confirm: (title, message, onConfirm, onCancel, options = {}) => {
      return modalStore.open('ConfirmModal', {
        title,
        message,
        onConfirm,
        onCancel,
        onDelete: options.onDelete,
        deleteText: options.deleteText,
        variant: options.variant || 'default' // 'default' or 'danger'
      }, {
        size: options.size || 'small',
        closable: options.closable !== false
      });
    },
    // Large confirm modal for complex content
    confirmLarge: (title, message, onConfirm, onCancel) => {
      return modalStore.open('ConfirmModal', {
        title,
        message,
        onConfirm,
        onCancel
      }, {
        size: 'large',
        closable: false
      });
    },
    alert: (title, message, onClose) => {
      return modalStore.open('AlertModal', {
        title,
        message,
        onClose
      }, {
        size: 'small'
      });
    },
    prompt: (title, message, placeholder = '', onSubmit, onCancel) => {
      return modalStore.open('PromptModal', {
        title,
        message,
        placeholder,
        defaultValue: '',
        inputValue: '',
        onSubmit,
        onCancel
      }, {
        size: 'medium'
      });
    },
    // Form modal with two input fields
    form: (title, message, field1Config, field2Config, onSubmit, onCancel, onDelete, options = {}) => {
      return modalStore.open('FormModal', {
        title,
        message,
        field1Label: field1Config.label || 'Field 1',
        field1Type: field1Config.type || 'text',
        field1Placeholder: field1Config.placeholder || 'Enter value...',
        field1Value: field1Config.value || '',
        field1Min: field1Config.min,
        field1Max: field1Config.max,
        field1Disabled: field1Config.disabled || false,
        field1DisabledReason: field1Config.disabledReason || '',
        field2Label: field2Config.label || 'Field 2',
        field2Type: field2Config.type || 'text',
        field2Placeholder: field2Config.placeholder || 'Enter value...',
        field2Value: field2Config.value || '',
        field2Min: field2Config.min,
        field2Max: field2Config.max,
        field2Disabled: field2Config.disabled || false,
        field2DisabledReason: field2Config.disabledReason || '',
        onSubmit,
        onCancel,
        onDelete,
        deleteDisabled: options.deleteDisabled || false,
        deleteDisabledReason: options.deleteDisabledReason || ''
      }, {
        size: options.size || 'medium',
        closable: options.closable !== false
      });
    }
  };
}

export const modalStore = createModalStore();