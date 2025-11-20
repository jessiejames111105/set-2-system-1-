<script>
  import { toastStore } from './js/toastStore.js';
  import Toast from './Toast.svelte';

  // Subscribe to toast store
  let toasts = $state([]);
  
  // Subscribe to store updates
  toastStore.subscribe(value => {
    toasts = value;
  });

  // Handle toast close
  function handleToastClose(toastId) {
    // Add a small delay to allow the exit animation to complete
    setTimeout(() => {
      toastStore.remove(toastId);
    }, 300); // Match the slideOutBounce animation duration
  }
</script>

<div class="toast-container">
  {#each toasts as toast (toast.id)}
    <Toast 
      message={toast.message} 
      type={toast.type} 
      duration={toast.duration}
      onClose={() => handleToastClose(toast.id)}
    />
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: var(--spacing-lg);
    right: var(--spacing-lg);
    z-index: 10001;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    pointer-events: none;
  }

  .toast-container :global(.toast) {
    pointer-events: auto;
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .toast-container {
      top: var(--spacing-md);
      bottom: auto;
      left: var(--spacing-md);
      right: var(--spacing-md);
    }
  }
</style>