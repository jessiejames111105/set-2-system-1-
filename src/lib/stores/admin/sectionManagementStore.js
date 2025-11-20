import { writable } from 'svelte/store';
import { authenticatedFetch } from '../../../routes/api/helper/api-helper.js';

// Cache configuration - only for sections
const SECTIONS_CACHE_KEY = 'sectionsCache';
const CACHE_VALIDITY_MS = 3 * 60 * 1000; // 3 minutes

// Create writable stores
export const sectionManagementStore = (() => {
    // Initialize stores
    const sections = writable([]);
    const isLoadingSections = writable(false);
    const sectionsError = writable(null);

    // Cache utilities - only for sections
    const getCachedSections = () => {
        try {
            const cached = localStorage.getItem(SECTIONS_CACHE_KEY);
            if (!cached) return null;

            const data = JSON.parse(cached);
            const now = Date.now();
            
            // Check if cache is still valid
            if (now - data.timestamp > CACHE_VALIDITY_MS) {
                localStorage.removeItem(SECTIONS_CACHE_KEY);
                return null;
            }
            
            return data.sections;
        } catch (error) {
            console.error('Error reading sections cache:', error);
            localStorage.removeItem(SECTIONS_CACHE_KEY);
            return null;
        }
    };

    const setCachedSections = (sectionsData) => {
        try {
            const cacheData = {
                sections: sectionsData,
                timestamp: Date.now()
            };
            localStorage.setItem(SECTIONS_CACHE_KEY, JSON.stringify(cacheData));
        } catch (error) {
            console.error('Error setting sections cache:', error);
        }
    };

    const clearSectionsCache = () => {
        try {
            localStorage.removeItem(SECTIONS_CACHE_KEY);
        } catch (error) {
            console.error('Error clearing sections cache:', error);
        }
    };

    // Store methods
    const initSections = () => {
        const cachedSections = getCachedSections();
        if (cachedSections) {
            sections.set(cachedSections);
            return true; // Has cached data
        }
        return false; // No cached data
    };

    const updateSections = (newSections, silent = false) => {
        sections.set(newSections);
        sectionsError.set(null);
        
        if (!silent) {
            isLoadingSections.set(false);
        }
        
        // Update cache
        setCachedSections(newSections);
    };

    const setLoadingSections = (loading, silent = false) => {
        if (!silent) {
            isLoadingSections.set(loading);
        }
    };

    const setSectionsError = (error) => {
        sectionsError.set(error);
        isLoadingSections.set(false);
    };

    const loadSections = async (silent = false, searchTerm = '') => {
        try {
            setLoadingSections(true, silent);
            
            // Build URL with search parameter if provided
            let url = '/api/sections';
            if (searchTerm && searchTerm.trim()) {
                url += `?search=${encodeURIComponent(searchTerm.trim())}`;
            }
            
            const response = await authenticatedFetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Check if the API response has the expected structure
            if (!result.success || !result.data) {
                throw new Error('Invalid API response structure');
            }
            
            // Process sections data
            const processedSections = result.data.map(section => ({
                ...section,
                students: section.students || [],
                adviser: section.adviser || null
            }));
            
            // Update stores and cache using the modern caching system
            updateSections(processedSections, silent);
            
        } catch (error) {
            console.error('Error loading sections:', error);
            setSectionsError(error.message);
        } finally {
            setLoadingSections(false, false); // Always turn off loading state, never silent
        }
    };

    const addSection = (newSection) => {
        sections.update(currentSections => {
            const updated = [...currentSections, newSection];
            setCachedSections(updated);
            return updated;
        });
    };

    const updateSection = (sectionId, updatedSection) => {
        sections.update(currentSections => {
            const updated = currentSections.map(section => 
                section.id === sectionId ? { ...section, ...updatedSection } : section
            );
            setCachedSections(updated);
            return updated;
        });
    };

    const removeSection = (sectionId) => {
        sections.update(currentSections => {
            const updated = currentSections.filter(section => section.id !== sectionId);
            setCachedSections(updated);
            return updated;
        });
    };

    // Return store interface
    return {
        // Stores
        sections: { subscribe: sections.subscribe },
        isLoadingSections: { subscribe: isLoadingSections.subscribe },
        sectionsError: { subscribe: sectionsError.subscribe },
        
        // Methods
        initSections,
        loadSections,
        updateSections,
        setLoadingSections,
        setSectionsError,
        addSection,
        updateSection,
        removeSection,
        clearSectionsCache
    };
})();