<script>
	import './adminDepartmentManagement.css';
	import { modalStore } from '../../../../common/js/modalStore.js';
	import { toastStore } from '../../../../common/js/toastStore.js';
	import { api } from '../../../../../routes/api/helper/api-helper.js';
	import { onMount } from 'svelte';

	// State variables
	let selectedDepartment = null;
	let isEditing = false;
	let isCreating = false;
	let selectedSubjects = [];
	let selectedTeachers = [];


	// Department creation state
	let departmentName = '';
	let departmentCode = '';

	// Department management state
	let departments = [];
	let filteredDepartments = [];

	// Filter state - keeping filter logic but removing dropdown UI
	let selectedFilter = 'all';
	
	// Search state
	let departmentsSearchTerm = '';

	// Edit department state
	let editingDepartmentId = null;
	let editDepartmentName = '';
	let editDepartmentCode = '';
	let isUpdating = false;

	// Assign department state
	let assigningDepartmentId = null;
	let isAssigning = false;

	// Department details view state
	let expandedDepartmentId = null;

	// Available data for dropdowns
	let availableSubjects = [];
	let availableTeachers = [];

	// Dropdown state variables
	let isSubjectDropdownOpen = false;
	let isTeacherDropdownOpen = false;
	let subjectSearchTerm = '';
	let teacherSearchTerm = '';

	// Loading states
	let isLoadingDepartments = false;
	let isLoadingSubjects = false;
	let isLoadingTeachers = false;

	// Filter options - keeping for logic but not displaying
	const filterOptions = [
		{ id: 'all', name: 'All Departments', icon: 'corporate_fare' },
		{ id: 'with_subjects', name: 'With Subjects', icon: 'book' },
		{ id: 'with_teachers', name: 'With Teachers', icon: 'person' },
		{ id: 'empty', name: 'Empty Departments', icon: 'folder_open' }
	];

	// API functions
	async function fetchDepartments() {
		isLoadingDepartments = true;
		try {
			const result = await api.get('/api/departments?action=departments');

			if (result.success) {
				departments = result.data.map((dept) => ({
					id: dept.id,
					name: dept.name,
					code: dept.code,
					subjects: dept.subjects || [],
					teachers: dept.teachers || [],
					createdAt: dept.created_at
						? dept.created_at.split('T')[0]
						: new Date().toISOString().split('T')[0]
				}));
			} else {
				toastStore.error('Failed to load departments');
			}
		} catch (error) {
			console.error('Error fetching departments:', error);
			toastStore.error('Failed to load departments');
		} finally {
			isLoadingDepartments = false;
		}
	}

	async function fetchSubjects() {
		isLoadingSubjects = true;
		try {
			const result = await api.get('/api/departments?action=subjects');

			if (result.success) {
				availableSubjects = result.data.map((subject) => ({
					id: subject.id,
					name: subject.name,
					code: subject.code,
					gradeLevel: `Grade ${subject.grade_level}`
				}));
			} else {
				toastStore.error('Failed to load subjects');
			}
		} catch (error) {
			console.error('Error fetching subjects:', error);
			toastStore.error('Failed to load subjects');
		} finally {
			isLoadingSubjects = false;
		}
	}

	async function fetchTeachers() {
		isLoadingTeachers = true;
		try {
			const result = await api.get('/api/departments?action=teachers');

			if (result.success) {
				availableTeachers = result.data.map((teacher) => ({
					id: teacher.id,
					name: teacher.full_name || `${teacher.first_name} ${teacher.last_name}`,
					accountNumber: teacher.account_number
				}));
			} else {
				toastStore.error('Failed to load teachers');
			}
		} catch (error) {
			console.error('Error fetching teachers:', error);
			toastStore.error('Failed to load teachers');
		} finally {
			isLoadingTeachers = false;
		}
	}

	// Initialize data
	onMount(async () => {
		await Promise.all([fetchDepartments(), fetchSubjects(), fetchTeachers()]);
		filterDepartments();
	});

	// Computed properties
	$: if (departments) filterDepartments(departments, selectedFilter, departmentsSearchTerm);

	// Filtered arrays for dropdowns
	$: filteredSubjects = availableSubjects.filter(
		(subject) =>
			subject.name.toLowerCase().includes(subjectSearchTerm.toLowerCase()) ||
			subject.code.toLowerCase().includes(subjectSearchTerm.toLowerCase())
	);

	$: filteredTeachers = availableTeachers.filter(
		(teacher) =>
			teacher.name.toLowerCase().includes(teacherSearchTerm.toLowerCase()) ||
			teacher.accountNumber.toLowerCase().includes(teacherSearchTerm.toLowerCase())
	);

	// Sorted filtered arrays (selected items first)
	$: sortedFilteredSubjects = filteredSubjects.sort((a, b) => {
		const aSelected = selectedSubjects.some((id) => id === a.id);
		const bSelected = selectedSubjects.some((id) => id === b.id);

		if (aSelected && !bSelected) return -1;
		if (!aSelected && bSelected) return 1;
		return a.name.localeCompare(b.name);
	});

	$: sortedFilteredTeachers = filteredTeachers.sort((a, b) => {
		const aSelected = selectedTeachers.some((id) => id === a.id);
		const bSelected = selectedTeachers.some((id) => id === b.id);

		if (aSelected && !bSelected) return -1;
		if (!aSelected && bSelected) return 1;
		return a.name.localeCompare(b.name);
	});

	// Functions
	function filterDepartments(depts = departments, filter = selectedFilter, search = departmentsSearchTerm) {
		let filtered = [...depts];

		// Apply type filter
		if (filter === 'with_subjects') {
			// Show departments with assigned subjects
			filtered = filtered.filter((dept) => dept.subjects.length > 0);
		} else if (filter === 'with_teachers') {
			// Show departments with assigned teachers
			filtered = filtered.filter((dept) => dept.teachers.length > 0);
		} else if (filter === 'empty') {
			// Show departments without subjects or teachers
			filtered = filtered.filter(
				(dept) => dept.subjects.length === 0 && dept.teachers.length === 0
			);
		}

		// Apply search filter
		if (search.trim() !== '') {
			filtered = filtered.filter(
				(dept) =>
					dept.name.toLowerCase().includes(search.toLowerCase()) ||
					dept.code.toLowerCase().includes(search.toLowerCase())
			);
		}

		filteredDepartments = filtered;
	}


	// Department CRUD operations
	async function handleCreateDepartment() {
		if (!departmentName.trim() || !departmentCode.trim()) {
			toastStore.error('Please fill in all required fields');
			return;
		}

		// Check if department code already exists
		if (departments.some((dept) => dept.code.toLowerCase() === departmentCode.toLowerCase())) {
			toastStore.error('Department code already exists');
			return;
		}

		isCreating = true;

		try {
			const result = await api.post('/api/departments', {
				name: departmentName.trim(),
				code: departmentCode.trim().toUpperCase()
			});

			if (result.success) {
				// Refresh departments list
				await fetchDepartments();

				// Reset form
				departmentName = '';
				departmentCode = '';

				toastStore.success('Department created successfully');
			} else {
				toastStore.error(result.error || 'Failed to create department');
			}
		} catch (error) {
			console.error('Error creating department:', error);
			// Extract the error message from the thrown error
			const errorMessage = error.message || 'Failed to create department. Please try again.';
			toastStore.error(errorMessage);
		} finally {
			isCreating = false;
		}
	}

	async function handleUpdateDepartment(event) {
		event.preventDefault();

		if (isUpdating) return;
		isUpdating = true;

		try {
			// Validate input
			if (!editDepartmentName.trim() || !editDepartmentCode.trim()) {
				toastStore.error('Department name and code are required');
				return;
			}

			// Validate department code length (database limit is 20 characters)
			if (editDepartmentCode.trim().length > 20) {
				toastStore.error('Department code cannot exceed 20 characters');
				return;
			}

			// Check if department code already exists (excluding current department)
			const existingDepartment = departments.find(
				(dept) =>
					dept.code.toLowerCase() === editDepartmentCode.trim().toLowerCase() &&
					dept.id !== editingDepartmentId
			);

			if (existingDepartment) {
				toastStore.error('Department code already exists');
				return;
			}

			// Find the current department to preserve existing assignments
			const currentDepartment = departments.find((dept) => dept.id === editingDepartmentId);
			if (!currentDepartment) {
				throw new Error('Department not found');
			}

			// Extract current teacher and subject IDs to preserve assignments
			const currentTeacherIds = currentDepartment.teachers
				? currentDepartment.teachers.map((teacher) => teacher.id)
				: [];
			const currentSubjectIds = currentDepartment.subjects
				? currentDepartment.subjects.map((subject) => subject.id)
				: [];

			const result = await api.put('/api/departments', {
				id: editingDepartmentId,
				name: editDepartmentName.trim(),
				code: editDepartmentCode.trim().toUpperCase(),
				teachers: currentTeacherIds,
				subjects: currentSubjectIds
			});

			if (result.success) {
				// Refresh departments list
				await fetchDepartments();

				// Close edit form
				editingDepartmentId = null;
				editDepartmentName = '';
				editDepartmentCode = '';

				toastStore.success('Department updated successfully');
			} else {
				toastStore.error(result.error || 'Failed to update department');
			}
		} catch (error) {
			console.error('Error updating department:', error);
			// Extract the error message from the thrown error
			const errorMessage = error.message || 'Failed to update department. Please try again.';
			toastStore.error(errorMessage);
		} finally {
			isUpdating = false;
		}
	}

	function toggleEditForm(department) {
		if (editingDepartmentId === department.id) {
			// Close edit form
			editingDepartmentId = null;
			editDepartmentName = '';
			editDepartmentCode = '';
		} else {
			// Close assign form if it's open for this department
			if (assigningDepartmentId === department.id) {
				assigningDepartmentId = null;
				selectedSubjects = [];
				selectedTeachers = [];
				// Reset dropdown states
				isSubjectDropdownOpen = false;
				isTeacherDropdownOpen = false;
				subjectSearchTerm = '';
				teacherSearchTerm = '';
			}
			// Open edit form and populate with current values
			editingDepartmentId = department.id;
			editDepartmentName = department.name;
			editDepartmentCode = department.code;
		}
	}

	function handleRemoveDepartment(department) {
		modalStore.confirm(
			'Remove Department',
			`<p>Are you sure you want to remove the department <strong>"${department.name}"</strong>?</p>
			 <p class="warning-text">This action will also remove all subject and teacher assignments.</p>`,
			async () => {
				try {
					const result = await api.delete('/api/departments', {
						id: department.id,
						name: department.name
					});

					if (result.success) {
						// Refresh departments list
						await fetchDepartments();
						toastStore.success('Department removed successfully');
					} else {
						toastStore.error(result.error || 'Failed to remove department');
					}
				} catch (error) {
					console.error('Error removing department:', error);
					toastStore.error('Failed to remove department. Please try again.');
				}
			},
			() => {
				// Cancel callback
			},
			{ size: 'small' }
		);
	}

	// Assign functions
	function toggleAssignForm(department) {
		if (assigningDepartmentId === department.id) {
			// Close assign form
			assigningDepartmentId = null;
			selectedSubjects = [];
			selectedTeachers = [];
			// Reset dropdown states
			isSubjectDropdownOpen = false;
			isTeacherDropdownOpen = false;
			subjectSearchTerm = '';
			teacherSearchTerm = '';
		} else {
			// Close edit form if it's open for this department
			if (editingDepartmentId === department.id) {
				editingDepartmentId = null;
				editDepartmentName = '';
				editDepartmentCode = '';
			}
			// Open assign form and populate with current assignments
			assigningDepartmentId = department.id;
			selectedSubjects = department.subjects
				? department.subjects.map((subject) => subject.id)
				: [];
			selectedTeachers = department.teachers
				? department.teachers.map((teacher) => teacher.id)
				: [];
			// Reset dropdown states
			isSubjectDropdownOpen = false;
			isTeacherDropdownOpen = false;
			subjectSearchTerm = '';
			teacherSearchTerm = '';
		}
	}

	// Dropdown toggle functions
	function toggleSubjectDropdown() {
		isSubjectDropdownOpen = !isSubjectDropdownOpen;
		if (isSubjectDropdownOpen) {
			isTeacherDropdownOpen = false;
		}
	}

	function toggleTeacherDropdown() {
		isTeacherDropdownOpen = !isTeacherDropdownOpen;
		if (isTeacherDropdownOpen) {
			isSubjectDropdownOpen = false;
		}
	}

	function toggleSubjectSelection(subject) {
		const index = selectedSubjects.findIndex((id) => id === subject.id);
		if (index > -1) {
			selectedSubjects = selectedSubjects.filter((id) => id !== subject.id);
		} else {
			selectedSubjects = [...selectedSubjects, subject.id];
		}
	}

	function toggleTeacherSelection(teacher) {
		const index = selectedTeachers.findIndex((id) => id === teacher.id);
		if (index > -1) {
			selectedTeachers = selectedTeachers.filter((id) => id !== teacher.id);
		} else {
			selectedTeachers = [...selectedTeachers, teacher.id];
		}
	}

	function toggleSelectAllSubjects() {
		const allFilteredSelected = sortedFilteredSubjects.every((subject) =>
			selectedSubjects.some((id) => id === subject.id)
		);

		if (allFilteredSelected) {
			// Remove all filtered subjects from selection
			selectedSubjects = selectedSubjects.filter(
				(id) => !sortedFilteredSubjects.some((subject) => subject.id === id)
			);
		} else {
			// Add all filtered subjects to selection
			const newSelections = sortedFilteredSubjects
				.filter((subject) => !selectedSubjects.some((id) => id === subject.id))
				.map((subject) => subject.id);
			selectedSubjects = [...selectedSubjects, ...newSelections];
		}
	}

	function toggleSelectAllTeachers() {
		const allFilteredSelected = sortedFilteredTeachers.every((teacher) =>
			selectedTeachers.some((id) => id === teacher.id)
		);

		if (allFilteredSelected) {
			// Remove all filtered teachers from selection
			selectedTeachers = selectedTeachers.filter(
				(id) => !sortedFilteredTeachers.some((teacher) => teacher.id === id)
			);
		} else {
			// Add all filtered teachers to selection
			const newSelections = sortedFilteredTeachers
				.filter((teacher) => !selectedTeachers.some((id) => id === teacher.id))
				.map((teacher) => teacher.id);
			selectedTeachers = [...selectedTeachers, ...newSelections];
		}
	}

	function removeSubject(subjectId) {
		selectedSubjects = selectedSubjects.filter((id) => id !== subjectId);
	}

	function removeTeacher(teacherId) {
		selectedTeachers = selectedTeachers.filter((id) => id !== teacherId);
	}

	async function handleAssignDepartment() {
		isAssigning = true;

		try {
			// Find the department to get its current details
			const department = departments.find((dept) => dept.id === assigningDepartmentId);
			if (!department) {
				throw new Error('Department not found');
			}

			const requestData = {
				id: assigningDepartmentId,
				name: department.name,
				code: department.code,
				teachers: selectedTeachers,
				subjects: selectedSubjects
			};

			// Make API call to update department assignments
			const result = await api.put('/api/departments', requestData);

			if (!result.success) {
				throw new Error(result.error || 'Failed to update assignments');
			}

			// Update local state to reflect the changes
			departments = departments.map((dept) => {
				if (dept.id === assigningDepartmentId) {
					// Get full objects for subjects and teachers based on selected IDs
					const assignedSubjects = availableSubjects.filter((subject) =>
						selectedSubjects.includes(subject.id)
					);
					const assignedTeachers = availableTeachers.filter((teacher) =>
						selectedTeachers.includes(teacher.id)
					);

					return {
						...dept,
						subjects: assignedSubjects,
						teachers: assignedTeachers
					};
				}
				return dept;
			});

			toastStore.success('Department assignments updated successfully');

			// Close assign form
			assigningDepartmentId = null;
			selectedSubjects = [];
			selectedTeachers = [];
		} catch (error) {
			console.error('Error assigning department:', error);
			toastStore.error('Failed to update assignments. Please try again.');
		} finally {
			isAssigning = false;
		}
	}

	// Utility functions
	function getDepartmentSubjects(department) {
		// The API returns subject objects directly, not just IDs
		return department.subjects || [];
	}

	function getDepartmentTeachers(department) {
		// The API returns teacher objects directly, not just IDs
		return department.teachers || [];
	}

	// Toggle department details view
	function toggleDepartmentDetails(departmentId) {
		expandedDepartmentId = expandedDepartmentId === departmentId ? null : departmentId;
	}

	// Handle click outside to close dropdowns
	function handleClickOutside(event) {
		// No longer needed for simple select elements
	}

	// Format date from YYYY-MM-DD to MM-DD-YYYY
	function formatDate(dateString) {
		if (!dateString) return '';
		const parts = dateString.split('-');
		if (parts.length === 3) {
			return `${parts[1]}-${parts[2]}-${parts[0]}`;
		}
		return dateString;
	}
	
	// Clear search function
	function clearSearch() {
		departmentsSearchTerm = '';
	}
