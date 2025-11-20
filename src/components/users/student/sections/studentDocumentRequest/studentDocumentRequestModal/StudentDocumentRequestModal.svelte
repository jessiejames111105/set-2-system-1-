<script>
	import { authStore } from '../../../../../login/js/auth.js';
	import { api } from '../../../../../../routes/api/helper/api-helper.js';
	import { toastStore } from '../../../../../common/js/toastStore.js';
	import Modal from '../../../../../common/Modal.svelte';

	// Props passed from modal store
	let {
		request = {},
		onCancel = () => {},
		onRefresh = () => {},
		onClose = () => {}
	} = $props();

	// Local state for the modal
	let selectedRequest = $state({ ...request });
	let newMessage = $state('');
	let isProcessFlowOpen = $state(false);
	let isSendingMessage = $state(false);
	let chatMessagesEl = $state();
	let chatInputEl = $state();
	let fileInputEl = $state();
	let selectedFiles = $state([]);
	let pollingInterval;
	let showCancelModal = $state(false);
	let showStatusHistory = $state(false);
	let showPaymentInstructions = $state(false);
	// Mobile pagination state
	let currentPage = $state(1); // 1 = left container, 2 = right container
	
	// Swipe handling
	let touchStartX = $state(0);
	let touchEndX = $state(0);

	// Get messages from the request
	let messages = $derived(selectedRequest.messages || []);

	// Get status history from the request
	let statusHistory = $derived(selectedRequest.statusHistory || []);

	// Check if chat should be disabled based on status
	let isChatDisabled = $derived(
		selectedRequest.status === 'released' || selectedRequest.status === 'cancelled'
	);

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

	// Open process status flow modal
	function openProcessFlowModal() {
		isProcessFlowOpen = true;
	}

	function closeProcessFlowModal() {
		isProcessFlowOpen = false;
	}

	// Open/close status history sidebar
	function openStatusHistory() {
		showStatusHistory = true;
	}

	function closeStatusHistory() {
		showStatusHistory = false;
	}

	// Open/close payment instructions modal
	function openPaymentInstructions() {
		showPaymentInstructions = true;
	}

	function closePaymentInstructions() {
		showPaymentInstructions = false;
	}

	// Send a new message with optimistic UI update
	async function sendMessage() {
		if ((!newMessage.trim() && selectedFiles.length === 0) || isSendingMessage || !selectedRequest || isChatDisabled) return;

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
			author: $authStore.userData?.name || 'Student',
			authorRole: 'student',
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
			const result = await api.post('/api/document-requests', {
				action: 'sendMessage',
				requestId: selectedRequest.requestId,
				message: messageText,
				attachments: attachments
			});

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

	// Handle cancel request
	function handleCancelRequest() {
		// Show confirmation modal before cancelling
		showCancelModal = true;
	}

	async function confirmCancel() {
		if (onCancel) {
			await onCancel(selectedRequest);
		}
		showCancelModal = false;
		onClose();
	}

	function cancelCancelRequest() {
		showCancelModal = false;
	}

	// Mobile pagination functions
	function goToPage(page) {
		currentPage = page;
	}

	function nextPage() {
		if (currentPage < 2) currentPage++;
	}

	function prevPage() {
		if (currentPage > 1) currentPage--;
	}

	// Swipe gesture handlers
	function handleTouchStart(e) {
		touchStartX = e.touches[0].clientX;
	}

	function handleTouchMove(e) {
		touchEndX = e.touches[0].clientX;
	}

	function handleTouchEnd() {
		if (!touchStartX || !touchEndX) return;
		
		const swipeDistance = touchStartX - touchEndX;
		const minSwipeDistance = 50; // Minimum distance for a swipe
		
		if (Math.abs(swipeDistance) > minSwipeDistance) {
			if (swipeDistance > 0) {
				// Swiped left - go to next page
				nextPage();
			} else {
				// Swiped right - go to previous page
				prevPage();
			}
		}
		
		// Reset
		touchStartX = 0;
		touchEndX = 0;
	}

	// Fetch latest messages from server
	async function fetchLatestMessages() {
		if (!selectedRequest || isSendingMessage) return;

		try {
			const result = await api.get(`/api/document-requests?action=single&requestId=${selectedRequest.requestId}`);
			
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
				
				// Update status history if available
				if (result.data.statusHistory) {
					selectedRequest.statusHistory = result.data.statusHistory;
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

<div class="student-docreq-modal-content">
	<div 
		class="student-docreq-modal-grid"
	>
		<!-- LEFT CONTAINER: Request Information -->
		<div class="student-docreq-modal-left-container" class:mobile-hidden={currentPage !== 1}>
			<header class="student-docreq-modal-title">
				<h2>Request Details</h2>
				<div class="student-docreq-modal-sub">ID: <span>{selectedRequest.requestId}</span></div>
			</header>
			<!-- Request Info Cards -->
			<div class="student-docreq-cards">
				<!-- First Row: Status card (read-only, clickable for info) -->
				<div class="student-docreq-card full-width status-card-horizontal status-card-{selectedRequest.status}">
					<div class="status-group">
						<div class="card-label">
							<span class="material-symbols-outlined">info</span> Status:
						</div>
						<button
							class="status-badge status-{selectedRequest.status}"
							onclick={openStatusHistory}
							title="Click to view status history"
							aria-label="View status history timeline"
						>
							{getStatusDisplayName(selectedRequest.status)}
						</button>
					</div>
					<button
						class="status-info-button"
						onclick={openProcessFlowModal}
						title="Click to view status flow information"
						aria-label="View status flow information"
					>
						<span class="material-symbols-outlined">help</span>
					</button>
				</div>

		<!-- Second Row: Document Type, Quantity, and Processed By -->
		<div class="student-docreq-card third-row">
			<div class="card-label">
				<span class="material-symbols-outlined">description</span> Document Type
			</div>
			<div class="card-value">{selectedRequest.type}</div>
		</div>

		<div class="student-docreq-card third-row">
			<div class="card-label">
				<span class="material-symbols-outlined">numbers</span> Quantity
			</div>
			<div class="card-value">{selectedRequest.quantity || 1} {(selectedRequest.quantity || 1) === 1 ? 'copy' : 'copies'}</div>
		</div>

		<div class="student-docreq-card third-row">
			<div class="card-label">
				<span class="material-symbols-outlined">account_circle</span> Processed By
			</div>
			<div class="card-value">{selectedRequest.processedBy ?? '—'}</div>
		</div>

	<!-- Third Row: Payment and Dates -->
	{#if selectedRequest.paymentAmount !== null && selectedRequest.paymentAmount !== undefined}
	<div class="student-docreq-card third-row">
		<div class="card-label">
			<span class="material-symbols-outlined">payments</span> Total Payment
		</div>
		<div class="card-value payment-value">
			{#if selectedRequest.paymentAmount === 0}
				<span class="payment-amount free">Free</span>
			{:else if selectedRequest.paymentStatus === 'pending'}
				<!-- svelte-ignore a11y_invalid_attribute -->
				<a
					href="javascript:void(0)"
					class="payment-amount pending clickable"
					onclick={(e) => { e.preventDefault(); openPaymentInstructions(); }}
					title="Click to view payment instructions"
					aria-label="View payment instructions"
					role="button"
				>
					₱{(selectedRequest.paymentAmount || 0).toFixed(2)} (Pending)
				</a>
			{:else}
				<span class="payment-amount paid">
					₱{(selectedRequest.paymentAmount || 0).toFixed(2)} (Paid)
				</span>
			{/if}
		</div>
	</div>
	{/if}

	<div class="student-docreq-card third-row">
		<div class="card-label">
			<span class="material-symbols-outlined">calendar_today</span> Requested Date
		</div>
		<div class="card-value">{selectedRequest.requestedDate ?? '—'}</div>
	</div>

	{#if selectedRequest.status === 'cancelled' && selectedRequest.cancelledDate}
	<div class="student-docreq-card third-row">
		<div class="card-label">
			<span class="material-symbols-outlined">event_busy</span> Cancelled Date
		</div>
		<div class="card-value">{selectedRequest.cancelledDate}</div>
	</div>
	{:else if selectedRequest.tentativeDate}
	<div class="student-docreq-card third-row">
		<div class="card-label">
			<span class="material-symbols-outlined">event</span> Tentative Date
		</div>
		<div class="card-value">
			<div class="date-display">
				{formatDate(selectedRequest.tentativeDate)}
			</div>
		</div>
	</div>
	{/if}

	{#if selectedRequest.status === 'released' && selectedRequest.completedDate}
	<div class="student-docreq-card">
		<div class="card-label">
			<span class="material-symbols-outlined">check_circle</span> Released Date
		</div>
		<div class="card-value">{selectedRequest.completedDate}</div>
	</div>
	{/if}
			</div>

		<!-- Purpose Section -->
		<div class="student-docreq-purpose">
			<div class="purpose-label">
				<span class="material-symbols-outlined">description</span> Purpose & Details
			</div>
			<div class="purpose-content">
				{selectedRequest.purpose || 'No purpose provided'}
			</div>
		</div>

		{#if selectedRequest.adminNote}
		<!-- Admin Note Section -->
		<div class="admin-note-section">
			<div class="note-label">
				<span class="material-symbols-outlined">note</span> Admin Note
			</div>
			<p class="note-text">{selectedRequest.adminNote}</p>
		</div>
		{/if}

		<!-- Action Buttons -->
		<div class="student-modal-action-buttons">
			<button 
				class="student-cancel-button" 
				onclick={handleCancelRequest}
				disabled={selectedRequest.status !== 'on_hold'}
				title={selectedRequest.status !== 'on_hold' ? 'Can only cancel requests that are on hold' : 'Cancel this request'}
			>
				<span class="material-symbols-outlined">cancel</span>
				Cancel Request
			</button>

			<button class="student-back-button" onclick={onClose}>
				<span class="material-symbols-outlined">arrow_back</span>
				Back
			</button>
		</div>
	</div>

	<!-- RIGHT CONTAINER: Chat -->
	<div class="student-docreq-modal-right-container" class:mobile-hidden={currentPage !== 2}>
			<div class="chat-container">
				<div class="chat-header">
					<h3><span class="material-symbols-outlined">forum</span> Communication</h3>
					<span class="chat-count-badge">{messages.length}</span>
				</div>

				<div class="student-chat-messages" bind:this={chatMessagesEl}>
					{#if messages.length > 0}
						{#each messages as msg (msg.id)}
							<div class="message-wrapper {msg.authorRole === 'admin' ? 'received' : 'sent'}">
								{#if msg.authorRole === 'admin'}
									<div class="message-avatar">
										<span class="material-symbols-outlined">admin_panel_settings</span>
									</div>
								{/if}
								<div class="message-bubble">
									<div class="message-header">
										<span class="message-author">{msg.author}</span>
										<span class="message-time">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
									</div>
									{#if msg.text}
										<div class="student-document-request-message-text">{msg.text}</div>
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
							<p class="subtitle">Start a conversation with the admin</p>
						</div>
					{/if}
				</div>

				<div class="student-chat-input-wrapper">
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
					<div class="student-chat-input" class:disabled={isChatDisabled}>
						{#if isChatDisabled}
							<div class="chat-disabled-notice">
								<span class="material-symbols-outlined">block</span>
								<span>Chat is disabled for {selectedRequest.status === 'released' ? 'released' : 'cancelled'} requests</span>
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

	<!-- Mobile Pagination Controls -->
	<div class="mobile-pagination-controls">
		<div class="pagination-dots">
			<button 
				class="pagination-dot" 
				class:active={currentPage === 1}
				onclick={() => goToPage(1)}
				aria-label="Go to request details"
			>
				<span class="material-symbols-outlined">description</span>
			</button>
			<button 
				class="pagination-dot" 
				class:active={currentPage === 2}
				onclick={() => goToPage(2)}
				aria-label="Go to chat"
			>
				<span class="material-symbols-outlined">forum</span>
			</button>
		</div>
	</div>
</div>

<!-- Status History Sidebar Modal -->
{#if showStatusHistory}
	<div 
		class="status-history-backdrop" 
		onclick={closeStatusHistory}
		onkeydown={(e) => e.key === 'Escape' && closeStatusHistory()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div 
			class="status-history-sidebar"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="status-history-header">
				<div class="status-history-title">
					<span class="material-symbols-outlined">history</span>
					<h3>Status History</h3>
				</div>
				<button class="status-history-close-btn" aria-label="Close" onclick={closeStatusHistory}>
					<span class="material-symbols-outlined">close</span>
				</button>
			</div>

			<div class="status-history-body">
				{#if statusHistory && statusHistory.length > 0}
					<div class="status-timeline">
						{#each statusHistory as entry, index (entry.timestamp || index)}
							<div class="timeline-item">
								<div class="timeline-marker status-{entry.status}">
									<span class="material-symbols-outlined">
										{#if entry.status === 'on_hold'}
											pause_circle
										{:else if entry.status === 'verifying'}
											fact_check
										{:else if entry.status === 'processing'}
											sync
										{:else if entry.status === 'for_pickup'}
											inventory
										{:else if entry.status === 'released'}
											check_circle
										{:else if entry.status === 'rejected'}
											cancel
										{:else if entry.status === 'cancelled'}
											block
										{:else}
											circle
										{/if}
									</span>
								</div>
								<div class="timeline-content">
									<div class="timeline-header">
										<h4>{getStatusDisplayName(entry.status)}</h4>
										<span class="timeline-date">
											{new Date(entry.timestamp).toLocaleDateString('en-US', { 
												month: 'short', 
												day: 'numeric', 
												year: 'numeric',
												hour: '2-digit',
												minute: '2-digit'
											})}
										</span>
									</div>
									{#if entry.changedBy}
										<p class="timeline-user">
											<span class="material-symbols-outlined">person</span>
											{entry.changedBy}
										</p>
									{/if}
									<p class="timeline-note">{entry.note || 'No additional details'}</p>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="no-history">
						<span class="material-symbols-outlined">history_toggle_off</span>
						<p>No status history available</p>
						<p class="subtitle">Status changes will appear here</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Process Status Flow Modal -->
{#if isProcessFlowOpen}
	<div 
		class="flow-backdrop" 
		onclick={closeProcessFlowModal}
		onkeydown={(e) => e.key === 'Enter' && closeProcessFlowModal()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div 
			class="flow-container" 
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="document"
		>
			<div class="flow-header">
				<h2>Process Status Flow</h2>
				<button class="flow-close-btn" aria-label="Close" onclick={closeProcessFlowModal}>
					<span class="material-symbols-outlined">close</span>
				</button>
			</div>

			<div class="flow-body">
				<div class="flow-list">
					<!-- On Hold -->
					<div class="flow-item">
						<div class="flow-icon-wrapper on_hold">
							<span class="material-symbols-outlined">pause_circle</span>
						</div>
						<div class="flow-content">
							<h3>On Hold</h3>
							<p>Your request is awaiting review by the admin.</p>
						</div>
					</div>

					<!-- Verifying -->
					<div class="flow-item">
						<div class="flow-icon-wrapper verifying">
							<span class="material-symbols-outlined">fact_check</span>
						</div>
						<div class="flow-content">
							<h3>Verifying</h3>
							<p>The document request is currently being verified. (Takes up to 5 days)</p>
						</div>
					</div>

					<!-- Processing -->
					<div class="flow-item">
						<div class="flow-icon-wrapper processing">
							<span class="material-symbols-outlined">sync</span>
						</div>
						<div class="flow-content">
							<h3>For Processing</h3>
							<p>The document is in the processing stage.</p>
						</div>
					</div>

					<!-- For Pick Up -->
					<div class="flow-item">
						<div class="flow-icon-wrapper for_pickup">
							<span class="material-symbols-outlined">inventory</span>
						</div>
						<div class="flow-content">
							<h3>For Pick Up</h3>
							<p>The document is ready and available for pick up.</p>
						</div>
					</div>

					<!-- Released -->
					<div class="flow-item">
						<div class="flow-icon-wrapper released">
							<span class="material-symbols-outlined">check_circle</span>
						</div>
						<div class="flow-content">
							<h3>Released</h3>
							<p>The document has been released to you.</p>
						</div>
					</div>

					<!-- Rejected -->
					<div class="flow-item">
						<div class="flow-icon-wrapper rejected">
							<span class="material-symbols-outlined">cancel</span>
						</div>
						<div class="flow-content">
							<h3>Rejected</h3>
							<p>The request was rejected. Check the rejection reason or contact admin.</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Confirmation Modal for Cancel -->
{#if showCancelModal}
	<Modal 
		title="Cancel Request" 
		size="small" 
		closable={true}
		onClose={cancelCancelRequest}
	>
		<div class="modal-confirm-content">
			<div class="modal-message">
				<p>Are you sure you want to cancel this document request?</p>
				<div class="confirm-details cancel-warning">
					<div class="confirm-detail-row">
						<span class="detail-label">Request ID:</span>
						<span class="detail-value">{selectedRequest.requestId}</span>
					</div>
					<div class="confirm-detail-row">
						<span class="detail-label">Document Type:</span>
						<span class="detail-value">{selectedRequest.type}</span>
					</div>
					<div class="confirm-detail-row">
						<span class="detail-label">Status:</span>
						<span class="detail-value">{getStatusDisplayName(selectedRequest.status)}</span>
					</div>
					<div class="cancel-notice">
						<span class="material-symbols-outlined">warning</span>
						<span>This action will mark your request as cancelled. You may need to submit a new request if needed.</span>
					</div>
				</div>
			</div>
			<div class="modal-actions">
				<button class="modal-btn modal-btn-secondary" onclick={cancelCancelRequest}>
					Go Back
				</button>
				<button class="modal-btn modal-btn-danger" onclick={confirmCancel}>
					Cancel Request
				</button>
			</div>
		</div>
	</Modal>
{/if}

<!-- Payment Instructions Modal -->
{#if showPaymentInstructions}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="payment-instructions-backdrop" 
		onclick={closePaymentInstructions}
		onkeydown={(e) => e.key === 'Escape' && closePaymentInstructions()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div 
			class="payment-instructions-container" 
			onclick={(e) => e.stopPropagation()}
		>
			<div class="payment-instructions-header">
				<h2>Payment Instructions</h2>
				<button class="payment-instructions-close-btn" onclick={closePaymentInstructions}>
					<span class="material-symbols-outlined">close</span>
				</button>
			</div>

			<div class="payment-instructions-body">
				<p>You can pay once your document is ready for pick-up.</p>
				<p>Please follow these steps to complete your payment and claim your document:</p>

				<ol class="payment-instructions-steps">
					<li>Wait until your request status shows "Ready for Pick-Up."</li>
					<li>Go to the Cashier's Office.</li>
					<li>Inform the cashier that you are paying for your approved document request.</li>
					<li>Provide your Request Reference Number or Student ID.</li>
					<li>Pay the required amount for your document.</li>
					<li>Get your Official Receipt.</li>
					<li>Proceed to the Registrar's Office (or releasing area) and present your receipt to claim your document.</li>
				</ol>
			</div>

			<div class="payment-instructions-footer">
				<button class="payment-instructions-got-it-btn" onclick={closePaymentInstructions}>
					Got it
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.student-docreq-modal-content {
		width: 100%;
		max-width: 1400px;
		background-color: var(--md-sys-color-surface-container-high);
		border-radius: var(--radius-xl);
		border: none;
		box-shadow: var(--shadow-lg);
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		max-height: 90vh;
	}

	.student-docreq-modal-grid {
		display: grid;
		grid-template-columns: 1.2fr 1fr;
		gap: var(--spacing-xl);
		align-items: stretch;
		padding: var(--spacing-md);
	}

	.student-docreq-modal-left-container {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		background-color: var(--md-sys-color-surface-container);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
		border: 1px solid var(--md-sys-color-outline-variant);
		height: 100%;
	}

	.student-docreq-modal-right-container {
		display: flex;
		flex-direction: column;
		background-color: var(--md-sys-color-surface-container);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
		border: 1px solid var(--md-sys-color-outline-variant);
		height: 100%;
	}

	.student-docreq-modal-title h2 {
		margin: 0 0 6px 0;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.student-docreq-modal-sub {
		color: var(--md-sys-color-on-surface-variant);
		font-size: 0.875rem;
		margin-top: 6px;
	}

	.student-docreq-cards {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-md);
	}

	.student-docreq-card {
		background-color: var(--md-sys-color-surface-container);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		border: 1px solid var(--md-sys-color-outline-variant);
		flex: 1 1 calc(33.333% - var(--spacing-md));
		min-width: 200px;
	}

	.student-docreq-card.full-width {
		flex: 1 1 100%;
	}

	.student-docreq-card.half-width {
		flex: 1 1 calc(50% - var(--spacing-md) / 2);
	}

	.student-docreq-card.third-row {
		flex: 1 1 calc(33.333% - var(--spacing-md) * 2 / 3);
		min-width: 180px;
	}

	.student-docreq-card.status-card-horizontal {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
	}

	.status-group {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		flex: 1;
	}

	.student-docreq-card.status-card-horizontal .card-label {
		margin: 0;
	}
	.status-info-button {
		background: var(--md-sys-color-surface-container);
		border: none;
		padding: 8px;
		border-radius: 50%;
		cursor: pointer;
		color: var(--md-sys-color-on-surface);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--transition-fast);
		min-width: 36px;
		min-height: 36px;
		flex-shrink: 0;
	}

	.status-info-button .material-symbols-outlined {
		font-size: 20px;
	}

	.card-label {
		color: var(--md-sys-color-on-surface-variant);
		font-size: 0.875rem;
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.student-docreq-card:not(.status-card-horizontal) .card-label .material-symbols-outlined,
	.purpose-label .material-symbols-outlined,
	.note-label .material-symbols-outlined {
		display: none;
	}

	.card-value {
		margin-top: 8px;
		font-weight: 600;
		font-size: 1rem;
	}

	.payment-value {
		display: flex;
		align-items: center;
		gap: 8px;
		justify-content: space-between;
	}

	.payment-amount {
		font-size: 1rem;
	}

	.payment-amount.free {
		color: var(--md-sys-color-tertiary);
		font-weight: 700;
	}

	.payment-amount.paid {
		color: var(--status-released-text);
	}

	.payment-amount.pending {
		color: var(--status-pending-text);
	}

	.payment-amount.clickable {
		cursor: pointer;
		transition: all var(--transition-fast);
		color: var(--status-pending-text);
		display: inline-block;
		text-decoration: none;
	}

	.payment-amount.clickable:hover {
		transform: scale(1.02);
		opacity: 0.8;
	}

	.payment-amount.clickable:active {
		transform: scale(0.98);
	}

	.status-badge {
		display: inline-block;
		padding: 6px 12px;
		border-radius: 16px;
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: capitalize;
		border: none;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.status-badge:hover {
		transform: scale(1.05);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.status-badge:active {
		transform: scale(0.98);
	}

	.status-badge.on_hold {
		background: var(--status-on-hold-bg);
		color: var(--status-on-hold-text);
	}

	.status-badge.verifying {
		background: var(--status-verifying-bg);
		color: var(--status-verifying-text);
	}

	.status-badge.processing {
		background: var(--status-processing-bg);
		color: var(--status-processing-text);
	}

	.status-badge.for_pickup {
		background: var(--status-for-pickup-bg);
		color: var(--status-for-pickup-text);
		border-color: var(--status-for-pickup-border);
	}

	.status-badge.released {
		background: var(--status-released-bg);
		color: var(--status-released-text);
	}

	.status-badge.rejected {
		background: var(--status-rejected-bg);
		color: var(--status-rejected-text);
	}

	.status-badge.cancelled {
		background: var(--status-cancelled-bg);
		color: var(--status-cancelled-text);
	}

	/* Status Card Border Colors - Match Badge Colors */
	.status-card-horizontal.status-card-on_hold {
		border-color: var(--status-on-hold-bg);
	}

	.status-card-horizontal.status-card-verifying {
		border-color: var(--status-verifying-bg);
	}

	.status-card-horizontal.status-card-processing {
		border-color: var(--status-processing-bg);
	}

	.status-card-horizontal.status-card-for_pickup {
		border-color: var(--status-for-pickup-bg);
	}

	.status-card-horizontal.status-card-released {
		border-color: var(--status-released-bg);
	}

	.status-card-horizontal.status-card-rejected {
		border-color: var(--status-rejected-bg);
	}
	
	.date-display {
		display: inline-block;
		color: var(--md-sys-color-on-surface);
	}

	.student-docreq-purpose {
		margin-top: var(--spacing-sm);
    height: 100%;
		width: 100%;
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
		min-height: 100px;
		word-wrap: break-word;
		word-break: break-word;
		overflow-wrap: break-word;
		white-space: pre-wrap;
	}

	.admin-note-section {
		margin-top: var(--spacing-sm);
		padding: var(--spacing-md);
		background-color: var(--md-sys-color-tertiary-container);
		border-radius: var(--radius-md);
		border: 1px solid var(--md-sys-color-outline-variant);
	}

	.note-label {
		display: flex;
		gap: 8px;
		align-items: center;
		color: var(--md-sys-color-on-tertiary-container);
		font-weight: 600;
		margin-bottom: 8px;
		font-size: 0.875rem;
	}

	.note-text {
		background: var(--md-sys-color-surface);
		padding: 12px;
		border-radius: var(--radius-md);
		margin: 0;
		line-height: 1.6;
		color: var(--md-sys-color-on-surface);
	}

	/* Chat Container */
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

	.student-chat-messages {
		flex: 1;
		background: var(--md-sys-color-surface);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		border: 1px solid var(--md-sys-color-outline-variant);
		overflow-y: auto;
		max-height: 500px;
		min-height: 330px;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
		justify-content: end;
	}

	/* Reduce chat messages height when files are selected */
	.chat-container:has(.selected-files-preview) .student-chat-messages {
		max-height: 448px;
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
		max-width: 15rem;
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

	.student-chat-input {
		display: flex;
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
		background: var(--md-sys-color-surface);
		border-radius: var(--radius-md);
		border: 1px solid var(--md-sys-color-outline-variant);
		align-items: center;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
		margin-top: auto;
		min-width: 0;
	}

	.student-chat-input input {
		flex: 1;
		padding: 12px var(--spacing-md);
		border-radius: var(--radius-md);
		background: var(--md-sys-color-surface-container);
		border: 1px solid var(--md-sys-color-outline-variant);
		color: var(--md-sys-color-on-surface);
		font-size: 0.95rem;
		transition: all var(--transition-fast);
		min-width: 0;
	}

	.student-chat-input input:focus {
		outline: none;
		border-color: var(--md-sys-color-primary);
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
		background: var(--md-sys-color-surface);
	}

	.student-chat-input input::placeholder {
		color: var(--md-sys-color-on-surface-variant);
		opacity: 0.7;
	}

	.student-chat-input.disabled {
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

	.student-modal-action-buttons {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
		margin-top: auto;
		padding-top: var(--spacing-md);
		border-top: 2px solid var(--md-sys-color-outline-variant);
	}

	.student-cancel-button {
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

	.student-cancel-button .material-symbols-outlined {
		font-size: 22px;
	}

	.student-cancel-button:hover {
		background: var(--md-sys-color-error);
		opacity: 0.9;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		transform: translateY(-1px);
	}

	.student-cancel-button:active {
		transform: translateY(0);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.student-cancel-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		background: var(--md-sys-color-surface-variant);
		color: var(--md-sys-color-on-surface-variant);
	}

	.student-cancel-button:disabled:hover {
		transform: none;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		opacity: 0.5;
	}

	.student-back-button {
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

	.student-back-button .material-symbols-outlined {
		font-size: 22px;
	}

	.student-back-button:hover {
		background-color: var(--md-sys-color-surface-container-highest);
		border-color: var(--md-sys-color-outline);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
		transform: translateY(-1px);
	}

	.student-back-button:active {
		transform: translateY(0);
		box-shadow: none;
	}

	/* Process Flow Modal */
	.flow-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10002;
		padding: var(--spacing-lg);
	}

	.flow-container {
		width: 100%;
		max-width: 600px;
		max-height: 90vh;
		background: var(--md-sys-color-surface-container-high);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-xl);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.flow-header {
		padding: var(--spacing-lg);
		border-bottom: 1px solid var(--md-sys-color-outline-variant);
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--md-sys-color-surface-container);
	}

	.flow-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--md-sys-color-on-surface);
	}

	.flow-close-btn {
		background: var(--md-sys-color-surface-container-highest);
		border: none;
		padding: 8px;
		border-radius: 50%;
		cursor: pointer;
		color: var(--md-sys-color-on-surface);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--transition-fast);
		width: 36px;
		height: 36px;
	}

	.flow-close-btn:hover {
		background: var(--md-sys-color-surface-container-highest);
	}

	.flow-close-btn:active {
		transform: scale(0.95);
	}

	.flow-close-btn .material-symbols-outlined {
		font-size: 20px;
	}

	.flow-body {
		flex: 1;
		overflow-y: auto;
		padding: var(--spacing-lg);
    background-color: var(--md-sys-color-surface-container);
	}

	.flow-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.flow-item {
		display: flex;
		gap: var(--spacing-md);
		padding: var(--spacing-md);
		background: var(--md-sys-color-surface-container);
		border-radius: var(--radius-md);
		border: 1px solid var(--md-sys-color-outline-variant);
		align-items: flex-start;
	}

	.flow-icon-wrapper {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.flow-icon-wrapper .material-symbols-outlined {
		font-size: 24px;
	}

	.flow-icon-wrapper.on_hold {
		background: var(--status-on-hold-bg);
		color: var(--status-on-hold-text);
	}

	.flow-icon-wrapper.verifying {
		background: var(--status-verifying-bg);
		color: var(--status-verifying-text);
	}

	.flow-icon-wrapper.processing {
		background: var(--status-processing-bg);
		color: var(--status-processing-text);
	}

	.flow-icon-wrapper.for_pickup {
		background: var(--status-for-pickup-bg);
		color: var(--status-for-pickup-text);
	}

	.flow-icon-wrapper.released {
		background: var(--status-released-bg);
		color: var(--status-released-text);
	}

	.flow-icon-wrapper.rejected {
		background: var(--status-rejected-bg);
		color: var(--status-rejected-text);
	}

	.flow-content {
		flex: 1;
	}

	.flow-content h3 {
		margin: 0 0 4px 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--md-sys-color-on-surface);
	}

	.flow-content p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--md-sys-color-on-surface-variant);
		line-height: 1.4;
	}

	/* Mobile Pagination Controls */
	.mobile-pagination-controls {
		display: none;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-sm);
		background-color: none;
		margin-top: var(--spacing-xs);
		position: relative;
		z-index: 10;
		flex-shrink: 0;
	}

	.pagination-dots {
		display: flex;
		gap: var(--spacing-md);
		align-items: center;
	}

	.pagination-dot {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background-color: var(--md-sys-color-surface-container-highest);
		border: 1.5px solid var(--md-sys-color-outline-variant);
		cursor: pointer;
		transition: all var(--transition-fast);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--md-sys-color-on-surface-variant);
		pointer-events: auto;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	.pagination-dot .material-symbols-outlined {
		font-size: 18px;
	}

	.pagination-dot.active {
		background-color: var(--md-sys-color-primary);
		border-color: var(--md-sys-color-primary);
		color: var(--md-sys-color-on-primary);
		transform: scale(1.05);
		box-shadow: 0 1px 4px rgba(99, 102, 241, 0.3);
		pointer-events: none;
	}

	.pagination-dot:hover:not(.active) {
		background-color: var(--md-sys-color-surface-container-highest);
		border-color: var(--md-sys-color-outline);
		transform: scale(1.02);
	}

	/* Responsive */
	@media (max-width: 1200px) {
		.student-docreq-modal-grid{
			padding: 0;
		}
		
		.student-docreq-card.third-row {
			flex: 1 1 calc(33.333% - var(--spacing-md) * 2 / 3);
			min-width: 120px;
		}
	}

	@media (max-width: 768px) {
		.student-docreq-modal-content {
			overflow: visible;
			max-height: none;
			height: auto;
		}

		.student-docreq-modal-title{
			display: flex;
			align-items: center;
			justify-content: space-between;
		}

		.student-docreq-modal-title h2 {
			font-size: 1.15rem;
			font-weight: 600;
			margin: 0;
		}

		.student-docreq-modal-sub {
			margin: 0;
		}

		.student-chat-messages {
			max-height: 58vh;
		}

		.student-modal-action-buttons{
			flex-direction: row-reverse;
			gap: var(--spacing-sm);
		}

		/* Show pagination controls on mobile */
		.mobile-pagination-controls {
			display: flex;
			position: relative;
			z-index: 100;
			touch-action: manipulation;
		}

		.student-docreq-modal-grid{
			grid-template-columns: 1fr;
			overflow: visible;
			position: relative;
			padding: 0;
		}

		/* Hide containers based on pagination */
		.mobile-hidden {
			display: none !important;
		}

		.student-docreq-modal-left-container,
		.student-docreq-modal-right-container {
			padding: var(--spacing-md);
			gap: var(--spacing-sm);
			overflow-y: auto;
			max-height: 80vh;
		}
		
		.student-docreq-card {
			flex: 1 1 100%;
		}
		
		.student-docreq-card.half-width {
			flex: 1 1 calc(50% - var(--spacing-md) / 2);
			min-width: 140px;
		}

		.student-docreq-modal-right-container {
			min-height: 400px;
		}

		.chat-messages {
			min-height: 200px;
		}

		.flow-backdrop {
			padding: var(--spacing-md);
		}

		.flow-container {
			max-width: 100%;
		}

		.flow-body {
			padding: var(--spacing-md);
		}

		.flow-item {
			padding: var(--spacing-sm) var(--spacing-md);
		}

		.flow-icon-wrapper {
			width: 36px;
			height: 36px;
		}

		.flow-icon-wrapper .material-symbols-outlined {
			font-size: 20px;
		}
	}

	/* Confirmation Modal Styles - Matching Admin Modal */
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

	.cancel-notice {
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

	.cancel-notice .material-symbols-outlined {
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
	.student-chat-input-wrapper {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
		margin-top: auto;
		flex-shrink: 0;
	}

	.selected-files-preview {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
		padding: var(--spacing-sm);
		background: var(--md-sys-color-surface-container);
		border-radius: var(--radius-md);
		border: 1px solid var(--md-sys-color-outline-variant);
		margin-bottom: var(--spacing-xs);
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

	/* Status History Sidebar Modal */
	.status-history-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		z-index: 10003;
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.status-history-sidebar {
		position: fixed;
		top: 0;
		right: 0;
		width: 100%;
		max-width: 480px;
		height: 100vh;
		background: var(--md-sys-color-surface-container-high);
		box-shadow: var(--shadow-xl);
		display: flex;
		flex-direction: column;
		animation: slideInRight 0.3s ease-out;
		z-index: 10004;
	}

	@keyframes slideInRight {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(0);
		}
	}

	.status-history-header {
		padding: var(--spacing-lg);
		border-bottom: 1px solid var(--md-sys-color-outline-variant);
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--md-sys-color-surface-container);
		flex-shrink: 0;
	}

	.status-history-title {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.status-history-title h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--md-sys-color-on-surface);
	}

	.status-history-title .material-symbols-outlined {
		font-size: 28px;
		color: var(--md-sys-color-primary);
	}

	.status-history-close-btn {
		background: var(--md-sys-color-surface-container-highest);
		border: none;
		padding: 8px;
		border-radius: 50%;
		cursor: pointer;
		color: var(--md-sys-color-on-surface);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--transition-fast);
		width: 40px;
		height: 40px;
	}


	.status-history-close-btn .material-symbols-outlined {
		font-size: 22px;
	}

	.status-history-body {
		flex: 1;
		overflow-y: auto;
		padding: var(--spacing-lg);
		background: var(--md-sys-color-surface-container);
	}

	/* Timeline Styles */
	.status-timeline {
		position: relative;
		padding-left: var(--spacing-md);
	}

	.timeline-item {
		position: relative;
		padding-left: var(--spacing-xl);
		padding-bottom: var(--spacing-lg);
		display: flex;
		gap: var(--spacing-md);
	}

	.timeline-item::before {
		content: '';
		position: absolute;
		left: 5px;
		top: 40px;
		bottom: 0;
		width: 2px;
		background: var(--md-sys-color-outline-variant);
		opacity: 0.3;
	}

	.timeline-item:last-child {
		padding-bottom: 0;
	}

	.timeline-item:last-child::before {
		display: none;
	}

	.timeline-marker {
		position: absolute;
		left: -15px;
		top: 0;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border: 3px solid var(--md-sys-color-surface-container);
		background: var(--md-sys-color-surface-container-highest);
		z-index: 100;
	}

	.timeline-marker .material-symbols-outlined {
		font-size: 22px;
		font-weight: 600;
	}

	.timeline-marker.status-on_hold {
		background: #fbc02d;
		color: #ffffff;
		border-color: #f57f17;
	}

	.timeline-marker.status-verifying {
		background: #5c6bc0;
		color: #ffffff;
		border-color: #3949ab;
	}

	.timeline-marker.status-processing {
		background: #ff9800;
		color: #ffffff;
		border-color: #f57c00;
	}

	.timeline-marker.status-for_pickup {
		background: #00bcd4;
		color: #ffffff;
		border-color: #0097a7;
	}

	.timeline-marker.status-released {
		background: #4caf50;
		color: #ffffff;
		border-color: #388e3c;
	}

	.timeline-marker.status-rejected {
		background: #f44336;
		color: #ffffff;
		border-color: #d32f2f;
	}

	.timeline-marker.status-cancelled {
		background: #757575;
		color: #ffffff;
		border-color: #616161;
	}

	.timeline-content {
		flex: 1;
		background: var(--md-sys-color-surface-container-highest);
		padding: var(--spacing-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--md-sys-color-outline-variant);
	}

	.timeline-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: var(--spacing-xs);
		gap: var(--spacing-sm);
	}

	.timeline-header h4 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--md-sys-color-on-surface);
	}

	.timeline-date {
		font-size: 0.75rem;
		color: var(--md-sys-color-on-surface-variant);
		white-space: nowrap;
	}

	.timeline-user {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.875rem;
		color: var(--md-sys-color-on-surface-variant);
		margin: var(--spacing-xs) 0;
	}

	.timeline-user .material-symbols-outlined {
		font-size: 16px;
	}

	.timeline-note {
		margin: var(--spacing-xs) 0 0 0;
		font-size: 0.875rem;
		color: var(--md-sys-color-on-surface);
		line-height: 1.5;
		padding: var(--spacing-xs);
	}

	.no-history {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-xl);
		color: var(--md-sys-color-on-surface-variant);
		text-align: center;
		min-height: 300px;
	}

	.no-history .material-symbols-outlined {
		font-size: 64px;
		opacity: 0.3;
		margin-bottom: var(--spacing-md);
	}

	.no-history p {
		margin: 4px 0;
		font-size: 1rem;
	}

	.no-history .subtitle {
		font-size: 0.875rem;
		opacity: 0.7;
	}

	/* Responsive for status history sidebar */
	@media (max-width: 768px) {
		.status-history-sidebar {
			max-width: 100%;
		}

		.status-history-header {
			padding: var(--spacing-md);
		}

		.status-history-title h3 {
			font-size: 1.125rem;
		}

		.status-history-body {
			padding: var(--spacing-md);
		}

		.timeline-item {
			padding-left: var(--spacing-lg);
		}

		.timeline-marker {
			width: 36px;
			height: 36px;
		}

		.timeline-marker .material-symbols-outlined {
			font-size: 20px;
		}

		.timeline-content {
			padding: var(--spacing-sm);
		}

		.timeline-header h4 {
			font-size: 0.95rem;
		}
	}

	/* Payment Instructions Modal */
	.payment-instructions-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10005;
		padding: var(--spacing-lg);
	}

	.payment-instructions-container {
		width: 100%;
		max-width: 500px;
		background: var(--md-sys-color-surface-container-high);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		max-height: 90vh;
	}

	.payment-instructions-header {
		padding: var(--spacing-lg);
		border-bottom: 1px solid var(--md-sys-color-outline-variant);
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--md-sys-color-surface-container);
	}

	.payment-instructions-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--md-sys-color-on-surface);
	}

	.payment-instructions-close-btn {
		background: transparent;
		border: none;
		padding: 4px;
		cursor: pointer;
		color: var(--md-sys-color-on-surface);
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		transition: all var(--transition-fast);
	}

	.payment-instructions-close-btn:hover {
		background: var(--md-sys-color-surface-container-highest);
	}

	.payment-instructions-close-btn .material-symbols-outlined {
		font-size: 24px;
	}

	.payment-instructions-body {
		padding: var(--spacing-lg);
		overflow-y: auto;
		background: var(--md-sys-color-surface-container);
	}

	.payment-instructions-body p {
		margin: 0 0 var(--spacing-md) 0;
		color: var(--md-sys-color-on-surface);
		line-height: 1.6;
	}

	.payment-instructions-body p:last-of-type {
		margin-bottom: var(--spacing-lg);
	}

	.payment-instructions-steps {
		list-style: decimal;
		padding-left: var(--spacing-xl);
		margin: 0;
		color: var(--md-sys-color-on-surface);
		line-height: 1.8;
	}

	.payment-instructions-steps li {
		margin-bottom: var(--spacing-sm);
	}

	.payment-instructions-steps li:last-child {
		margin-bottom: 0;
	}

	.payment-instructions-footer {
		padding: var(--spacing-lg);
		border-top: 1px solid var(--md-sys-color-outline-variant);
		background: var(--md-sys-color-surface-container);
		display: flex;
		justify-content: flex-end;
	}

	.payment-instructions-got-it-btn {
		padding: var(--spacing-sm) var(--spacing-xl);
		border-radius: var(--radius-md);
		background: var(--md-sys-color-primary);
		color: var(--md-sys-color-on-primary);
		border: none;
		font-weight: 600;
		font-size: 1rem;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.payment-instructions-got-it-btn:hover {
		background: var(--md-sys-color-primary-container);
		color: var(--md-sys-color-on-primary-container);
		box-shadow: var(--shadow-sm);
		transform: translateY(-1px);
	}

	.payment-instructions-got-it-btn:active {
		transform: translateY(0);
	}

	.payment-instructions-got-it-btn:focus-visible {
		outline: 2px solid var(--md-sys-color-primary);
		outline-offset: 2px;
	}

	@media (max-width: 768px) {
		.student-chat-messages{
			margin-bottom: var(--spacing-sm);
			min-height: 460px;
		}

		.card-value, .payment-amount{
			font-size: 13px;
		}

		.student-docreq-purpose {
			margin: 0;
		}
		.student-docreq-cards{
			gap: var(--spacing-sm);
		}
		.payment-instructions-backdrop {
			padding: var(--spacing-md);
		}

		.payment-instructions-container {
			max-width: 100%;
		}

		.payment-instructions-header,
		.payment-instructions-body,
		.payment-instructions-footer {
			padding: var(--spacing-xs);
		}

		.payment-instructions-got-it-btn {
			width: 100%;
		}
	}
</style>

