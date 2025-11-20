import { writable } from 'svelte/store';
import { toastStore } from '../../../components/common/js/toastStore.js';
import { authStore } from '../../../components/login/js/auth.js';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_KEY_PREFIX = 'student_schedule_';

// Helper function to get authentication headers
function getAuthHeaders() {
	let userInfo;
	authStore.subscribe(value => {
		userInfo = value.userData;
	})();

	if (!userInfo) {
		console.warn('No user info available for authentication');
		return {};
	}

	return {
		'x-user-info': JSON.stringify({
			id: userInfo.id,
			name: userInfo.name,
			account_number: userInfo.accountNumber,
			account_type: userInfo.accountType
		})
	};
}

// Create the store
function createStudentScheduleStore() {
	const initialState = {
		scheduleData: {
			Mon: [],
			Tue: [],
			Wed: [],
			Thu: [],
			Fri: []
		},
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
			console.warn('Failed to retrieve cached student schedule data:', error);
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
			console.warn('Failed to retrieve cached student schedule data:', error);
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
			console.warn('Failed to cache student schedule data:', error);
		}
	}

	// Map database day names to abbreviated names
	const dayMapping = {
		'monday': 'Mon',
		'tuesday': 'Tue',
		'wednesday': 'Wed',
		'thursday': 'Thu',
		'friday': 'Fri'
	};

	// Slot-based colors (each slot gets a designated color)
	const slotColors = ['blue', 'green', 'purple', 'yellow', 'orange'];
	
	// Function to get color based on slot index
	function getSlotColor(slotIndex) {
		return slotColors[slotIndex % slotColors.length];
	}

	// Format time from 24-hour to 12-hour format
	function formatTime(timeString) {
		const [hours, minutes] = timeString.split(':');
		const hour = parseInt(hours);
		const ampm = hour >= 12 ? 'PM' : 'AM';
		const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
		return `${displayHour.toString().padStart(2, '0')}:${minutes} ${ampm}`;
	}

	// Process schedule data into the format expected by the component
	function processScheduleData(data) {
		const processedSchedule = {
			Mon: [],
			Tue: [],
			Wed: [],
			Thu: [],
			Fri: []
		};

		// Group by day to track slot indices
		const daySlotCounters = {
			Mon: 0,
			Tue: 0,
			Wed: 0,
			Thu: 0,
			Fri: 0
		};

		data.forEach(item => {
			const dayAbbrev = dayMapping[item.day_of_week.toLowerCase()];
			if (dayAbbrev) {
				// Format time from 24-hour to 12-hour format
				const startTime = formatTime(item.start_time);
				const endTime = formatTime(item.end_time);
				
				// Determine the class name and teacher
				let className, teacher;
				if (item.schedule_type === 'subject') {
					className = item.subject_name || 'Unknown Subject';
					teacher = item.teacher_name || 'No Teacher Assigned';
				} else if (item.schedule_type === 'activity') {
					className = item.activity_type_name || 'Activity';
					teacher = item.teacher_name || '';
				}

				const classItem = {
					name: className,
					time: `${startTime} - ${endTime}`,
					room: item.room_name || 'TBA',
					teacher: teacher,
					scheduleType: item.schedule_type,
					color: getSlotColor(daySlotCounters[dayAbbrev])
				};

				processedSchedule[dayAbbrev].push(classItem);
				daySlotCounters[dayAbbrev]++;
			}
		});

		return processedSchedule;
	}

	// Main function to load schedule data
	async function loadSchedule(studentId, silent = false) {
		try {
			// Set loading state (only if not silent)
			update(state => ({
				...state,
				isLoading: !silent,
				isRefreshing: silent,
				error: null,
				currentStudentId: studentId
			}));

			// Fetch current school year from admin settings
			const currentQuarterResponse = await fetch('/api/current-quarter', {
				headers: getAuthHeaders()
			});
			const currentQuarterData = await currentQuarterResponse.json();
			const schoolYear = currentQuarterData.data?.currentSchoolYear || '2025-2026';

			// Fetch schedule data
			const response = await fetch(`/api/schedules?action=student-schedules&studentId=${studentId}&schoolYear=${schoolYear}`, {
				headers: getAuthHeaders()
			});
			const result = await response.json();

			if (!result.success) {
				throw new Error(result.error || 'Failed to fetch schedule data');
			}

			// Process the data
			const processedData = processScheduleData(result.data);

			// Update store with new data
			update(state => ({
				...state,
				scheduleData: processedData,
				isLoading: false,
				isRefreshing: false,
				error: null,
				lastUpdated: new Date().toISOString()
			}));

			// Cache the processed data
			cacheData(studentId, {
				scheduleData: processedData,
				lastUpdated: new Date().toISOString()
			});

		} catch (error) {
			console.error('Error loading student schedule:', error);
			
		// Try to get cached data even if it's expired
		const cachedData = getCachedData(studentId);
		
		if (cachedData) {
			// If we have cached data, use it and show a toast notification
			update(state => ({
				...state,
				isLoading: false,
				isRefreshing: false,
				error: null, // Don't set error since we have cached data
				scheduleData: cachedData.scheduleData || {
					Mon: [],
					Tue: [],
					Wed: [],
					Thu: [],
					Fri: []
				},
				lastUpdated: cachedData.lastUpdated
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
				scheduleData: {
					Mon: [],
					Tue: [],
					Wed: [],
					Thu: [],
					Fri: []
				}
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
	function forceRefresh(studentId) {
		// Clear cache
		try {
			const cacheKey = getCacheKey(studentId);
			localStorage.removeItem(cacheKey);
		} catch (error) {
			console.warn('Failed to clear student schedule cache:', error);
		}

		// Reset store state
		update(state => ({
			...initialState,
			currentStudentId: studentId,
			isLoading: true
		}));

		// Load fresh data
		return store.loadSchedule(studentId, false);
	}

	const store = {
		subscribe,
		init,
		loadSchedule,
		forceRefresh,
		getCachedData: (studentId) => getCachedData(studentId)
	};

	return store;
}

export const studentScheduleStore = createStudentScheduleStore();