</script>

<svelte:window on:click={handleClickOutside} />

<div class="dept-mgmt-container">
	<!-- Header -->
	<div class="dept-mgmt-header">
		<div class="dept-mgmt-header-content">
			<h1 class="dept-mgmt-page-title">Department Management</h1>
			<p class="dept-mgmt-page-subtitle">
				Create and manage academic departments, assign subjects and teachers
			</p>
		</div>
	</div>

	<!-- Create Department Section -->
	<div class="dept-mgmt-create-section">
		<h2 class="dept-mgmt-section-title">Create New Department</h2>
		<p class="dept-mgmt-section-subtitle">
			Add a new academic department to organize subjects and teachers
		</p>

		<div class="dept-mgmt-create-form">
			<div class="dept-mgmt-form-row">
				<div class="dept-mgmt-form-group">
					<label for="departmentName" class="dept-mgmt-form-label">Department Name *</label>
					<input
						id="departmentName"
						type="text"
						bind:value={departmentName}
						placeholder="e.g., Mathematics Department"
						class="dept-mgmt-form-input"
						disabled={isCreating}
					/>
				</div>

				<div class="dept-mgmt-form-group">
					<label for="departmentCode" class="dept-mgmt-form-label">Department Code *</label>
					<input
						id="departmentCode"
						type="text"
						bind:value={departmentCode}
						placeholder="e.g., MATH-DEPT"
						class="dept-mgmt-form-input"
						disabled={isCreating}
					/>
				</div>
			</div>

			<!-- Submit Button -->
			<div class="dept-mgmt-form-actions">
				<button
					type="submit"
					class="dept-mgmt-btn-primary"
					disabled={isCreating || !departmentName || !departmentCode}
					on:click={handleCreateDepartment}
				>
					{#if isCreating}
						Creating...
					{:else}
						<span class="material-symbols-outlined">add_ad</span>
						Create Department
					{/if}
				</button>
			</div>
		</div>
	</div>

	<!-- Departments List Section -->
	<div class="dept-mgmt-departments-section">
		<div class="dept-mgmt-section-header">
			<div class="section-header-content">
				<div class="section-title-group">
					<h2 class="dept-mgmt-section-title">All Departments</h2>
					<p class="dept-mgmt-section-subtitle">
						Manage existing departments, assign subjects and teachers
					</p>
				</div>

				<!-- Search Container -->
				<div class="dept-mgmt-search-container">
					<div class="dept-mgmt-search-input-wrapper">
						<span class="material-symbols-outlined dept-mgmt-search-icon">search</span>
						<input
							type="text"
							placeholder="Search by name or code..."
							class="dept-mgmt-search-input"
							bind:value={departmentsSearchTerm}
						/>
						{#if departmentsSearchTerm}
							<button
								type="button"
								class="dept-mgmt-clear-search-button"
								on:click={clearSearch}
							>
								<span class="material-symbols-outlined">close</span>
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Departments Grid -->
		<div class="dept-mgmt-departments-grid">
			{#if isLoadingDepartments}
				<div class="dept-mgmt-loading">
					<span class="system-loader"></span>
					<p>Loading departments...</p>
				</div>
			{:else if filteredDepartments.length === 0}
				<div class="dept-mgmt-empty-state">
					<span class="material-symbols-outlined dept-mgmt-empty-icon">corporate_fare</span>
					{#if departments.length === 0}
						<h3 class="dept-mgmt-empty-title">No departments created yet</h3>
						<p class="dept-mgmt-empty-description">Create your first department to get started</p>
					{:else}
						<h3 class="dept-mgmt-empty-title">No departments found</h3>
						<p class="dept-mgmt-empty-description">No departments match your search or filter criteria</p>
					{/if}
				</div>
			{:else}
				{#each filteredDepartments as department (department.id)}
					<div
						class="dept-mgmt-department-card"
						class:editing={editingDepartmentId === department.id}
						class:assigning={assigningDepartmentId === department.id}
						id="department-card-{department.id}"
					>
						<div class="dept-mgmt-department-header">
							<div class="dept-mgmt-department-title">
								<h3 class="dept-mgmt-department-name">{department.name}</h3>
							</div>
							<div class="dept-mgmt-action-buttons">
								<a href="#department-card-{department.id}">
									<button
										type="button"
										class="dept-mgmt-assign-button"
										on:click={() => toggleAssignForm(department)}
										title={assigningDepartmentId === department.id ? 'Cancel Assign' : 'Assign'}
									>
										<span class="material-symbols-outlined"
											>{assigningDepartmentId === department.id ? 'close' : 'add_circle'}</span
										>
									</button>
								</a>
								<a href="#department-card-{department.id}">
									<button
										type="button"
										class="dept-mgmt-edit-button"
										on:click={() => toggleEditForm(department)}
										title={editingDepartmentId === department.id
											? 'Cancel Edit'
											: 'Edit Department'}
									>
										<span class="material-symbols-outlined"
											>{editingDepartmentId === department.id ? 'close' : 'edit'}</span
										>
									</button>
								</a>
								<button
									type="button"
									class="dept-mgmt-remove-button"
									on:click={() => handleRemoveDepartment(department)}
									title="Remove Department"
								>
									<span class="material-symbols-outlined">delete</span>
								</button>
							</div>
						</div>

						<div class="dept-mgmt-department-details">
							<div class="dept-mgmt-department-code">
								<span class="material-symbols-outlined">tag</span>
								<span>{department.code}</span>
							</div>
							<div class="dept-mgmt-department-subjects">
								<span class="material-symbols-outlined">subject</span>
								<span>{getDepartmentSubjects(department).length} Subjects</span>
							</div>
							<div class="dept-mgmt-department-teachers">
								<span class="material-symbols-outlined">person</span>
								<span>{getDepartmentTeachers(department).length} Teachers</span>
							</div>
							<div class="dept-mgmt-department-created">
								<span class="material-symbols-outlined">calendar_today</span>
								<span>Created: {formatDate(department.createdAt)}</span>
							</div>
						</div>

						<!-- Inline Edit Form -->
						{#if editingDepartmentId === department.id}
							<div class="dept-mgmt-edit-form-section">
								<div
									class="dept-mgmt-edit-form-container"
									id="admin-department-edit-form-container"
								>
									<div class="dept-mgmt-edit-form-header">
										<h2 class="dept-mgmt-edit-form-title">Edit Department</h2>
										<p class="dept-mgmt-edit-form-subtitle">Update department information</p>
									</div>

									<form
										class="dept-mgmt-edit-form-content"
										on:submit|preventDefault={handleUpdateDepartment}
									>
										<!-- Department Info -->
										<div class="dept-mgmt-edit-info-row">
											<div class="dept-mgmt-form-group">
												<label class="dept-mgmt-form-label" for="edit-department-name">
													Department Name *
												</label>
												<input
													type="text"
													id="edit-department-name"
													class="dept-mgmt-form-input"
													bind:value={editDepartmentName}
													placeholder="Enter department name"
													required
												/>
											</div>

											<div class="dept-mgmt-form-group">
												<label class="dept-mgmt-form-label" for="edit-department-code">
													Department Code *
												</label>
												<input
													type="text"
													id="edit-department-code"
													class="dept-mgmt-form-input"
													bind:value={editDepartmentCode}
													placeholder="Enter department code"
													required
												/>
											</div>
										</div>

										<!-- Form Actions -->
										<div class="dept-mgmt-edit-form-actions">
											<a href="#department-card-{department.id}">
												<button
													type="button"
													class="dept-mgmt-cancel-button"
													on:click={() => toggleEditForm(department)}
												>
													Cancel
												</button>
											</a>
											<button
												type="submit"
												class="dept-mgmt-update-button"
												disabled={isUpdating || !editDepartmentName || !editDepartmentCode}
											>
												{#if isUpdating}
													Updating...
												{:else}
													Update Department
												{/if}
											</button>
										</div>
									</form>
								</div>
							</div>
						{/if}

						<!-- Inline Assign Form -->
						{#if assigningDepartmentId === department.id}
							<div class="dept-mgmt-assign-form-section">
								<div class="dept-mgmt-assign-form-container">
									<div class="dept-mgmt-assign-form-header">
										<h2 class="dept-mgmt-assign-form-title">Assign Subjects & Teachers</h2>
										<p class="dept-mgmt-assign-form-subtitle">
											Select subjects and teachers for this department
										</p>
									</div>

									<form
										class="dept-mgmt-assign-form-content"
										on:submit|preventDefault={handleAssignDepartment}
									>
										<!-- Subjects and Teachers Selection -->
										<div class="dept-mgmt-assign-info-row">
											<!-- Subjects Selection -->
											<div class="dept-mgmt-form-group">
												<label class="dept-mgmt-form-label" for="subjects"
													>Select Subjects ({selectedSubjects.length} selected)</label
												>

												<!-- Search and Select All -->
												<div class="dept-mgmt-subject-controls">
													<input
														type="text"
														class="dept-mgmt-form-input"
														placeholder="Search subjects by name or code..."
														bind:value={subjectSearchTerm}
														id="subjects"
													/>
													{#if sortedFilteredSubjects.length > 0}
														{@const allFilteredSelected = sortedFilteredSubjects.every((subject) =>
															selectedSubjects.some((id) => id === subject.id)
														)}
														<button
															type="button"
															class="dept-mgmt-select-all-button"
															on:click={toggleSelectAllSubjects}
															title="{allFilteredSelected
																? 'Deselect All'
																: 'Select All'} ({sortedFilteredSubjects.length})"
														>
															<span class="material-symbols-outlined"
																>{allFilteredSelected ? 'deselect' : 'select_all'}</span
															>
														</button>
													{/if}
												</div>

												<!-- Subject List -->
												<div class="dept-mgmt-subject-list">
													{#each sortedFilteredSubjects as subject (subject.id)}
														<button
															type="button"
															class="dept-mgmt-subject-item"
															class:selected={selectedSubjects.some((id) => id === subject.id)}
															on:click={() => toggleSubjectSelection(subject)}
														>
															<div class="dept-mgmt-option-content">
																<span class="material-symbols-outlined dept-mgmt-option-icon"
																	>subject</span
																>
																<span class="dept-mgmt-option-name">{subject.name}</span>
																<span class="dept-mgmt-option-description"
																	>{subject.code} • {subject.gradeLevel}</span
																>
															</div>
															<div class="dept-mgmt-subject-checkbox">
																<span class="material-symbols-outlined">
																	{selectedSubjects.some((id) => id === subject.id)
																		? 'check_box'
																		: 'check_box_outline_blank'}
																</span>
															</div>
														</button>
													{/each}
													{#if sortedFilteredSubjects.length === 0}
														<div class="dept-mgmt-no-results">
															<span class="material-symbols-outlined">subject</span>
															<span>No subjects found</span>
														</div>
													{/if}
												</div>
												<p class="dept-mgmt-form-help">
													Select subjects that will be managed by this department.
												</p>
											</div>

											<!-- Teachers Selection -->
											<div class="dept-mgmt-form-group">
												<label class="dept-mgmt-form-label" for="teachers"
													>Select Teachers ({selectedTeachers.length} selected)</label
												>

												<!-- Search and Select All -->
												<div class="dept-mgmt-teacher-controls">
													<input
														type="text"
														class="dept-mgmt-form-input"
														placeholder="Search teachers by name or account number..."
														bind:value={teacherSearchTerm}
														id="teachers"
													/>
													{#if sortedFilteredTeachers.length > 0}
														{@const allFilteredSelected = sortedFilteredTeachers.every((teacher) =>
															selectedTeachers.some((id) => id === teacher.id)
														)}
														<button
															type="button"
															class="dept-mgmt-select-all-button"
															on:click={toggleSelectAllTeachers}
															title="{allFilteredSelected
																? 'Deselect All'
																: 'Select All'} ({sortedFilteredTeachers.length})"
														>
															<span class="material-symbols-outlined"
																>{allFilteredSelected ? 'deselect' : 'select_all'}</span
															>
														</button>
													{/if}
												</div>

												<!-- Teacher List -->
												<div class="dept-mgmt-teacher-list">
													{#each sortedFilteredTeachers as teacher (teacher.id)}
														<button
															type="button"
															class="dept-mgmt-teacher-item"
															class:selected={selectedTeachers.some((id) => id === teacher.id)}
															on:click={() => toggleTeacherSelection(teacher)}
														>
															<div class="dept-mgmt-option-content">
																<span class="material-symbols-outlined dept-mgmt-option-icon"
																	>person</span
																>
																<span class="dept-mgmt-option-name">{teacher.name}</span>
																<span class="dept-mgmt-option-description"
																	>{teacher.accountNumber}</span
																>
															</div>
															<div class="dept-mgmt-teacher-checkbox">
																<span class="material-symbols-outlined">
																	{selectedTeachers.some((id) => id === teacher.id)
																		? 'check_box'
																		: 'check_box_outline_blank'}
																</span>
															</div>
														</button>
													{/each}
													{#if sortedFilteredTeachers.length === 0}
														<div class="dept-mgmt-no-results">
															<span class="material-symbols-outlined">person_off</span>
															<span>No teachers found</span>
														</div>
													{/if}
												</div>
												<p class="dept-mgmt-form-help">
													Select teachers who will be part of this department.
												</p>
											</div>
										</div>

										<!-- Form Actions -->
										<div class="dept-mgmt-assign-actions">
											<button
												type="button"
												class="dept-mgmt-cancel-button"
												on:click={() => toggleAssignForm(department)}
											>
												Cancel
											</button>
											<button
												type="submit"
												class="dept-mgmt-assign-submit-button"
												disabled={isAssigning}
											>
												{#if isAssigning}
													Assigning...
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
			{/if}
		</div>
	</div>
</div>
