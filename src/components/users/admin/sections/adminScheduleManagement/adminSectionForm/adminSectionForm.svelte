<script>
	import './adminSectionForm.css';
	import { modalStore } from '../../../../../common/js/modalStore.js';
	import { toastStore } from '../../../../../common/js/toastStore.js';
	import { api, authenticatedFetch } from '../../../../../../routes/api/helper/api-helper.js';
	import { onMount } from 'svelte';
	import { sectionManagementStore } from '../../../../../../lib/stores/admin/sectionManagementStore.js';

	// Destructure store values
	$: ({ sections, isLoadingSections, sectionsError } = sectionManagementStore);
	$: isLoading = $isLoadingSections;
	$: sectionsData = $sections;

	// Section creation state
	let isCreating = false;
	let sectionName = '';
	let gradeLevel = '';
	let schoolYear = ''; // Current school year
	let selectedAdviser = null;
	let selectedStudents = [];

	// Dropdown states
	let isGradeLevelDropdownOpen = false;
	let isAdviserDropdownOpen = false;
	let isFilterDropdownOpen = false;

	// Search states
	let adviserSearchTerm = '';
	let studentSearchTerm = '';
	let sectionsSearchTerm = '';
	let searchTimeout;

	// Filter state
	let selectedFilter = 'all';

	// Edit section states
	let editingSectionId = null;
	let editSectionName = '';
	let editSelectedAdviser = null;
	let editSelectedStudents = [];
	let isUpdating = false;

	// Edit dropdown states
	let isEditAdviserDropdownOpen = false;

	// Edit search states
	let editAdviserSearchTerm = '';
	let editStudentSearchTerm = '';

	// Data arrays
	let availableAdvisers = [];
	let availableStudents = [];
	// recentSections now comes from store as sections
	// isLoading now comes from store
	let isLoadingAdvisers = false;
	let isLoadingStudents = false;

	// Fetch current school year from admin settings
	async function fetchCurrentSchoolYear() {
		try {
			const response = await authenticatedFetch('/api/current-quarter');
			const result = await response.json();
			if (result.success && result.data?.currentSchoolYear) {
				schoolYear = result.data.currentSchoolYear;
			}
		} catch (error) {
			console.error('Error fetching current school year:', error);
			// Keep default value of 2025-2026
		}
	}

	// Load data on component mount
	onMount(async () => {
		// Fetch current school year first
		await fetchCurrentSchoolYear();
		// Initialize sections from cache (instant load if available)
		const hasCachedSections = sectionManagementStore.initSections();
		// Load sections using store method (silent if we have cache, visible loading if not)
		await sectionManagementStore.loadSections(hasCachedSections);
		// Always load teachers and students with normal loading
		await loadAvailableTeachers();
	});

	async function loadAvailableTeachers(teacherGradeLevel = null) {
		try {
			isLoadingAdvisers = true;
			const gradeParam = teacherGradeLevel ? `&teacherGradeLevel=${teacherGradeLevel}` : '';
			const result = await api.get(
				`/api/sections?action=available-teachers&schoolYear=${schoolYear}${gradeParam}`
			);

			if (result.success) {
				availableAdvisers = result.data.map((teacher) => {
					// Check if this teacher is already assigned to a section
					// Only check if sections array is available
					const hasSection =
						sectionsData && sectionsData.length > 0
							? sectionsData.some((section) => section.adviser_id === teacher.id)
							: false;

					return {
						id: teacher.id,
						name: teacher.full_name,
						employeeId: teacher.account_number,
						subject: teacher.subject_code || 'No Subject',
						subject_grade_level: teacher.subject_grade_level,
						hasSection: hasSection
					};
				});

				// Add current section advisers to the list if they're not already there
				// This ensures that when editing a section, the current adviser appears in the dropdown
				if (sectionsData && sectionsData.length > 0) {
					for (const section of sectionsData) {
						if (
							section.adviser_id &&
							!availableAdvisers.find((adviser) => adviser.id === section.adviser_id)
						) {
							availableAdvisers.push({
								id: section.adviser_id,
								name: section.adviser_name,
								employeeId: section.adviser_account_number || 'N/A',
								subject: section.adviser_subject || 'No Subject',
								subject_grade_level: section.grade_level, // Use section's grade level for existing advisers
								hasSection: true
							});
						}
					}
				}
			}
		} catch (error) {
			console.error('Error loading teachers:', error);
			toastStore.error('Failed to load available teachers');
		} finally {
			isLoadingAdvisers = false;
		}
	}

	async function loadAvailableStudents(grade) {
		try {
			isLoadingStudents = true;
			const result = await api.get(
				`/api/sections?action=available-students&gradeLevel=${grade}&schoolYear=${schoolYear}`
			);

			if (result.success) {
				availableStudents = result.data.map((student) => ({
					id: student.id,
					name: student.full_name,
					studentId: student.account_number,
					grade: student.grade_level,
					hasSection: false
				}));
			}
		} catch (error) {
			console.error('Error loading students:', error);
			toastStore.error('Failed to load available students');
		} finally {
			isLoadingStudents = false;
		}
	}

	async function loadSectionStudents(sectionId) {
		try {
			const result = await api.get(`/api/sections?action=section-students&sectionId=${sectionId}`);

			if (result.success) {
				return result.data.map((student) => ({
					id: student.id,
					name: student.full_name,
					studentId: student.account_number,
					grade: student.grade_level
				}));
			}
			return [];
		} catch (error) {
			console.error('Error loading section students:', error);
			return [];
		}
	}

	// Edit student selection functions

	function toggleEditStudentSelection(student) {
		const index = editSelectedStudents.findIndex((s) => s.id === student.id);
		if (index > -1) {
			editSelectedStudents = editSelectedStudents.filter((s) => s.id !== student.id);
		} else {
			editSelectedStudents = [...editSelectedStudents, student];
		}
	}

	function removeEditSelectedStudent(student) {
		editSelectedStudents = editSelectedStudents.filter((s) => s.id !== student.id);
	}

	function clearAllEditSelectedStudents() {
		editSelectedStudents = [];
	}

	function toggleSelectAllEditStudents() {
		if (
			editSelectedStudents.length === editFilteredStudents.length &&
			editFilteredStudents.every((student) => editSelectedStudents.some((s) => s.id === student.id))
		) {
			// All filtered students are selected, so unselect all
			editSelectedStudents = editSelectedStudents.filter(
				(selected) => !editFilteredStudents.some((filtered) => filtered.id === selected.id)
			);
		} else {
			// Not all filtered students are selected, so select all
			const newSelections = editFilteredStudents.filter(
				(student) => !editSelectedStudents.some((s) => s.id === student.id)
			);
			editSelectedStudents = [...editSelectedStudents, ...newSelections];
		}
	}

	// Grade levels for Philippine high school (Grades 7-10)
	const gradeLevels = [
		{ id: '7', name: 'Grade 7', description: 'First Year Junior High School' },
		{ id: '8', name: 'Grade 8', description: 'Second Year Junior High School' },
		{ id: '9', name: 'Grade 9', description: 'Third Year Junior High School' },
		{ id: '10', name: 'Grade 10', description: 'Fourth Year Junior High School' }
	];

	// Filter options
	const filterOptions = [
		{ id: 'all', name: 'All Sections', icon: 'group' },
		{ id: '7', name: 'Grade 7', icon: 'school' },
		{ id: '8', name: 'Grade 8', icon: 'school' },
		{ id: '9', name: 'Grade 9', icon: 'school' },
		{ id: '10', name: 'Grade 10', icon: 'school' }
	];

	// Close dropdowns when clicking outside
	function handleClickOutside(event) {
		if (
			!event.target.closest('.sectionmgmt-custom-dropdown') &&
			!event.target.closest('.adminform-custom-dropdown')
		) {
			isGradeLevelDropdownOpen = false;
			isAdviserDropdownOpen = false;
			isFilterDropdownOpen = false;
		}
	}

	// Toggle dropdown functions
	function toggleGradeLevelDropdown() {
		isGradeLevelDropdownOpen = !isGradeLevelDropdownOpen;
		isAdviserDropdownOpen = false;
	}

	function toggleAdviserDropdown() {
		isAdviserDropdownOpen = !isAdviserDropdownOpen;
		isGradeLevelDropdownOpen = false;
	}

	function toggleFilterDropdown() {
		isFilterDropdownOpen = !isFilterDropdownOpen;
	}

	// Select functions
	function selectGradeLevel(grade) {
		gradeLevel = grade.id;
		isGradeLevelDropdownOpen = false;
		// Reset selected students when grade level changes
		selectedStudents = [];
		// Load available students for the selected grade
		loadAvailableStudents(grade.id);
		// Load available teachers for the selected grade level
		loadAvailableTeachers(grade.id);
	}

	function selectAdviser(adviser) {
		selectedAdviser = adviser;
		isAdviserDropdownOpen = false;
		adviserSearchTerm = '';
	}

	function selectFilter(filter) {
		selectedFilter = filter.id;
		isFilterDropdownOpen = false;
	}

	function toggleStudentSelection(student) {
		const index = selectedStudents.findIndex((s) => s.id === student.id);
		if (index > -1) {
			selectedStudents = selectedStudents.filter((s) => s.id !== student.id);
		} else {
			selectedStudents = [...selectedStudents, student];
		}
	}

	function removeStudent(studentId) {
		selectedStudents = selectedStudents.filter((s) => s.id !== studentId);
	}

	function toggleSelectAllStudents() {
		if (
			selectedStudents.length === filteredStudents.length &&
			filteredStudents.every((student) => selectedStudents.some((s) => s.id === student.id))
		) {
			// All filtered students are selected, so unselect all
			selectedStudents = selectedStudents.filter(
				(selected) => !filteredStudents.some((filtered) => filtered.id === selected.id)
			);
		} else {
			// Not all filtered students are selected, so select all
			const newSelections = filteredStudents.filter(
				(student) => !selectedStudents.some((s) => s.id === student.id)
			);
			selectedStudents = [...selectedStudents, ...newSelections];
		}
	}

	// Debounced search function
	function handleSearchChange() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(async () => {
			await sectionManagementStore.loadSections(false, sectionsSearchTerm);
		}, 500); // 500ms delay
	}

	// Watch for search term changes
	$: if (sectionsSearchTerm !== undefined) {
		handleSearchChange();
	}

	// Clear search function
	function clearSearch() {
		sectionsSearchTerm = '';
		sectionManagementStore.loadSections(false, ''); // Load all sections
	}

	// Computed values
	$: selectedGradeObj = gradeLevels.find((g) => g.id === gradeLevel);
	$: selectedFilterObj = filterOptions.find((filter) => filter.id === selectedFilter);
	$: filteredAdvisers = availableAdvisers.filter(
		(adviser) =>
			!adviser.hasSection && adviser.name.toLowerCase().includes(adviserSearchTerm.toLowerCase())
	);
	$: filteredStudents = availableStudents
		.filter((student) => {
			const matchesGrade = student.grade === gradeLevel;
			const matchesSearch = student.name.toLowerCase().includes(studentSearchTerm.toLowerCase());
			const notInSection = !student.hasSection;
			const notAlreadySelected = !selectedStudents.some((s) => s.id === student.id);
			
			// Show students that: match grade, match search, and either (not in any section OR already selected in current form)
			return matchesGrade && matchesSearch && (notInSection || !notAlreadySelected);
		})
		.sort((a, b) => {
			// Sort selected students to the top
			const aSelected = selectedStudents.some((s) => s.id === a.id);
			const bSelected = selectedStudents.some((s) => s.id === b.id);
			
			if (aSelected && !bSelected) return -1;
			if (!aSelected && bSelected) return 1;
			
			// If both selected or both not selected, sort alphabetically by name
			return a.name.localeCompare(b.name);
		});
	$: filteredSections = sectionsData;

	// Clear selections when grade level changes
	$: if (gradeLevel) {
		// Clear selected students that don't match the new grade level
		selectedStudents = selectedStudents.filter((student) => student.grade === gradeLevel);

		// Clear selected adviser if they don't match the new grade level
		if (
			selectedAdviser &&
			selectedAdviser.subject_grade_level &&
			selectedAdviser.subject_grade_level !== parseInt(gradeLevel)
		) {
			selectedAdviser = null;
		}
	}

	// Form submission
	async function handleCreateSection() {
		if (!sectionName || !gradeLevel) {
			toastStore.error('Please fill in section name and grade level.');
			return;
		}

		isCreating = true;

		try {
			const result = await api.post('/api/sections', {
				sectionName,
				gradeLevel: parseInt(gradeLevel),
				schoolYear,
				adviserId: selectedAdviser?.id || null,
				studentIds: selectedStudents.map((s) => s.id),
				roomId: null // Room assignment can be added later
			});

			if (result.success) {
				// Show success toast
				toastStore.success(result.message);

				// Reset form
				sectionName = '';
				gradeLevel = '';
				selectedAdviser = null;
				selectedStudents = [];
				adviserSearchTerm = '';
				studentSearchTerm = '';
				availableStudents = [];

				// Add new section to store and reload teachers
				sectionManagementStore.addSection(result.data);
				await loadAvailableTeachers();
			} else {
				toastStore.error(result.error || 'Failed to create section');
			}
		} catch (error) {
			console.error('Error creating section:', error);
			toastStore.error('Failed to create section. Please try again.');
		} finally {
			isCreating = false;
		}
	}

	// Edit section functions
	async function toggleEditForm(section) {
		if (editingSectionId === section.id) {
			// Close the form
			editingSectionId = null;
			editSectionName = '';
			editSelectedAdviser = null;
			editSelectedStudents = [];
			editAdviserSearchTerm = '';
			editStudentSearchTerm = '';
			isEditAdviserDropdownOpen = false;
		} else {
			// Open the form
			editingSectionId = section.id;
			editSectionName = section.name;
			// Find the adviser by ID from availableAdvisers
			editSelectedAdviser = availableAdvisers.find((adviser) => adviser.id === section.adviser_id);

			// If not found in availableAdvisers, create a placeholder but don't use cached name
			if (!editSelectedAdviser && section.adviser_id) {
				editSelectedAdviser = {
					id: section.adviser_id,
					name: 'Loading...',
					employeeId: '',
					subject: '',
					hasSection: true
				};
				// Reload teachers for the section's grade level to get the correct name
				await loadAvailableTeachers(section.grade_level);
				editSelectedAdviser =
					availableAdvisers.find((adviser) => adviser.id === section.adviser_id) ||
					editSelectedAdviser; // Use .id instead of ._id
			}

			// Load students for this section
			editSelectedStudents = await loadSectionStudents(section.id);
			originalSectionStudents = [...editSelectedStudents]; // Store original students
			editStudentSearchTerm = '';

			// Load available students for the grade level (for adding new students)
			await loadAvailableStudents(section.grade_level);
		}
	}

	async function handleEditSection() {
		if (!editSectionName) {
			toastStore.error('Please fill in section name.');
			return;
		}

		isUpdating = true;

		try {
			const requestData = {
				sectionId: editingSectionId,
				sectionName: editSectionName,
				adviserId: editSelectedAdviser?.id || null, // Use .id instead of ._id, allow null
				studentIds: editSelectedStudents.map((s) => s.id || s._id), // Handle both id formats
				roomId: null
			};

			const result = await api.put('/api/sections', requestData);

			if (result.success) {
				// Show success toast
				toastStore.success(result.message);

				// Close edit form
				editingSectionId = null;
				editSectionName = '';
				editSelectedAdviser = null;
				editSelectedStudents = [];
				editAdviserSearchTerm = '';
				editStudentSearchTerm = '';
				isEditAdviserDropdownOpen = false;

				// Update section in store, reload sections to refresh all details, and reload teachers
				sectionManagementStore.updateSection(editingSectionId, result.data);
				await sectionManagementStore.loadSections(true); // Silent reload to refresh all section details
				await loadAvailableTeachers();
			} else {
				toastStore.error(result.error || 'Failed to update section');
			}
		} catch (error) {
			console.error('Error updating section:', error);
			toastStore.error('Failed to update section. Please try again.');
		} finally {
			isUpdating = false;
		}
	}

	// Edit dropdown functions
	function toggleEditAdviserDropdown() {
		isEditAdviserDropdownOpen = !isEditAdviserDropdownOpen;
	}

	async function selectEditAdviser(adviser) {
		const selectedAdviserId = adviser.id;
		editSelectedAdviser = adviser;
		isEditAdviserDropdownOpen = false;
		editAdviserSearchTerm = '';

		// Refresh available advisers to update hasSection status
		await loadAvailableTeachers();

		// Re-find the selected adviser in the refreshed list to maintain correct reference
		editSelectedAdviser = availableAdvisers.find((a) => a.id === selectedAdviserId) || adviser;
	}

	// Handle section removal with modal confirmation
	// Open remove modal
	function openRemoveModal(section) {
		modalStore.confirm(
			'Delete Section',
			`<p>Are you sure you want to permanently delete section <strong>"${section.name}"</strong> (Grade ${section.grade_level})?</p>
			<p class="sectionmgmt-warning">This action will:</p>
			<ul class="sectionmgmt-warning-list">
				<li>Permanently delete the section and all its data</li>
				<li>Remove all students from this section</li>
				<li>Free up the advisory teacher for other sections</li>
				<li>This action cannot be undone</li>
			</ul>`,
			() => handleRemoveSection(section),
			null,
			{ size: 'medium' }
		);
	}

	// Handle section removal
	async function handleRemoveSection(section) {
		try {
			const result = await api.delete(`/api/sections?sectionId=${section._id}`);

			if (result.success) {
				toastStore.success('Section deleted successfully');
				sectionManagementStore.removeSection(section._id);
			} else {
				toastStore.error(result.error || 'Failed to delete section');
			}
		} catch (error) {
			console.error('Error deleting section:', error);
			toastStore.error('An error occurred while deleting the section');
		}
	}

	// Edit filtered data
	$: editFilteredAdvisers = availableAdvisers.filter((adviser) => {
		// Allow advisers without sections OR the current section's adviser
		const currentSectionAdviser =
			editingSectionId && sectionsData.find((s) => s.id === editingSectionId)?.adviser_id;
		const isAvailable = !adviser.hasSection || adviser.id === currentSectionAdviser;

		// Get the current section's grade level for filtering
		const currentSection = editingSectionId && sectionsData.find((s) => s.id === editingSectionId);
		const sectionGradeLevel = currentSection?.grade_level;

		// Filter by grade level if we have the section's grade level and adviser has subject_grade_level
		const gradeMatches =
			!sectionGradeLevel ||
			!adviser.subject_grade_level ||
			adviser.subject_grade_level === sectionGradeLevel;

		return (
			isAvailable &&
			gradeMatches &&
			adviser.name.toLowerCase().includes(editAdviserSearchTerm.toLowerCase())
		);
	});
	// Store original section students when editing starts
	let originalSectionStudents = [];

	$: editFilteredStudents = (() => {
		// Get current section being edited
		const currentSection = sectionsData.find((s) => s.id === editingSectionId);
		
		// Combine available students with original section students
		const allPossibleStudents = [...availableStudents];

		// Add original section students if they're not already in availableStudents
		originalSectionStudents.forEach((student) => {
			if (!allPossibleStudents.some((s) => s.id === student.id)) {
				allPossibleStudents.push({ ...student, hasSection: true });
			}
		});

		return allPossibleStudents
			.filter((student) => {
				const matchesSearch = student.name
					.toLowerCase()
					.includes(editStudentSearchTerm.toLowerCase());
				
				// Check if student is currently selected in the edit form
				const isCurrentlySelected = editSelectedStudents.some((s) => s.id === student.id);
				
				// Check if student was originally in this section
				const wasOriginallyInSection = originalSectionStudents.some((s) => s.id === student.id);
				
				// Show students that:
				// - Match the search term AND
				// - Either: (don't have a section OR are currently selected OR were originally in this section)
				const isAvailable = !student.hasSection || isCurrentlySelected || wasOriginallyInSection;
				
				return matchesSearch && isAvailable;
			})
			.sort((a, b) => {
				// Sort selected students to the top
				const aSelected = editSelectedStudents.some((s) => s.id === a.id);
				const bSelected = editSelectedStudents.some((s) => s.id === b.id);
				
				if (aSelected && !bSelected) return -1;
				if (!aSelected && bSelected) return 1;
				
				// If both selected or both not selected, sort alphabetically by name
				return a.name.localeCompare(b.name);
			});
	})();
