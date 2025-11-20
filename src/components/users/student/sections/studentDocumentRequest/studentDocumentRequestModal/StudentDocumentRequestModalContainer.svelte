<script>
	import { onMount } from 'svelte';
	import { studentDocReqModalStore } from './studentDocReqModalStore.js';
	import StudentDocumentRequestModal from './StudentDocumentRequestModal.svelte';

	// Subscribe to modal store
	let modalState = $state({
		isOpen: false,
		request: null,
		onCancel: null,
		onRefresh: null
	});

	studentDocReqModalStore.subscribe((value) => {
		modalState = value;
	});

	// Animation states
	let visible = $state(false);
	let closing = $state(false);
	let modalElement = $state(null);

	// Watch for modal open/close
	$effect(() => {
		if (modalState.isOpen && !visible && !closing) {
			// Opening modal
			setTimeout(() => {
				visible = true;
			}, 10);
			document.body.style.overflow = 'hidden';
		} else if (!modalState.isOpen && (visible || closing)) {
			// Closing modal
			handleClose();
		}
	});

	// Close modal with animation
	function handleClose() {
		closing = true;
		setTimeout(() => {
			visible = false;
			closing = false;
			document.body.style.overflow = '';
		}, 300);
	}

	// Handle backdrop click
	function handleBackdropClick(event) {
		if (event.target === event.currentTarget) {
			studentDocReqModalStore.close();
		}
	}

	// Handle escape key
	function handleKeydown(event) {
		if (event.key === 'Escape' && modalState.isOpen) {
			studentDocReqModalStore.close();
		}
	}

	// Cleanup on component unmount
	onMount(() => {
		return () => {
			document.body.style.overflow = '';
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if modalState.isOpen || visible || closing}
	<div
		class="student-docreq-modal-overlay"
		class:student-docreq-modal-visible={visible && !closing}
		class:student-docreq-modal-closing={closing}
		onclick={handleBackdropClick}
		onkeydown={(e) => e.key === 'Enter' && handleBackdropClick(e)}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		bind:this={modalElement}
	>
		<StudentDocumentRequestModal
			request={modalState.request}
			onCancel={modalState.onCancel}
			onRefresh={modalState.onRefresh}
			onClose={() => studentDocReqModalStore.close()}
		/>
	</div>
{/if}

<style>
	.student-docreq-modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
		opacity: 0;
		transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		padding: var(--spacing-lg);
	}

	.student-docreq-modal-visible {
		opacity: 1;
	}

	.student-docreq-modal-closing {
		opacity: 0;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.student-docreq-modal-overlay {
			padding: var(--spacing-md);
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.student-docreq-modal-overlay {
			transition: none;
		}
	}
</style>

