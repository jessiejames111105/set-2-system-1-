import { writable } from 'svelte/store';
import { toastStore } from '../../../components/common/js/toastStore.js';
import { authStore } from '../../../components/login/js/auth.js';
import { get } from 'svelte/store';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_KEY_PREFIX = 'student_grades_';
const AI_ANALYSIS_CACHE_KEY_PREFIX = 'student_ai_analysis_';
const AI_ANALYSIS_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Create the store
function createStudentGradeStore() {
	const initialState = {
		grades: [],
		statistics: {
			overallAverage: 0,
			totalSubjects: 0
		},
		sectionInfo: null,
		classRank: null,
		totalStudentsInSection: 0,
		currentQuarter: 2,
		currentQuarterName: '2nd Quarter',
		currentSchoolYear: '2025-2026',
		isLoading: false,
		isRefreshing: false,
		error: null,
		lastUpdated: null,
		currentStudentId: null,
		previousQuarterAverage: null,
		averageChange: null,
		// AI Analysis cache
		aiAnalysis: null,
		aiAnalysisLoading: false,
		aiAnalysisError: null,
		aiAnalysisTimestamp: null,
		// Background preloading state
		isPreloading: false,
		preloadProgress: { current: 0, total: 0 }
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
			// Failed to retrieve cached data - continue with fresh fetch
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
			// Failed to retrieve cached data - continue
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
			// Failed to cache data - continue
		}
	}

	// Fetch current quarter and school year
	async function fetchCurrentQuarter() {
		try {
			const response = await fetch('/api/current-quarter', {
				headers: getAuthHeaders()
			});
			const data = await response.json();
			
			if (data.success && data.data) {
				return {
					currentQuarter: data.data.currentQuarter,
					currentQuarterName: data.data.quarterName,
					currentSchoolYear: data.data.currentSchoolYear
				};
			}
		} catch (err) {
			// Failed to fetch current quarter - use defaults
		}
		
		// Return defaults if fetch fails
		return {
			currentQuarter: 2,
			currentQuarterName: '2nd Quarter',
			currentSchoolYear: '2025-2026'
		};
	}

	// Fetch student profile data for section info
	async function fetchStudentProfile(studentId) {
		try {
			const response = await fetch(`/api/student-profile?studentId=${studentId}`, {
				headers: getAuthHeaders()
			});
			const result = await response.json();
			
			if (result.success) {
				const { section } = result.data;
				return {
					sectionInfo: section
				};
			}
		} catch (err) {
			// Failed to fetch student profile - continue
		}
		return {
			sectionInfo: null
		};
	}

	// Fetch class rank for specific quarter and school year
	async function fetchClassRank(studentId, quarter, schoolYear) {
		try {
			const response = await fetch(`/api/class-rankings?studentId=${studentId}&quarter=${quarter}&schoolYear=${schoolYear}`, {
				headers: getAuthHeaders()
			});
			const result = await response.json();
			
			if (result.success) {
				return {
					classRank: result.myRank,
					totalStudentsInSection: result.totalStudents
				};
			}
		} catch (err) {
			// Failed to fetch class rank - continue
		}
		return {
			classRank: null,
			totalStudentsInSection: 0
		};
	}

	// Fetch previous quarter's average for comparison
	async function fetchPreviousQuarterAverage(studentId, currentQuarter, schoolYear) {
		try {
			// Determine previous quarter
			let prevQuarter = currentQuarter - 1;
			let prevSchoolYear = schoolYear;
			
			// If current quarter is 1, get quarter 4 from previous school year
			if (prevQuarter < 1) {
				prevQuarter = 4;
				// Parse school year and decrement
				const [startYear, endYear] = schoolYear.split('-').map(y => parseInt(y));
				prevSchoolYear = `${startYear - 1}-${endYear - 1}`;
			}
			
			// Fetch previous quarter grades
			const response = await fetch(`/api/student-grades?student_id=${studentId}&quarter=${prevQuarter}&school_year=${prevSchoolYear}`, {
				headers: getAuthHeaders()
			});
			const result = await response.json();
			
			if (result.success && result.data.statistics) {
				return result.data.statistics.overallAverage || null;
			}
		} catch (err) {
			// Failed to fetch previous quarter average - continue
		}
		return null;
	}

	// Main function to load grades data
	async function loadGrades(studentId, quarter = null, schoolYear = null, silent = false) {
		try {
			// Set loading state (only if not silent)
			update(state => ({
				...state,
				isLoading: !silent,
				isRefreshing: silent,
				error: null,
				currentStudentId: studentId
			}));

			// Fetch current quarter/school year if not provided
			let quarterData;
			if (!quarter || !schoolYear) {
				quarterData = await fetchCurrentQuarter();
				quarter = quarter || quarterData.currentQuarter;
				schoolYear = schoolYear || quarterData.currentSchoolYear;
			} else {
				quarterData = {
					currentQuarter: quarter,
					currentQuarterName: `${quarter}${quarter === 1 ? 'st' : quarter === 2 ? 'nd' : quarter === 3 ? 'rd' : 'th'} Quarter`,
					currentSchoolYear: schoolYear
				};
			}

		// Fetch grades data, profile, class rank, and previous quarter average in parallel
		const [gradesResult, profileData, rankData, previousAverage] = await Promise.all([
			fetch(`/api/student-grades?student_id=${studentId}&quarter=${quarter}&school_year=${schoolYear}`, {
				headers: getAuthHeaders()
			}).then(res => res.json()),
			fetchStudentProfile(studentId),
			fetchClassRank(studentId, quarter, schoolYear),
			fetchPreviousQuarterAverage(studentId, quarter, schoolYear)
		]);

		if (!gradesResult.success) {
			throw new Error(gradesResult.error || 'Failed to fetch grades data');
		}

		// Calculate average change
		const currentAverage = gradesResult.data.statistics?.overallAverage || 0;
		let averageChange = null;
		if (previousAverage !== null && currentAverage > 0) {
			averageChange = currentAverage - previousAverage;
		}

		// Update store with new data
		const newState = {
			grades: gradesResult.data.grades || [],
			statistics: gradesResult.data.statistics || { overallAverage: 0, totalSubjects: 0 },
			sectionInfo: profileData.sectionInfo,
			classRank: rankData.classRank,
			totalStudentsInSection: rankData.totalStudentsInSection,
			currentQuarter: quarter,
			currentQuarterName: quarterData.currentQuarterName,
			currentSchoolYear: schoolYear,
			previousQuarterAverage: previousAverage,
			averageChange: averageChange,
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

		// Cache the data (including quarter-specific rank)
		cacheData(studentId, quarter, schoolYear, {
			grades: newState.grades,
			statistics: newState.statistics,
			sectionInfo: newState.sectionInfo,
			classRank: newState.classRank,
			totalStudentsInSection: newState.totalStudentsInSection,
			currentQuarter: quarter,
			currentQuarterName: quarterData.currentQuarterName,
			currentSchoolYear: schoolYear,
			previousQuarterAverage: newState.previousQuarterAverage,
			averageChange: newState.averageChange,
			lastUpdated: newState.lastUpdated
		});

	} catch (error) {
		// Error loading grades - try cached data as fallback
		
		// Try to get cached data even if it's expired
		const cachedData = getCachedData(studentId, quarter, schoolYear);
		
		if (cachedData) {
			// If we have cached data, use it and show a toast notification
			update(state => ({
				...state,
				grades: cachedData.grades || [],
				statistics: cachedData.statistics || { overallAverage: 0, totalSubjects: 0 },
				sectionInfo: cachedData.sectionInfo,
				classRank: cachedData.classRank,
				totalStudentsInSection: cachedData.totalStudentsInSection,
				currentQuarter: cachedData.currentQuarter,
				currentQuarterName: cachedData.currentQuarterName,
				currentSchoolYear: cachedData.currentSchoolYear,
				previousQuarterAverage: cachedData.previousQuarterAverage,
				averageChange: cachedData.averageChange,
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
				grades: [],
				statistics: {
					overallAverage: 0,
					totalSubjects: 0
				},
				previousQuarterAverage: null,
				averageChange: null
			}));
		}
	}
	}

	// Initialize store with cached data if available
	function init(studentId, quarter = null, schoolYear = null) {
		// Clear AI analysis when switching to a different student
		let currentStudentId;
		subscribe(state => {
			currentStudentId = state.currentStudentId;
		})();
		
		if (currentStudentId && currentStudentId !== studentId) {
			// Different student, clear AI analysis
			update(state => ({
				...state,
				aiAnalysis: null,
				aiAnalysisLoading: false,
				aiAnalysisError: null,
				aiAnalysisTimestamp: null
			}));
		}
		
		// If quarter/schoolYear not provided, we need to fetch them first
		if (!quarter || !schoolYear) {
			fetchCurrentQuarter().then(quarterData => {
				const cachedData = getValidCachedData(
					studentId, 
					quarterData.currentQuarter, 
					quarterData.currentSchoolYear
				);
				
				if (cachedData) {
					update(state => ({
						...state,
						...cachedData,
						currentStudentId: studentId,
						isLoading: false,
						isRefreshing: false,
						error: null,
						// Clear AI analysis for new student
						aiAnalysis: null,
						aiAnalysisLoading: false,
						aiAnalysisError: null,
						aiAnalysisTimestamp: null
					}));
				} else {
					update(state => ({
						...state,
						currentStudentId: studentId,
						currentQuarter: quarterData.currentQuarter,
						currentQuarterName: quarterData.currentQuarterName,
						currentSchoolYear: quarterData.currentSchoolYear,
						isLoading: true,
						isRefreshing: false,
						error: null,
						// Clear AI analysis for new student
						aiAnalysis: null,
						aiAnalysisLoading: false,
						aiAnalysisError: null,
						aiAnalysisTimestamp: null
					}));
				}
			});
			return false;
		}

		const cachedData = getValidCachedData(studentId, quarter, schoolYear);
		if (cachedData) {
			update(state => ({
				...state,
				...cachedData,
				currentStudentId: studentId,
				isLoading: false,
				isRefreshing: false,
				error: null,
				// Clear AI analysis for new student
				aiAnalysis: null,
				aiAnalysisLoading: false,
				aiAnalysisError: null,
				aiAnalysisTimestamp: null
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
			error: null,
			// Clear AI analysis for new student
			aiAnalysis: null,
			aiAnalysisLoading: false,
			aiAnalysisError: null,
			aiAnalysisTimestamp: null
		}));
		return false; // No cached data
	}

	// Change quarter
	async function changeQuarter(studentId, quarter, schoolYear) {
		// Check cache first
		const cachedData = getValidCachedData(studentId, quarter, schoolYear);
		if (cachedData) {
			update(state => ({
				...state,
				...cachedData,
				currentStudentId: studentId,
				isLoading: false,
				isRefreshing: false,
				error: null
			}));
		}
		
		// Load fresh data (silent if we have cache)
		await loadGrades(studentId, quarter, schoolYear, !!cachedData);
	}

	// Force refresh (clear cache and reload)
	function forceRefresh(studentId, quarter, schoolYear) {
		// Clear cache
		try {
			const cacheKey = getCacheKey(studentId, quarter, schoolYear);
			localStorage.removeItem(cacheKey);
		} catch (error) {
			// Failed to clear cache - continue
		}

		// Reset store state
		update(state => ({
			...initialState,
			currentStudentId: studentId,
			currentQuarter: quarter,
			currentSchoolYear: schoolYear,
			isLoading: true
		}));

		// Load fresh data
		return store.loadGrades(studentId, quarter, schoolYear, false);
	}

	// Clear all cached data for a student (useful for debugging/testing)
	function clearAllCache(studentId) {
		try {
			const keys = Object.keys(localStorage);
			const prefix = `${CACHE_KEY_PREFIX}${studentId}_`;
			const aiPrefix = `${AI_ANALYSIS_CACHE_KEY_PREFIX}${studentId}_`;
			keys.forEach(key => {
				if (key.startsWith(prefix) || key.startsWith(aiPrefix)) {
					localStorage.removeItem(key);
				}
			});
		} catch (error) {
			// Failed to clear all cache - continue
		}
	}

	// AI Analysis caching functions
	function getAiAnalysisCacheKey(studentId, quarter, schoolYear) {
		return `${AI_ANALYSIS_CACHE_KEY_PREFIX}${studentId}_${quarter}_${schoolYear}`;
	}

	function getCachedAiAnalysis(studentId, quarter, schoolYear) {
		try {
			const cacheKey = getAiAnalysisCacheKey(studentId, quarter, schoolYear);
			const cached = localStorage.getItem(cacheKey);
			if (cached) {
				const parsedData = JSON.parse(cached);
				// Check if cache is still valid (7 days)
				if (Date.now() - parsedData.timestamp < AI_ANALYSIS_CACHE_DURATION) {
					return parsedData.data;
				}
			}
		} catch (error) {
			// Failed to retrieve cached AI analysis - continue
		}
		return null;
	}

	function cacheAiAnalysis(studentId, quarter, schoolYear, analysisData) {
		try {
			const cacheKey = getAiAnalysisCacheKey(studentId, quarter, schoolYear);
			const cacheEntry = {
				data: analysisData,
				timestamp: Date.now()
			};
			localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
		} catch (error) {
			// Failed to cache AI analysis - continue
		}
	}

	// Load AI Analysis (with dual caching: localStorage + database)
	async function loadAiAnalysis(studentId, quarter, schoolYear, forceRefresh = false) {
		try {
			// Set loading state
			update(state => ({
				...state,
				aiAnalysisLoading: true,
				aiAnalysisError: null
			}));

			// Determine previous quarter (but DON'T fetch - let API do it)
			let previousQuarterInfo = null;
			let prevQuarter = quarter - 1;
			let prevSchoolYear = schoolYear;
			
			if (prevQuarter < 1) {
				prevQuarter = 4;
				const [startYear, endYear] = schoolYear.split('-').map(y => parseInt(y));
				prevSchoolYear = `${startYear - 1}-${endYear - 1}`;
			}
			
			// Just send the quarter/year info, let the API fetch the actual data
			previousQuarterInfo = {
				quarter: prevQuarter,
				schoolYear: prevSchoolYear
			};

			// Check localStorage cache
			if (!forceRefresh) {
				const cachedAnalysis = getCachedAiAnalysis(studentId, quarter, schoolYear);
				if (cachedAnalysis) {
					update(state => ({
						...state,
						aiAnalysis: cachedAnalysis,
						aiAnalysisLoading: false,
						aiAnalysisError: null,
						aiAnalysisTimestamp: Date.now()
					}));
					return cachedAnalysis;
				}
			}

			// Fetch from API (API checks database cache, then generates if needed)
			// Set a longer timeout (90 seconds) for AI generation
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 90000);
			
			try {
				const response = await fetch('/api/ai-grade-analysis', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						...getAuthHeaders()
					},
					body: JSON.stringify({
						studentId,
						quarter,
						schoolYear,
						forceRefresh,
						previousQuarterInfo
					}),
					signal: controller.signal
				});
				
				clearTimeout(timeoutId);

				if (!response.ok) {
					throw new Error('Failed to fetch AI analysis');
				}

				// Read the streamed response
				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let jsonString = '';

				while (true) {
					const { value, done } = await reader.read();
					if (done) break;
					jsonString += decoder.decode(value, { stream: true });
				}

				// Parse the JSON
				const analysisData = JSON.parse(jsonString);

				// Validate structure
				if (!analysisData || !analysisData.overallInsight) {
					throw new Error('Invalid analysis data structure');
				}

				// Cache to localStorage (database cache is handled by API)
				cacheAiAnalysis(studentId, quarter, schoolYear, analysisData);

				// Update store
				update(state => ({
					...state,
					aiAnalysis: analysisData,
					aiAnalysisLoading: false,
					aiAnalysisError: null,
					aiAnalysisTimestamp: Date.now()
				}));

				return analysisData;
			} catch (fetchError) {
				clearTimeout(timeoutId);
				if (fetchError.name === 'AbortError') {
					throw new Error('AI analysis is taking longer than expected. Please try again.');
				}
				throw fetchError;
			}

		} catch (error) {
			// Error loading AI analysis - try cached fallback
			
			// Try localStorage cache as fallback (even if expired)
			const cachedAnalysis = getCachedAiAnalysis(studentId, quarter, schoolYear);
			if (cachedAnalysis) {
				update(state => ({
					...state,
					aiAnalysis: cachedAnalysis,
					aiAnalysisLoading: false,
					aiAnalysisError: null,
					aiAnalysisTimestamp: Date.now()
				}));
				return cachedAnalysis;
			}

			// No cache available
			update(state => ({
				...state,
				aiAnalysis: null,
				aiAnalysisLoading: false,
				aiAnalysisError: error.message,
				aiAnalysisTimestamp: null
			}));
			
			throw error;
		}
	}

	// Clear AI Analysis from store (when switching quarters)
	function clearAiAnalysis() {
		update(state => ({
			...state,
			aiAnalysis: null,
			aiAnalysisLoading: false,
			aiAnalysisError: null,
			aiAnalysisTimestamp: null
		}));
	}

	// Initialize AI Analysis from cache if available
	function initAiAnalysis(studentId, quarter, schoolYear) {
		const cachedAnalysis = getCachedAiAnalysis(studentId, quarter, schoolYear);
		if (cachedAnalysis) {
			update(state => ({
				...state,
				aiAnalysis: cachedAnalysis,
				aiAnalysisTimestamp: Date.now()
			}));
			return true;
		}
		return false;
	}

	// Background preload all quarters
	async function preloadAllQuarters(studentId, currentQuarter, schoolYear) {
		
		// Preload all 4 quarters in the background
		const quarters = [1, 2, 3, 4].filter(q => q !== currentQuarter);
		
		// Set preloading state
		update(state => ({
			...state,
			isPreloading: true,
			preloadProgress: { current: 0, total: quarters.length }
		}));
		
		// Load quarters sequentially to avoid overwhelming the server
		for (let i = 0; i < quarters.length; i++) {
			const quarter = quarters[i];
			try {
				// Check if already cached
				const cachedData = getValidCachedData(studentId, quarter, schoolYear);
				if (cachedData) {
					update(state => ({
						...state,
						preloadProgress: { current: i + 1, total: quarters.length }
					}));
					continue;
				}
				
				
				// Fetch grades data, profile, class rank, and previous quarter average
				const quarterName = `${quarter}${quarter === 1 ? 'st' : quarter === 2 ? 'nd' : quarter === 3 ? 'rd' : 'th'} Quarter`;
				
				const [gradesResult, profileData, rankData, previousAverage] = await Promise.all([
					fetch(`/api/student-grades?student_id=${studentId}&quarter=${quarter}&school_year=${schoolYear}`, {
						headers: getAuthHeaders()
					}).then(res => res.json()),
					fetchStudentProfile(studentId),
					fetchClassRank(studentId, quarter, schoolYear),
					fetchPreviousQuarterAverage(studentId, quarter, schoolYear)
				]);

				if (!gradesResult.success) {
					// Failed to preload quarter - continue with others
					update(state => ({
						...state,
						preloadProgress: { current: i + 1, total: quarters.length }
					}));
					continue;
				}

				// Calculate average change
				const currentAverage = gradesResult.data.statistics?.overallAverage || 0;
				let averageChange = null;
				if (previousAverage !== null && currentAverage > 0) {
					averageChange = currentAverage - previousAverage;
				}

				// Cache the data
				cacheData(studentId, quarter, schoolYear, {
					grades: gradesResult.data.grades || [],
					statistics: gradesResult.data.statistics || { overallAverage: 0, totalSubjects: 0 },
					sectionInfo: profileData.sectionInfo,
					classRank: rankData.classRank,
					totalStudentsInSection: rankData.totalStudentsInSection,
					currentQuarter: quarter,
					currentQuarterName: quarterName,
					currentSchoolYear: schoolYear,
					previousQuarterAverage: previousAverage,
					averageChange: averageChange,
					lastUpdated: new Date().toISOString()
				});
				
				// Update progress
				update(state => ({
					...state,
					preloadProgress: { current: i + 1, total: quarters.length }
				}));
				
				// Small delay between requests to avoid overwhelming the server
				await new Promise(resolve => setTimeout(resolve, 500));
			} catch (error) {
				// Error preloading quarter - continue with others
				update(state => ({
					...state,
					preloadProgress: { current: i + 1, total: quarters.length }
				}));
			}
		}
		
		// Clear preloading state
		update(state => ({
			...state,
			isPreloading: false,
			preloadProgress: { current: 0, total: 0 }
		}));
	}

	// Background preload AI analysis for all quarters (only if analysis already exists)
	async function preloadAllAiAnalysis(studentId, currentQuarter, schoolYear) {
		
		// Preload AI for all 4 quarters, but only fetch existing analyses (don't trigger generation)
		const quarters = [1, 2, 3, 4].filter(q => q !== currentQuarter);
		
		for (const quarter of quarters) {
			try {
				// Check if already cached in localStorage
				const cachedAnalysis = getCachedAiAnalysis(studentId, quarter, schoolYear);
				if (cachedAnalysis) {
					continue;
				}
				
				// First, check if this quarter has grades (from cache or quick fetch)
				const cachedGrades = getValidCachedData(studentId, quarter, schoolYear);
				const hasGrades = cachedGrades && cachedGrades.grades && cachedGrades.grades.length > 0;
				
				// If no cached grades, skip AI preload (likely no grades for this quarter yet)
				if (!hasGrades) {
					continue;
				}
				
				// Determine previous quarter info
				let prevQuarter = quarter - 1;
				let prevSchoolYear = schoolYear;
				
				if (prevQuarter < 1) {
					prevQuarter = 4;
					const [startYear, endYear] = schoolYear.split('-').map(y => parseInt(y));
					prevSchoolYear = `${startYear - 1}-${endYear - 1}`;
				}
				
				const previousQuarterInfo = {
					quarter: prevQuarter,
					schoolYear: prevSchoolYear
				};

				// Fetch AI analysis with cacheOnly flag to prevent generation
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 30000); // Shorter timeout since we're not generating
				
				try {
					const response = await fetch('/api/ai-grade-analysis', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							...getAuthHeaders()
						},
						body: JSON.stringify({
							studentId,
							quarter,
							schoolYear,
							forceRefresh: false,
							previousQuarterInfo,
							cacheOnly: true // Only fetch if already exists in database
						}),
						signal: controller.signal
					});
					
					clearTimeout(timeoutId);

					if (!response.ok) {
						// No existing analysis in database - skip silently (expected)
						continue;
					}

					// Read the streamed response
					const reader = response.body.getReader();
					const decoder = new TextDecoder();
					let jsonString = '';

					while (true) {
						const { value, done } = await reader.read();
						if (done) break;
						jsonString += decoder.decode(value, { stream: true });
					}

					// Parse and cache to localStorage
					const analysisData = JSON.parse(jsonString);
					
					if (analysisData && analysisData.overallInsight) {
						cacheAiAnalysis(studentId, quarter, schoolYear, analysisData);
					}
					
					// Small delay between requests
					await new Promise(resolve => setTimeout(resolve, 500));
				} catch (fetchError) {
					clearTimeout(timeoutId);
					// Silently skip - no existing analysis or network error
				}
			} catch (error) {
				// Silently skip - preload is best-effort
			}
		}
	}

	const store = {
		subscribe,
		init,
		loadGrades,
		changeQuarter,
		forceRefresh,
		clearAllCache,
		getCachedData: (studentId, quarter, schoolYear) => getCachedData(studentId, quarter, schoolYear),
		// AI Analysis methods
		loadAiAnalysis,
		clearAiAnalysis,
		initAiAnalysis,
		getCachedAiAnalysis: (studentId, quarter, schoolYear) => getCachedAiAnalysis(studentId, quarter, schoolYear),
		// Background preloading methods
		preloadAllQuarters,
		preloadAllAiAnalysis
	};

	return store;
}

export const studentGradeStore = createStudentGradeStore();

