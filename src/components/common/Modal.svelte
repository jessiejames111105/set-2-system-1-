<script>
  import { onMount, createEventDispatcher } from 'svelte';

  // Props
  let { 
    title = '', 
    size = 'medium', 
    closable = true, 
    backdrop = true,
    onClose,
    children
  } = $props();

  // State
  let visible = $state(false);
  let closing = $state(false);
  let modalElement = $state();
  
  const dispatch = createEventDispatcher();

  // Show modal with animation
  onMount(() => {
    // Small delay to trigger entrance animation
    setTimeout(() => {
      visible = true;
    }, 10);

    // Focus management
    if (modalElement) {
      modalElement.focus();
    }

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
    };
  });

  // Close modal with animation
  function closeModal() {
    if (!closable) return;
    
    closing = true;
    setTimeout(() => {
      visible = false;
      document.body.style.overflow = '';
      if (onClose) onClose();
      dispatch('close');
    }, 300); // Match the fadeOut animation duration
  }

  // Handle backdrop click
  function handleBackdropClick(event) {
    if (backdrop && event.target === event.currentTarget) {
      closeModal();
    }
  }

  // Handle escape key
  function handleKeydown(event) {
    if (event.key === 'Escape' && closable) {
      closeModal();
    }
  }

  // Get modal size class
  function getSizeClass(size) {
    switch (size) {
      case 'small':
        return 'modal-small';
      case 'large':
        return 'modal-large';
      case 'xlarge':
        return 'modal-xlarge';
      case 'full':
        return 'modal-full';
      default:
        return 'modal-medium';
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible || closing}
  <div 
    class="modal-overlay" 
    class:modal-visible={visible && !closing} 
    class:modal-closing={closing}
    onclick={handleBackdropClick}
    onkeydown={handleBackdropClick}
    role="presentation"
  >
    <div 
      class="modal-content {getSizeClass(size)}"
      bind:this={modalElement}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      tabindex="-1"
    >
      {#if title || closable}
        <div class="modal-header">
          {#if title}
            <h2 id="modal-title" class="modal-title">{title}</h2>
          {/if}
          {#if closable}
            <button 
              class="modal-close-btn" 
              onclick={closeModal}
              aria-label="Close modal"
            >
              <span class="material-symbols-outlined">close</span>
            </button>
          {/if}
        </div>
      {/if}
      
      <div class="modal-body">
        {@render children()}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    padding: var(--spacing-lg);
  }

  .modal-visible {
    opacity: 1;
  }

  .modal-closing {
    opacity: 0;
  }

  .modal-content {
    background-color: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transform: scale(0.8) translateY(30px);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-out;
    opacity: 0;
  }

  .modal-visible .modal-content {
    transform: scale(1) translateY(0);
    opacity: 1;
  }

  .modal-closing .modal-content {
    transform: scale(0.8) translateY(30px);
    opacity: 0;
  }

  /* Modal sizes */
  .modal-small {
    width: 100%;
    max-width: 500px;
  }

  .modal-medium {
    width: 100%;
    max-width: 600px;
  }

  .modal-large {
    width: 100%;
    max-width: 900px;
  }

  .modal-xlarge {
    width: 100%;
    max-width: 1400px;
  }

  .modal-full {
    width: 95vw;
    height: 95vh;
    max-width: none;
    max-height: none;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    background-color: var(--md-sys-color-surface-container);
  }

  .modal-title {
    margin: 0;
    font-family: var(--md-sys-typescale-headline-small-font);
    font-size: var(--md-sys-typescale-headline-small-size);
    font-weight: var(--md-sys-typescale-headline-small-weight);
    color: var(--md-sys-color-on-surface);
  }

  .modal-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    background: none;
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: background-color var(--transition-fast);
  }

  .modal-close-btn:hover {
    background-color: var(--md-sys-color-surface-container-highest);
  }

  .modal-close-btn:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .modal-close-btn .material-symbols-outlined {
    font-size: 20px;
  }

  .modal-body {
    padding: var(--spacing-md);
    overflow-y: auto;
    flex: 1;
    color: var(--md-sys-color-on-surface);
    background-color: var(--md-sys-color-surface);
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .modal-overlay {
      padding: var(--spacing-md);
    }

    .modal-small,
    .modal-medium,
    .modal-large,
    .modal-xlarge {
      width: 100%;
      max-width: none;
    }

    .modal-full {
      width: 100vw;
      height: 100vh;
      border-radius: 0;
    }

    .modal-header {
      padding: var(--spacing-md);
    }

    .modal-body {
      padding: var(--spacing-md);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .modal-overlay,
    .modal-content {
      transition: none;
    }
  }
</style>