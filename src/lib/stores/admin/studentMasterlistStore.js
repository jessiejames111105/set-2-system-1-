import { writable } from 'svelte/store';

// Student Masterlist store with caching
function createStudentMasterlistStore() {
	const { subscribe, set, update } = writable({
		students: [],
		sections: [],
		isLoading: false,
		error: null,
		lastUpdated: null,
		isInitialized: false
	});

	return {
		subscribe,
		
		// Initialize with cached data (show immediately)
		init: (cachedData) => {
			if (cachedData) {
				update(state => ({
					...state,
					students: cachedData.students || [],
					sections: cachedData.sections || [],
					isInitialized: true,
					isLoading: false
				}));
			}
		},

		// Set loading state (only for initial load if no cache)
		setLoading: (loading) => {
			update(state => ({
				...state,
				isLoading: loading && !state.isInitialized
			}));
		},

		// Update students data silently (background refresh)
		updateStudents: (newStudents) => {
			update(state => {
				const newState = {
					...state,
					students: newStudents,
					isLoading: false,
					error: null,
					lastUpdated: new Date(),
					isInitialized: true
				};

				// Cache to localStorage
				try {
					localStorage.setItem('student-masterlist-cache', JSON.stringify({
						students: newStudents,
						sections: state.sections,
						timestamp: Date.now()
					}));
				} catch (e) {
					console.warn('Failed to cache student masterlist data:', e);
				}

				return newState;
			});
		},

		// Update sections data
		updateSections: (newSections) => {
			update(state => {
				const newState = {
					...state,
					sections: newSections
				};

				// Update cache with new sections
				try {
					localStorage.setItem('student-masterlist-cache', JSON.stringify({
						students: state.students,
						sections: newSections,
						timestamp: Date.now()
					}));
				} catch (e) {
					console.warn('Failed to cache sections data:', e);
				}

				return newState;
			});
		},

		// Set error state
		setError: (error) => {
			update(state => ({
				...state,
				error,
				isLoading: false
			}));
		},

		// Get cached data from localStorage
		getCachedData: () => {
			try {
				const cached = localStorage.getItem('student-masterlist-cache');
				if (cached) {
					const { students, sections, timestamp } = JSON.parse(cached);
					// Cache is valid for 5 minutes
					if (Date.now() - timestamp < 5 * 60 * 1000) {
						return { students, sections };
					}
				}
			} catch (e) {
				console.warn('Failed to retrieve cached student masterlist data:', e);
			}
			return null;
		},

		// Clear cache
		clearCache: () => {
			try {
				localStorage.removeItem('student-masterlist-cache');
			} catch (e) {
				console.warn('Failed to clear student masterlist cache:', e);
			}
		},

		// Refresh data (force refresh)
		refresh: async (fetchStudentsFn, fetchSectionsFn) => {
			update(state => ({ ...state, isLoading: true }));
			await Promise.all([fetchStudentsFn(), fetchSectionsFn()]);
		}
	};
}

export const studentMasterlistStore = createStudentMasterlistStore();

