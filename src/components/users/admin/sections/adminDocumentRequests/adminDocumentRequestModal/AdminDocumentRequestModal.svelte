<script>
	import { createEventDispatcher } from 'svelte';
	import { authenticatedFetch } from '../../../../../../routes/api/helper/api-helper.js';
	import { authStore } from '../../../../../login/js/auth.js';
	import { toastStore } from '../../../../../common/js/toastStore.js';
	import Modal from '../../../../../common/Modal.svelte';

	// Props passed from modal store
	let {
		request = {},
		requestStatuses = [],
		modalStatuses = [],
		onUpdate = async () => {},
		onReject = async () => {},
		onClose = () => {}
	} = $props();

	const dispatch = createEventDispatcher();

	// Local state for the modal - sync with request prop
	let selectedRequest = $state({ ...request });
	
	// Update selectedRequest when request prop changes
	$effect(() => {
		if (request && request.requestId) {
			selectedRequest = { ...request };
		}
	});
	let isModalStatusDropdownOpen = $state(false);
	let dateInputEl = $state();
	let newMessage = $state('');
	let isSendingMessage = $state(false);
	let chatMessagesEl = $state();
	let chatInputEl = $state();
	let fileInputEl = $state();
	let selectedFiles = $state([]);
	let pollingInterval;
	let showConfirmModal = $state(false);
	let showRejectModal = $state(false);
	let showReceiptModal = $state(false);
	let paymentStatus = $state('pending'); // 'paid' or 'pending'

	// Get messages from the request
	let messages = $derived(selectedRequest.messages || []);

	// Track the saved status (from database) separately from local edits
	let savedStatus = $state(request.status || '');
	
	// Track the saved payment status (from database) separately from local edits
	let savedPaymentStatus = $state(request.paymentStatus || 'pending');

	// Update savedStatus when request prop changes
	$effect(() => {
		if (request && request.status) {
			savedStatus = request.status;
		}
		if (request && request.paymentStatus) {
			savedPaymentStatus = request.paymentStatus;
		} else if (request) {
			savedPaymentStatus = 'pending';
		}
	});

	// Check if chat should be disabled based on saved status (not local changes)
	let isChatDisabled = $derived(
		savedStatus === 'released' || savedStatus === 'cancelled'
	);

	// Initialize paymentStatus from request data when request changes
	$effect(() => {
		if (selectedRequest && selectedRequest.paymentStatus) {
			paymentStatus = selectedRequest.paymentStatus;
		} else if (selectedRequest) {
			// Default to 'pending' if not set
			paymentStatus = 'pending';
		}
	});

	// Scroll to bottom of chat
	function scrollToBottom() {
		if (chatMessagesEl) {
			setTimeout(() => {
				chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
			}, 100);
		}
	}

	// Handle file selection
	function handleFileSelect(event) {
		const files = Array.from(event.target.files || []);
		if (files.length === 0) return;

		// Limit file size to 10MB per file
		const maxSize = 10 * 1024 * 1024;
		const validFiles = files.filter(file => {
			if (file.size > maxSize) {
				toastStore.error(`File "${file.name}" is too large. Maximum size is 10MB.`);
				return false;
			}
			return true;
		});

		selectedFiles = [...selectedFiles, ...validFiles];
		
		// Reset the file input value to allow re-uploading the same file
		if (fileInputEl) {
			fileInputEl.value = '';
		}
	}

	// Remove selected file
	function removeFile(index) {
		selectedFiles = selectedFiles.filter((_, i) => i !== index);
	}

	// Trigger file input click
	function triggerFileInput() {
		if (fileInputEl) {
			fileInputEl.click();
		}
	}

	// Convert file to base64
	async function fileToBase64(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	// Download file attachment
	function downloadFile(attachment) {
		const link = document.createElement('a');
		link.href = attachment.data;
		link.download = attachment.name;
		link.click();
	}

	// Send a new message with optimistic UI update
	async function sendMessage() {
		if ((!newMessage.trim() && selectedFiles.length === 0) || isSendingMessage || isChatDisabled) return;

		isSendingMessage = true;
		const messageText = newMessage.trim();
		const filesToSend = [...selectedFiles];
		
		// Convert files to base64
		let attachments = [];
		try {
			for (const file of filesToSend) {
				const base64Data = await fileToBase64(file);
				attachments.push({
					name: file.name,
					type: file.type,
					size: file.size,
					data: base64Data
				});
			}
		} catch (error) {
			console.error('Error converting files:', error);
			toastStore.error('Failed to process files. Please try again.');
			isSendingMessage = false;
			return;
		}
		
		// Create optimistic message with actual sender name
		const tempId = `temp-${Date.now()}`; // Store temp ID
		const optimisticMessage = {
			id: tempId,
			text: messageText,
			author: $authStore.userData?.name || 'Admin',
			authorRole: 'admin',
			created_at: new Date().toISOString(),
			attachments: attachments,
			isPending: true // Flag to track optimistic messages (internal only)
		};

		// Immediately add message to UI
		selectedRequest.messages = [...(selectedRequest.messages || []), optimisticMessage];
		newMessage = '';
		selectedFiles = [];
		scrollToBottom();
		
		// Refocus the input immediately
		if (chatInputEl) {
			setTimeout(() => chatInputEl.focus(), 50);
		}

		// Send to server in the background
		try {
			const response = await authenticatedFetch('/api/document-requests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'sendMessage',
					requestId: selectedRequest.requestId,
					message: messageText,
					attachments: attachments
				})
			});

			const result = await response.json();

			if (result.success) {
				// Replace optimistic message with actual message from server, keeping the same ID
				selectedRequest.messages = selectedRequest.messages.map(msg => 
					msg.id === tempId ? { ...result.data, id: tempId, isPending: false } : msg
				);
			} else {
				console.error('Failed to send message:', result.error);
			// Remove the optimistic message on failure
			selectedRequest.messages = selectedRequest.messages.filter(msg => msg.id !== tempId);
			// Show error notification
			toastStore.error('Failed to send message. Please try again.');
			// Restore the message text and files so user can retry
			newMessage = messageText;
			selectedFiles = filesToSend;
			}
		} catch (error) {
		console.error('Error sending message:', error);
		// Remove the optimistic message on error
		selectedRequest.messages = selectedRequest.messages.filter(msg => msg.id !== tempId);
		toastStore.error('An error occurred while sending the message.');
		// Restore the message text and files so user can retry
		newMessage = messageText;
		selectedFiles = filesToSend;
		} finally {
			isSendingMessage = false;
		}
	}

	// Status dropdown functions
	function toggleModalStatusDropdown() {
		isModalStatusDropdownOpen = !isModalStatusDropdownOpen;
	}

	function selectModalStatus(statusId) {
		if (!selectedRequest) return;
		selectedRequest.status = statusId;
		
		// Automatically set tentative date to 5 days from now when status is verifying or processing
		if (statusId === 'verifying' || statusId === 'processing') {
			const tentativeDate = new Date();
			tentativeDate.setDate(tentativeDate.getDate() + 5);
			const year = tentativeDate.getFullYear();
			const month = String(tentativeDate.getMonth() + 1).padStart(2, '0');
			const day = String(tentativeDate.getDate()).padStart(2, '0');
			selectedRequest.tentativeDate = `${year}-${month}-${day}`;
		} else {
			// Reset tentative date for other statuses
			selectedRequest.tentativeDate = null;
		}
		
		isModalStatusDropdownOpen = false;
	}

	// Date handling
	function formatTentativeDateForDisplay(dateStr) {
		if (!dateStr) return '--/--/----';
		const [y, m, d] = dateStr.split('-');
		if (!y || !m || !d) return '--/--/----';
		return `${m}/${d}/${y}`;
	}

	// Action handlers
	function handleUpdate() {
		// Show confirmation modal before updating
		showConfirmModal = true;
	}

	async function confirmUpdate() {
		const updateData = {
			status: selectedRequest.status,
			tentativeDate: selectedRequest.tentativeDate,
			paymentAmount: selectedRequest.paymentAmount,
			paymentStatus: paymentStatus
		};
		const success = await onUpdate(selectedRequest.requestId, updateData);
		showConfirmModal = false;
		
		// If update was successful, refresh the request data but keep modal open
		if (success) {
			await refreshRequestData();
		}
	}

	// Refresh request data from server
	async function refreshRequestData() {
		if (!selectedRequest || !selectedRequest.requestId) return;

		try {
			const response = await authenticatedFetch(`/api/document-requests?action=single&requestId=${selectedRequest.requestId}`);
			const result = await response.json();

			if (result.success && result.data) {
				// Update selectedRequest with fresh data from server
				selectedRequest = { ...result.data };
				// Update savedStatus with the actual saved status from database
				if (result.data.status) {
					savedStatus = result.data.status;
				}
				// Update paymentStatus from refreshed data
				if (result.data.paymentStatus) {
					paymentStatus = result.data.paymentStatus;
					savedPaymentStatus = result.data.paymentStatus;
				} else {
					savedPaymentStatus = 'pending';
				}
			}
		} catch (error) {
			console.error('Error refreshing request data:', error);
		}
	}

	function cancelUpdate() {
		showConfirmModal = false;
	}

	function handleReject() {
		// Show confirmation modal before rejecting
		showRejectModal = true;
	}

	async function confirmReject() {
		await onReject(selectedRequest.requestId);
		showRejectModal = false;
		onClose();
	}

	function cancelReject() {
		showRejectModal = false;
	}

	// Show receipt generation confirmation modal
	function generateReceipt() {
		if (!selectedRequest || !selectedRequest.requestId) return;
		showReceiptModal = true;
	}

	// Convert blob to base64
	async function blobToBase64(blob) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}

	// Confirm and generate receipt, then send to chat
	async function confirmGenerateReceipt() {
		if (!selectedRequest || !selectedRequest.requestId) return;
		
		showReceiptModal = false;
		isSendingMessage = true;
		
		try {
			// Generate receipt PDF
			const response = await authenticatedFetch(`/api/document-requests?action=generateReceipt&requestId=${selectedRequest.requestId}`, {
				method: 'GET'
			});

			if (!response.ok) {
				const result = await response.json();
				toastStore.error(result.error || 'Failed to generate receipt');
				isSendingMessage = false;
				return;
			}

			const blob = await response.blob();

			// Convert blob to base64 for sending to chat
			const base64Data = await blobToBase64(blob);
			const attachments = [{
				name: `receipt-${selectedRequest.requestId}.pdf`,
				type: 'application/pdf',
				size: blob.size,
				data: base64Data
			}];

			// Create optimistic message
			const tempId = `temp-${Date.now()}`;
			const messageText = `Receipt generated for ${selectedRequest.requestId}`;
			const optimisticMessage = {
				id: tempId,
				text: messageText,
				author: $authStore.userData?.name || 'Admin',
				authorRole: 'admin',
				created_at: new Date().toISOString(),
				attachments: attachments,
				isPending: true
			};

			// Add message to UI immediately
			selectedRequest.messages = [...(selectedRequest.messages || []), optimisticMessage];
			scrollToBottom();

			// Send to server
			try {
				const sendResponse = await authenticatedFetch('/api/document-requests', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'sendMessage',
						requestId: selectedRequest.requestId,
						message: messageText,
						attachments: attachments
					})
				});

				const result = await sendResponse.json();

				if (result.success) {
					// Replace optimistic message with actual message from server
					selectedRequest.messages = selectedRequest.messages.map(msg => 
						msg.id === tempId ? { ...result.data, id: tempId, isPending: false } : msg
					);
					toastStore.success('Receipt generated and sent to chat successfully');
				} else {
					// Remove optimistic message on failure
					selectedRequest.messages = selectedRequest.messages.filter(msg => msg.id !== tempId);
					toastStore.error(result.error || 'Failed to send receipt to chat');
				}
			} catch (error) {
				console.error('Error sending receipt to chat:', error);
				// Remove optimistic message on error
				selectedRequest.messages = selectedRequest.messages.filter(msg => msg.id !== tempId);
				toastStore.error('Receipt generated but failed to send to chat');
			}
		} catch (error) {
			console.error('Error generating receipt:', error);
			toastStore.error('An error occurred while generating the receipt');
		} finally {
			isSendingMessage = false;
		}
	}

	function cancelGenerateReceipt() {
		showReceiptModal = false;
	}

	// Get current status name
	let modalCurrentStatusName = $derived(
		selectedRequest
			? (requestStatuses.find((s) => s.id === selectedRequest.status) || {}).name || 'Select'
			: 'Select'
	);

	// Handle click outside dropdown
	function handleClickOutside(event) {
		if (!event.target.closest('.docreq-status-dropdown')) {
			isModalStatusDropdownOpen = false;
		}
	}

	// Handle ESC key for dropdown
	function handleKeydown(event) {
		if (event.key === 'Escape' && isModalStatusDropdownOpen) {
			isModalStatusDropdownOpen = false;
		}
	}

	// Toggle payment status
	function togglePaymentStatus() {
		paymentStatus = paymentStatus === 'paid' ? 'pending' : 'paid';
	}

	// Fetch latest messages from server
	async function fetchLatestMessages() {
		if (!selectedRequest || isSendingMessage) return;

		try {
			const response = await authenticatedFetch(`/api/document-requests?action=single&requestId=${selectedRequest.requestId}`, {
				method: 'GET'
			});

			const result = await response.json();
			
			if (result.success && result.data.messages) {
				// Keep pending messages and merge with server messages
				const pendingMessages = messages.filter(m => m.isPending);
				const serverMessages = result.data.messages;
				
				// Get IDs of existing non-pending messages
				const currentMessageIds = new Set(messages.filter(m => !m.isPending).map(m => m.id));
				const newMessages = serverMessages.filter(m => !currentMessageIds.has(m.id));
				
				// Only update if there are new messages
				if (newMessages.length > 0) {
					// Merge server messages with pending messages
					selectedRequest.messages = [...serverMessages, ...pendingMessages];
					scrollToBottom();
				}
			}
		} catch (error) {
			console.error('Error fetching latest messages:', error);
		}
	}

	// Handle visibility change - pause polling when tab is not visible
	function handleVisibilityChange() {
		if (document.hidden) {
			// Tab is hidden, clear the interval
			if (pollingInterval) {
				clearInterval(pollingInterval);
				pollingInterval = null;
			}
		} else {
			// Tab is visible again, restart polling if not already running
			if (!pollingInterval) {
				// Fetch immediately when tab becomes visible
				fetchLatestMessages();
				pollingInterval = setInterval(fetchLatestMessages, 8000);
			}
		}
	}

	// Watch for message changes and scroll to bottom (including automated messages)
	$effect(() => {
		// Scroll to bottom whenever messages change
		if (messages.length > 0) {
			scrollToBottom();
		}
	});

	// Start polling when component mounts
	$effect(() => {
		// Poll every 8 seconds for new messages (reduced from 3s to reduce server load)
		pollingInterval = setInterval(fetchLatestMessages, 8000);
		
		// Listen for visibility changes to pause polling when tab is hidden
		document.addEventListener('visibilitychange', handleVisibilityChange);
		
		// Scroll to bottom when messages change
		scrollToBottom();

		// Cleanup on unmount
		return () => {
			if (pollingInterval) {
				clearInterval(pollingInterval);
			}
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});
</script>

<svelte:window on:click={handleClickOutside} on:keydown={handleKeydown} />

<div class="docreq-modal-content">
	<div class="docreq-modal-grid">
		<!-- LEFT CONTAINER: Request Information -->
		<div class="docreq-modal-left-container">
		<header class="docreq-modal-title">
			<div class="docreq-modal-title-row">
				<div>
					<h2>Request Details</h2>
					<div class="docreq-modal-sub">ID: <span>{selectedRequest.requestId}</span></div>
				</div>
				{#if selectedRequest.status === 'for_pickup'}
					<button class="generate-receipt-btn" onclick={generateReceipt} title="Generate Receipt">
						<span class="material-symbols-outlined">receipt</span>
						<span>Generate Receipt</span>
					</button>
				{/if}
			</div>
		</header>



		<!-- Request Info Cards -->
		<div class="docreq-cards">
			<div class="docreq-card">
				<div class="card-label">
					<span class="material-symbols-outlined">description</span> Document Type
				</div>
				<div class="admin-card-value">{selectedRequest.documentType}</div>
			</div>

			
			<!-- Status card with dropdown -->
			<div class="docreq-card">
				<div class="card-label">
					<span class="material-symbols-outlined">info</span> Status
				</div>
				<div class="admin-card-value">
					<div
						class="docreq-status-dropdown"
						class:open={isModalStatusDropdownOpen}
						aria-haspopup="listbox"
						aria-expanded={isModalStatusDropdownOpen}
					>
						<button
							class="docreq-status-dropdown-trigger"
							onclick={toggleModalStatusDropdown}
							aria-label="Change status"
							disabled={request?.status === 'cancelled' || request?.status === 'rejected' || request?.status === 'released'}
						>
							<span class="docreq-status-dropdown-label">{modalCurrentStatusName}</span>
							<span class="material-symbols-outlined docreq-status-dropdown-caret">
								{isModalStatusDropdownOpen ? 'expand_less' : 'expand_more'}
							</span>
						</button>

						<div class="docreq-status-dropdown-menu" role="listbox" aria-label="Select status">
							{#each modalStatuses as st (st.id)}
								<button
									type="button"
									class="docreq-status-item"
									onclick={() => selectModalStatus(st.id)}
									role="option"
									aria-selected={selectedRequest.status === st.id}
								>
									<span class="status-dot {st.id}"></span>
									<span class="status-text">{st.name}</span>
								</button>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<div class="docreq-card">
				<div class="card-label">
					<span class="material-symbols-outlined">account_circle</span> Processed By
				</div>
				<div class="admin-card-value">{selectedRequest.processedBy ?? '—'}</div>
			</div>

		<!-- Tentative Date card -->
		{#if selectedRequest.tentativeDate}
		<div class="docreq-card">
			<div class="card-label">
				<span class="material-symbols-outlined">event</span> Tentative Date
			</div>
			<div class="admin-card-value">
				<div class="date-box readonly">
					{formatTentativeDateForDisplay(selectedRequest.tentativeDate)}
				</div>
			</div>
		</div>
		{/if}

		<!-- Quantity card -->
		<div class="docreq-card">
			<div class="card-label">
				<span class="material-symbols-outlined">numbers</span> Quantity
			</div>
			<div class="admin-card-value">
				{selectedRequest.quantity + ` Copies` ?? '—'} 
			</div>
		</div>

		<!-- Payment Amount card -->
		<div class="docreq-card">
			<div class="card-label">
				<span class="material-symbols-outlined">payments</span> Payment Amount
			</div>
			<div class="admin-card-value">
				<div class="payment-display-container">
					<div class="payment-readonly {(request?.status !== 'cancelled' && request?.status !== 'rejected' && selectedRequest.paymentAmount !== null && selectedRequest.paymentAmount !== undefined) ? paymentStatus : ''}">
						{#if selectedRequest.paymentAmount !== null && selectedRequest.paymentAmount !== undefined}
							₱{selectedRequest.paymentAmount.toFixed(2)}
						{:else}
							<span class="not-set">Not set</span>
						{/if}
					</div>
					<div class="payment-actions">
						<button 
							class="payment-status-toggle {paymentStatus === 'paid' ? 'pending' : 'paid'}" 
							onclick={togglePaymentStatus}
							title={
								(selectedRequest.paymentAmount === null || selectedRequest.paymentAmount === undefined) 
									? 'Set payment amount first' 
									: (paymentStatus === 'paid' ? 'Mark as pending' : 'Mark as paid')
							}
							aria-label={paymentStatus === 'paid' ? 'Mark as pending' : 'Mark as paid'}
							disabled={
								savedStatus === 'cancelled' || 
								savedStatus === 'rejected' || 
								savedStatus === 'released' ||
								selectedRequest.paymentAmount === null || 
								selectedRequest.paymentAmount === undefined
							}
						>
							<span class="material-symbols-outlined">
								{paymentStatus === 'paid' ? 'cancel' : 'check_circle'}
							</span>
						</button>
					</div>
				</div>
			</div>
		</div>

			{#if selectedRequest.status === 'cancelled' && selectedRequest.cancelledDate}
				<div class="docreq-card">
					<div class="card-label">
						<span class="material-symbols-outlined">event_busy</span> Cancelled Date
					</div>
					<div class="admin-card-value">{selectedRequest.cancelledDate}</div>
				</div>
				{/if}
			</div>

		<!-- Purpose Section -->
		<div class="docreq-purpose">
			<div class="purpose-label">
				<span class="material-symbols-outlined">description</span> Purpose & Details
			</div>
			<div class="purpose-content">{selectedRequest.purpose ?? 'No purpose provided'}</div>
		</div>

			<!-- Action Buttons -->
			<div class="action-buttons">
				<button 
					class="docreq-approve-button" 
					onclick={handleUpdate}
					disabled={request?.status === 'cancelled' || request?.status === 'rejected' || request?.status === 'released'}
				>
					<span class="material-symbols-outlined">check_circle</span>
					Update Request
				</button>
				<button 
					class="docreq-reject-button" 
					onclick={handleReject}
					disabled={savedStatus === 'cancelled' || savedStatus === 'rejected' || savedStatus === 'released'}
				>
					<span class="material-symbols-outlined">cancel</span>
					Reject Request
				</button>
				<button class="docreq-complete-button" onclick={onClose}>
					<span class="material-symbols-outlined">arrow_back</span>
					Back
				</button>
			</div>
		</div>

		<!-- RIGHT CONTAINER: Student Info & Chat -->
		<div class="docreq-modal-right-container">
			<!-- Student Information Section -->
			<div class="student-info-section">
				<h3><span class="material-symbols-outlined">school</span> Student Information</h3>
				
				<div class="student-info-grid">
					<div class="student-field">
						<div class="field-label">Student ID</div>
						<div class="field-value">{selectedRequest.studentId}</div>
					</div>

					<div class="student-field">
						<div class="field-label">Full Name</div>
						<div class="field-value">{selectedRequest.studentName}</div>
					</div>

					<div class="student-field">
						<div class="field-label">Grade & Section</div>
						<div class="field-value">
							{selectedRequest.gradeLevel} - {selectedRequest.section || 'N/A'}
						</div>
					</div>

					<div class="student-field">
						<div class="field-label">Date of birth</div>
						<div class="field-value">{selectedRequest.dateOfBirth ?? '—'}</div>
					</div>
				</div>
			</div>

			<div class="chat-container">
				<div class="chat-header">
					<h3><span class="material-symbols-outlined">forum</span> Communication</h3>
					<span class="chat-count-badge">{messages.length}</span>
				</div>

				<div class="admin-chat-messages" bind:this={chatMessagesEl}>
					{#if messages.length > 0}
						{#each messages as msg (msg.id)}
							<div class="message-wrapper {msg.authorRole === 'admin' ? 'sent' : 'received'}">
								{#if msg.authorRole !== 'admin'}
									<div class="message-avatar">
										<span class="material-symbols-outlined">account_circle</span>
									</div>
								{/if}
								<div class="message-bubble">
									<div class="message-header">
										<span class="message-author">{msg.author}</span>
										<span class="message-time">
											{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
										</span>
									</div>
									{#if msg.text}
										<div class="admin-document-request-message-text">{msg.text}</div>
									{/if}
									{#if msg.attachments && msg.attachments.length > 0}
										<div class="message-attachments">
											{#each msg.attachments as attachment}
												<button class="attachment-item" onclick={() => downloadFile(attachment)}>
													<span class="material-symbols-outlined">attach_file</span>
													<div class="attachment-info">
														<span class="attachment-name">{attachment.name}</span>
														<span class="attachment-size">{(attachment.size / 1024).toFixed(1)} KB</span>
													</div>
													<span class="material-symbols-outlined">download</span>
												</button>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						{/each}
					{:else}
						<div class="no-chat">
							<span class="material-symbols-outlined">chat_bubble_outline</span>
							<p>No messages yet</p>
							<p class="subtitle">Start a conversation with the student</p>
						</div>
					{/if}
				</div>

				<div class="admin-chat-input-wrapper">
					{#if selectedFiles.length > 0}
						<div class="selected-files-preview">
							{#each selectedFiles as file, index}
								<div class="file-preview-item">
									<span class="material-symbols-outlined">description</span>
									<span class="file-preview-name">{file.name}</span>
									<span class="file-preview-size">({(file.size / 1024).toFixed(1)} KB)</span>
									<button class="remove-file-btn" onclick={() => removeFile(index)} title="Remove file">
										<span class="material-symbols-outlined">close</span>
									</button>
								</div>
							{/each}
						</div>
					{/if}
					<div class="admin-chat-input" class:disabled={isChatDisabled}>
						{#if isChatDisabled}
							<div class="chat-disabled-notice">
								<span class="material-symbols-outlined">block</span>
								<span>Chat is disabled for {savedStatus === 'released' ? 'released' : 'cancelled'} requests</span>
							</div>
						{:else}
							<input 
								type="file" 
								bind:this={fileInputEl}
								onchange={handleFileSelect}
								multiple
								accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
								style="display: none;"
							/>
							<button class="attach-btn" title="Attach file" aria-label="Attach file" onclick={triggerFileInput}>
								<span class="material-symbols-outlined">attach_file</span>
							</button>
							<input 
								bind:this={chatInputEl}
								placeholder="Type your message..." 
								aria-label="Message input" 
								bind:value={newMessage}
								onkeydown={(e) => e.key === 'Enter' && !e.shiftKey && !isSendingMessage && sendMessage()}
								disabled={isSendingMessage}
							/>
							<button 
								class="send-btn" 
								title="Send message" 
								aria-label="Send message" 
								onclick={sendMessage}
								disabled={isSendingMessage || (!newMessage.trim() && selectedFiles.length === 0)}
							>
								<span class="material-symbols-outlined">send</span>
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Confirmation Modal for Update -->
{#if showConfirmModal}
	<Modal 
		title="Confirm Update" 
		size="small" 
		closable={true}
		onClose={cancelUpdate}
	>
		<div class="modal-confirm-content">
			<div class="modal-message">
				<p>Are you sure you want to update this document request?</p>
				<div class="confirm-details">
					<div class="confirm-detail-row">
						<span class="detail-label">Request ID:</span>
						<span class="detail-value">{selectedRequest.requestId}</span>
					</div>
					<div class="confirm-detail-row">
						<span class="detail-label">New Status:</span>
						<span class="detail-value">{modalCurrentStatusName}</span>
					</div>
					{#if selectedRequest.tentativeDate}
					<div class="confirm-detail-row">
						<span class="detail-label">Tentative Date:</span>
						<span class="detail-value">{formatTentativeDateForDisplay(selectedRequest.tentativeDate)}</span>
					</div>
					{/if}
					<div class="confirm-detail-row">
						<span class="detail-label">Payment Amount:</span>
						<span class="detail-value">
							{#if selectedRequest.paymentAmount !== null && selectedRequest.paymentAmount !== undefined}
								₱{selectedRequest.paymentAmount}
							{:else}
								Tentative (not set)
							{/if}
						</span>
					</div>
					<div class="confirm-detail-row">
						<span class="detail-label">Payment Status:</span>
						<span class="detail-value payment-status-{paymentStatus}">
							{paymentStatus === 'paid' ? 'Paid' : 'Pending'}
						</span>
					</div>
				</div>
			</div>
			<div class="modal-actions">
				<button class="modal-btn modal-btn-secondary" onclick={cancelUpdate}>
					Cancel
				</button>
				<button class="modal-btn modal-btn-primary" onclick={confirmUpdate}>
					Confirm
				</button>
			</div>
		</div>
	</Modal>
{/if}

<!-- Confirmation Modal for Reject -->
{#if showRejectModal}
	<Modal 
		title="Reject Request" 
		size="small" 
		closable={true}
		onClose={cancelReject}
	>
		<div class="modal-confirm-content">
			<div class="modal-message">
				<p>Are you sure you want to reject this document request?</p>
				<div class="confirm-details reject-warning">
					<div class="confirm-detail-row">
						<span class="detail-label">Request ID:</span>
						<span class="detail-value">{selectedRequest.requestId}</span>
					</div>
					<div class="confirm-detail-row">
						<span class="detail-label">Student:</span>
						<span class="detail-value">{selectedRequest.studentName}</span>
					</div>
					<div class="confirm-detail-row">
						<span class="detail-label">Document Type:</span>
						<span class="detail-value">{selectedRequest.documentType}</span>
					</div>
					<div class="reject-notice">
						<span class="material-symbols-outlined">warning</span>
						<span>This action will mark the request as rejected and notify the student.</span>
					</div>
				</div>
			</div>
			<div class="modal-actions">
				<button class="modal-btn modal-btn-secondary" onclick={cancelReject}>
					Cancel
				</button>
				<button class="modal-btn modal-btn-danger" onclick={confirmReject}>
					Reject Request
				</button>
			</div>
		</div>
	</Modal>
{/if}

<!-- Confirmation Modal for Generate Receipt -->
{#if showReceiptModal}
	<Modal 
		title="Generate Receipt" 
		size="small" 
		closable={true}
		onClose={cancelGenerateReceipt}
	>
		<div class="modal-confirm-content">
			<div class="modal-message">
				<p>Generate receipt for this document request?</p>
				<div class="confirm-details">
					<div class="confirm-detail-row">
						<span class="detail-label">Request ID:</span>
						<span class="detail-value">{selectedRequest.requestId}</span>
					</div>
					<div class="confirm-detail-row">
						<span class="detail-label">Student:</span>
						<span class="detail-value">{selectedRequest.studentName}</span>
					</div>
					<div class="confirm-detail-row">
						<span class="detail-label">Document Type:</span>
						<span class="detail-value">{selectedRequest.documentType}</span>
					</div>
					<div class="reject-notice" style="background: rgba(33, 150, 243, 0.1); border-color: #2196F3;">
						<span class="material-symbols-outlined" style="color: #2196F3;">info</span>
						<span>The receipt will be generated and automatically sent to the chat.</span>
					</div>
				</div>
			</div>
			<div class="modal-actions">
				<button class="modal-btn modal-btn-secondary" onclick={cancelGenerateReceipt}>
					Cancel
				</button>
				<button class="modal-btn modal-btn-primary" onclick={confirmGenerateReceipt} disabled={isSendingMessage}>
					{isSendingMessage ? 'Generating...' : 'Generate Receipt'}
				</button>
			</div>
		</div>
	</Modal>
{/if}

<style>
	.docreq-modal-content {
		width: 100%;
		max-width: 1400px;
		background-color: var(--md-sys-color-surface-container-high);
		border-radius: var(--radius-xl);
		border: none;
		box-shadow: var(--shadow-lg);
		position: relative;
		overflow-y: hidden;
		display: flex;
		flex-direction: column;
	}

	.docreq-modal-close-button:hover {
		background-color: var(--md-sys-color-surface-container-highest);
		transform: scale(1.1);
	}

	.docreq-modal-close-button:active {
		transform: scale(0.95);
	}

	.docreq-modal-grid {
		display: grid;
		grid-template-columns: 1.2fr 1fr;
		gap: var(--spacing-xl);
		align-items: stretch;
		padding: var(--spacing-xl);
		flex: 1;
	}

	.docreq-modal-left-container {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		background-color: var(--md-sys-color-surface-container);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
		border: 1px solid var(--md-sys-color-outline-variant);
		height: 100%;
	}

	.docreq-modal-right-container {
		display: flex;
		flex-direction: column;
		background-color: var(--md-sys-color-surface-container);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
		border: 1px solid var(--md-sys-color-outline-variant);
		height: 100%;
	}

	.docreq-modal-title-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--spacing-md);
	}

	.docreq-modal-title h2 {
		margin: 0 0 6px 0;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.docreq-modal-sub {
		color: var(--md-sys-color-on-surface-variant);
		font-size: 0.875rem;
		margin-top: 6px;
	}

	.generate-receipt-btn {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: 10px var(--spacing-md);
		border-radius: var(--radius-md);
		background: var(--md-sys-color-primary);
		color: var(--md-sys-color-on-primary);
		border: none;
		cursor: pointer;
		font-weight: 600;
		font-size: 0.9rem;
		transition: all var(--transition-fast);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		white-space: nowrap;
	}

	.generate-receipt-btn .material-symbols-outlined {
		font-size: 20px;
	}

	.generate-receipt-btn:hover {
		background: var(--md-sys-color-primary);
		opacity: 0.9;
		box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
		transform: translateY(-1px);
	}

	.generate-receipt-btn:active {
		transform: translateY(0);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.generate-receipt-btn:focus-visible {
		outline: 2px solid var(--md-sys-color-primary);
		outline-offset: 2px;
	}

	.docreq-cards {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-md);
	}

	.docreq-card {
		background-color: var(--md-sys-color-surface-container);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		border: 1px solid var(--md-sys-color-outline-variant);
		flex: 1 1 calc(50% - var(--spacing-md) / 2);
		min-width: 250px;
	}

	/* First row: 3 cards (Document Type, Status, Processed By) */
	.docreq-card:nth-child(1),
	.docreq-card:nth-child(2),
	.docreq-card:nth-child(3) {
		flex: 1 1 calc(33.333% - var(--spacing-md) * 2 / 3);
		min-width: 200px;
	}

	/* Second row: Tentative Date (when shown), Quantity, and Payment Amount - 3 cards */
	.docreq-card:nth-child(4),
	.docreq-card:nth-child(5),
	.docreq-card:nth-child(6) {
		flex: 1 1 calc(33.333% - var(--spacing-md) * 2 / 3);
		min-width: 200px;
	}

	.card-label {
		color: var(--md-sys-color-on-surface-variant);
		font-size: 0.875rem;
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.admin-card-value {
		display: flex;
		margin-top: 8px;
		font-weight: 600;
		font-size: 1rem;
		width: 100%;
		min-height: 40px;
		align-items: center;
	}

	.docreq-purpose {
		margin-top: var(--spacing-sm);
	}

	.purpose-label {
		display: flex;
		gap: 8px;
		align-items: center;
		color: var(--md-sys-color-on-surface-variant);
		margin-bottom: 8px;
		font-weight: 600;
		font-size: 0.875rem;
	}

	.purpose-content {
		background: var(--md-sys-color-surface);
		padding: 12px;
		border-radius: var(--radius-md);
		border: 1px solid var(--md-sys-color-outline-variant);
		line-height: 1.6;
		color: var(--md-sys-color-on-surface);
		font-size: 0.95rem;
		min-height: 60px;
		word-wrap: break-word;
		word-break: break-word;
		overflow-wrap: break-word;
		white-space: pre-wrap;
		height: 15vh;
	}	

	/* Student Information Section */
	.student-info-section {
		padding: var(--spacing-md);
		background-color: var(--md-sys-color-surface);
		border-radius: var(--radius-md);
		border: 1px solid var(--md-sys-color-outline-variant);
		margin-bottom: var(--spacing-md);
	}

	.student-info-section h3 {
		display: flex;
		gap: 8px;
		align-items: center;
		margin: 0 0 var(--spacing-md) 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--md-sys-color-on-surface);
	}

	.student-info-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--spacing-md);
	}

	/* Chat Container - Full height */
	.chat-container {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.chat-header {
		padding-bottom: var(--spacing-md);
		border-bottom: 1px solid var(--md-sys-color-outline-variant);
		margin-bottom: var(--spacing-md);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.chat-header h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--md-sys-color-on-surface);
	}

	.chat-header .material-symbols-outlined {
		font-size: 24px;
	}

	.chat-count-badge {
		background: var(--md-sys-color-primary-container);
		color: var(--md-sys-color-on-primary-container);
		padding: 4px 12px;
		border-radius: 12px;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.admin-chat-messages {
		flex: 1;
		background: var(--md-sys-color-surface);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		border: 1px solid var(--md-sys-color-outline-variant);
		overflow-y: auto;
		margin-bottom: var(--spacing-sm);
		min-height: 350px;
		max-height: 400px;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	/* Reduce chat messages height when files are selected */
	.chat-container:has(.selected-files-preview) .admin-chat-messages {
		max-height: 300px;
	}

	.no-chat {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-xl);
		color: var(--md-sys-color-on-surface-variant);
		text-align: center;
		min-height: 200px;
	}

	.no-chat .material-symbols-outlined {
		font-size: 48px;
		opacity: 0.5;
		margin-bottom: var(--spacing-sm);
	}

	.no-chat p {
		margin: 4px 0;
	}

	.no-chat .subtitle {
		font-size: 0.875rem;
		opacity: 0.7;
	}

	/* Message Bubbles */
	.message-wrapper {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		margin-bottom: var(--spacing-xs);
		animation: slideIn 0.2s ease-out;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.message-wrapper.sent {
		justify-content: flex-end;
	}

	.message-wrapper.received {
		justify-content: flex-start;
	}

	.message-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--md-sys-color-surface-container-highest);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-bottom: 2px;
	}

	.message-avatar .material-symbols-outlined {
		font-size: 20px;
		color: var(--md-sys-color-on-surface-variant);
	}

	.message-wrapper.sent .message-avatar .material-symbols-outlined {
		color: var(--md-sys-color-primary);
	}

	.message-wrapper.received .message-avatar .material-symbols-outlined {
		color: var(--md-sys-color-secondary);
	}

	.message-bubble {
		max-width: 16rem;
		padding: 10px 14px;
		border-radius: 16px;
		position: relative;
		word-wrap: break-word;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.message-wrapper.sent .message-bubble {
		background: var(--md-sys-color-primary);
		color: var(--md-sys-color-on-primary);
		border-bottom-right-radius: 4px;
	}

	.message-wrapper.received .message-bubble {
		background: var(--md-sys-color-surface-container-highest);
		color: var(--md-sys-color-on-surface);
		border-bottom-left-radius: 4px;
	}

	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 4px;
		gap: 12px;
	}

	.message-author {
		font-size: 0.75rem;
		font-weight: 600;
		opacity: 0.9;
	}

	.message-time {
		font-size: 0.7rem;
		opacity: 0.7;
		white-space: nowrap;
	}

	.message-text {
		font-size: 0.95rem;
		line-height: 1.4;
		word-break: break-word;
		white-space: pre-wrap;
	}

	.admin-chat-input {
		display: flex;
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
		background: var(--md-sys-color-surface);
		border-radius: var(--radius-md);
		border: 1px solid var(--md-sys-color-outline-variant);
		align-items: center;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
		margin-top: auto;
	}

	.admin-chat-input input {
		flex: 1;
		padding: 12px var(--spacing-md);
		border-radius: var(--radius-md);
		background: var(--md-sys-color-surface-container);
		border: 1px solid var(--md-sys-color-outline-variant);
		color: var(--md-sys-color-on-surface);
		font-size: 0.95rem;
		transition: all var(--transition-fast);
	}

	.admin-chat-input input:focus {
		outline: none;
		border-color: var(--md-sys-color-primary);
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
		background: var(--md-sys-color-surface);
	}

	.admin-chat-input input::placeholder {
		color: var(--md-sys-color-on-surface-variant);
		opacity: 0.7;
	}

	.admin-chat-input.disabled {
		background: var(--md-sys-color-surface-variant);
		opacity: 0.7;
		justify-content: center;
	}

	.chat-disabled-notice {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		color: var(--md-sys-color-on-surface-variant);
		font-size: 0.9rem;
		font-weight: 500;
		padding: var(--spacing-sm);
	}

	.chat-disabled-notice .material-symbols-outlined {
		font-size: 20px;
		opacity: 0.8;
	}

	.attach-btn,
	.send-btn {
		background: var(--md-sys-color-surface-container);
		border: 1px solid var(--md-sys-color-outline-variant);
		padding: 10px;
		border-radius: var(--radius-md);
		color: var(--md-sys-color-on-surface);
		cursor: pointer;
		transition: all var(--transition-fast);
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		min-height: 44px;
	}

	.attach-btn .material-symbols-outlined,
	.send-btn .material-symbols-outlined {
		font-size: 22px;
	}

	.attach-btn:hover {
		background: var(--md-sys-color-secondary-container);
		border-color: var(--md-sys-color-secondary);
		color: var(--md-sys-color-on-secondary-container);
		transform: scale(1.05);
	}

	.send-btn {
		background: var(--md-sys-color-primary);
		color: var(--md-sys-color-on-primary);
		border-color: var(--md-sys-color-primary);
	}

	.send-btn:hover:not(:disabled) {
		background: var(--md-sys-color-primary);
		opacity: 0.9;
		transform: scale(1.05);
		box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.attach-btn:active,
	.send-btn:active {
		transform: scale(0.95);
	}

	.attach-btn:focus-visible,
	.send-btn:focus-visible {
		outline: 2px solid var(--md-sys-color-primary);
		outline-offset: 2px;
	}

	.student-field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.field-label {
		color: var(--md-sys-color-on-surface-variant);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-weight: 500;
	}

	.field-value {
		font-weight: 600;
		font-size: 0.95rem;
		color: var(--md-sys-color-on-surface);
	}

	.action-buttons {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
		margin-top: auto;
		padding-top: var(--spacing-lg);
		border-top: 2px solid var(--md-sys-color-outline-variant);
	}

	.docreq-approve-button {
		width: 100%;
		padding: 14px var(--spacing-md);
		border-radius: var(--radius-md);
		background: var(--md-sys-color-primary);
		color: var(--md-sys-color-on-primary);
		border: none;
		cursor: pointer;
		font-weight: 600;
		font-size: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		transition: all var(--transition-normal);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.docreq-approve-button .material-symbols-outlined {
		font-size: 22px;
	}

	.docreq-approve-button:hover {
		background: var(--md-sys-color-primary);
		opacity: 0.9;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		transform: translateY(-1px);
	}

	.docreq-approve-button:active {
		transform: translateY(0);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.docreq-approve-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		background: var(--md-sys-color-surface-variant);
		color: var(--md-sys-color-on-surface-variant);
	}

	.docreq-approve-button:disabled:hover {
		transform: none;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.docreq-reject-button {
		width: 100%;
		padding: 14px var(--spacing-md);
		border-radius: var(--radius-md);
		background: var(--md-sys-color-error);
		color: var(--md-sys-color-on-error);
		border: none;
		cursor: pointer;
		font-weight: 600;
		font-size: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		transition: all var(--transition-normal);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.docreq-reject-button .material-symbols-outlined {
		font-size: 22px;
	}

	.docreq-reject-button:hover {
		background: var(--md-sys-color-error);
		opacity: 0.9;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		transform: translateY(-1px);
	}

	.docreq-reject-button:active {
		transform: translateY(0);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.docreq-reject-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		background: var(--md-sys-color-surface-variant);
		color: var(--md-sys-color-on-surface-variant);
	}

	.docreq-reject-button:disabled:hover {
		transform: none;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.docreq-complete-button {
		width: 100%;
		padding: 14px var(--spacing-md);
		border-radius: var(--radius-md);
		background: var(--md-sys-color-surface-container-highest);
		color: var(--md-sys-color-on-surface);
		border: 1px solid var(--md-sys-color-outline-variant);
		cursor: pointer;
		font-weight: 600;
		font-size: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		transition: all var(--transition-normal);
	}

	.docreq-complete-button .material-symbols-outlined {
		font-size: 22px;
	}

	.docreq-complete-button:hover {
		background-color: var(--md-sys-color-surface-container-highest);
		border-color: var(--md-sys-color-outline);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
		transform: translateY(-1px);
	}

	.docreq-complete-button:active {
		transform: translateY(0);
		box-shadow: none;
	}

	.badge {
		background: var(--md-sys-color-surface-container);
		padding: 6px 8px;
		border-radius: 8px;
		font-size: 0.875rem;
		border: 1px solid var(--md-sys-color-outline-variant);
		color: var(--md-sys-color-on-surface);
		display: inline-block;
		margin-left: 8px;
	}

	.badge.orange {
		background: var(--status-pending-bg);
		color: var(--status-pending-text);
	}

	/* Status dropdown */
	.docreq-status-dropdown {
		position: relative;
		display: inline-block;
		width: 100%;
	}

	.docreq-status-dropdown-trigger {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		border-radius: 8px;
		background: var(--md-sys-color-surface);
		border: 1px solid var(--md-sys-color-outline-variant);
		color: var(--md-sys-color-on-surface);
		cursor: pointer;
		font-weight: 600;
		font-size: 0.875rem;
		min-width: 120px;
		justify-content: space-between;
		box-sizing: border-box;
		min-width: 100%;
	}

	.docreq-status-dropdown-trigger:focus {
		outline: none;
		box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
	}

	.docreq-status-dropdown-trigger:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		background: var(--md-sys-color-surface-variant);
	}

	.docreq-status-dropdown-label {
		display: inline-block;
		padding: 6px 8px;
		border-radius: 6px;
		background: transparent;
		color: var(--md-sys-color-on-surface);
	}

	.docreq-status-dropdown-caret {
		font-size: 18px;
		opacity: 0.95;
	}

	.docreq-status-dropdown-menu {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		min-width: 220px;
		background: var(--md-sys-color-surface);
		border-radius: 12px;
		border: 1px solid var(--md-sys-color-outline-variant);
		padding: 8px;
		box-shadow: var(--shadow-lg);
		display: none;
		z-index: 30;
	}

	.docreq-status-dropdown.open .docreq-status-dropdown-menu {
		display: block;
	}

	.docreq-status-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px;
		width: 100%;
		background: transparent;
		border: none;
		color: var(--md-sys-color-on-surface);
		text-align: left;
		font-size: 1.05rem;
		border-radius: 8px;
		cursor: pointer;
	}

	.docreq-status-item:hover {
		background: rgba(255, 255, 255, 0.02);
	}

	.status-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		display: inline-block;
		box-shadow: 0 0 0 3px rgba(0, 0, 0, 0);
	}

	.status-dot.on_hold {
		background: #f5b400;
	}
	.status-dot.verifying {
		background: #3b82f6;
	}
	.status-dot.processing {
		background: #fb923c;
	}
	.status-dot.for_pickup {
		background: #06b6d4;
	}
	.status-dot.released {
		background: #22c55e;
	}
	.status-dot.rejected {
		background: #ef4444;
	}

	.docreq-status-item[aria-selected='true'] {
		background: rgba(255, 255, 255, 0.02);
	}

	.status-text {
		font-size: 1.05rem;
		font-weight: 600;
	}

	/* Tentative date */
	.date-input {
		padding: 10px 12px;
		border-radius: 8px;
		background: var(--md-sys-color-surface);
		border: 1px solid var(--md-sys-color-outline-variant);
		min-width: 160px;
		color: var(--md-sys-color-on-surface);
		font-size: 0.95rem;
		font-family: inherit;
		cursor: pointer;
		transition: all var(--transition-fast);
		width: 100%;
	}

	.date-input.editable {
		background: var(--md-sys-color-surface);
		border: 1px solid var(--md-sys-color-primary);
		width: 100%;
	}

	.date-input.editable:hover {
		background: var(--md-sys-color-surface-container);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.date-input:focus {
		outline: none;
		border-color: var(--md-sys-color-primary);
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
	}

	.date-box {
		padding: 10px 12px;
		border-radius: 8px;
		background: var(--md-sys-color-surface);
		border: 1px solid var(--md-sys-color-outline-variant);
		min-width: 160px;
		text-align: left;
		color: var(--md-sys-color-on-surface);
		display: inline-block;
		box-sizing: border-box;
	}

	.date-box.readonly {
		background: var(--md-sys-color-surface-container);
		border: 1px solid var(--md-sys-color-outline-variant);
		opacity: 0.8;
	}

	/* Payment Display Container */
	.payment-display-container {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		width: 100%;
	}

	/* Payment Read-only Display */	
	.payment-readonly {
		flex: 1;
		padding: 8px 12px;
		border-radius: var(--radius-md);
		background: var(--md-sys-color-surface-container);
		border: 1px solid var(--md-sys-color-outline-variant);
		color: var(--md-sys-color-on-surface);
		font-weight: 600;
		min-height: 40px;
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		font-size: 0.95rem;
		transition: all var(--transition-fast);
	}

	.payment-readonly .not-set {
		color: var(--md-sys-color-on-surface-variant);
		font-style: italic;
		opacity: 0.7;
	}

	.payment-readonly.paid {
		border-color: #22c55e;
		background: rgba(34, 197, 94, 0.08);
	}

	.payment-readonly.pending {
		border-color: #f59e0b;
		background: rgba(245, 158, 11, 0.08);
	}

	/* Payment Actions Container */
	.payment-actions {
		display: flex;
		gap: var(--spacing-xs);
		align-items: center;
	}

	/* Payment Status Toggle Button */
	.payment-status-toggle {
		background: var(--md-sys-color-surface);
		border: 1px solid var(--md-sys-color-outline-variant);
		padding: 8px;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all var(--transition-fast);
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 40px;
		min-height: 40px;
		flex-shrink: 0;
	}

	.payment-status-toggle:hover {
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
		transform: scale(1.05);
	}

	.payment-status-toggle:active {
		transform: scale(0.95);
	}

	.payment-status-toggle.paid {
		background: rgba(34, 197, 94, 0.15);
		border-color: #22c55e;
		color: #22c55e;
	}

	.payment-status-toggle.paid:hover:not(:disabled) {
		background: rgba(34, 197, 94, 0.2);
		border-color: #22c55e;
	}

	.payment-status-toggle.pending {
		background: rgba(245, 158, 11, 0.15);
		border-color: #f59e0b;
		color: #f59e0b;
	}

	.payment-status-toggle.pending:hover:not(:disabled) {
		background: rgba(245, 158, 11, 0.2);
		border-color: #f59e0b;
	}

	.payment-status-toggle .material-symbols-outlined {
		font-size: 20px;
	}

	.payment-status-toggle:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		background: var(--md-sys-color-surface-variant);
		border-color: var(--md-sys-color-outline-variant);
		color: var(--md-sys-color-on-surface-variant);
	}

	.payment-status-toggle:disabled:hover {
		transform: none;
		box-shadow: none;
	}

	/* Responsive */
	@media (max-width: 1200px) {
		.docreq-modal-grid {
			grid-template-columns: 1fr;
		}

		.docreq-modal-right-container {
			min-height: 500px;
		}
	}

	@media (max-width: 768px) {
		.docreq-modal-left-container,
		.docreq-modal-right-container {
			padding: var(--spacing-md);
		}

		.docreq-cards {
			flex-direction: column;
		}

		.student-info-grid {
			grid-template-columns: 1fr;
		}

		.docreq-modal-right-container {
			min-height: 400px;
		}

		.admin-chat-messages {
			min-height: 200px;
		}
	}

	/* Confirmation Modal Styles - Matching ModalContainer */
	.modal-confirm-content {
		display: flex;
		flex-direction: column;
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

	.modal-message p {
		margin: 0 0 12px 0;
	}

	.confirm-details {
		background: var(--md-sys-color-surface-container);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		border: 1px solid var(--md-sys-color-outline-variant);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-md);
	}

	.confirm-detail-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-xs) 0;
	}

	.detail-label {
		font-weight: 500;
		color: var(--md-sys-color-on-surface-variant);
		font-size: 0.9rem;
	}

	.detail-value {
		font-weight: 600;
		color: var(--md-sys-color-on-surface);
		font-size: 0.95rem;
	}

	.detail-value.payment-status-paid {
		color: #22c55e;
		text-transform: uppercase;
		font-weight: 700;
	}

	.detail-value.payment-status-pending {
		color: #f59e0b;
		text-transform: uppercase;
		font-weight: 700;
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

	.modal-btn-danger:hover {
		background-color: var(--md-sys-color-error-container);
		color: var(--md-sys-color-on-error-container);
		box-shadow: var(--shadow-sm);
	}

	.modal-btn:focus-visible {
		outline: 2px solid var(--md-sys-color-primary);
		outline-offset: 2px;
	}

	.reject-notice {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm);
		border: 1px solid var(--md-sys-color-outline-variant);
		border-radius: var(--radius-sm);
		margin-top: var(--spacing-sm);
		color: var(--md-sys-color-on-surface);
		font-size: 0.875rem;
		line-height: 1.4;
	}

	.reject-notice .material-symbols-outlined {
		color: var(--md-sys-color-error);
		font-size: 20px;
		flex-shrink: 0;
	}

	@media (max-width: 640px) {
		.modal-actions {
			flex-direction: column-reverse;
		}

		.modal-btn {
			width: 100%;
		}
	}

	/* File Upload Styles */
	.admin-chat-input-wrapper {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.selected-files-preview {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
		padding: var(--spacing-sm);
		background: var(--md-sys-color-surface-container);
		border-radius: var(--radius-md);
		border: 1px solid var(--md-sys-color-outline-variant);
	}

	.file-preview-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--md-sys-color-surface);
		border: 1px solid var(--md-sys-color-outline-variant);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
	}

	.file-preview-item .material-symbols-outlined {
		font-size: 18px;
		color: var(--md-sys-color-primary);
	}

	.file-preview-name {
		font-weight: 500;
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file-preview-size {
		color: var(--md-sys-color-on-surface-variant);
		font-size: 0.75rem;
	}

	.remove-file-btn {
		background: transparent;
		border: none;
		padding: 2px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		transition: all var(--transition-fast);
		color: var(--md-sys-color-on-surface-variant);
	}

	.remove-file-btn .material-symbols-outlined {
		font-size: 16px;
	}

	.remove-file-btn:hover {
		background: var(--md-sys-color-error-container);
		color: var(--md-sys-color-error);
	}

	/* Message Attachments */
	.message-attachments {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
		margin-top: var(--spacing-xs);
	}

	.attachment-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
		text-align: left;
		width: 100%;
	}

	.attachment-item:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: var(--md-sys-color-primary);
		transform: translateY(-1px);
	}

	.attachment-item .material-symbols-outlined:first-child {
		font-size: 20px;
	}

	.attachment-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.attachment-name {
		font-weight: 500;
		font-size: 0.9rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: inherit;
	}

	.attachment-size {
		font-size: 0.75rem;
		opacity: 0.7;
		color: inherit;
	}

	.attachment-item .material-symbols-outlined:last-child {
		font-size: 18px;
		opacity: 0.7;
	}

	.message-wrapper.sent .attachment-item {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.2);
		color: var(--md-sys-color-on-primary);
	}

	.message-wrapper.received .attachment-item {
		background: var(--md-sys-color-surface-container-high);
		border-color: var(--md-sys-color-outline-variant);
		color: var(--md-sys-color-on-surface);
	}
</style>


