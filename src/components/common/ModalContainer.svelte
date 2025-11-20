<script>
  import { modalStore } from './js/modalStore.js';
  import Modal from './Modal.svelte';
  import DocumentRequestModal from '../users/admin/sections/adminDocumentRequests/adminDocumentRequestModal/AdminDocumentRequestModal.svelte';

  // Subscribe to modal store
  let modals = $state([]);
  
  // Subscribe to store updates
  modalStore.subscribe(value => {
    modals = value;
  });

  // Handle modal close
  function handleModalClose(modalId) {
    modalStore.close(modalId);
  }

  // Dynamic component resolver
  function resolveComponent(componentName) {
    // This is a placeholder - in a real implementation, you'd have a registry
    // of components or use dynamic imports
    switch (componentName) {
      case 'ConfirmModal':
        return null; // Would import ConfirmModal component
      case 'AlertModal':
        return null; // Would import AlertModal component
      case 'PromptModal':
        return null; // Would import PromptModal component
      case 'DocumentRequestModal':
        return DocumentRequestModal;
      default:
        return componentName; // Assume it's already a component
    }
  }
</script>

<!-- Render all active modals -->
{#each modals as modal (modal.id)}
  <Modal 
    title={modal.props.title || ''}
    size={modal.options.size || 'medium'}
    closable={modal.options.closable !== false}
    backdrop={modal.options.backdrop !== false}
    onClose={() => handleModalClose(modal.id)}
  >
    <!-- Dynamic content based on modal type -->
    {#if typeof modal.component === 'string'}
      <!-- Handle string-based component names -->
      {#if modal.component === 'ConfirmModal'}
        <div class="modal-confirm-content">
          <div class="modal-message" class:danger-message={modal.props.variant === 'danger'}>{@html modal.props.message}</div>
          <div class="modal-actions">
            <button 
              class="modal-btn modal-btn-secondary" 
              onclick={() => {
                if (modal.props.onCancel) modal.props.onCancel();
                handleModalClose(modal.id);
              }}
            >
              Cancel
            </button>
            <button 
              class="modal-btn {modal.props.variant === 'danger' ? 'modal-btn-danger' : 'modal-btn-primary'}" 
              onclick={() => {
                if (modal.props.onConfirm) modal.props.onConfirm();
                handleModalClose(modal.id);
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      {:else if modal.component === 'AlertModal'}
        <div class="modal-alert-content">
          <p class="modal-message">{modal.props.message}</p>
          <div class="modal-actions">
            <button 
              class="modal-btn modal-btn-primary" 
              onclick={() => {
                if (modal.props.onClose) modal.props.onClose();
                handleModalClose(modal.id);
              }}
            >
              OK
            </button>
          </div>
        </div>
      {:else if modal.component === 'PromptModal'}
        <div class="modal-prompt-content">
          <p class="modal-message">{modal.props.message}</p>
          <input 
            type="text" 
            class="modal-input" 
            placeholder={modal.props.placeholder || "Enter value..."}
            bind:value={modal.props.inputValue}
          />
          <div class="modal-actions">
            <button 
              class="modal-btn modal-btn-secondary" 
              onclick={() => {
                if (modal.props.onCancel) modal.props.onCancel();
                handleModalClose(modal.id);
              }}
            >
              Cancel
            </button>
            <button 
              class="modal-btn modal-btn-primary" 
              onclick={() => {
                if (modal.props.onSubmit) modal.props.onSubmit(modal.props.inputValue || modal.props.defaultValue || '');
                handleModalClose(modal.id);
              }}
            >
              Submit
            </button>
          </div>
        </div>
      {:else if modal.component === 'FormModal'}
        <div class="modal-form-content">
          <p class="modal-message">{modal.props.message}</p>
          <div class="modal-form-fields">
            <div class="modal-form-group">
              <label for="formField1" class="modal-form-label">{modal.props.field1Label || 'Field 1'}</label>
              <input 
                type={modal.props.field1Type || 'text'}
                id="formField1"
                class="modal-input" 
                class:modal-input-disabled={modal.props.field1Disabled}
                placeholder={modal.props.field1Placeholder || "Enter value..."}
                bind:value={modal.props.field1Value}
                min={modal.props.field1Min}
                max={modal.props.field1Max}
                disabled={modal.props.field1Disabled}
                title={modal.props.field1Disabled ? modal.props.field1DisabledReason : ''}
              />
            </div>
            <div class="modal-form-group">
              <label for="formField2" class="modal-form-label">{modal.props.field2Label || 'Field 2'}</label>
              <input 
                type={modal.props.field2Type || 'text'}
                id="formField2"
                class="modal-input" 
                class:modal-input-disabled={modal.props.field2Disabled}
                placeholder={modal.props.field2Placeholder || "Enter value..."}
                bind:value={modal.props.field2Value}
                min={modal.props.field2Min}
                max={modal.props.field2Max}
                disabled={modal.props.field2Disabled}
                title={modal.props.field2Disabled ? modal.props.field2DisabledReason : ''}
              />
            </div>
          </div>
          <div class="modal-actions">
            <button 
              class="modal-btn modal-btn-secondary" 
              onclick={() => {
                if (modal.props.onCancel) modal.props.onCancel();
                handleModalClose(modal.id);
              }}
            >
              Cancel
            </button>
            <button 
              class="modal-btn modal-btn-danger" 
              disabled={modal.props.deleteDisabled}
              title={modal.props.deleteDisabled ? modal.props.deleteDisabledReason : 'Delete this column'}
              onclick={() => {
                if (modal.props.onDelete && !modal.props.deleteDisabled) modal.props.onDelete();
                handleModalClose(modal.id);
              }}
            >
              Delete
            </button>
            <button 
              class="modal-btn modal-btn-primary" 
              onclick={() => {
                if (modal.props.onSubmit) modal.props.onSubmit(modal.props.field1Value, modal.props.field2Value);
                handleModalClose(modal.id);
              }}
            >
              Update
            </button>
          </div>
        </div>
      {:else if modal.component === 'DocumentRequestModal'}
        <DocumentRequestModal 
          {...modal.props}
          onClose={() => handleModalClose(modal.id)}
        />
      {:else if modal.component === 'CustomModal'}
        <div class="modal-custom-content">
          {@html modal.props.content}
        </div>
      {:else}
        <!-- Fallback for unknown string components -->
        <div class="modal-generic-content">
          <p>Component '{modal.component}' not found</p>
        </div>
      {/if}
    {:else}
      <!-- Handle Svelte component instances -->
      {@const Component = modal.component}
      <Component {...modal.props} onClose={() => handleModalClose(modal.id)} />
    {/if}
  </Modal>
{/each}

<style>
  /* Modal content styles */
  .modal-confirm-content,
  .modal-alert-content,
  .modal-prompt-content,
  .modal-form-content,
  .modal-custom-content,
  .modal-generic-content {
    display: flex;
    flex-direction: column;
  }

  .modal-form-fields {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    margin: var(--spacing-md) 0;
  }

  .modal-form-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .modal-form-label {
    font-family: var(--md-sys-typescale-body-medium-font);
    font-size: var(--md-sys-typescale-body-medium-size);
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
  }

  .modal-message {
    margin: 0;
    font-family: var(--md-sys-typescale-body-large-font);
    font-size: var(--md-sys-typescale-body-large-size);
    color: var(--md-sys-color-on-surface);
    line-height: 1.6;
    max-width: none;
    word-wrap: break-word;
  }

  /* Danger variant for modal message */
  .danger-message {
    font-weight: 700;
    color: var(--md-sys-color-error);
  }

  /* Enhanced styling for HTML content in messages */
  .modal-message :global(p) {
    margin: 0 0 12px 0;
  }

  .modal-message :global(p:last-child) {
    margin-bottom: 0;
  }

  .modal-message :global(strong) {
    font-weight: 600;
  }

  .modal-message :global(div) {
    margin: 8px 0;
  }

  .modal-input {
    padding: var(--spacing-md);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    background-color: var(--md-sys-color-surface-container);
    color: var(--md-sys-color-on-surface);
    font-family: var(--md-sys-typescale-body-medium-font);
    font-size: var(--md-sys-typescale-body-medium-size);
    transition: border-color var(--transition-fast);
  }

  .modal-input:focus {
    outline: none;
    border-color: var(--md-sys-color-primary);
  }

  /* Disabled input styling */
  .modal-input:disabled,
  .modal-input-disabled {
    background-color: var(--md-sys-color-surface-container-low);
    color: var(--md-sys-color-on-surface-variant);
    cursor: not-allowed;
    opacity: 0.6;
    border: 2px solid var(--md-sys-color-outline-variant);
  }

  .modal-input:disabled::placeholder,
  .modal-input-disabled::placeholder {
    color: var(--md-sys-color-on-surface-variant);
    opacity: 0.5;
  }

  .modal-actions {
    display: flex;
    gap: var(--spacing-md);
    justify-content: flex-end;
    margin-top: var(--spacing-md);
    padding: var(--spacing-md);
  }

  .modal-btn {
    padding: var(--spacing-sm) var(--spacing-lg);
    border: none;
    border-radius: var(--radius-md);
    font-family: var(--md-sys-typescale-label-large-font);
    font-size: var(--md-sys-typescale-label-large-size);
    font-weight: var(--md-sys-typescale-label-large-weight);
    cursor: pointer;
    transition: background-color var(--transition-fast), box-shadow var(--transition-fast);
    min-width: 80px;
  }

  .modal-btn-primary {
    background-color: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
    border: 1px solid var(--md-sys-color-primary);
  }

  .modal-btn-primary:hover {
    background-color: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
    box-shadow: var(--shadow-sm);
  }

  .modal-btn-secondary {
    background-color: var(--md-sys-color-surface-container-high);
    color: var(--md-sys-color-on-surface);
    border: 1px solid var(--md-sys-color-outline-variant);
  }

  .modal-btn-secondary:hover {
    background-color: var(--md-sys-color-surface-container-highest);
    box-shadow: var(--shadow-sm);
  }

  .modal-btn-danger {
    background-color: var(--md-sys-color-error);
    color: var(--md-sys-color-on-error);
    border: 1px solid var(--md-sys-color-error);
  }

  .modal-btn-danger:hover:not(:disabled) {
    background-color: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
    box-shadow: var(--shadow-sm);
  }

  .modal-btn-danger:disabled {
    background-color: var(--md-sys-color-surface-variant);
    color: var(--md-sys-color-on-surface-variant);
    border: 1px solid var(--md-sys-color-outline-variant);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .modal-btn:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {

    .modal-btn {
      width: 100%;
    }
  }
</style>