import { writable } from 'svelte/store';
import { authenticatedFetch } from '../../../routes/api/helper/api-helper.js';

// Cache configuration
const CACHE_KEY = 'teacherScheduleCache';
const CACHE_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes

// Create the teacher schedule store
function createTeacherScheduleStore() {
	const { subscribe, set, update } = writable({
		scheduleData: {
			Mon: [],
			Tue: [],
			Wed: [],
			Thu: [],
			Fri: []
		},
		isLoading: false,
		isRefreshing: false, // For silent background refresh
		error: null,
		lastUpdated: null,
		isInitialized: false
	});

	const store = {
		subscribe,

		// Initialize store with cached data (immediate display)
		init: (teacherId, schoolYear) => {
			const cachedData = getCachedData(teacherId, schoolYear);
			if (cachedData) {
				update(state => ({
					...state,
					scheduleData: cachedData.scheduleData,
					lastUpdated: cachedData.lastUpdated,
					isInitialized: true,
					isLoading: false,
					error: null
				}));
				return true; // Has cached data
			}
			return false; // No cached data
		},

		// Set loading state (only for initial load if no cache)
		setLoading: (loading, silent = false) => {
			update(state => ({
				...state,
				isLoading: loading && !state.isInitialized && !silent,
				isRefreshing: loading && silent,
				error: loading ? null : state.error
			}));
		},

		// Update schedule data and cache it
		updateScheduleData: (newScheduleData, teacherId, schoolYear, silent = false) => {
			const now = Date.now();
			
			update(state => ({
				...state,
				scheduleData: newScheduleData,
				isLoading: false,
				isRefreshing: false,
				error: null,
				lastUpdated: now,
				isInitialized: true
			}));

			// Cache the data
			cacheData(newScheduleData, teacherId, schoolYear, now);
		},

		// Set error state
		setError: (error, silent = false) => {
			update(state => ({
				...state,
				error,
				isLoading: false,
				isRefreshing: false
			}));
		},

		// Load schedule data with caching support
		loadSchedule: async (teacherId, schoolYear, silent = false) => {
			try {
				// Set loading state
				update(state => ({
					...state,
					isLoading: !silent && !state.isInitialized,
					isRefreshing: silent,
					error: null
				}));

				// Fetch current school year if not provided
				let currentSchoolYear = schoolYear;
				if (!currentSchoolYear) {
					const currentQuarterResponse = await authenticatedFetch('/api/current-quarter');
					const currentQuarterData = await currentQuarterResponse.json();
					currentSchoolYear = currentQuarterData.data?.currentSchoolYear || '2025-2026';
				}

				// Fetch schedule data
				const response = await authenticatedFetch(`/api/schedules?action=teacher-schedules&teacherId=${teacherId}&schoolYear=${currentSchoolYear}`);
				const result = await response.json();

				if (!result.success) {
					throw new Error(result.error || 'Failed to fetch schedule data');
				}

				// Process the schedule data
				const processedData = processScheduleData(result.data);
				
				// Update store and cache
				update(state => ({
					...state,
					scheduleData: processedData,
					isLoading: false, 
					isRefreshing: false,
					error: null,
					lastUpdated: Date.now(),
					isInitialized: true
				}));

				// Cache the processed data
				cacheData(processedData, teacherId, currentSchoolYear, Date.now());

			} catch (error) {
				console.error('Error loading teacher schedule:', error);
				
				update(state => ({
					...state,
					error: error.message,
					isLoading: false,
					isRefreshing: false
				}));
			}
		},

		// Clear cache
		clearCache: (teacherId, schoolYear) => {
			try {
				const cacheKey = `${CACHE_KEY}_${teacherId}_${schoolYear}`;
				localStorage.removeItem(cacheKey);
			} catch (error) {
				console.warn('Failed to clear teacher schedule cache:', error);
			}
		},

		// Force refresh (clear cache and reload)
		forceRefresh: async (teacherId, schoolYear) => {
			// Clear cache first
			try {
				const cacheKey = `${CACHE_KEY}_${teacherId}_${schoolYear}`;
				localStorage.removeItem(cacheKey);
			} catch (error) {
				console.warn('Failed to clear cache during force refresh:', error);
			}

			// Reset state and reload
			update(state => ({
				...state,
				isInitialized: false,
				scheduleData: {
					Mon: [],
					Tue: [],
					Wed: [],
					Thu: [],
					Fri: []
				}
			}));

			// Load fresh data
			await store.loadSchedule(teacherId, schoolYear, false);
		}
	};

	return store;
}

