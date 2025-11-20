import { writable } from 'svelte/store';
import { api } from '../../../routes/api/helper/api-helper.js';
import { toastStore } from '../../../components/common/js/toastStore.js';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_KEY_PREFIX = 'student_doc_requests_';

// Create the store
function createStudentDocumentRequestStore() {
	const initialState = {
		requestHistory: [],
		isLoading: false,
		isRefreshing: false,
		error: null,
		lastUpdated: null,
		currentStudentId: null
	};

	const { subscribe, set, update } = writable(initialState);

	// Helper function to get cache key
	function getCacheKey(studentId) {
		return `${CACHE_KEY_PREFIX}${studentId}`;
	}

	// Helper function to check if cached data is valid
	function isCacheValid(cachedData) {
		if (!cachedData || !cachedData.timestamp) return false;
		return Date.now() - cachedData.timestamp < CACHE_DURATION;
	}

	// Helper function to get cached data
	function getCachedData(studentId) {
		try {
			const cacheKey = getCacheKey(studentId);
			const cached = localStorage.getItem(cacheKey);
			if (cached) {
				const parsedData = JSON.parse(cached);
				// Return cached data even if expired (for offline fallback)
				return parsedData.data;
			}
		} catch (error) {
			console.warn('Failed to retrieve cached document request data:', error);
		}
		return null;
	}
	
	// Helper function to get only valid cached data (for init)
	function getValidCachedData(studentId) {
		try {
			const cacheKey = getCacheKey(studentId);
			const cached = localStorage.getItem(cacheKey);
			if (cached) {
				const parsedData = JSON.parse(cached);
				if (isCacheValid(parsedData)) {
					return parsedData.data;
				}
			}
		} catch (error) {
			console.warn('Failed to retrieve cached document request data:', error);
		}
		return null;
	}

	// Helper function to cache data
	function cacheData(studentId, data) {
		try {
			const cacheKey = getCacheKey(studentId);
			const cacheEntry = {
				data,
				timestamp: Date.now()
			};
			localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
		} catch (error) {
			console.warn('Failed to cache document request data:', error);
		}
	}

	// Map backend status to UI status (keeping it as-is for now)
	function mapStatusToUI(backendStatus) {
		return backendStatus;
	}

	// Main function to load document requests
	async function loadDocumentRequests(silent = false) {
		try {
			// Set loading state (only if not silent)
			update(state => ({
				...state,
				isLoading: !silent,
				isRefreshing: silent,
				error: null
			}));

			// Fetch document requests
			const result = await api.get('/api/document-requests?action=student');

			if (!result.success) {
				throw new Error(result.error || 'Failed to load document requests');
			}

			// Transform data to match UI expectations
			const requestHistory = result.data.map(req => ({
				id: req.id,
				requestId: req.requestId,
				type: req.documentType,
				purpose: req.purpose,
				quantity: req.quantity || 1,
				status: mapStatusToUI(req.status),
				requestedDate: req.submittedDate,
				completedDate: req.completedDate,
				cancelledDate: req.cancelledDate,
				tentativeDate: req.tentativeDate,
				payment: req.payment,
				paymentAmount: req.paymentAmount,
				paymentStatus: req.paymentStatus || 'pending',
				processedBy: req.processedBy,
				adminName: req.processedBy,
				adminNote: req.adminNote,
				rejectionReason: req.rejectionReason,
				messages: req.messages || [],
				lastReadAt: req.lastReadAt || null
			}));

			// Update store with new data
			update(state => ({
				...state,
				requestHistory,
				isLoading: false,
				isRefreshing: false,
				error: null,
				lastUpdated: new Date().toISOString()
			}));

			// Cache the data
			const currentState = { requestHistory, lastUpdated: new Date().toISOString() };
			
			// Get current student ID from state
			let studentId;
			update(state => {
				studentId = state.currentStudentId;
				return state;
			});

			if (studentId) {
				cacheData(studentId, currentState);
			}

	} catch (error) {
		console.error('Error loading document requests:', error);
		
		// Try to get cached data even if it's expired
		let studentId;
		update(state => {
			studentId = state.currentStudentId;
			return state;
		});
		
		const cachedData = getCachedData(studentId);
		
		if (cachedData) {
			// If we have cached data, use it and show a toast notification
			update(state => ({
				...state,
				requestHistory: cachedData.requestHistory || [],
				lastUpdated: cachedData.lastUpdated,
				isLoading: false,
				isRefreshing: false,
				error: null // Don't set error since we have cached data
			}));
			
			// Show connection error toast
			toastStore.error('No internet connection. Showing offline data.');
		} else {
			// No cached data available, show error container
			update(state => ({
				...state,
				isLoading: false,
				isRefreshing: false,
				error: error.message,
				requestHistory: []
			}));
		}
	}
	}

	// Initialize store with cached data if available
	function init(studentId) {
		const cachedData = getValidCachedData(studentId);
		if (cachedData) {
			update(state => ({
				...state,
				...cachedData,
				currentStudentId: studentId,
				isLoading: false,
				isRefreshing: false,
				error: null
			}));
			return true; // Has cached data
		}
		
		// No cached data, set up initial state
		update(state => ({
			...state,
			currentStudentId: studentId,
			isLoading: true,
			isRefreshing: false,
			error: null
		}));
		return false; // No cached data
	}

	// Force refresh (clear cache and reload)
	async function forceRefresh(studentId) {
		// Clear cache
		try {
			const cacheKey = getCacheKey(studentId);
			localStorage.removeItem(cacheKey);
		} catch (error) {
			console.warn('Failed to clear document request cache:', error);
		}

		// Reset store state
		update(state => ({
			...initialState,
			currentStudentId: studentId,
			isLoading: true
		}));

		// Load fresh data
		return await store.loadDocumentRequests(false);
	}

	// Submit a new document request
	async function submitRequest(documentType, purpose, quantity = 1) {
		try {
			const result = await api.post('/api/document-requests', {
				action: 'create',
				documentType: documentType,
				purpose: purpose.trim(),
				quantity: quantity,
				paymentAmount: null,
				isUrgent: false
			});

			if (!result.success) {
				throw new Error(result.error || 'Failed to submit request');
			}

			// Refresh the request history
			await store.loadDocumentRequests(false);

			return { success: true };
		} catch (error) {
			console.error('Error submitting document request:', error);
			return { success: false, error: error.message };
		}
	}

	// Cancel a document request
	async function cancelRequest(requestId) {
		try {
			const result = await api.post('/api/document-requests', {
				action: 'cancel',
				requestId: requestId
			});

			if (!result.success) {
				throw new Error(result.error || 'Failed to cancel request');
			}

			// Refresh the request history
			await store.loadDocumentRequests(false);

			return { success: true };
		} catch (error) {
			console.error('Error cancelling document request:', error);
			return { success: false, error: error.message };
		}
	}

	// Mark messages as read for a specific request
	async function markMessagesAsRead(requestId) {
		try {
			const result = await api.post('/api/document-requests', {
				action: 'markAsRead',
				requestId: requestId
			});

			if (result.success) {
				// Update only the specific request's lastReadAt in local state
				update(state => ({
					...state,
					requestHistory: state.requestHistory.map(req => 
						req.requestId === requestId 
							? { ...req, lastReadAt: result.data.lastReadAt }
							: req
					)
				}));
			}

			return { success: result.success };
		} catch (error) {
			console.error('Error marking messages as read:', error);
			return { success: false, error: error.message };
		}
	}

	// Get details for a single request
	async function getRequestDetails(requestId) {
		try {
			const result = await api.get(`/api/document-requests?action=single&requestId=${requestId}`);

			if (!result.success) {
				throw new Error(result.error || 'Failed to load request details');
			}

			// Transform data to match UI expectations
			const requestData = {
				...result.data,
				type: result.data.documentType,
				quantity: result.data.quantity || 1,
				requestedDate: result.data.submittedDate,
				paymentAmount: result.data.paymentAmount,
				paymentStatus: result.data.paymentStatus ?? 'pending'
			};

			return { success: true, data: requestData };
		} catch (error) {
			console.error('Error fetching request details:', error);
			return { success: false, error: error.message };
		}
	}

	const store = {
		subscribe,
		init,
		loadDocumentRequests,
		forceRefresh,
		submitRequest,
		cancelRequest,
		markMessagesAsRead,
		getRequestDetails,
		getCachedData: (studentId) => getCachedData(studentId)
	};

	return store;
}

export const studentDocumentRequestStore = createStudentDocumentRequestStore();

