<script>
	import './adminStudentMasterlist.css';
	import { onMount } from 'svelte';
	import { toastStore } from '../../../../common/js/toastStore.js';
	import { modalStore } from '../../../../common/js/modalStore.js';
	import { api } from '../../../../../routes/api/helper/api-helper.js';
	import { studentMasterlistStore } from '../../../../../lib/stores/admin/studentMasterlistStore.js';

	// Subscribe to store
	$: ({ students, sections: sectionOptions, isLoading, error } = $studentMasterlistStore);

	// Local UI state
	let filteredStudents = [];
	let searchQuery = '';
	let selectedGradeLevel = '';
	let selectedSection = '';

	// Dropdown states
	let isGradeLevelDropdownOpen = false;
	let isSectionDropdownOpen = false;

	// Grade level options
	const gradeLevelOptions = [
		{ id: '', name: 'All Grade Levels', icon: 'school' },
		{ id: '7', name: 'Grade 7', icon: 'looks_one' },
		{ id: '8', name: 'Grade 8', icon: 'looks_two' },
		{ id: '9', name: 'Grade 9', icon: 'looks_3' },
		{ id: '10', name: 'Grade 10', icon: 'looks_4' }
	];

	// Computed values
	$: selectedGradeLevelObj = gradeLevelOptions.find((level) => level.id === selectedGradeLevel);
	$: selectedSectionObj = sectionOptions.find((section) => section.id === selectedSection);

	// Reactive filter
	$: if (students) {
		filterStudents();
	}

	// Load students data
	async function loadStudents(silent = false) {
		try {
			if (!silent) {
				studentMasterlistStore.setLoading(true);
			}

			const data = await api.get('/api/accounts?type=student');
			if (!data.success) {
				throw new Error('Failed to load students');
			}

			// Transform API data to match our component structure
			const transformedStudents = data.accounts.map((account) => ({
				id: account.id,
				name: account.name,
				number: account.number, // Add the student ID number
				email: account.email,
				gradeLevel: account.gradeLevel || 'Not specified',
				section: account.section || 'Not specified',
				birthdate: account.birthdate || 'Not specified',
				address: account.address || 'Not specified',
				guardian: account.guardian || 'Not specified',
				contactNumber: account.contactNumber || 'Not specified',
				status: account.status || 'active'
			}));

			studentMasterlistStore.updateStudents(transformedStudents);
		} catch (error) {
			console.error('Error loading students:', error);
			studentMasterlistStore.setError(error.message);
			if (!silent) {
				toastStore.error('Failed to load students. Please try again.');
			}
		}
	}

	// Load sections data
	async function loadSections() {
		try {
			const data = await api.get('/api/sections');
			if (data.success && data.data) {
				// Transform sections data and add to dropdown options
				const sectionsFromDB = data.data.map((section) => ({
					id: section.name, // Use section name as ID for filtering
					name: section.name
				}));

				// Combine "All Sections" with actual sections
				const allSections = [{ id: '', name: 'All Sections' }, ...sectionsFromDB];
				studentMasterlistStore.updateSections(allSections);
			}
		} catch (error) {
			console.error('Error loading sections:', error);
			// Keep default "All Sections" option if loading fails
			studentMasterlistStore.updateSections([{ id: '', name: 'All Sections' }]);
		}
	}

	// Filter students based on search query, grade level, and section
	function filterStudents() {
		filteredStudents = students.filter((student) => {
			const matchesSearch =
				!searchQuery ||
				student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(student.number && student.number.toLowerCase().includes(searchQuery.toLowerCase()));

			const matchesGradeLevel = !selectedGradeLevel || student.gradeLevel === selectedGradeLevel;

			const matchesSection = !selectedSection || student.section === selectedSection;

			return matchesSearch && matchesGradeLevel && matchesSection;
		});
	}

	// Dropdown functions
	function toggleGradeLevelDropdown() {
		isGradeLevelDropdownOpen = !isGradeLevelDropdownOpen;
		isSectionDropdownOpen = false;
	}

	function toggleSectionDropdown() {
		isSectionDropdownOpen = !isSectionDropdownOpen;
		isGradeLevelDropdownOpen = false;
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

	// Calculate age from birthdate
	function calculateAge(birthdate) {
		if (!birthdate) return 'N/A';
		const today = new Date();
		const birth = new Date(birthdate);
		let age = today.getFullYear() - birth.getFullYear();
		const monthDiff = today.getMonth() - birth.getMonth();
		if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
			age--;
		}
		return age;
	}

	// Format birthdate for display
	function formatBirthdate(birthdate) {
		if (!birthdate) return 'N/A';
		const date = new Date(birthdate);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	// Clear all filters
	function clearFilters() {
		searchQuery = '';
		selectedGradeLevel = '';
		selectedSection = '';
		filterStudents();
	}

	// Reactive statements
	$: if (searchQuery !== undefined) filterStudents();

	// Close dropdowns when clicking outside
	function handleClickOutside(event) {
		if (!event.target.closest('.custom-dropdown')) {
			isGradeLevelDropdownOpen = false;
			isSectionDropdownOpen = false;
		}
	}

	// Archive student function with confirmation
	async function archiveStudent(studentId, studentName) {
		modalStore.confirm(
			'Archive Student',
			`Are you sure you want to archive ${studentName}? This action will move the student to the archived list.`,
			async () => {
				try {
					const result = await api.patch('/api/accounts', { id: studentId, action: 'archive' });

					if (result.success) {
						toastStore.success(result.message);
						// Reload students to reflect the change
						await loadStudents();
					} else {
						toastStore.error(result.message || 'Failed to archive student');
					}
				} catch (error) {
					console.error('Error archiving student:', error);
					toastStore.error('Failed to archive student. Please try again.');
				}
			},
			() => {
				// User cancelled - do nothing
			},
			{
				variant: 'danger'
			}
		);
	}

	onMount(() => {
		// Initialize store with cached data (instant load)
		const cachedData = studentMasterlistStore.getCachedData();
		if (cachedData) {
			studentMasterlistStore.init(cachedData);
		}

		// Fetch fresh data (silent if we have cache, visible loading if not)
		loadSections();
		loadStudents(!!cachedData);

		// Set up periodic silent refresh every 30 seconds
		const refreshInterval = setInterval(() => {
			loadStudents(true); // Always silent for periodic refresh
		}, 30000);

		document.addEventListener('click', handleClickOutside);

		return () => {
			clearInterval(refreshInterval);
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div class="student-masterlist-container">
	<!-- Header -->
	<div class="admin-student-header">
		<div class="header-content">
			<h1 class="page-title">Student Masterlist</h1>
			<p class="page-subtitle">View and manage all student records in the system</p>
		</div>
	</div>

	<!-- Filters Section -->
	<div class="filters-section">
		<div class="studmaster-search-filter-container">
			<!-- Search Bar -->
			<div class="search-container">
				<div class="search-input-wrapper">
					<span class="material-symbols-outlined search-icon">search</span>
					<input
						type="text"
						class="search-input"
						placeholder="Search students by name, email, or ID..."
						bind:value={searchQuery}
					/>
					{#if searchQuery}
						<button type="button" class="clear-search-button" on:click={() => (searchQuery = '')}>
							<span class="material-symbols-outlined">close</span>
						</button>
					{/if}
				</div>
			</div>

			<!-- Filter Dropdowns -->
			<div class="studmaster-filter-container">
				<!-- Grade Level Filter -->
				<div class="filter-group">
					<label class="filter-label" for="grade-level-dropdown">Grade Level</label>
					<div class="custom-dropdown" class:open={isGradeLevelDropdownOpen}>
						<button
							type="button"
							id="grade-level-dropdown"
							class="dropdown-trigger filter-trigger"
							on:click={toggleGradeLevelDropdown}
						>
							{#if selectedGradeLevelObj && selectedGradeLevel}
								<div class="selected-option">
									<span class="material-symbols-outlined option-icon"
										>{selectedGradeLevelObj.icon}</span
									>
									<span class="option-name">{selectedGradeLevelObj.name}</span>
								</div>
							{:else}
								<span class="placeholder">All Grade Levels</span>
							{/if}
							<span class="material-symbols-outlined dropdown-arrow">expand_more</span>
						</button>
						<div class="dropdown-menu">
							{#each gradeLevelOptions as gradeLevel (gradeLevel.id)}
								<button
									type="button"
									class="dropdown-option"
									class:selected={selectedGradeLevel === gradeLevel.id}
									on:click={() => selectGradeLevel(gradeLevel)}
								>
									<span class="material-symbols-outlined option-icon">{gradeLevel.icon}</span>
									<div class="option-content">
										<span class="option-name">{gradeLevel.name}</span>
									</div>
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Section Filter -->
				<div class="filter-group">
					<label class="filter-label" for="section-dropdown">Section</label>
					<div class="custom-dropdown" class:open={isSectionDropdownOpen}>
						<button
							type="button"
							id="section-dropdown"
							class="dropdown-trigger filter-trigger"
							on:click={toggleSectionDropdown}
						>
							{#if selectedSectionObj && selectedSection}
								<div class="selected-option">
									<span class="option-name">{selectedSectionObj.name}</span>
								</div>
							{:else}
								<span class="placeholder">All Sections</span>
							{/if}
							<span class="material-symbols-outlined dropdown-arrow">expand_more</span>
						</button>
						<div class="dropdown-menu">
							{#each sectionOptions as section (section.id)}
								<button
									type="button"
									class="dropdown-option"
									class:selected={selectedSection === section.id}
									on:click={() => selectSection(section)}
								>
									<div class="option-content">
										<span class="option-name">{section.name}</span>
									</div>
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Clear Filters Button -->
				{#if searchQuery || selectedGradeLevel || selectedSection}
					<button type="button" class="clear-filters-button" on:click={clearFilters}>
						<span class="material-symbols-outlined">filter_alt_off</span>
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Students List -->
	<div class="students-list-section">
		{#if isLoading}
			<div class="masterlist-loading-container">
				<span class="system-loader"></span>
				<p class="masterlist-loading-text">Loading students...</p>
			</div>
		{:else if filteredStudents.length > 0}
			<div class="students-grid">
				{#each filteredStudents as student (student.id)}
					<div class="account-card">
						<div class="account-card-header">
							<div class="account-title">
								<h3 class="account-name">
									{#if student.number}{student.number}{/if} · {student.name}
								</h3>
							</div>
							<div class="action-buttons">
								<button
									type="button"
									class="archive-button"
									title="Archive Student"
									on:click={() => archiveStudent(student.id, student.name)}
								>
									<span class="material-symbols-outlined">archive</span>
								</button>
							</div>
						</div>

						<div class="master-account-details">
							{#if student.email}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">email</span>
									<span>{student.email}</span>
								</div>
							{/if}
							{#if student.gradeLevel && student.gradeLevel !== 'Not specified'}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">school</span>
									<span
										>{gradeLevelOptions.find((level) => level.id === student.gradeLevel)?.name ||
											student.gradeLevel}</span
									>
								</div>
							{/if}
							{#if student.section && student.section !== 'Not specified'}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">class</span>
									<span
										>Section: {sectionOptions.find((section) => section.id === student.section)
											?.name || student.section}</span
									>
								</div>
							{/if}
							{#if student.birthdate && student.birthdate !== 'Not specified'}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">cake</span>
									<span>Age: {calculateAge(student.birthdate)} years old</span>
								</div>
							{/if}
							{#if student.guardian && student.guardian !== 'Not specified'}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">family_restroom</span>
									<span>Guardian: {student.guardian}</span>
								</div>
							{/if}
							{#if student.contactNumber && student.contactNumber !== 'Not specified'}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">phone</span>
									<span>Contact: {student.contactNumber}</span>
								</div>
							{/if}
							{#if student.address && student.address !== 'Not specified'}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">home</span>
									<span>Address: {student.address}</span>
								</div>
							{/if}
							{#if student.birthdate && student.birthdate !== 'Not specified'}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">calendar_today</span>
									<span>Birthdate: {formatBirthdate(student.birthdate)}</span>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="no-results">
				<span class="material-symbols-outlined no-results-icon">
					{searchQuery || selectedGradeLevel || selectedSection ? 'search_off' : 'school'}
				</span>
				<p>
					{#if searchQuery || selectedGradeLevel || selectedSection}
						No students found matching your search criteria.
					{:else}
						No students found in the system.
					{/if}
				</p>
			</div>
		{/if}
	</div>
</div>
