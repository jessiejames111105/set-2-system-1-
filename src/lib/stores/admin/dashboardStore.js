import { writable } from 'svelte/store';

// Dashboard statistics store with caching
function createDashboardStore() {
	const { subscribe, set, update } = writable({
		data: [
			{ id: 'students', label: 'Total Students', value: 0, icon: 'school', color: 'blue' },
			{ id: 'teachers', label: 'Total Teachers', value: 0, icon: 'person', color: 'green' },
			{ id: 'sections', label: 'Total Sections', value: 0, icon: 'class', color: 'orange' },
			{ id: 'rooms', label: 'Total Rooms', value: 0, icon: 'meeting_room', color: 'purple' }
		],
		isLoading: false,
		error: null,
		lastUpdated: null,
		isInitialized: false,
		// Chart data
		charts: {
			studentsPerGrade: {
				data: null,
				isLoading: false,
				error: null,
				lastUpdated: null
			},
			sectionsPerGrade: {
				data: null,
				isLoading: false,
				error: null,
				lastUpdated: null
			}
		}
	});

	return {
		subscribe,
		
		// Initialize with cached data (show immediately)
		init: (cachedData) => {
			if (cachedData) {
				update(state => ({
					...state,
					data: cachedData,
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

		// Update data silently (background refresh)
		updateData: (newData) => {
			update(state => ({
				...state,
				data: newData,
				isLoading: false,
				error: null,
				lastUpdated: new Date(),
				isInitialized: true
			}));
			
			// Cache to localStorage
			try {
				localStorage.setItem('dashboard-stats-cache', JSON.stringify({
					data: newData,
					timestamp: Date.now()
				}));
			} catch (e) {
				console.warn('Failed to cache dashboard data:', e);
			}
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
				const cached = localStorage.getItem('dashboard-stats-cache');
				if (cached) {
					const { data, timestamp } = JSON.parse(cached);
					// Cache is valid for 5 minutes
					if (Date.now() - timestamp < 5 * 60 * 1000) {
						return data;
					}
				}
			} catch (e) {
				console.warn('Failed to retrieve cached dashboard data:', e);
			}
			return null;
		},

	// Clear cache
	clearCache: () => {
		try {
			localStorage.removeItem('dashboard-stats-cache');
			localStorage.removeItem('dashboard-charts-cache');
		} catch (e) {
			console.warn('Failed to clear dashboard cache:', e);
		}
	},

	// ========== CHART DATA METHODS ==========

	// Initialize chart data with cached data
	initChartData: (chartType, cachedData) => {
		if (cachedData) {
			update(state => ({
				...state,
				charts: {
					...state.charts,
					[chartType]: {
						...state.charts[chartType],
						data: cachedData,
						isLoading: false
					}
				}
			}));
		}
	},

	// Set chart loading state
	setChartLoading: (chartType, loading) => {
		update(state => ({
			...state,
			charts: {
				...state.charts,
				[chartType]: {
					...state.charts[chartType],
					isLoading: loading
				}
			}
		}));
	},

	// Update chart data
	updateChartData: (chartType, newData) => {
		update(state => ({
			...state,
			charts: {
				...state.charts,
				[chartType]: {
					data: newData,
					isLoading: false,
					error: null,
					lastUpdated: new Date()
				}
			}
		}));

		// Cache to localStorage
		try {
			const cacheKey = `dashboard-chart-${chartType}-cache`;
			localStorage.setItem(cacheKey, JSON.stringify({
				data: newData,
				timestamp: Date.now()
			}));
		} catch (e) {
			console.warn(`Failed to cache ${chartType} data:`, e);
		}
	},

	// Set chart error
	setChartError: (chartType, error) => {
		update(state => ({
			...state,
			charts: {
				...state.charts,
				[chartType]: {
					...state.charts[chartType],
					error,
					isLoading: false
				}
			}
		}));
	},

	// Get cached chart data
	getCachedChartData: (chartType) => {
		try {
			const cacheKey = `dashboard-chart-${chartType}-cache`;
			const cached = localStorage.getItem(cacheKey);
			if (cached) {
				const { data, timestamp } = JSON.parse(cached);
				// Cache is valid for 5 minutes
				if (Date.now() - timestamp < 5 * 60 * 1000) {
					return data;
				}
			}
		} catch (e) {
			console.warn(`Failed to retrieve cached ${chartType} data:`, e);
		}
		return null;
	}
};
}

export const dashboardStore = createDashboardStore();