import { writable } from 'svelte/store';

// Cache configuration
const CACHE_KEY = 'roomManagementData';
const SECTIONS_CACHE_KEY = 'availableSectionsData';
const CACHE_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes

// Create the store with initial state
function createRoomManagementStore() {
	const { subscribe, set, update } = writable({
		rooms: [],
		availableSections: [],
		isLoading: false,
		error: null,
		lastUpdated: null
	});

	return {
		subscribe,
		
		// Initialize store with cached data
		init: (cachedData) => {
			if (cachedData && cachedData.rooms) {
				set({
					rooms: cachedData.rooms,
					availableSections: cachedData.availableSections || [],
					isLoading: false,
					error: null,
					lastUpdated: cachedData.lastUpdated
				});
			}
		},

		// Set loading state
		setLoading: (loading) => {
			update(state => ({
				...state,
				isLoading: loading,
				error: loading ? null : state.error
			}));
		},

		// Update rooms data and cache it
		updateRooms: (rooms) => {
			const now = Date.now();
			const newState = {
				rooms,
				lastUpdated: now,
				isLoading: false,
				error: null
			};

			update(state => ({
				...state,
				...newState
			}));

			// Cache the rooms data
			try {
				localStorage.setItem(CACHE_KEY, JSON.stringify({
					rooms,
					lastUpdated: now
				}));
			} catch (error) {
				console.warn('Failed to cache rooms data:', error);
			}
		},

		// Update available sections data and cache it
		updateSections: (sections) => {
			const now = Date.now();
			
			update(state => ({
				...state,
				availableSections: sections,
				lastUpdated: now
			}));

			// Cache the sections data
			try {
				localStorage.setItem(SECTIONS_CACHE_KEY, JSON.stringify({
					sections,
					lastUpdated: now
				}));
			} catch (error) {
				console.warn('Failed to cache sections data:', error);
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

		// Get cached data if valid
		getCachedData: () => {
			try {
				const roomsCache = localStorage.getItem(CACHE_KEY);
				const sectionsCache = localStorage.getItem(SECTIONS_CACHE_KEY);
				
				if (!roomsCache) return null;

				const roomsData = JSON.parse(roomsCache);
				const sectionsData = sectionsCache ? JSON.parse(sectionsCache) : { sections: [] };
				
				// Check if cache is still valid
				const now = Date.now();
				const roomsAge = now - (roomsData.lastUpdated || 0);
				const sectionsAge = now - (sectionsData.lastUpdated || 0);
				
				if (roomsAge < CACHE_VALIDITY_MS) {
					return {
						rooms: roomsData.rooms || [],
						availableSections: sectionsAge < CACHE_VALIDITY_MS ? (sectionsData.sections || []) : [],
						lastUpdated: roomsData.lastUpdated
					};
				}
				
				return null;
			} catch (error) {
				console.warn('Failed to retrieve cached room data:', error);
				return null;
			}
		},

		// Clear cache
		clearCache: () => {
			try {
				localStorage.removeItem(CACHE_KEY);
				localStorage.removeItem(SECTIONS_CACHE_KEY);
			} catch (error) {
				console.warn('Failed to clear room cache:', error);
			}
		},

		// Add a new room to the store
		addRoom: (room) => {
			update(state => {
				const newRooms = [room, ...state.rooms];
				
				// Update cache
				try {
					localStorage.setItem(CACHE_KEY, JSON.stringify({
						rooms: newRooms,
						lastUpdated: Date.now()
					}));
				} catch (error) {
					console.warn('Failed to update cache after adding room:', error);
				}

				return {
					...state,
					rooms: newRooms
				};
			});
		},

		// Remove a room from the store
		removeRoom: (roomId) => {
			update(state => {
				const newRooms = state.rooms.filter(room => room.id !== roomId);
				
				// Update cache
				try {
					localStorage.setItem(CACHE_KEY, JSON.stringify({
						rooms: newRooms,
						lastUpdated: Date.now()
					}));
				} catch (error) {
					console.warn('Failed to update cache after removing room:', error);
				}

				return {
					...state,
					rooms: newRooms
				};
			});
		},

		// Update a specific room in the store
		updateRoom: (roomId, updatedRoom) => {
			update(state => {
				const newRooms = state.rooms.map(room => 
					room.id === roomId ? { ...room, ...updatedRoom } : room
				);
				
				// Update cache
				try {
					localStorage.setItem(CACHE_KEY, JSON.stringify({
						rooms: newRooms,
						lastUpdated: Date.now()
					}));
				} catch (error) {
					console.warn('Failed to update cache after updating room:', error);
				}

				return {
					...state,
					rooms: newRooms
				};
			});
		}
	};
}

export const roomManagementStore = createRoomManagementStore();