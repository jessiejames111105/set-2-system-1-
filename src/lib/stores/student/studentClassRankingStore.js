import { writable } from 'svelte/store';
import { toastStore } from '../../../components/common/js/toastStore.js';
import { authStore } from '../../../components/login/js/auth.js';
import { get } from 'svelte/store';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_KEY_PREFIX = 'student_class_ranking_';

// Create the store
function createStudentClassRankingStore() {
	const initialState = {
		myRank: 0,
		totalStudents: 0,
		myAverage: 0,
		sectionInfo: null,
		rankingsList: [],
		isLoading: false,
		isRefreshing: false,
		error: null,
		lastUpdated: null,
		currentStudentId: null,
		currentQuarter: null,
		currentSchoolYear: null
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
	function getCacheKey(studentId, quarter, schoolYear) {
		return `${CACHE_KEY_PREFIX}${studentId}_${quarter}_${schoolYear}`;
	}

	// Helper function to check if cached data is valid
	function isCacheValid(cachedData) {
		if (!cachedData || !cachedData.timestamp) return false;
		return Date.now() - cachedData.timestamp < CACHE_DURATION;
	}

	// Helper function to get cached data
	function getCachedData(studentId, quarter, schoolYear) {
		try {
			const cacheKey = getCacheKey(studentId, quarter, schoolYear);
			const cached = localStorage.getItem(cacheKey);
			if (cached) {
				const parsedData = JSON.parse(cached);
				// Return cached data even if expired (for offline fallback)
				return parsedData.data;
			}
		} catch (error) {
			console.warn('Failed to retrieve cached class ranking data:', error);
		}
		return null;
	}
	
	// Helper function to get only valid cached data (for init)
	function getValidCachedData(studentId, quarter, schoolYear) {
		try {
			const cacheKey = getCacheKey(studentId, quarter, schoolYear);
			const cached = localStorage.getItem(cacheKey);
			if (cached) {
				const parsedData = JSON.parse(cached);
				if (isCacheValid(parsedData)) {
					return parsedData.data;
				}
			}
		} catch (error) {
			console.warn('Failed to retrieve cached class ranking data:', error);
		}
		return null;
	}

	// Helper function to cache data
	function cacheData(studentId, quarter, schoolYear, data) {
		try {
			const cacheKey = getCacheKey(studentId, quarter, schoolYear);
			const cacheEntry = {
				data,
				timestamp: Date.now()
			};
			localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
		} catch (error) {
			console.warn('Failed to cache class ranking data:', error);
		}
	}

	// Fetch rankings data from API
	async function fetchRankings(studentId, quarter, schoolYear) {
		const response = await fetch(
			`/api/class-rankings?studentId=${studentId}&quarter=${quarter}&schoolYear=${schoolYear}`,
			{
				headers: getAuthHeaders()
			}
		);
		
		if (!response.ok) {
			throw new Error('Failed to load class rankings');
		}
		
		return await response.json();
	}

	return {
		subscribe,

		// Initialize store with cached data if available
		init(studentId, quarter, schoolYear) {
			const cachedData = getValidCachedData(studentId, quarter, schoolYear);
			if (cachedData) {
				update(state => ({
					...state,
					...cachedData,
					currentStudentId: studentId,
					currentQuarter: quarter,
					currentSchoolYear: schoolYear,
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
				currentQuarter: quarter,
				currentSchoolYear: schoolYear,
				isLoading: true,
				isRefreshing: false,
				error: null
			}));
			return false; // No cached data
		},

		// Load rankings with optional force refresh
		async loadRankings(studentId, quarter, schoolYear, forceRefresh = false) {
			if (!studentId) {
				console.warn('Student ID is required to load rankings');
				return;
			}

			// Don't check cache here anymore - always try to fetch
			// (cache checking is done in init)

			// Set loading/refreshing state
			update(state => ({
				...state,
				isLoading: state.rankingsList.length === 0 && !forceRefresh,
				isRefreshing: state.rankingsList.length > 0 || forceRefresh,
				error: null,
				currentStudentId: studentId,
				currentQuarter: quarter,
				currentSchoolYear: schoolYear
			}));

			try {
				const data = await fetchRankings(studentId, quarter, schoolYear);

				const newState = {
					myRank: data.myRank || 0,
					totalStudents: data.totalStudents || 0,
					myAverage: data.myAverage || 0,
					sectionInfo: data.sectionInfo || null,
					rankingsList: data.rankings || [],
					isLoading: false,
					isRefreshing: false,
					error: null,
					lastUpdated: Date.now(),
					currentStudentId: studentId,
					currentQuarter: quarter,
					currentSchoolYear: schoolYear
				};

				// Cache the data
				cacheData(studentId, quarter, schoolYear, {
					myRank: newState.myRank,
					totalStudents: newState.totalStudents,
					myAverage: newState.myAverage,
					sectionInfo: newState.sectionInfo,
					rankingsList: newState.rankingsList,
					lastUpdated: newState.lastUpdated
				});

				// Update the store
				set(newState);

		} catch (error) {
			console.error('Error loading class rankings:', error);
			
			// Try to get cached data even if it's expired
			const cachedData = getCachedData(studentId, quarter, schoolYear);
			
			console.log('Rankings fetch failed, checking cache:', {
				hasCachedData: !!cachedData,
				studentId,
				quarter,
				schoolYear
			});
			
			if (cachedData) {
				// If we have cached data, use it and show a toast notification
				console.log('Using cached rankings data and showing toast');
				update(state => ({
					...state,
					myRank: cachedData.myRank || 0,
					totalStudents: cachedData.totalStudents || 0,
					myAverage: cachedData.myAverage || 0,
					sectionInfo: cachedData.sectionInfo || null,
					rankingsList: cachedData.rankingsList || [],
					lastUpdated: cachedData.lastUpdated,
					isLoading: false,
					isRefreshing: false,
					error: null // Don't set error since we have cached data
				}));
				
				// Show connection error toast - always show it
				setTimeout(() => {
					toastStore.error('No internet connection. Showing offline data.');
				}, 100);
			} else {
				console.log('No cached data available, showing error container');
				// No cached data available, show error container
				update(state => ({
					...state,
					isLoading: false,
					isRefreshing: false,
					error: error.message || 'Failed to load rankings'
				}));
			}
		}
		},

		// Refresh current rankings
		async refresh() {
			let currentState;
			const unsubscribe = subscribe(state => {
				currentState = state;
			});
			unsubscribe();

			if (currentState.currentStudentId && currentState.currentQuarter && currentState.currentSchoolYear) {
				await this.loadRankings(
					currentState.currentStudentId,
					currentState.currentQuarter,
					currentState.currentSchoolYear,
					true
				);
			}
		},

		// Reset store to initial state
		reset() {
			set(initialState);
		},

		// Clear cache for specific student
		clearCache(studentId, quarter, schoolYear) {
			try {
				const cacheKey = getCacheKey(studentId, quarter, schoolYear);
				localStorage.removeItem(cacheKey);
			} catch (error) {
				console.warn('Failed to clear cache:', error);
			}
		},

		// Clear all ranking caches
		clearAllCache() {
			try {
				const keys = Object.keys(localStorage);
				keys.forEach(key => {
					if (key.startsWith(CACHE_KEY_PREFIX)) {
						localStorage.removeItem(key);
					}
				});
			} catch (error) {
				console.warn('Failed to clear all caches:', error);
			}
		}
	};
}

export const studentClassRankingStore = createStudentClassRankingStore();

