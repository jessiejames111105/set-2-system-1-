import { writable } from 'svelte/store';
import { api } from '../../../routes/api/helper/api-helper.js';

// Cache configuration
const CACHE_KEY = 'teacherProfileCache';
const CACHE_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes

// Create the teacher profile store
function createTeacherProfileStore() {
	const { subscribe, set, update } = writable({
		teacherData: null,
		teacherProfileData: null,
		teacherSections: [],
		isLoading: false,
		isRefreshing: false, // For silent background refresh
		error: null,
		lastUpdated: null,
		isInitialized: false
	});

	const store = {
		subscribe,

		// Initialize store with cached data (immediate display)
		init: (teacherId) => {
			const cachedData = getCachedData(teacherId);
			if (cachedData) {
				update(state => ({
					...state,
					teacherData: cachedData.teacherData,
					teacherProfileData: cachedData.teacherProfileData,
					teacherSections: cachedData.teacherSections,
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

		// Set error state
		setError: (errorMessage) => {
			update(state => ({
				...state,
				isLoading: false,
				isRefreshing: false,
				error: errorMessage
			}));
		},

		// Update profile data and cache it
		updateProfileData: (teacherData, teacherProfileData, teacherSections, teacherId) => {
			const timestamp = Date.now();
			
			update(state => ({
				...state,
				teacherData,
				teacherProfileData,
				teacherSections,
				isLoading: false,
				isRefreshing: false,
				error: null,
				lastUpdated: timestamp,
				isInitialized: true
			}));

			// Cache the data
			cacheData(teacherData, teacherProfileData, teacherSections, teacherId, timestamp);
		},

		// Load profile data with caching support
		loadProfile: async (teacherId, silent = false) => {
			try {
				// Set loading state
				update(state => ({
					...state,
					isLoading: !silent && !state.isInitialized,
					isRefreshing: silent,
					error: null
				}));

				// Ensure teacherId is a string for comparison
				const teacherIdStr = String(teacherId);
				console.log('Loading teacher profile for ID:', teacherIdStr);

				let currentUserData = null;
				let teacherProfileData = null;
				let teacherSections = [];

				// Fetch teacher profile data which includes basic info
				const profileResponse = await api.get(`/api/teacher-profile?teacherId=${teacherIdStr}`);
				
				console.log('Profile response:', profileResponse);
				
				if (!profileResponse.success || !profileResponse.data) {
					throw new Error(profileResponse.error || 'Failed to fetch teacher profile');
				}

				const profileData = profileResponse.data;

				// Extract basic teacher data from the profile response
				currentUserData = {
					id: profileData.teacher.id,
					name: profileData.teacher.full_name,
					firstName: profileData.teacher.full_name.split(' ')[0],
					lastName: profileData.teacher.full_name.split(' ').slice(1).join(' '),
					middleInitial: '',
					email: profileData.teacher.email,
					type: 'Teacher',
					number: teacherIdStr,
					position: profileData.teacher.position || 'Teacher',
					department: profileData.teacher.department || 'Not assigned',
					contactNumber: 'Not available',
					address: 'Not available',
					birthdate: null,
					age: 'Not available',
					gender: 'Not available',
					createdDate: 'Not available',
					updatedDate: 'Not available',
					status: 'active'
				};

				// Use the profile data for subjects
				teacherProfileData = {
					subjects: profileData.subjects || [],
					classes: [],
					sections: profileData.sections || []
				};
				
				// Fetch teacher sections
				try {
					// Fetch current school year from admin settings
					const currentQuarterData = await api.get('/api/current-quarter');
					const schoolYear = currentQuarterData.data?.currentSchoolYear || '2025-2026';

					const sectionsResponse = await api.get(`/api/teacher-sections?teacherId=${teacherIdStr}&schoolYear=${schoolYear}`);
					if (sectionsResponse.success) {
						teacherSections = sectionsResponse.data?.classData || [];
					}
				} catch (err) {
					// Don't throw error here as basic profile should still work
					console.warn('Failed to fetch teacher sections:', err);
				}

				// Update store and cache
				store.updateProfileData(currentUserData, teacherProfileData, teacherSections, teacherId);

			} catch (error) {
				console.error('Error loading teacher profile:', error);
				
				update(state => ({
					...state,
					isLoading: false,
					isRefreshing: false,
					error: error.message
				}));
			}
		},

		// Clear cache
		clearCache: (teacherId) => {
			try {
				const cacheKey = `${CACHE_KEY}_${teacherId}`;
				localStorage.removeItem(cacheKey);
			} catch (error) {
				console.warn('Failed to clear teacher profile cache:', error);
			}
		},

		// Force refresh (clear cache and reload)
		forceRefresh: async (teacherId) => {
			// Clear cache first
			store.clearCache(teacherId);

			// Reset state and reload
			update(state => ({
				...state,
				isInitialized: false,
				teacherData: null,
				teacherProfileData: null,
				teacherSections: []
			}));

			// Load fresh data
			await store.loadProfile(teacherId, false);
		}
	};

	return store;
}

// Helper function to get cached data
function getCachedData(teacherId) {
	try {
		const cacheKey = `${CACHE_KEY}_${teacherId}`;
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
			teacherData: data.teacherData,
			teacherProfileData: data.teacherProfileData,
			teacherSections: data.teacherSections,
			lastUpdated: data.timestamp
		};
	} catch (error) {
		console.warn('Failed to get cached teacher profile data:', error);
		return null;
	}
}

// Helper function to cache data
function cacheData(teacherData, teacherProfileData, teacherSections, teacherId, timestamp) {
	try {
		const cacheKey = `${CACHE_KEY}_${teacherId}`;
		const dataToCache = {
			teacherData,
			teacherProfileData,
			teacherSections,
			timestamp
		};
		
		localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
	} catch (error) {
		console.warn('Failed to cache teacher profile data:', error);
	}
}

// Export the store instance
export const teacherProfileStore = createTeacherProfileStore();