import { writable } from 'svelte/store';
import { toastStore } from '../../../components/common/js/toastStore.js';
import { authenticatedFetch } from '../../../routes/api/helper/api-helper.js';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_KEY_PREFIX = 'student_profile_';

// Create the store
function createStudentProfileStore() {
	const initialState = {
		studentData: null,
		studentProfileData: null,
		studentSections: [],
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
			console.warn('Failed to retrieve cached student profile data:', error);
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
			console.warn('Failed to retrieve cached student profile data:', error);
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
			console.warn('Failed to cache student profile data:', error);
		}
	}

	// Main function to load profile data
	async function loadProfile(studentId, silent = false) {
		try {
			// Set loading state (only if not silent)
			update(state => ({
				...state,
				isLoading: !silent,
				isRefreshing: silent,
				error: null,
				currentStudentId: studentId
			}));

			// Fetch student profile data from API
			const profileResponse = await authenticatedFetch(`/api/student-profile?studentId=${studentId}`);
			
			if (!profileResponse.ok) {
				throw new Error('Failed to fetch student profile data');
			}

			const profileResult = await profileResponse.json();
			
			if (!profileResult.success) {
				throw new Error(profileResult.error || 'Failed to fetch student profile data');
			}

			const studentProfileData = profileResult.data;

			// Fetch basic student data from users API
			let currentStudentData = null;
			try {
				const userResponse = await authenticatedFetch(`/api/users?id=${studentId}`);
				if (userResponse.ok) {
					const userResult = await userResponse.json();
					if (userResult.success && userResult.user) {
						currentStudentData = {
							id: userResult.user.id || studentId,
							number: userResult.user.account_number,
							name: userResult.user.full_name,
							firstName: userResult.user.first_name,
							lastName: userResult.user.last_name,
							middleInitial: userResult.user.middle_initial || '',
							email: userResult.user.email,
							contactNumber: userResult.user.contact_number,
							address: userResult.user.address,
							birthdate: userResult.user.birth_date,
							age: userResult.user.age,
							guardian: userResult.user.guardian,
							gender: userResult.user.gender,
							gradeLevel: studentProfileData?.section?.gradeLevel || userResult.user.grade_level
						};
					}
				}
			} catch (err) {
				console.warn('Failed to fetch basic student data:', err);
			}

			// If we don't have basic student data, create a minimal version from profile data
			if (!currentStudentData) {
				currentStudentData = {
					id: studentId,
					number: studentId,
					name: 'Student',
					gradeLevel: studentProfileData?.section?.gradeLevel || 'Not assigned'
				};
			}

			// If student profile data doesn't have subjects or has empty subjects, fetch from grades API
			if (!studentProfileData?.subjects || studentProfileData.subjects.length === 0) {
				try {
					// Get current quarter and school year
					const currentQuarterResponse = await authenticatedFetch('/api/current-quarter');
					const currentQuarterData = await currentQuarterResponse.json();
					const currentQuarter = currentQuarterData.data?.currentQuarter || 2;
					const schoolYear = currentQuarterData.data?.currentSchoolYear || '2025-2026';

					// Fetch subjects from grades API (similar to student grades page)
					const gradesResponse = await authenticatedFetch(`/api/student-grades?student_id=${studentId}&quarter=${currentQuarter}&school_year=${schoolYear}`);
					if (gradesResponse.ok) {
						const gradesResult = await gradesResponse.json();
						if (gradesResult.success && gradesResult.data.grades) {
							// Transform grades data to match the subjects format expected by the profile
							const subjectsFromGrades = gradesResult.data.grades.map(grade => ({
								id: grade.subject_id,
								name: grade.name,
								code: grade.code || '',
								teacher: grade.teacher,
								color: getSubjectColorFromName(grade.name) // Helper function to get color
							}));

							// Update studentProfileData with subjects from grades
							if (studentProfileData) {
								studentProfileData.subjects = subjectsFromGrades;
							} else {
								// Create minimal profile data with subjects
								studentProfileData = {
									section: {
										id: null,
										name: 'No section assigned',
										gradeLevel: currentStudentData.grade_level || 'Not assigned',
										adviser: 'No adviser'
									},
									subjects: subjectsFromGrades,
									academicSummary: {
										generalAverage: gradesResult.data.statistics.overallAverage || 'Not available',
										classRank: 'Not available',
										totalStudentsInSection: 0,
										totalSubjectsEnrolled: subjectsFromGrades.length,
										totalSubjectsWithGrades: gradesResult.data.statistics.countedSubjects || 0
									}
								};
							}
						}
					}
				} catch (err) {
					console.warn('Failed to fetch subjects from grades API:', err);
				}
			}

			// Fetch student sections if available
			let studentSections = [];
			try {
				const currentQuarterResponse = await authenticatedFetch('/api/current-quarter');
				const currentQuarterData = await currentQuarterResponse.json();
				const schoolYear = currentQuarterData.data?.currentSchoolYear || '2025-2026';

				const sectionsResponse = await authenticatedFetch(`/api/student-sections?studentId=${studentId}&schoolYear=${schoolYear}`);
				if (sectionsResponse.ok) {
					const sectionsResult = await sectionsResponse.json();
					if (sectionsResult.success) {
						studentSections = sectionsResult.data.classData || [];
					}
				}
			} catch (err) {
				// Don't throw error here as basic profile should still work
				console.warn('Failed to fetch student sections:', err);
			}

			// Update store with new data
			const profileData = {
				studentData: currentStudentData,
				studentProfileData,
				studentSections,
				lastUpdated: new Date().toISOString()
			};

			update(state => ({
				...state,
				...profileData,
				isLoading: false,
				isRefreshing: false,
				error: null
			}));

			// Cache the data
			cacheData(studentId, profileData);

		} catch (error) {
			console.error('Error loading student profile:', error);
			
		// Try to get cached data even if it's expired
		const cachedData = getCachedData(studentId);
		
		if (cachedData) {
			// If we have cached data, use it and show a toast notification
			update(state => ({
				...state,
				studentData: cachedData.studentData,
				studentProfileData: cachedData.studentProfileData,
				studentSections: cachedData.studentSections || [],
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
				error: error.message
			}));
		}
		}
	}

	// Helper function to assign colors to subjects (similar to student-profile API)
	function getSubjectColorFromName(subjectName) {
		const subjectColors = {
			'Mathematics': ['#4F46E5', '#6366F1', '#8B5CF6', '#3B82F6'],
			'Math': ['#4F46E5', '#6366F1', '#8B5CF6', '#3B82F6'],
			'Science': ['#059669', '#10B981', '#34D399', '#047857'],
			'English': ['#DC2626', '#EF4444', '#F87171', '#B91C1C'],
			'Physical Education': ['#EA580C', '#F97316', '#FB923C', '#C2410C'],
			'MAPEH': ['#EA580C', '#F97316', '#FB923C', '#C2410C'],
			'PE': ['#EA580C', '#F97316', '#FB923C', '#C2410C'],
			'Filipino': ['#7C2D12', '#A16207', '#D97706', '#92400E'],
			'Araling Panlipunan': ['#B45309', '#D97706', '#F59E0B', '#A16207'],
			'History': ['#B45309', '#D97706', '#F59E0B', '#A16207'],
			'Computer': ['#6366F1', '#8B5CF6', '#A855F7', '#7C3AED'],
			'Technology': ['#6366F1', '#8B5CF6', '#A855F7', '#7C3AED'],
			'Arts': ['#C026D3', '#D946EF', '#E879F9', '#A21CAF'],
			'Music': ['#EC4899', '#F472B6', '#F9A8D4', '#DB2777'],
			'Health': ['#16A34A', '#22C55E', '#4ADE80', '#15803D'],
			'Values': ['#0891B2', '#06B6D4', '#22D3EE', '#0E7490'],
			'Research': ['#7C2D12', '#A16207', '#D97706', '#92400E'],
			'TLE': ['#9333EA', '#A855F7', '#C084FC', '#7E22CE'],
			'ESP': ['#0891B2', '#06B6D4', '#22D3EE', '#0E7490']
		};

		const fallbackColors = [
			'#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', 
			'#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6',
			'#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
			'#F43F5E', '#E11D48', '#BE123C', '#9F1239', '#881337'
		];
		
		function simpleHash(str) {
			let hash = 0;
			for (let i = 0; i < str.length; i++) {
				const char = str.charCodeAt(i);
				hash = ((hash << 5) - hash) + char;
				hash = hash & hash;
			}
			return Math.abs(hash);
		}

		const normalizedName = subjectName.toLowerCase().trim();
		
		for (const [key, colorArray] of Object.entries(subjectColors)) {
			if (normalizedName.includes(key.toLowerCase())) {
				const hash = simpleHash(subjectName);
				const colorIndex = hash % colorArray.length;
				return colorArray[colorIndex];
			}
		}
		
		const hash = simpleHash(subjectName);
		const colorIndex = hash % fallbackColors.length;
		return fallbackColors[colorIndex];
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
			console.warn('Failed to clear student profile cache:', error);
		}

		// Reset store state
		update(state => ({
			...initialState,
			currentStudentId: studentId,
			isLoading: true
		}));

		// Load fresh data
		return store.loadProfile(studentId, false);
	}

	const store = {
		subscribe,
		init,
		loadProfile,
		forceRefresh,
		getCachedData: (studentId) => getCachedData(studentId)
	};

	return store;
}

export const studentProfileStore = createStudentProfileStore();