</script>

<div class="sectionmgmt-form-container">
	<div class="sectionmgmt-creation-form-section">
		<div class="sectionmgmt-section-header">
			<h2 class="sectionmgmt-section-title">Create New Section</h2>
			<p class="sectionmgmt-section-subtitle">
				Fill in the details below to create a new class section
			</p>
		</div>

		<div class="sectionmgmt-form-container">
			<form on:submit|preventDefault={handleCreateSection}>
				<!-- Basic Section Info -->
				<div class="sectionmgmt-basic-info-row">
					<div class="sectionmgmt-form-group">
						<label class="sectionmgmt-form-label" for="section-name">Section Name *</label>
						<input
							type="text"
							id="section-name"
							class="sectionmgmt-form-input"
							bind:value={sectionName}
							placeholder="Enter section name (e.g., Mabini, Rizal, Bonifacio)"
							required
						/>
					</div>

					<div class="sectionmgmt-form-group">
						<label class="sectionmgmt-form-label" for="school-year">School Year</label>
						<input
							type="text"
							id="school-year"
							class="sectionmgmt-form-input"
							bind:value={schoolYear}
							readonly
						/>
					</div>
				</div>

				<!-- Grade Level and Adviser Row -->
				<div class="sectionmgmt-create-info-row">
					<!-- Grade Level Selection -->
					<div class="sectionmgmt-form-group">
						<label class="sectionmgmt-form-label" for="grade-level">Grade Level *</label>
						<div class="sectionmgmt-custom-dropdown" class:open={isGradeLevelDropdownOpen}>
							<button
								type="button"
								class="sectionmgmt-dropdown-trigger"
								class:selected={gradeLevel}
								on:click={toggleGradeLevelDropdown}
								id="grade-level"
							>
								{#if selectedGradeObj}
									<div class="sectionmgmt-selected-option">
										<span class="material-symbols-outlined sectionmgmt-option-icon">school</span>
										<div class="sectionmgmt-option-content">
											<span class="sectionmgmt-option-name">{selectedGradeObj.name}</span>
										</div>
									</div>
								{:else}
									<span class="sectionmgmt-placeholder">Select grade level</span>
								{/if}
								<span class="material-symbols-outlined sectionmgmt-dropdown-arrow">expand_more</span
								>
							</button>
							<div class="sectionmgmt-dropdown-menu">
								{#each gradeLevels as grade (grade.id)}
									<button
										type="button"
										class="sectionmgmt-dropdown-option"
										class:selected={gradeLevel === grade.id}
										on:click={() => selectGradeLevel(grade)}
									>
										<span class="material-symbols-outlined sectionmgmt-option-icon">school</span>
										<div class="sectionmgmt-option-content">
											<span class="sectionmgmt-option-name">{grade.name}</span>
											<span class="sectionmgmt-option-description">{grade.description}</span>
										</div>
									</button>
								{/each}
							</div>
						</div>
					</div>

					<!-- Adviser Selection -->
					<div class="sectionmgmt-form-group">
						<label class="sectionmgmt-form-label" for="adviser">Advisory Teacher (Optional)</label>
						<div class="sectionmgmt-custom-dropdown" class:open={isAdviserDropdownOpen}>
							<button
								type="button"
								class="sectionmgmt-dropdown-trigger"
								class:selected={selectedAdviser}
								on:click={toggleAdviserDropdown}
								id="adviser"
								disabled={!gradeLevel}
							>
								{#if selectedAdviser}
									<div class="sectionmgmt-selected-option">
										<span class="material-symbols-outlined sectionmgmt-option-icon">person</span>
										<div class="sectionmgmt-option-content">
											<span class="sectionmgmt-option-name">{selectedAdviser.name}</span>
										</div>
									</div>
								{:else if gradeLevel}
									<span class="sectionmgmt-placeholder">Select advisory teacher</span>
								{:else}
									<span class="sectionmgmt-placeholder">Select grade level first</span>
								{/if}
								<span class="material-symbols-outlined sectionmgmt-dropdown-arrow">expand_more</span
								>
							</button>
							<div class="sectionmgmt-dropdown-menu">
								<div class="sectionmgmt-search-container">
									<input
										type="text"
										class="sectionmgmt-search-input"
										placeholder="Search teachers..."
										bind:value={adviserSearchTerm}
									/>
									<span class="material-symbols-outlined sectionmgmt-search-icon">search</span>
								</div>
								{#if isLoadingAdvisers}
									<div class="admin-section-loading">
										<span class="system-loader"></span>
										<p>Loading teachers...</p>
									</div>
								{:else if filteredAdvisers.length === 0}
									<div class="sectionmgmt-no-results">
										<span class="material-symbols-outlined">person_off</span>
										<span>No available teachers found</span>
									</div>
								{:else}
									{#each filteredAdvisers as adviser (adviser.id)}
										<button
											type="button"
											class="sectionmgmt-dropdown-option"
											class:selected={selectedAdviser?.id === adviser.id}
											on:click={() => selectAdviser(adviser)}
										>
											<span class="material-symbols-outlined sectionmgmt-option-icon">person</span>
											<div class="sectionmgmt-option-content">
												<span class="sectionmgmt-option-name">{adviser.name}</span>
												<span class="sectionmgmt-option-description">{adviser.employeeId}</span>
											</div>
										</button>
									{/each}
								{/if}
							</div>
						</div>
						<p class="sectionmgmt-form-help">
							Only teachers without assigned sections are shown. Each teacher can only advise one
							section.
						</p>
					</div>
				</div>

				<!-- Student Selection -->
				<div class="sectionmgmt-form-group">
					<label class="sectionmgmt-form-label" for="students">Students (Optional)</label>

					{#if gradeLevel}
						<!-- Search and Select All -->
						<div class="sectionmgmt-student-controls">
							<input
								type="text"
								class="sectionmgmt-form-input"
								placeholder="Search students by name or ID..."
								bind:value={studentSearchTerm}
								id="students"
							/>
							{#if filteredStudents.length > 0}
								{@const allFilteredSelected = filteredStudents.every((student) =>
									selectedStudents.some((s) => s.id === student.id)
								)}
								<button
									type="button"
									class="sectionmgmt-select-all-button"
									on:click={toggleSelectAllStudents}
									title="{allFilteredSelected
										? 'Deselect All'
										: 'Select All'} ({filteredStudents.length})"
								>
									<span class="material-symbols-outlined"
										>{allFilteredSelected ? 'deselect' : 'select_all'}</span
									>
								</button>
							{/if}
						</div>
						<!-- Student List -->
						<div class="sectionmgmt-student-list">
							{#if isLoadingStudents}
								<div class="admin-section-loading">
									<span class="system-loader"></span>
									<p>Loading students...</p>
								</div>
							{:else if filteredStudents.length === 0}
								<div class="sectionmgmt-no-results">
									<span class="material-symbols-outlined">person_off</span>
									<span>No available students found for this grade level</span>
								</div>
							{:else}
								{#each filteredStudents as student (student.id)}
									<button
										type="button"
										class="sectionmgmt-student-item"
										class:selected={selectedStudents.some((s) => s.id === student.id)}
										on:click={() => toggleStudentSelection(student)}
									>
										<div class="sectionmgmt-option-content">
											<span class="material-symbols-outlined sectionmgmt-option-icon">school</span>
											<span class="sectionmgmt-option-name">Grade {student.grade} | </span>
											<span class="sectionmgmt-option-description"
												>{student.name} • {student.studentId}</span
											>
										</div>
										<div class="sectionmgmt-student-checkbox">
											<span class="material-symbols-outlined">
												{selectedStudents.some((s) => s.id === student.id)
													? 'check_box'
													: 'check_box_outline_blank'}
											</span>
										</div>
									</button>
								{/each}
							{/if}
						</div>
					{:else}
						<div class="sectionmgmt-placeholder-message">
							<span class="material-symbols-outlined">info</span>
							<span>Please select a grade level first to view available students.</span>
						</div>
					{/if}
				</div>

				<!-- Submit Button -->
				<div class="sectionmgmt-form-actions">
					<button
						type="submit"
						class="sectionmgmt-create-button"
						class:loading={isCreating}
						disabled={isCreating || !sectionName || !gradeLevel}
					>
						{#if isCreating}
							Creating...
						{:else}
							<span class="material-symbols-outlined">groups</span>
							Create Section
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
	<!-- All Sections -->
	<div class="sectionmgmt-recent-sections-section">
		<div class="sectionmgmt-section-header">
			<div class="section-header-content">
				<div class="section-title-group">
					<h2 class="sectionmgmt-section-title">All Sections</h2>
					<p class="sectionmgmt-section-subtitle">All sections in the system</p>
				</div>

				<!-- Search and Filter Container -->
				<div class="adminform-search-filter-container">
					<!-- Search Input -->
					<div class="adminform-search-container">
						<div class="adminform-search-input-wrapper">
							<span class="material-symbols-outlined adminform-search-icon">search</span>
							<input
								type="text"
								placeholder="Search by section name, grade level, student account number, or student name..."
								class="adminform-search-input"
								bind:value={sectionsSearchTerm}
							/>
							{#if sectionsSearchTerm}
								<button
									type="button"
									class="adminform-clear-search-button"
									on:click={clearSearch}
								>
									<span class="material-symbols-outlined">close</span>
								</button>
							{/if}
						</div>
					</div>

					<!-- Filter Dropdown -->
					<div class="adminform-filter-container">
						<div class="adminform-custom-dropdown" class:open={isFilterDropdownOpen}>
							<button
								type="button"
								class="adminform-dropdown-trigger adminform-filter-trigger"
								class:selected={selectedFilter !== 'all'}
								on:click={toggleFilterDropdown}
							>
								{#if selectedFilterObj}
									<div class="adminform-selected-option">
										<span class="material-symbols-outlined adminform-option-icon"
											>{selectedFilterObj.icon}</span
										>
										<div class="adminform-option-content">
											<span class="adminform-option-name">{selectedFilterObj.name}</span>
										</div>
									</div>
								{:else}
									<span class="adminform-placeholder">Filter by grade</span>
								{/if}
								<span class="material-symbols-outlined adminform-dropdown-arrow">expand_more</span>
							</button>
							<div class="adminform-dropdown-menu">
								{#each filterOptions as filter (filter.id)}
									<button
										type="button"
										class="adminform-dropdown-option"
										class:selected={selectedFilter === filter.id}
										on:click={() => selectFilter(filter)}
									>
										<span class="material-symbols-outlined adminform-option-icon"
											>{filter.icon}</span
										>
										<div class="adminform-option-content">
											<span class="adminform-option-name">{filter.name}</span>
										</div>
									</button>
								{/each}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="sectionmgmt-sections-grid">
			{#if isLoading}
				<div class="admin-section-loading">
					<span class="system-loader"></span>
					<p>Loading sections...</p>
				</div>
			{:else}
				{#each filteredSections as section (section.id)}
					<div
						class="sectionmgmt-section-card"
						class:editing={editingSectionId === section.id}
						id="sectionmgmt-section-card-{section.id}"
					>
						<div class="sectionmgmt-section-header-card">
							<div class="sectionmgmt-section-title">
								<h3 class="sectionmgmt-section-name">
									{section.name} · Grade {section.grade_level}
								</h3>
							</div>
							<div class="sectionmgmt-action-buttons">
								<a href="#sectionmgmt-section-card-{section.id}">
									<button
										type="button"
										class="sectionmgmt-edit-button"
										on:click={() => toggleEditForm(section)}
										title={editingSectionId === section.id ? 'Cancel Edit' : 'Edit Section'}
									>
										<span class="material-symbols-outlined"
											>{editingSectionId === section.id ? 'close' : 'edit'}</span
										>
									</button>
								</a>
								<button
									type="button"
									class="sectionmgmt-remove-button"
									title="Remove Section"
									on:click={() => openRemoveModal(section)}
								>
									<span class="material-symbols-outlined">delete</span>
								</button>
							</div>
						</div>

						<div class="sectionmgmt-section-details">
							<div class="sectionmgmt-section-adviser">
								<span class="material-symbols-outlined">person_book</span>
								<span>{section.adviser_name || 'No adviser'}</span>
							</div>
							<div class="sectionmgmt-section-students">
								<span class="material-symbols-outlined">group</span>
								<span>{section.student_count} students</span>
							</div>
							<div class="sectionmgmt-section-room">
								<span class="material-symbols-outlined">location_on</span>
								<span
									>{section.room_name
										? `${section.room_name} (${section.room_building}, ${section.room_floor})`
										: 'No room assigned'}</span
								>
							</div>
							<div class="sectionmgmt-section-created">
								<span class="material-symbols-outlined">calendar_today</span>
								<span>Created: {new Date(section.created_at).toLocaleDateString()}</span>
							</div>
							{#if section.updated_at && section.updated_at !== section.created_at}
								<div class="sectionmgmt-section-updated">
									<span class="material-symbols-outlined">update</span>
									<span>Updated: {new Date(section.updated_at).toLocaleDateString()}</span>
								</div>
							{/if}
						</div>

						<!-- Inline Edit Form -->
						{#if editingSectionId === section.id}
							<div class="sectionmgmt-edit-form-section">
								<div class="sectionmgmt-edit-form-container" id="section-edit-form-container">
									<div class="sectionmgmt-edit-form-header">
										<h2 class="sectionmgmt-edit-form-title">Edit Section</h2>
										<p class="sectionmgmt-edit-form-subtitle">
											Update section information and manage students
										</p>
									</div>

									<form
										class="sectionmgmt-edit-form-content"
										on:submit|preventDefault={handleEditSection}
									>
										<!-- Section Name and Adviser Row -->
										<div class="sectionmgmt-edit-info-row">
											<!-- Section Name -->
											<div class="sectionmgmt-form-group">
												<label class="sectionmgmt-form-label" for="edit-section-name">
													Section Name
												</label>
												<input
													type="text"
													id="edit-section-name"
													class="sectionmgmt-form-input"
													bind:value={editSectionName}
													placeholder="Enter section name (e.g., Mabini, Rizal, Bonifacio)"
													required
												/>
											</div>

											<!-- Section Adviser -->
											<div class="sectionmgmt-form-group">
												<label class="sectionmgmt-form-label" for="edit-section-adviser">
													Section Adviser
												</label>
												<div
													class="sectionmgmt-custom-dropdown"
													class:open={isEditAdviserDropdownOpen}
												>
													<button
														type="button"
														class="sectionmgmt-dropdown-trigger"
														class:selected={editSelectedAdviser}
														on:click={toggleEditAdviserDropdown}
														id="edit-section-adviser"
													>
														{#if editSelectedAdviser}
															<div class="sectionmgmt-selected-option">
																<span class="material-symbols-outlined sectionmgmt-option-icon"
																	>person</span
																>
																<div class="sectionmgmt-option-content">
																	<span class="sectionmgmt-option-name"
																		>{editSelectedAdviser.name}</span
																	>
																</div>
															</div>
														{:else}
															<span class="sectionmgmt-placeholder">Select section adviser</span>
														{/if}
														<span class="material-symbols-outlined sectionmgmt-dropdown-arrow"
															>expand_more</span
														>
													</button>
													<div class="sectionmgmt-dropdown-menu">
														<div class="sectionmgmt-search-container">
															<input
																type="text"
																class="sectionmgmt-search-input"
																placeholder="Search advisers..."
																bind:value={editAdviserSearchTerm}
															/>
															<span class="material-symbols-outlined sectionmgmt-search-icon"
																>search</span
															>
														</div>
														{#each editFilteredAdvisers as adviser (adviser.id)}
															<button
																type="button"
																class="sectionmgmt-dropdown-option"
																class:selected={editSelectedAdviser?.id === adviser.id}
																on:click={() => selectEditAdviser(adviser)}
															>
																<span class="material-symbols-outlined sectionmgmt-option-icon"
																	>person</span
																>
																<div class="sectionmgmt-option-content">
																	<span class="sectionmgmt-option-name">{adviser.name}</span>
																	<span class="sectionmgmt-option-description"
																		>{adviser.employeeId}</span
																	>
																</div>
															</button>
														{/each}
														{#if editFilteredAdvisers.length === 0}
															<div class="sectionmgmt-no-results">
																<span class="material-symbols-outlined">person_off</span>
																<span>No available advisers found</span>
															</div>
														{/if}
													</div>
												</div>
											</div>
										</div>

										<!-- Student Selection -->
										<div class="sectionmgmt-form-group">
											<label class="sectionmgmt-form-label" for="edit-students">
												Students ({editSelectedStudents.length} selected)
											</label>

											<!-- Search and Select All -->
											<div class="sectionmgmt-student-controls">
												<input
													type="text"
													class="sectionmgmt-form-input"
													placeholder="Search students by name or ID..."
													bind:value={editStudentSearchTerm}
													id="edit-students"
												/>
												{#if editFilteredStudents.length > 0}
													{@const allEditFilteredSelected = editFilteredStudents.every((student) =>
														editSelectedStudents.some((s) => s.id === student.id)
													)}
													<button
														type="button"
														class="sectionmgmt-select-all-button"
														on:click={toggleSelectAllEditStudents}
														title="{allEditFilteredSelected
															? 'Deselect All'
															: 'Select All'} ({editFilteredStudents.length})"
													>
														<span class="material-symbols-outlined"
															>{allEditFilteredSelected ? 'deselect' : 'select_all'}</span
														>
													</button>
												{/if}
											</div>

											<!-- Student List -->
											<div class="sectionmgmt-student-list">
												{#each editFilteredStudents as student (student.id)}
													<button
														type="button"
														class="sectionmgmt-student-item"
														class:selected={editSelectedStudents.some((s) => s.id === student.id)}
														on:click={() => toggleEditStudentSelection(student)}
													>
														<div class="sectionmgmt-option-content">
															<span class="material-symbols-outlined sectionmgmt-option-icon"
																>school</span
															>
															<span class="sectionmgmt-option-name">{student.name}</span>
															<span class="sectionmgmt-option-description"
																>{student.studentId} • Grade {student.grade}</span
															>
														</div>
														<span class="material-symbols-outlined sectionmgmt-option-icon">
															{editSelectedStudents.some((s) => s.id === student.id)
																? 'check_box'
																: 'check_box_outline_blank'}
														</span>
													</button>
												{/each}
												{#if editFilteredStudents.length === 0}
													<div class="sectionmgmt-no-results">
														<span class="material-symbols-outlined">person_off</span>
														<span>No available students found</span>
													</div>
												{/if}
											</div>
										</div>

										<!-- Form Actions -->
										<div class="sectionmgmt-edit-form-actions">
											<button
												type="button"
												class="sectionmgmt-cancel-button"
												on:click={() => toggleEditForm(section)}
											>
												Cancel
											</button>
											<button
												type="submit"
												class="sectionmgmt-submit-button"
												disabled={isUpdating || !editSectionName}
											>
												{#if isUpdating}
													Updating...
												{:else}
													Update
												{/if}
											</button>
										</div>
									</form>
								</div>
							</div>
						{/if}
					</div>
				{/each}
				{#if filteredSections.length === 0}
					<div class="sectionmgmt-sections-empty">
						<span class="material-symbols-outlined">school</span>
						{#if sectionsData.length === 0}
							<p>No sections found</p>
						{:else}
							<p>No sections found matching your search.</p>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
