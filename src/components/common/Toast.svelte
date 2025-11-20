<script>
  import { onMount } from 'svelte';

  // Props
  let { message = '', type = 'success', duration = 3000, onClose } = $props();

  // State
  let visible = $state(true);
  let hiding = $state(false);
  let timeoutId;

  // Auto-hide toast after duration
  onMount(() => {
    if (duration > 0) {
      timeoutId = setTimeout(() => {
        hideToast();
      }, duration);
    }

    // Cleanup timeout on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  });

  // Hide toast with animation
  function hideToast() {
    hiding = true;
    setTimeout(() => {
      visible = false;
      if (onClose) onClose();
    }, 300); // Match the slideOutBounce animation duration (was 1000ms)
  }

  // Get icon based on type
  function getIcon(type) {
    switch (type) {
      case 'success':
        return 'check_circle';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'check_circle';
    }
  }
</script>

{#if visible}
  <div class="toast toast-{type}" class:toast-visible={visible && !hiding} class:toast-hiding={hiding}>
    <div class="toast-content">
      <span class="material-symbols-outlined toast-icon">
        {getIcon(type)}
      </span>
      <span class="toast-message">{message}</span>
      <button class="toast-close" onclick={hideToast} aria-label="Close notification">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
  </div>
{/if}

<style>
  .toast {
    position: relative;
    z-index: 10001;
    min-width: 300px;
    max-width: 500px;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    opacity: 0;
    transform: translateX(calc(100% + var(--spacing-lg))) scale(0.95);
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    animation: slideInBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  .toast-visible {
    opacity: 1;
    transform: translateX(0) scale(1);
  }

  @keyframes slideInBounce {
    0% {
      opacity: 0;
      transform: translateX(calc(100% + var(--spacing-lg))) scale(0.8) rotateY(90deg);
    }
    50% {
      opacity: 0.8;
      transform: translateX(-10px) scale(1.02) rotateY(0deg);
    }
    100% {
      opacity: 1;
      transform: translateX(0) scale(1) rotateY(0deg);
    }
  }

  @keyframes slideOutBounce {
    0% {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
    30% {
      opacity: 0.7;
      transform: translateX(-5px) scale(0.98);
    }
    100% {
      opacity: 0;
      transform: translateX(calc(100% + var(--spacing-lg))) scale(0.9);
    }
  }

  .toast.toast-hiding {
    animation: slideOutBounce 0.3s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards;
  }

  /* Mobile slide down animations */
  @keyframes slideDownIn {
    0% {
      opacity: 0;
      transform: translateY(-100%) scale(0.95);
    }
    50% {
      opacity: 0.8;
      transform: translateY(10px) scale(1.02);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes slideDownOut {
    0% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    30% {
      opacity: 0.7;
      transform: translateY(-5px) scale(0.98);
    }
    100% {
      opacity: 0;
      transform: translateY(-100%) scale(0.9);
    }
  }

  .toast-success {
    background-color: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }

  .toast-error {
    background-color: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
  }

  .toast-warning {
    background-color: var(--md-sys-color-primary-container);
        color: var(--md-sys-color-on-primary-container);
  }

  .toast-info {
    background-color: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
  }

  .toast-content {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
  }

  .toast-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .toast-message {
    flex: 1;
    font-family: var(--md-sys-typescale-body-medium-font);
    font-size: var(--md-sys-typescale-body-medium-size);
    font-weight: 500;
  }

  .toast-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: background-color var(--transition-fast);
    flex-shrink: 0;
  }

  .toast-close:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }

  .toast-close .material-symbols-outlined {
    font-size: 16px;
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .toast {
      min-width: auto;
      max-width: none;
      transform: translateY(-100%) scale(0.95);
      animation: slideDownIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    .toast.toast-hiding {
      animation: slideDownOut 0.2s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards;
    }

    .toast-visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>