<script>
	import { onMount, onDestroy } from 'svelte';
	import { authStore } from '../../../../login/js/auth.js';
	import { api } from '../../../../../routes/api/helper/api-helper.js';
	import { modalStore } from '../../../../common/js/modalStore.js';
	import { toastStore } from '../../../../common/js/toastStore.js';
	import { studentDocReqModalStore } from './studentDocumentRequestModal/studentDocReqModalStore.js';
	import { studentDocumentRequestStore } from '../../../../../lib/stores/student/studentDocumentRequestStore.js';
	import './studentDocumentRequest.css';

	// Props - request ID to open from notification
	let { openRequestId = $bindable(null) } = $props();

	// Document request state
	let isRequestFormOpen = $state(false);
	let selectedDocumentType = $state('');
	let selectedQuantity = $state(1);
	let requestPurpose = $state('');
	let isSubmitting = $state(false);
	
	// Custom dropdown state
	let isDropdownOpen = $state(false);
	let isQuantityDropdownOpen = $state(false);

	// Quantity options (1-3)
	const quantityOptions = Array.from({ length: 3 }, (_, i) => i + 1);

	// Calculate total price
	let totalPrice = $derived.by(() => {
		if (!selectedDocumentType) return 0;
		const docType = documentTypes.find(d => d.id === selectedDocumentType);
		if (!docType) return 0;
		
		const isFirstTimeRequest = !isDocumentTypeRequested(selectedDocumentType);
		
		// First-time requests: only the first copy is free, additional copies are charged
		// Non-first-time requests: all copies are charged
		if (isFirstTimeRequest) {
			// First copy is free, additional copies are charged
			return docType.price * (selectedQuantity - 1);
		} else {
			// All copies are charged
			return docType.price * selectedQuantity;
		}
	});

	// Polling state
	let pollingInterval;

	// Subscribe to the store using $derived
	let requestHistory = $derived($studentDocumentRequestStore.requestHistory);
	let loading = $derived($studentDocumentRequestStore.isLoading);
	let isRefreshing = $derived($studentDocumentRequestStore.isRefreshing);
	let error = $derived($studentDocumentRequestStore.error);
	let lastUpdated = $derived($studentDocumentRequestStore.lastUpdated);

	// Close dropdown when clicking outside
	function handleClickOutside(event) {
		if (!event.target.closest('.custom-dropdown')) {
			isDropdownOpen = false;
		}
		if (!event.target.closest('.quantity-dropdown')) {
			isQuantityDropdownOpen = false;
		}
	}

	// Toggle dropdown
	function toggleDropdown() {
		isDropdownOpen = !isDropdownOpen;
	}

	// Select document type and close dropdown
	function selectDocumentType(docType) {
		selectedDocumentType = docType.id;
		isDropdownOpen = false;
	}

	// Toggle quantity dropdown
	function toggleQuantityDropdown() {
		isQuantityDropdownOpen = !isQuantityDropdownOpen;
	}

	// Select quantity and close dropdown
	function selectQuantity(quantity) {
		selectedQuantity = quantity;
		isQuantityDropdownOpen = false;
	}

	// Document types - aligned with admin system
	const documentTypes = [
		{ id: 'Transcript of Records', name: 'Transcript of Records', description: 'Official academic record', price: 300.00 },
		{ id: 'Enrollment Certificate', name: 'Enrollment Certificate', description: 'Proof of enrollment', price: 150.00 },
		{ id: 'Grade Report', name: 'Grade Report', description: 'Semester grade report', price: 50.00 },
		{ id: 'Diploma', name: 'Diploma', description: 'Official graduation certificate', price: 800.00 },
		{ id: 'Certificate', name: 'Certificate', description: 'Academic achievement certificate', price: 100.00 },
		{ id: 'Good Moral', name: 'Good Moral', description: 'Certificate of good moral character', price: 300.00 },
		{ id: 'Grade Slip', name: 'Grade Slip', description: 'Grade slip for specific period', price: 170.00 }
	];

	// Check if a document type has been requested before (not first time)
	function isDocumentTypeRequested(documentType) {
		if (!requestHistory || requestHistory.length === 0) return false;
		return requestHistory.some(req => 
			req.type === documentType && 
			['released', 'for_pickup', 'processing', 'verifying'].includes(req.status)
		);
	}

	// Check if a document type has an on-hold request
	function hasOnHoldRequest(documentType) {
		if (!requestHistory || requestHistory.length === 0) return false;
		return requestHistory.some(req => 
			req.type === documentType && 
			req.status === 'on_hold'
		);
	}

	// Handle refresh functionality
	async function handleRefresh() {
		const authState = $authStore;
		if (authState.isAuthenticated && authState.userData?.id) {
			await studentDocumentRequestStore.forceRefresh(authState.userData.id);
		}
	}

	// Load data when component mounts
	onMount(() => {
		const authState = $authStore;
		if (authState.isAuthenticated && authState.userData?.id) {
			// Initialize store with cached data if available
			const hasCachedData = studentDocumentRequestStore.init(authState.userData.id);
			
			// Load fresh data if no cache or load silently if cached
			studentDocumentRequestStore.loadDocumentRequests(hasCachedData);

			// Start polling for updates every 30 seconds (changed from 10 to reduce server load)
			pollingInterval = setInterval(() => {
				const currentAuthState = $authStore;
				if (currentAuthState.isAuthenticated && currentAuthState.userData?.id) {
					studentDocumentRequestStore.loadDocumentRequests(true); // Silent refresh
				}
			}, 30 * 1000); // 30 seconds
		}
	});

	// Watch for openRequestId changes and open modal when provided
	$effect(() => {
		if (openRequestId && requestHistory.length > 0) {
			// Find the request in the history
			const request = requestHistory.find(req => req.requestId === openRequestId);
			
			if (request) {
				// Open the modal for this request
				openRequestModal(request);
			}
			
			// Clear the openRequestId after attempting to open
			openRequestId = null;
		}
	});

	// Clean up polling on component destroy
	onDestroy(() => {
		if (pollingInterval) {
			clearInterval(pollingInterval);
		}
	});

	// Get status display name
	function getStatusDisplayName(status) {
		const statusNames = {
			'on_hold': 'On Hold',
			'verifying': 'Verifying',
			'processing': 'For Processing',
			'for_pickup': 'For Pick Up',
			'released': 'Released',
			'rejected': 'Rejected',
			'cancelled': 'Cancelled'
		};
		return statusNames[status] || status;
	}
	
	// Format date helper
	function formatDate(dateString) {
		if (!dateString) return 'N/A';
		const date = new Date(dateString);
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const year = date.getFullYear();
		return `${month}/${day}/${year}`;
	}

	// Submit new document request
	async function handleSubmitRequest() {
		if (!selectedDocumentType || !requestPurpose.trim()) return;

		try {
			isSubmitting = true;

			const docTypeName = documentTypes.find(d => d.id === selectedDocumentType)?.name;

			const result = await studentDocumentRequestStore.submitRequest(
				docTypeName || selectedDocumentType,
				requestPurpose,
				selectedQuantity
			);

			if (result.success) {
				// Close form and reset
				toggleRequestForm();
				
				// Show success toast notification
				toastStore.success('Document request submitted successfully');
			} else {
				toastStore.error(result.error || 'Failed to submit request');
			}
		} catch (err) {
			console.error('Error submitting request:', err);
			toastStore.error('Failed to submit document request');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleCancelRequest(request) {
		// Show confirmation modal before cancelling
		modalStore.confirm(
			'Cancel Document Request',
			`<p>Are you sure you want to cancel your request for <strong>"${request.type}"</strong>?</p>
			<p style="margin-top: 8px; color: var(--md-sys-color-on-surface-variant); font-size: 0.9rem;">This action cannot be undone. The request will be marked as cancelled.</p>`,
			async () => {
				try {
					const result = await studentDocumentRequestStore.cancelRequest(request.requestId);

					if (result.success) {
						toastStore.success('Document request cancelled successfully');
					} else {
						console.error('Failed to cancel request:', result.error);
						toastStore.error(result.error || 'Failed to cancel request');
					}
				} catch (err) {
					console.error('Error cancelling request:', err);
					toastStore.error('Failed to cancel request');
				}
			}
		);
	}

	function toggleRequestForm() {
		isRequestFormOpen = !isRequestFormOpen;
		if (!isRequestFormOpen) {
			// Reset form when closing
			selectedDocumentType = '';
			selectedQuantity = 1;
			requestPurpose = '';
			isDropdownOpen = false;
			isQuantityDropdownOpen = false;
		} else {
			// Scroll to form when opening
			setTimeout(() => {
				const formElement = document.querySelector('.request-form-section');
				if (formElement) {
					formElement.scrollIntoView({
						behavior: 'smooth',
						block: 'center'
					});
				}
			}, 100);
		}
	}


	function getStatusIcon(status) {
		switch (status) {
			case 'on_hold': return 'pause_circle';
			case 'verifying': return 'fact_check';
			case 'processing': return 'sync';
			case 'for_pickup': return 'hand_package';
			case 'released': return 'check_circle';
			case 'rejected': return 'cancel';
			case 'cancelled': return 'block';
			default: return 'help';
		}
	}

	// Get unread message count for a request
	function getUnreadMessageCount(request) {
		if (!request.messages || request.messages.length === 0) {
			return 0;
		}
		
		// If never read, all messages are unread
		if (!request.lastReadAt) {
			return request.messages.length;
		}
		
		// Count messages created after last read
		const lastReadTime = new Date(request.lastReadAt).getTime();
		return request.messages.filter(msg => {
			const messageTime = new Date(msg.created_at).getTime();
			return messageTime > lastReadTime;
		}).length;
	}

	// Open the details modal for a particular request
	async function openRequestModal(request) {
		try {
			// Fetch the full request details including latest messages
			const result = await studentDocumentRequestStore.getRequestDetails(request.requestId);
			
			if (result.success) {
				studentDocReqModalStore.open(
					result.data,
					handleCancelRequestInModal,
					() => studentDocumentRequestStore.loadDocumentRequests(false)
				);

				// Mark messages as read when modal is opened
				await studentDocumentRequestStore.markMessagesAsRead(request.requestId);
			} else {
				console.error('Failed to fetch request details:', result.error);
				toastStore.error('Failed to load request details. Please try again.');
			}
		} catch (error) {
			console.error('Error fetching request details:', error);
			toastStore.error('An error occurred while loading the request details.');
		}
	}

	// Handle cancel request from modal
	async function handleCancelRequestInModal(request) {
		try {
			const result = await studentDocumentRequestStore.cancelRequest(request.requestId);

			if (result.success) {
				toastStore.success('Document request cancelled successfully');
			} else {
				console.error('Failed to cancel request:', result.error);
				toastStore.error(result.error || 'Failed to cancel request');
			}
		} catch (err) {
			console.error('Error cancelling request:', err);
			toastStore.error('Failed to cancel request');
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="document-request-container" onclick={handleClickOutside} onkeydown={handleClickOutside}>
	<!-- Header Section -->
	<div class="document-header">
		<div class="header-content">
			<h1 class="page-title">Document Requests</h1>
			<p class="page-subtitle">Request new documents or check existing requests</p>
		</div>
	</div>

	<!-- Quick Actions Section -->
	<div class="quick-actions-section">
		<div class="quick-actions-header">
			<h2 class="quick-actions-title">Request a Document</h2>
			<div style="display: flex; gap: 8px;">
				<button class="request-new-button" onclick={toggleRequestForm} disabled={loading}>
					<span class="material-symbols-outlined">{isRequestFormOpen ? 'remove' : 'add'}</span>
					<span class="request-new-button-text">{isRequestFormOpen ? 'Cancel' : 'New Document'}</span>
				</button>
			</div>
		</div>
	</div>

	<!-- Inline Document Request Form -->
	{#if isRequestFormOpen}
		<div class="request-form-section">
			<div class="form-container">
				<div class="form-header">
					<h2 class="form-title">New Document Request</h2>
					<p class="form-subtitle">Fill out the form below to request a document</p>
				</div>
				
				<div class="form-content">
					<div class="student-form-row">
						<div class="student form-group">
							<label class="student-form-label" for="document-type-dropdown">
								<span class="material-symbols-outlined form-icon">description</span>
								Document Type
							</label>
							
							<!-- Custom Dropdown -->
							<div class="custom-dropdown">
								<button id="document-type-dropdown" class="dropdown-toggle" onclick={toggleDropdown}>
									<span>
										{#if selectedDocumentType}
											{documentTypes.find(d => d.id === selectedDocumentType)?.name || 'Select Document Type'}
										{:else}
											Choose the document
										{/if}
									</span>
									<span class="material-symbols-outlined dropdown-icon {isDropdownOpen ? 'open' : ''}">
										expand_more
									</span>
								</button>
								
							{#if isDropdownOpen}
								<div class="dropdown-menu-document">
									{#each documentTypes as docType}
										{@const isOnHold = hasOnHoldRequest(docType.id)}
										<button 
											class="doc-dropdown-item {docType.id === selectedDocumentType ? 'selected' : ''} {isOnHold ? 'disabled' : ''}"
											onclick={() => !isOnHold && selectDocumentType(docType)}
											disabled={isOnHold}
										>
											<div class="doc-dropdown-item-content">
												<div class="doc-dropdown-item-main">
													<span class="doc-dropdown-item-name">{docType.name}</span>
													<span class="doc-dropdown-item-desc">
														{#if isOnHold}
															Pending request exists
														{:else}
															{docType.description}
														{/if}
													</span>
												</div>
												{#if isOnHold}
													<span class="doc-dropdown-item-price on-hold-badge">
														<span class="material-symbols-outlined">schedule</span>
													</span>
												{:else if !isDocumentTypeRequested(docType.id)}
													<span class="doc-dropdown-item-price free-price">
														<span class="free-badge">1st copy FREE</span>
														<span class="original-price">₱{docType.price.toFixed(2)}/copy</span>
													</span>
												{:else}
													<span class="doc-dropdown-item-price">₱{docType.price.toFixed(2)}</span>
												{/if}
											</div>
										</button>
									{/each}
								</div>
							{/if}
							</div>
						</div>

						<!-- Quantity Dropdown -->
						<div class="form-group">
							<label class="student-form-label" for="quantity-dropdown">
								<span class="material-symbols-outlined form-icon">numbers</span>
								Quantity
							</label>
							
							<div class="quantity-dropdown">
								<button id="quantity-dropdown" class="dropdown-toggle quantity-toggle" onclick={toggleQuantityDropdown}>
									<span>{selectedQuantity} {selectedQuantity === 1 ? 'copy' : 'copies'}</span>
									<span class="material-symbols-outlined dropdown-icon {isQuantityDropdownOpen ? 'open' : ''}">
										expand_more
									</span>
								</button>
								
								{#if isQuantityDropdownOpen}
									<div class="dropdown-menu-quantity">
										{#each quantityOptions as qty}
											<button 
												class="quantity-dropdown-item {qty === selectedQuantity ? 'selected' : ''}"
												onclick={() => selectQuantity(qty)}
											>
												{qty} {qty === 1 ? 'copy' : 'copies'}
											</button>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					</div>
					
				{#if selectedDocumentType}
					<div class="total-price-section">
						<div class="total-price-label">
							<span class="material-symbols-outlined">payments</span>
							Total Amount
						</div>
						<div class="total-price-amount">₱{(totalPrice || 0).toFixed(2)}</div>
					</div>
					{@const isFirstTimeRequest = !isDocumentTypeRequested(selectedDocumentType)}
					{#if isFirstTimeRequest && selectedQuantity > 1}
						<div class="pricing-info">
							<span class="material-symbols-outlined">info</span>
							<span>First copy is free. You're being charged for {selectedQuantity - 1} additional {selectedQuantity - 1 === 1 ? 'copy' : 'copies'}.</span>
						</div>
					{:else if isFirstTimeRequest && selectedQuantity === 1}
						<div class="pricing-info free-info">
							<span class="material-symbols-outlined">celebration</span>
							<span>This is your first request for this document type - it's free!</span>
						</div>
					{/if}
				{/if}
					
				<div class="form-group">
					<label class="student-form-label" for="description">
						<span class="material-symbols-outlined form-icon">edit_note</span>
						Purpose & Details
					</label>
					<textarea 
						id="description" 
						class="form-textarea enhanced" 
						bind:value={requestPurpose} 
						placeholder="Please describe the purpose of your request and any specific requirements..."
						rows="5"
						maxlength="200"
					></textarea>
					<div class="form-help">
						<span class="material-symbols-outlined help-icon">info</span>
						Be specific about your needs to help us process your request efficiently
						<span class="char-counter">{requestPurpose.length}/200</span>
					</div>
				</div>
					
					<div class="document-form-actions">
						<button class="document-cancel-button" onclick={toggleRequestForm} disabled={isSubmitting}>
							Cancel
						</button>
						<button 
							class="submit-button" 
							onclick={handleSubmitRequest} 
							disabled={!selectedDocumentType || !requestPurpose.trim() || isSubmitting}
						>
							{#if isSubmitting}
								Submitting...
							{:else}
								Submit
							{/if}
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Request History Section -->
	<div class="request-history-section">
		<div class="request-history-header">
			<h2 class="section-title">Request History</h2>
			<button class="refresh-button" onclick={handleRefresh} disabled={loading} title="Refresh document requests">
				<span class="material-symbols-outlined">refresh</span>
			</button>
		</div>
		
		{#if error}
			<div class="error-message" style="padding: 20px; background: #fee; border-radius: 8px; color: #c33; margin: 20px 0;">
				<strong>Error:</strong> {error}
			</div>
		{/if}
		
		{#if loading}
			<div class="loading-message">
				<div class="system-loader"></div>
				Loading your document requests...
			</div>
		{:else if requestHistory.length === 0}
			<div class="no-requests-message">
				<span class="material-symbols-outlined">description</span>
				<p>No document requests found</p>
				<p class="subtitle">Start by requesting your first document above</p>
			</div>
		{:else}
			<div class="request-history-grid">
				{#each requestHistory as request, index (request.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="request-card {request.status}" style="--card-index: {index};" onclick={() => openRequestModal(request)}>
						<div class="request-main-content">
							<div class="request-status-icon">
								<span class="material-symbols-outlined">{getStatusIcon(request.status)}</span>
							</div>
							
							<div class="request-content">
								<div class="request-header">
								<div class="request-info">
									<h3 class="request-title">{request.type}</h3>
									<p class="request-date">Requested on {request.requestedDate}</p>
								</div>
									<div class="request-header-actions">
										<div class="student-status-badge status-{request.status}">
											{getStatusDisplayName(request.status)}
										</div>
										<button class="chat-indicator-btn" title="{getUnreadMessageCount(request) > 0 ? `${getUnreadMessageCount(request)} unread message${getUnreadMessageCount(request) !== 1 ? 's' : ''}` : 'View messages'}">
											<span class="material-symbols-outlined">chat_bubble</span>
											{#if getUnreadMessageCount(request) > 0}
												<span class="chat-badge">{getUnreadMessageCount(request)}</span>
											{/if}
										</button>
									</div>
								</div>
							</div>
						</div>
						
						<!-- Status Footer with colored background -->
						{#if request.status === 'released' || request.status === 'for_pickup'}
							<div class="request-footer completed-footer">
								<span class="footer-info">
									{request.status === 'released' ? 'Released' : 'Ready for pick up'}{request.processedBy ? ` by ${request.processedBy}` : ''}
								</span>
							</div>
						{:else if request.status === 'processing' || request.status === 'verifying'}
							<div class="request-footer processing-footer">
								<span class="footer-info">
									{#if request.adminNote}
										Note{request.processedBy ? ` by ${request.processedBy}` : ''}: {request.adminNote}
									{:else}
										{request.processedBy ? `Being ${request.status === 'verifying' ? 'verified' : 'processed'} by ${request.processedBy}` : `${request.status === 'verifying' ? 'Verifying' : 'Processing'} your request`}
									{/if}
									{#if request.tentativeDate && request.status === 'processing'}
										<span> • Tentative: {request.tentativeDate}</span>
									{/if}
								</span>
							</div>
					{:else if request.status === 'on_hold'}
						<div class="request-footer pending-footer">
							<span class="footer-info">Awaiting review</span>
						</div>
					{:else if request.status === 'cancelled'}
						<div class="request-footer cancelled-footer">
							<span class="footer-info">Cancelled on {formatDate(request.cancelledDate || request.submittedDate)}</span>
						</div>
						{:else if request.status === 'rejected'}
							<div class="request-footer rejected-footer">
								<span class="footer-info">
									Rejected{request.processedBy ? ` by ${request.processedBy}` : ''}{request.rejectionReason ? `: ${request.rejectionReason}` : ''}
								</span>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>