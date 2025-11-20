<script>
	import './adminStudentGradesList.css';
	import { onMount } from 'svelte';
	import { toastStore } from '../../../../common/js/toastStore.js';
	import { api } from '../../../../../routes/api/helper/api-helper.js';

	// State variables
	let students = [];
	let filteredStudents = [];
	let sections = [];
	let isLoading = true;
	let searchQuery = '';
	let selectedGradeLevel = '';
	let selectedSection = '';
	let selectedQuarter = ''; // Empty string means "Current Quarter"

	// Dropdown states
	let isGradeLevelDropdownOpen = false;
	let isSectionDropdownOpen = false;
	let isQuarterDropdownOpen = false;

	// Grade level options
	const gradeLevelOptions = [
		{ id: '', name: 'All Grade Levels', icon: 'school' },
		{ id: '7', name: 'Grade 7', icon: 'looks_one' },
		{ id: '8', name: 'Grade 8', icon: 'looks_two' },
		{ id: '9', name: 'Grade 9', icon: 'looks_3' },
		{ id: '10', name: 'Grade 10', icon: 'looks_4' }
	];

	// Quarter options
	const quarterOptions = [
		{ id: '', name: 'Current Quarter', icon: 'event' },
		{ id: 'all', name: 'Overall (All Quarters)', icon: 'summarize' },
		{ id: '1', name: '1st Quarter', icon: 'filter_1' },
		{ id: '2', name: '2nd Quarter', icon: 'filter_2' },
		{ id: '3', name: '3rd Quarter', icon: 'filter_3' },
		{ id: '4', name: '4th Quarter', icon: 'filter_4' }
	];

	// Dynamic section options - will be populated from API
	let sectionOptions = [{ id: '', name: 'All Sections' }];

	// Computed values
	$: selectedGradeLevelObj = gradeLevelOptions.find((level) => level.id === selectedGradeLevel);
	$: selectedSectionObj = sectionOptions.find((section) => section.id === selectedSection);
	$: selectedQuarterObj = quarterOptions.find((quarter) => quarter.id === selectedQuarter);

	// Load sections from API
	async function loadSections() {
		try {
			const data = await api.get('/api/sections');
			if (data.success) {
				sections = data.data || [];
				// Update section options with dynamic data - only include active sections
				const activeSections = sections.filter((section) => section.status === 'active');
				sectionOptions = [
					{ id: '', name: 'All Sections' },
					...activeSections.map((section) => ({
						id: section.name,
						name: `Grade ${section.grade_level} · ${section.name}`
					}))
				];
			}
		} catch (error) {
			console.error('Error loading sections:', error);
			toastStore.error('Failed to load sections');
		}
	}

	// Load students data with grades using optimized bulk endpoint
	async function loadStudents() {
		isLoading = true;
		try {
			// Build query parameters
			const params = new URLSearchParams();
			if (selectedQuarter) {
				params.append('quarter', selectedQuarter);
			}
			
			// Use the new bulk endpoint that gets all data in one query
			const url = `/api/students-bulk${params.toString() ? '?' + params.toString() : ''}`;
			const studentsData = await api.get(url);
			if (!studentsData.success) {
				throw new Error(studentsData.error || 'Failed to load students');
			}

			// Data is already formatted from the bulk endpoint
			students = studentsData.students || [];

			filterStudents();
		} catch (error) {
			console.error('Error loading students:', error);
			toastStore.error('Failed to load students. Please try again.');
			students = [];
		} finally {
			isLoading = false;
		}
	}

	// Filter students based on search query, grade level, and section
	function filterStudents() {
		filteredStudents = students.filter((student) => {
			const matchesSearch =
				!searchQuery ||
				student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				student.id.toString().toLowerCase().includes(searchQuery.toLowerCase());

			const matchesGradeLevel = !selectedGradeLevel || student.gradeLevel === selectedGradeLevel;

			const matchesSection = !selectedSection || student.section === selectedSection;

			return matchesSearch && matchesGradeLevel && matchesSection;
		});
	}

	// Dropdown functions
	function toggleGradeLevelDropdown() {
		isGradeLevelDropdownOpen = !isGradeLevelDropdownOpen;
		isSectionDropdownOpen = false;
		isQuarterDropdownOpen = false;
	}

	function toggleSectionDropdown() {
		isSectionDropdownOpen = !isSectionDropdownOpen;
		isGradeLevelDropdownOpen = false;
		isQuarterDropdownOpen = false;
	}

	function toggleQuarterDropdown() {
		isQuarterDropdownOpen = !isQuarterDropdownOpen;
		isGradeLevelDropdownOpen = false;
		isSectionDropdownOpen = false;
	}

	function selectGradeLevel(gradeLevel) {
		selectedGradeLevel = gradeLevel.id;
		isGradeLevelDropdownOpen = false;
		filterStudents();
	}

	function selectSection(section) {
		selectedSection = section.id;
		isSectionDropdownOpen = false;
		filterStudents();
	}

	function selectQuarter(quarter) {
		selectedQuarter = quarter.id;
		isQuarterDropdownOpen = false;
		// Reload students data when quarter changes
		loadStudents();
	}

	// Search handler
	function handleSearch() {
		filterStudents();
	}

	// Clear filters
	function clearFilters() {
		searchQuery = '';
		selectedGradeLevel = '';
		selectedSection = '';
		selectedQuarter = '';
		// Reload students when clearing quarter filter
		loadStudents();
	}

	// Get GWA status class
	function getGwaStatus(gwa) {
		if (gwa >= 95) return 'excellent';
		if (gwa >= 90) return 'very-good';
		if (gwa >= 85) return 'good';
		if (gwa >= 80) return 'satisfactory';
		return 'needs-improvement';
	}

	// Get GWA status text
	function getGwaStatusText(gwa) {
		if (gwa >= 95) return 'Excellent';
		if (gwa >= 90) return 'Very Good';
		if (gwa >= 85) return 'Good';
		if (gwa >= 80) return 'Satisfactory';
		return 'Needs Improvement';
	}

	// Helper function to get grade level display name
	function getGradeLevelName(gradeLevel) {
		const gradeMap = {
			'7': 'Grade 7',
			'8': 'Grade 8',
			'9': 'Grade 9',
			'10': 'Grade 10'
		};
		return gradeMap[gradeLevel] || gradeLevel;
	}

	// Close dropdowns when clicking outside
	function handleClickOutside(event) {
		if (!event.target.closest('.sgl-custom-dropdown')) {
			isGradeLevelDropdownOpen = false;
			isSectionDropdownOpen = false;
			isQuarterDropdownOpen = false;
		}
	}

	// Load data on component mount
	onMount(async () => {
		await loadSections();
		await loadStudents();
		document.addEventListener('click', handleClickOutside);

		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

	// Reactive search
	$: if (searchQuery !== undefined) {
		handleSearch();
	}
</script>

<div class="sgl-student-grades-container">
	<!-- Header -->
	<div class="sgl-admin-student-header">
		<div class="sgl-header-content">
			<h1 class="sgl-page-title">Student Grades List</h1>
			<p class="sgl-page-subtitle">View and manage student academic performance records</p>
		</div>
	</div>

	<!-- Filters Section -->
	<div class="sgl-filters-section">
		<div class="sgl-search-filter-container">
			<!-- Search Bar -->
			<div class="sgl-search-container">
				<div class="sgl-search-input-wrapper">
					<span class="material-symbols-outlined sgl-search-icon">search</span>
					<input
						type="text"
						class="sgl-search-input"
						placeholder="Search students by name, email, or ID..."
						bind:value={searchQuery}
					/>
					{#if searchQuery}
						<button
							type="button"
							class="sgl-clear-search-button"
							on:click={() => (searchQuery = '')}
						>
							<span class="material-symbols-outlined">close</span>
						</button>
					{/if}
				</div>
			</div>

			<!-- Filter Dropdowns -->
			<div class="sgl-filter-container">
				<!-- Quarter Filter -->
				<div class="sgl-filter-group">
					<label class="sgl-filter-label" for="quarter-dropdown">Quarter</label>
					<div class="sgl-custom-dropdown" class:open={isQuarterDropdownOpen}>
						<button
							type="button"
							id="quarter-dropdown"
							class="sgl-dropdown-trigger sgl-filter-trigger"
							on:click={toggleQuarterDropdown}
						>
							{#if selectedQuarterObj}
								<div class="sgl-selected-option">
									<span class="material-symbols-outlined sgl-option-icon"
										>{selectedQuarterObj.icon}</span
									>
									<span class="sgl-option-name">{selectedQuarterObj.name}</span>
								</div>
							{:else}
								<span class="sgl-placeholder">Current Quarter</span>
							{/if}
							<span class="material-symbols-outlined sgl-dropdown-arrow">expand_more</span>
						</button>
						<div class="sgl-dropdown-menu">
							{#each quarterOptions as quarter (quarter.id)}
								<button
									type="button"
									class="sgl-dropdown-option"
									class:selected={selectedQuarter === quarter.id}
									on:click={() => selectQuarter(quarter)}
								>
									<span class="material-symbols-outlined sgl-option-icon">{quarter.icon}</span>
									<div class="sgl-option-content">
										<span class="sgl-option-name">{quarter.name}</span>
									</div>
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Grade Level Filter -->
				<div class="sgl-filter-group">
					<label class="sgl-filter-label" for="grades-grade-level-dropdown">Grade Level</label>
					<div class="sgl-custom-dropdown" class:open={isGradeLevelDropdownOpen}>
						<button
							type="button"
							id="grades-grade-level-dropdown"
							class="sgl-dropdown-trigger sgl-filter-trigger"
							on:click={toggleGradeLevelDropdown}
						>
							{#if selectedGradeLevelObj && selectedGradeLevel}
								<div class="sgl-selected-option">
									<span class="material-symbols-outlined sgl-option-icon"
										>{selectedGradeLevelObj.icon}</span
									>
									<span class="sgl-option-name">{selectedGradeLevelObj.name}</span>
								</div>
							{:else}
								<span class="sgl-placeholder">All Grade Levels</span>
							{/if}
							<span class="material-symbols-outlined sgl-dropdown-arrow">expand_more</span>
						</button>
						<div class="sgl-dropdown-menu">
							{#each gradeLevelOptions as gradeLevel (gradeLevel.id)}
								<button
									type="button"
									class="sgl-dropdown-option"
									class:selected={selectedGradeLevel === gradeLevel.id}
									on:click={() => selectGradeLevel(gradeLevel)}
								>
									<span class="material-symbols-outlined sgl-option-icon">{gradeLevel.icon}</span>
									<div class="sgl-option-content">
										<span class="sgl-option-name">{gradeLevel.name}</span>
									</div>
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Section Filter -->
				<div class="sgl-filter-group">
					<label class="sgl-filter-label" for="grades-section-dropdown">Section</label>
					<div class="sgl-custom-dropdown" class:open={isSectionDropdownOpen}>
						<button
							type="button"
							id="grades-section-dropdown"
							class="sgl-dropdown-trigger sgl-filter-trigger"
							on:click={toggleSectionDropdown}
						>
							{#if selectedSectionObj && selectedSection}
								<div class="sgl-selected-option">
									<span class="sgl-option-name">{selectedSectionObj.name}</span>
								</div>
							{:else}
								<span class="sgl-placeholder">All Sections</span>
							{/if}
							<span class="material-symbols-outlined sgl-dropdown-arrow">expand_more</span>
						</button>
						<div class="sgl-dropdown-menu">
							{#each sectionOptions as section (section.id)}
								<button
									type="button"
									class="sgl-dropdown-option"
									class:selected={selectedSection === section.id}
									on:click={() => selectSection(section)}
								>
									<div class="sgl-option-content">
										<span class="sgl-option-name">{section.name}</span>
									</div>
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Clear Filters Button -->
				{#if searchQuery || selectedGradeLevel || selectedSection || selectedQuarter}
					<button type="button" class="sgl-clear-filters-button" on:click={clearFilters}>
						<span class="material-symbols-outlined">filter_alt_off</span>
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Results Section -->
	<div class="sgl-results-section">
		<!-- Loading State -->
		{#if isLoading}
			<div class="sgl-masterlist-loading-container">
				<span class="system-loader"></span>
				<p class="sgl-masterlist-loading-text">Loading student grades...</p>
			</div>
		{:else if filteredStudents.length === 0}
			<!-- Empty State -->
			<div class="sgl-empty-state">
				<span class="material-symbols-outlined sgl-empty-icon">search_off</span>
				<h3 class="sgl-empty-title">No students found</h3>
				<p class="sgl-empty-description">
					{#if searchQuery || selectedGradeLevel || selectedSection}
						Try adjusting your search criteria or filters.
					{:else}
						No student records are available at the moment.
					{/if}
				</p>
			</div>
		{:else}
			<!-- Results Header -->
			<div class="sgl-results-header">
				<p class="sgl-results-count">
					Showing {filteredStudents.length} of {students.length} students
				</p>
			</div>

			<!-- Students Table -->
			<div class="sgl-table-container">
				<table class="sgl-students-table">
					<thead>
						<tr>
							<th>Student ID</th>
							<th>Name</th>
							<th>Grade Level</th>
							<th>Section</th>
							<th>GWA</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredStudents as student (student.id)}
							<tr class="sgl-student-row" class:low-gwa={student.gwa < 75}>
								<td class="sgl-student-id">{student.id}</td>
								<td class="sgl-student-name">{student.name}</td>
								<td class="sgl-year-level">{getGradeLevelName(student.gradeLevel)}</td>
								<td class="sgl-section">{student.section}</td>
								<td class="sgl-gwa">{student.gwa}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
