import { writable } from 'svelte/store';
import { toastStore } from '../../../components/common/js/toastStore.js';
import { authStore } from '../../../components/login/js/auth.js';
import { get } from 'svelte/store';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_KEY_PREFIX = 'student_notifications_';

// Create the store
function createStudentNotificationStore() {
	const initialState = {
		notifications: [],
		unreadCount: 0,
		totalCount: 0,
		currentFilter: 'all',
		isLoading: false,
		isRefreshing: false,
		error: null,
		lastUpdated: null,
		currentStudentId: null
	};

	const { subscribe, set, update } = writable(initialState);

	// Helper function to get auth headers
	function getAuthHeaders() {
		const authState = get(authStore);
		if (!authState?.isAuthenticated || !authState.userData) {
			return {};
		}
		
		const userInfo = {
			id: authState.userData.id,
			name: authState.userData.name,
			account_number: authState.userData.accountNumber,
			account_type: authState.userData.account_type || authState.userData.accountType
		};
		
		return {
			'x-user-info': JSON.stringify(userInfo)
		};
	}

	// Helper function to get cache key
	function getCacheKey(studentId, filter) {
		return `${CACHE_KEY_PREFIX}${studentId}_${filter}`;
	}

	// Helper function to check if cached data is valid
	function isCacheValid(cachedData) {
		if (!cachedData || !cachedData.timestamp) return false;
		return Date.now() - cachedData.timestamp < CACHE_DURATION;
	}

	// Helper function to get cached data
	function getCachedData(studentId, filter) {
		try {
			const cacheKey = getCacheKey(studentId, filter);
			const cached = localStorage.getItem(cacheKey);
			if (cached) {
				const parsedData = JSON.parse(cached);
				// Return cached data even if expired (for offline fallback)
				return parsedData.data;
			}
		} catch (error) {
			console.warn('Failed to retrieve cached student notifications data:', error);
		}
		return null;
	}
	
	// Helper function to get only valid cached data (for init)
	function getValidCachedData(studentId, filter) {
		try {
			const cacheKey = getCacheKey(studentId, filter);
			const cached = localStorage.getItem(cacheKey);
			if (cached) {
				const parsedData = JSON.parse(cached);
				if (isCacheValid(parsedData)) {
					return parsedData.data;
				}
			}
		} catch (error) {
			console.warn('Failed to retrieve cached student notifications data:', error);
		}
		return null;
	}

	// Helper function to cache data
	function cacheData(studentId, filter, data) {
		try {
			const cacheKey = getCacheKey(studentId, filter);
			const cacheEntry = {
				data,
				timestamp: Date.now()
			};
			localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
		} catch (error) {
			console.warn('Failed to cache student notifications data:', error);
		}
	}

	// Process notification data
	function processNotificationData(data) {
		if (!Array.isArray(data)) {
			return [];
		}

		return data.map(notification => ({
			id: notification.id,
			title: notification.title,
			message: notification.message,
			type: notification.type,
			timestamp: notification.created_at || notification.timestamp,
			isRead: notification.is_read || notification.isRead || false,
			adminNote: notification.admin_note || notification.adminNote || null,
			rejectionReason: notification.rejection_reason || notification.rejectionReason || null,
			metadata: notification.metadata || {}
		}));
	}

	// Calculate statistics
	function calculateStats(notifications) {
		const unreadCount = notifications.filter(n => !n.isRead).length;
		const totalCount = notifications.length;
		
		return { unreadCount, totalCount };
	}

	// Main function to load notifications
	async function loadNotifications(studentId, filter = 'all', silent = false) {
		try {
			// Set loading state (only if not silent)
			update(state => ({
				...state,
				isLoading: !silent,
				isRefreshing: silent,
				error: null,
				currentStudentId: studentId,
				currentFilter: filter
			}));

			// Build query parameters
			const params = new URLSearchParams({
				studentId: studentId,
				filter: filter
			});

			// Fetch notifications data
			const response = await fetch(`/api/student-notifications?${params.toString()}`, {
				headers: getAuthHeaders()
			});
			const result = await response.json();

			if (!result.success) {
				throw new Error(result.error || 'Failed to fetch notifications');
			}

			// Process the data
			const processedNotifications = processNotificationData(result.data || []);
			const stats = calculateStats(processedNotifications);

			// Update store with new data
			const newState = {
				notifications: processedNotifications,
				unreadCount: stats.unreadCount,
				totalCount: stats.totalCount,
				currentFilter: filter,
				isLoading: false,
				isRefreshing: false,
				error: null,
				lastUpdated: new Date().toISOString(),
				currentStudentId: studentId
			};

			update(state => ({
				...state,
				...newState
			}));

			// Cache the processed data
			cacheData(studentId, filter, {
				notifications: processedNotifications,
				unreadCount: stats.unreadCount,
				totalCount: stats.totalCount,
				lastUpdated: newState.lastUpdated
			});

		} catch (error) {
			console.error('Error loading student notifications:', error);
			
			// Try to get cached data even if it's expired
			const cachedData = getCachedData(studentId, filter);
			
			if (cachedData) {
				// If we have cached data, use it and show a toast notification
				update(state => ({
					...state,
					notifications: cachedData.notifications || [],
					unreadCount: cachedData.unreadCount || 0,
					totalCount: cachedData.totalCount || 0,
					lastUpdated: cachedData.lastUpdated,
					isLoading: false,
					isRefreshing: false,
					error: null // Don't set error since we have cached data
				}));
				
				// Show connection error toast
				toastStore.error('No internet connection. Showing offline data.');
			} else {
				// No cached data available, show error
				update(state => ({
					...state,
					isLoading: false,
					isRefreshing: false,
					error: error.message,
					notifications: [],
					unreadCount: 0,
					totalCount: 0
				}));
			}
		}
	}

	// Update notification status (read/unread)
	async function updateNotificationStatus(studentId, notificationId, isRead) {
		try {
			const response = await fetch('/api/student-notifications', {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					...getAuthHeaders()
				},
				body: JSON.stringify({
					studentId,
					notificationId,
					isRead
				})
			});

			const result = await response.json();

			if (!result.success) {
				throw new Error(result.error || 'Failed to update notification status');
			}

			// Update local state optimistically
			update(state => {
				const notifications = state.notifications.map(n => 
					n.id === notificationId ? { ...n, isRead } : n
				);
				const stats = calculateStats(notifications);
				
				// Update cache
				cacheData(studentId, state.currentFilter, {
					notifications,
					unreadCount: stats.unreadCount,
					totalCount: stats.totalCount,
					lastUpdated: new Date().toISOString()
				});

				return {
					...state,
					notifications,
					unreadCount: stats.unreadCount
				};
			});

		} catch (error) {
			console.error('Error updating notification status:', error);
			toastStore.error('Failed to update notification status');
		}
	}

	// Delete a notification
	async function deleteNotification(studentId, notificationId) {
		try {
			const response = await fetch('/api/student-notifications', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					...getAuthHeaders()
				},
				body: JSON.stringify({
					studentId,
					notificationId
				})
			});

			const result = await response.json();

			if (!result.success) {
				throw new Error(result.error || 'Failed to delete notification');
			}

			// Update local state
			update(state => {
				const notifications = state.notifications.filter(n => n.id !== notificationId);
				const stats = calculateStats(notifications);
				
				// Update cache
				cacheData(studentId, state.currentFilter, {
					notifications,
					unreadCount: stats.unreadCount,
					totalCount: stats.totalCount,
					lastUpdated: new Date().toISOString()
				});

				return {
					...state,
					notifications,
					unreadCount: stats.unreadCount,
					totalCount: stats.totalCount
				};
			});

		} catch (error) {
			console.error('Error deleting notification:', error);
			toastStore.error('Failed to delete notification');
			throw error;
		}
	}

	// Mark all notifications as read
	async function markAllAsRead(studentId) {
		try {
			const response = await fetch('/api/student-notifications', {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					...getAuthHeaders()
				},
				body: JSON.stringify({
					studentId,
					markAllAsRead: true
				})
			});

			const result = await response.json();

			if (!result.success) {
				throw new Error(result.error || 'Failed to mark all as read');
			}

			// Update local state
			update(state => {
				const notifications = state.notifications.map(n => ({ ...n, isRead: true }));
				
				// Update cache
				cacheData(studentId, state.currentFilter, {
					notifications,
					unreadCount: 0,
					totalCount: state.totalCount,
					lastUpdated: new Date().toISOString()
				});

				return {
					...state,
					notifications,
					unreadCount: 0
				};
			});

			toastStore.success('All notifications marked as read');

		} catch (error) {
			console.error('Error marking all as read:', error);
			toastStore.error('Failed to mark all as read');
		}
	}

	// Clear all read notifications
	async function clearAllRead(studentId) {
		try {
			const response = await fetch('/api/student-notifications', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					...getAuthHeaders()
				},
				body: JSON.stringify({
					studentId,
					clearAllRead: true
				})
			});

			const result = await response.json();

			if (!result.success) {
				throw new Error(result.error || 'Failed to clear read notifications');
			}

			// Update local state
			update(state => {
				const notifications = state.notifications.filter(n => !n.isRead);
				const stats = calculateStats(notifications);
				
				// Update cache
				cacheData(studentId, state.currentFilter, {
					notifications,
					unreadCount: stats.unreadCount,
					totalCount: stats.totalCount,
					lastUpdated: new Date().toISOString()
				});

				return {
					...state,
					notifications,
					totalCount: stats.totalCount
				};
			});

		} catch (error) {
			console.error('Error clearing read notifications:', error);
			toastStore.error('Failed to clear read notifications');
			throw error;
		}
	}

	// Set filter
	function setFilter(filter) {
		update(state => ({
			...state,
			currentFilter: filter
		}));
	}

	// Initialize store with cached data if available
	function init(studentId, filter = 'all') {
		const cachedData = getValidCachedData(studentId, filter);
		if (cachedData) {
			update(state => ({
				...state,
				...cachedData,
				currentStudentId: studentId,
				currentFilter: filter,
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
			currentFilter: filter,
			isLoading: true,
			isRefreshing: false,
			error: null
		}));
		return false; // No cached data
	}

	// Force refresh (clear cache and reload)
	function forceRefresh(studentId, filter = 'all') {
		// Clear cache
		try {
			const cacheKey = getCacheKey(studentId, filter);
			localStorage.removeItem(cacheKey);
		} catch (error) {
			console.warn('Failed to clear student notifications cache:', error);
		}

		// Reset store state
		update(state => ({
			...initialState,
			currentStudentId: studentId,
			currentFilter: filter,
			isLoading: true
		}));

		// Load fresh data
		return store.loadNotifications(studentId, filter, false);
	}

	// Clear all cached data for a student
	function clearAllCache(studentId) {
		try {
			const keys = Object.keys(localStorage);
			const prefix = `${CACHE_KEY_PREFIX}${studentId}_`;
			keys.forEach(key => {
				if (key.startsWith(prefix)) {
					localStorage.removeItem(key);
				}
			});
		} catch (error) {
			console.warn('Failed to clear all notification cache:', error);
		}
	}

	const store = {
		subscribe,
		init,
		setFilter,
		loadNotifications,
		updateNotificationStatus,
		deleteNotification,
		markAllAsRead,
		clearAllRead,
		forceRefresh,
		clearAllCache,
		getCachedData: (studentId, filter) => getCachedData(studentId, filter)
	};

	return store;
}

export const studentNotificationStore = createStudentNotificationStore();

