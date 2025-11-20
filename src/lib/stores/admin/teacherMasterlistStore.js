import { writable } from 'svelte/store';

// Teacher Masterlist store with caching
function createTeacherMasterlistStore() {
	const { subscribe, set, update } = writable({
		teachers: [],
		departments: [],
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
					teachers: cachedData.teachers || [],
					departments: cachedData.departments || [],
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

		// Update teachers data silently (background refresh)
		updateTeachers: (newTeachers) => {
			update(state => {
				const newState = {
					...state,
					teachers: newTeachers,
					isLoading: false,
					error: null,
					lastUpdated: new Date(),
					isInitialized: true
				};

				// Cache to localStorage
				try {
					localStorage.setItem('teacher-masterlist-cache', JSON.stringify({
						teachers: newTeachers,
						departments: state.departments,
						timestamp: Date.now()
					}));
				} catch (e) {
					console.warn('Failed to cache teacher masterlist data:', e);
				}

				return newState;
			});
		},

		// Update departments data
		updateDepartments: (newDepartments) => {
			update(state => {
				const newState = {
					...state,
					departments: newDepartments
				};

				// Update cache with new departments
				try {
					localStorage.setItem('teacher-masterlist-cache', JSON.stringify({
						teachers: state.teachers,
						departments: newDepartments,
						timestamp: Date.now()
					}));
				} catch (e) {
					console.warn('Failed to cache departments data:', e);
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
				const cached = localStorage.getItem('teacher-masterlist-cache');
				if (cached) {
					const { teachers, departments, timestamp } = JSON.parse(cached);
					// Cache is valid for 5 minutes
					if (Date.now() - timestamp < 5 * 60 * 1000) {
						return { teachers, departments };
					}
				}
			} catch (e) {
				console.warn('Failed to retrieve cached teacher masterlist data:', e);
			}
			return null;
		},

		// Clear cache
		clearCache: () => {
			try {
				localStorage.removeItem('teacher-masterlist-cache');
			} catch (e) {
				console.warn('Failed to clear teacher masterlist cache:', e);
			}
		},

		// Refresh data (force refresh)
		refresh: async (fetchTeachersFn, fetchDepartmentsFn) => {
			update(state => ({ ...state, isLoading: true }));
			await Promise.all([fetchTeachersFn(), fetchDepartmentsFn()]);
		}
	};
}

export const teacherMasterlistStore = createTeacherMasterlistStore();
