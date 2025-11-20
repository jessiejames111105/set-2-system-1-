import { writable } from 'svelte/store';
import { api } from '../../../routes/api/helper/api-helper.js';
import { toastStore } from '../../../components/common/js/toastStore.js';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_KEY_PREFIX = 'student_todolist_';

// Create the store
function createStudentTodolistStore() {
	const initialState = {
		todos: [],
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
			console.warn('Failed to retrieve cached student todolist data:', error);
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
			console.warn('Failed to retrieve cached student todolist data:', error);
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
			console.warn('Failed to cache student todolist data:', error);
		}
	}

	// Main function to load todos
	async function loadTodos(studentId, silent = false) {
		try {
			// Set loading state (only if not silent)
			update(state => ({
				...state,
				isLoading: !silent,
				isRefreshing: silent,
				error: null,
				currentStudentId: studentId
			}));

			// Fetch todos data
			const response = await api.get(`/api/student-todos?studentId=${studentId}`);

			if (!response.success) {
				throw new Error(response.error || 'Failed to fetch todos');
			}

			const todos = response.data || [];

			// Update store with new data
			update(state => ({
				...state,
				todos,
				isLoading: false,
				isRefreshing: false,
				error: null,
				lastUpdated: new Date().toISOString()
			}));

			// Cache the data
			cacheData(studentId, {
				todos,
				lastUpdated: new Date().toISOString()
			});

		} catch (error) {
			console.error('Error loading student todos:', error);
			
		// Try to get cached data even if it's expired
		let studentId;
		update(state => {
			studentId = state.currentStudentId;
			return state;
		});
		
		const cachedData = getCachedData(studentId);
		
		if (cachedData) {
			// If we have cached data, use it and show a toast notification
			update(state => ({
				...state,
				isLoading: false,
				isRefreshing: false,
				error: null, // Don't set error since we have cached data
				todos: cachedData.todos || [],
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
				todos: []
			}));
		}
		}
	}

	// Add a new todo
	async function addTodo(studentId, todoData) {
		try {
			const response = await api.post('/api/student-todos', {
				studentId,
				...todoData
			});

			if (!response.success) {
				throw new Error(response.error || 'Failed to add todo');
			}

			// Add to beginning of array and update cache
			update(state => {
				const newTodos = [response.data, ...state.todos];
				cacheData(studentId, {
					todos: newTodos,
					lastUpdated: new Date().toISOString()
				});
				return {
					...state,
					todos: newTodos,
					lastUpdated: new Date().toISOString()
				};
			});

			return { success: true, data: response.data };
		} catch (error) {
			console.error('Error adding todo:', error);
			return { success: false, error: error.message };
		}
	}

	// Update a todo
	async function updateTodo(studentId, todoId, updateData) {
		try {
			const response = await api.put('/api/student-todos', {
				id: todoId,
				studentId,
				action: 'update',
				...updateData
			});

			if (!response.success) {
				throw new Error(response.error || 'Failed to update todo');
			}

			// Update in array and cache
			update(state => {
				const newTodos = state.todos.map(todo => 
					todo.id === todoId ? response.data : todo
				);
				cacheData(studentId, {
					todos: newTodos,
					lastUpdated: new Date().toISOString()
				});
				return {
					...state,
					todos: newTodos,
					lastUpdated: new Date().toISOString()
				};
			});

			return { success: true, data: response.data };
		} catch (error) {
			console.error('Error updating todo:', error);
			return { success: false, error: error.message };
		}
	}

	// Toggle todo completion status
	async function toggleTodo(studentId, todoId) {
		try {
			const response = await api.put('/api/student-todos', {
				id: todoId,
				studentId,
				action: 'toggle'
			});

			if (!response.success) {
				throw new Error(response.error || 'Failed to toggle todo');
			}

			// Update in array and cache
			update(state => {
				const newTodos = state.todos.map(todo => 
					todo.id === todoId ? response.data : todo
				);
				cacheData(studentId, {
					todos: newTodos,
					lastUpdated: new Date().toISOString()
				});
				return {
					...state,
					todos: newTodos,
					lastUpdated: new Date().toISOString()
				};
			});

			return { success: true, data: response.data };
		} catch (error) {
			console.error('Error toggling todo:', error);
			return { success: false, error: error.message };
		}
	}

	// Delete a todo
	async function deleteTodo(studentId, todoId) {
		try {
			const response = await api.delete('/api/student-todos', {
				id: todoId,
				studentId
			});

			if (!response.success) {
				throw new Error(response.error || 'Failed to delete todo');
			}

			// Remove from array and update cache
			update(state => {
				const newTodos = state.todos.filter(todo => todo.id !== todoId);
				cacheData(studentId, {
					todos: newTodos,
					lastUpdated: new Date().toISOString()
				});
				return {
					...state,
					todos: newTodos,
					lastUpdated: new Date().toISOString()
				};
			});

			return { success: true };
		} catch (error) {
			console.error('Error deleting todo:', error);
			return { success: false, error: error.message };
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
			console.warn('Failed to clear student todolist cache:', error);
		}

		// Reset store state
		update(state => ({
			...initialState,
			currentStudentId: studentId,
			isLoading: true
		}));

		// Load fresh data
		return store.loadTodos(studentId, false);
	}

	const store = {
		subscribe,
		init,
		loadTodos,
		addTodo,
		updateTodo,
		toggleTodo,
		deleteTodo,
		forceRefresh,
		getCachedData: (studentId) => getCachedData(studentId)
	};

	return store;
}

export const studentTodolistStore = createStudentTodolistStore();