// Helper function to get cached data
function getCachedData(teacherId, schoolYear) {
	try {
		const cacheKey = `${CACHE_KEY}_${teacherId}_${schoolYear}`;
		const cached = localStorage.getItem(cacheKey);
		
		if (!cached) return null;

		const data = JSON.parse(cached);
		const now = Date.now();
		
		// Check if cache is still valid
		if (now - data.timestamp > CACHE_VALIDITY_MS) {
			localStorage.removeItem(cacheKey);
			return null;
		}
		
		return {
			scheduleData: data.scheduleData,
			lastUpdated: data.timestamp
		};
	} catch (error) {
		console.warn('Failed to retrieve cached teacher schedule:', error);
		return null;
	}
}

// Helper function to cache data
function cacheData(scheduleData, teacherId, schoolYear, timestamp) {
	try {
		const cacheKey = `${CACHE_KEY}_${teacherId}_${schoolYear}`;
		const cacheData = {
			scheduleData,
			timestamp,
			teacherId,
			schoolYear
		};
		localStorage.setItem(cacheKey, JSON.stringify(cacheData));
	} catch (error) {
		console.warn('Failed to cache teacher schedule data:', error);
	}
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
			
			// Determine the class name and subject
			let className, subject;
			if (item.schedule_type === 'subject') {
				className = item.section_name;
				subject = item.subject_name || 'Unknown Subject';
			} else if (item.schedule_type === 'activity') {
				className = item.activity_type_name || 'Activity';
				subject = item.activity_type_name || 'Activity';
			}

			const classItem = {
				name: className,
				time: `${startTime} - ${endTime}`,
				room: item.room_name || 'TBA',
				subject: subject,
				gradeLevel: item.grade_level,
				scheduleType: item.schedule_type,
				color: getSlotColor(daySlotCounters[dayAbbrev])
			};

			processedSchedule[dayAbbrev].push(classItem);
			daySlotCounters[dayAbbrev]++;
		}
	});

	// Add vacant time slots for each day
	Object.keys(processedSchedule).forEach(day => {
		const classes = processedSchedule[day];
		const vacantTimes = detectVacantTimes(classes);
		
		// Combine regular classes and vacant times, then sort by start time
		const combinedSchedule = [...classes, ...vacantTimes].sort((a, b) => {
			const aStartTime = timeToMinutes(a.time.split(' - ')[0]);
			const bStartTime = timeToMinutes(b.time.split(' - ')[0]);
			return aStartTime - bStartTime;
		});
		
		processedSchedule[day] = combinedSchedule;
	});

	return processedSchedule;
}

// Helper functions for time processing
function formatTime(timeString) {
	const [hours, minutes] = timeString.split(':');
	const hour = parseInt(hours);
	const ampm = hour >= 12 ? 'PM' : 'AM';
	const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
	return `${displayHour.toString().padStart(2, '0')}:${minutes} ${ampm}`;
}

function timeToMinutes(timeString) {
	const [time, period] = timeString.split(' ');
	const [hours, minutes] = time.split(':').map(Number);
	
	let totalMinutes = minutes;
	if (period === 'PM' && hours !== 12) {
		totalMinutes += (hours + 12) * 60;
	} else if (period === 'AM' && hours === 12) {
		totalMinutes += 0;
	} else {
		totalMinutes += hours * 60;
	}
	
	return totalMinutes;
}

function minutesToTime(totalMinutes) {
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	const ampm = hours >= 12 ? 'PM' : 'AM';
	const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
	return `${displayHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function detectVacantTimes(classes) {
	if (classes.length <= 1) return [];

	// Sort classes by start time
	const sortedClasses = [...classes].sort((a, b) => {
		const aStartTime = timeToMinutes(a.time.split(' - ')[0]);
		const bStartTime = timeToMinutes(b.time.split(' - ')[0]);
		return aStartTime - bStartTime;
	});

	const vacantTimes = [];

	// Check for gaps between consecutive classes
	for (let i = 0; i < sortedClasses.length - 1; i++) {
		const currentClass = sortedClasses[i];
		const nextClass = sortedClasses[i + 1];

		const currentEndTime = timeToMinutes(currentClass.time.split(' - ')[1]);
		const nextStartTime = timeToMinutes(nextClass.time.split(' - ')[0]);

		// If there's a gap between classes (more than 0 minutes)
		if (nextStartTime > currentEndTime) {
			const vacantStartTime = minutesToTime(currentEndTime);
			const vacantEndTime = minutesToTime(nextStartTime);

			vacantTimes.push({
				name: 'Vacant Time',
				time: `${vacantStartTime} - ${vacantEndTime}`,
				room: 'Available',
				subject: 'Free Period',
				color: 'gray',
				isVacant: true
			});
		}
	}

	return vacantTimes;
}

// Export the store instance
export const teacherScheduleStore = createTeacherScheduleStore();