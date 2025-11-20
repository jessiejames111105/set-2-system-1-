<script>
	import './adminSubjectsAndActivities.css';
	import { modalStore } from '../../../../common/js/modalStore.js';
	import { toastStore } from '../../../../common/js/toastStore.js';
	import { api } from '../../../../../routes/api/helper/api-helper.js';
	import { onMount } from 'svelte';

	// Subject creation state
	let isCreating = false;
	let selectedGradeLevel = '';
	let subjectName = '';
	let subjectCode = '';

	// Dropdown states
	let isGradeDropdownOpen = false;

	// Search and filter state
	let searchTerm = '';
	let selectedLevelCategory = ''; // All grade levels - keeping for logic but removing dropdown UI
	let activitySearchTerm = '';

	// Clear search functions
	function clearSubjectSearch() {
		searchTerm = '';
	}

	function clearActivitySearch() {
		activitySearchTerm = '';
	}

	// Edit subject states
	let editingSubjectId = null;
	let editSubjectName = '';
	let editSubjectCode = '';
	let editSelectedGradeLevel = '';
	let isUpdating = false;

	// Edit dropdown states
	let isEditGradeDropdownOpen = false;

	// Tab state for curriculum management
	let activeTab = 'subjects'; // 'subjects' or 'activities'

	// Activity types state
	let activityTypes = [];
	let isCreatingActivity = false;
	let activityName = '';
	let activityCode = '';
	let activityIcon = 'event';

	// Activity dropdown states
	let isIconDropdownOpen = false;

	// Activity types edit state
	let editingActivityId = null;
	let editActivityName = '';
	let editActivityCode = '';
	let editActivityIcon = 'event';
	let isUpdatingActivity = false;

	// Activity edit dropdown states
	let isEditIconDropdownOpen = false;

	// Data loading state
	let isLoading = false;
	let recentSubjects = [];

	// Grade levels for Philippines DepEd (Grades 7-10)
	const gradeLevels = [
		{ value: 7, label: 'Grade 7', description: 'Junior High School - First Year' },
		{ value: 8, label: 'Grade 8', description: 'Junior High School - Second Year' },
		{ value: 9, label: 'Grade 9', description: 'Junior High School - Third Year' },
		{ value: 10, label: 'Grade 10', description: 'Junior High School - Fourth Year' }
	];

	// Color options for activity types
	const colorOptions = [
		{ value: 'blue', name: 'Blue', hex: '#3b82f6' },
		{ value: 'green', name: 'Green', hex: '#10b981' },
		{ value: 'orange', name: 'Orange', hex: '#f59e0b' },
		{ value: 'purple', name: 'Purple', hex: '#8b5cf6' },
		{ value: 'yellow', name: 'Yellow', hex: '#eab308' },
		{ value: 'teal', name: 'Teal', hex: '#14b8a6' },
		{ value: 'pink', name: 'Pink', hex: '#ec4899' },
		{ value: 'red', name: 'Red', hex: '#ef4444' },
		{ value: 'gray', name: 'Gray', hex: '#6b7280' }
	];

	// Icon options for activity types
	const iconOptions = [
		{ value: 'event', name: 'Event' },
		{ value: 'flag', name: 'Flag' },
		{ value: 'coffee', name: 'Coffee' },
		{ value: 'restaurant', name: 'Restaurant' },
		{ value: 'groups', name: 'Groups' },
		{ value: 'home', name: 'Home' },
		{ value: 'book', name: 'Book' },
		{ value: 'group_work', name: 'Group Work' },
		{ value: 'schedule', name: 'Schedule' }
	];

	// Computed properties
	$: selectedGradeLevelObj = gradeLevels.find((grade) => grade.value === selectedGradeLevel);
	$: filteredSubjects = recentSubjects.filter((subject) => {
		const matchesSearchTerm =
			subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			subject.code.toLowerCase().includes(searchTerm.toLowerCase());

		const matchesGrade = selectedLevelCategory
			? subject.gradeLevel === `Grade ${selectedLevelCategory}`
			: true;

		return matchesSearchTerm && matchesGrade;
	});
	$: filteredActivityTypes = activityTypes.filter((activity) => {
		const matchesSearchTerm =
			activity.name.toLowerCase().includes(activitySearchTerm.toLowerCase()) ||
			activity.code.toLowerCase().includes(activitySearchTerm.toLowerCase());

		return matchesSearchTerm;
	});

	// Load subjects from database
	async function loadSubjects() {
		isLoading = true;
		try {
			const result = await api.get('/api/subjects');

			if (result.success) {
				recentSubjects = result.data;
			} else {
				toastStore.error('Failed to load subjects: ' + result.message);
			}
		} catch (error) {
			console.error('Error loading subjects:', error);
			toastStore.error('Failed to load subjects. Please try again.');
		} finally {
			isLoading = false;
		}
	}

	// Load activity types from database
	async function loadActivityTypes() {
		try {
			const result = await api.get('/api/activity-types');

			if (result.success) {
				activityTypes = result.data;
			} else {
				toastStore.error('Failed to load activity types: ' + result.message);
			}
		} catch (error) {
			console.error('Error loading activity types:', error);
			toastStore.error('Failed to load activity types. Please try again.');
		}
	}

	// Initialize component
	onMount(() => {
		loadSubjects();
		loadActivityTypes();
	});

	// Handle form submission
	async function handleCreateSubject() {
		if (!selectedGradeLevel || !subjectName.trim() || !subjectCode.trim()) {
			toastStore.error('Please fill in all required fields');
			return;
		}

		isCreating = true;

		try {
			const result = await api.post('/api/subjects', {
				name: subjectName.trim(),
				code: subjectCode.trim(),
				gradeLevel: selectedGradeLevel
			});

			if (result.success) {
				// Add the new subject to the list
				recentSubjects = [result.data, ...recentSubjects];

				// Reset form
				selectedGradeLevel = '';
				subjectName = '';
				subjectCode = '';

				// Show success toast
				toastStore.success(result.message);
			} else {
				toastStore.error(result.message);
			}
		} catch (error) {
			console.error('Error creating subject:', error);
			toastStore.error('Failed to create subject. Please try again.');
		} finally {
			isCreating = false;
		}
	}

	// Handle subject removal
	async function handleRemoveSubject(subject) {
		modalStore.confirm(
			'Remove Subject',
			`<p>Are you sure you want to remove the subject <strong>"${subject.name}"</strong>?</p>`,
			async () => {
				try {
					const result = await api.delete('/api/subjects', {
						id: subject.id
					});

					if (result.success) {
						// Remove the subject from the array
						recentSubjects = recentSubjects.filter((s) => s.id !== subject.id);

						// Show success toast
						toastStore.success(result.message);
					} else {
						toastStore.error(result.message);
					}
				} catch (error) {
					console.error('Error removing subject:', error);
					toastStore.error('Failed to remove subject. Please try again.');
				}
			},
			null, // onCancel - no action needed
			{ size: 'small' }
		);
	}

	// Edit dropdown functions
	function toggleEditGradeDropdown() {
		isEditGradeDropdownOpen = !isEditGradeDropdownOpen;
	}

	function selectEditGradeLevel(grade) {
		editSelectedGradeLevel = grade.value;
		isEditGradeDropdownOpen = false;
	}

	// Functions
	function toggleGradeDropdown() {
		isGradeDropdownOpen = !isGradeDropdownOpen;
	}

	function selectGradeLevel(grade) {
		selectedGradeLevel = grade.value;
		isGradeDropdownOpen = false;
	}

	function selectLevelCategory(gradeLevel) {
		if (gradeLevel) {
			selectedLevelCategory = gradeLevel.value;
		} else {
			selectedLevelCategory = '';
		}
	}

	// Handle click outside to close dropdowns
	function handleClickOutside(event) {
		if (!event.target.closest('.adminsubject-custom-dropdown')) {
			isGradeDropdownOpen = false;
			isEditGradeDropdownOpen = false;
			isIconDropdownOpen = false;
			isEditIconDropdownOpen = false;
		}
	}

	// Activity types dropdown functions
	function toggleIconDropdown() {
		isIconDropdownOpen = !isIconDropdownOpen;
	}

	function selectIcon(icon) {
		activityIcon = icon;
		isIconDropdownOpen = false;
	}

	// Helper functions for activity types
	function getIconName(iconValue) {
		const icon = iconOptions.find((i) => i.value === iconValue);
		return icon ? icon.name : iconValue;
	}

	function getRandomColor() {
		const colors = ['blue', 'green', 'orange', 'purple', 'yellow', 'teal', 'pink', 'red', 'gray'];
		return colors[Math.floor(Math.random() * colors.length)];
	}

	// Edit subject functions
	function toggleEditForm(subject) {
		if (editingSubjectId === subject.id) {
			// Close the form
			editingSubjectId = null;
			editSubjectName = '';
			editSubjectCode = '';
			editSelectedGradeLevel = '';
			isEditGradeDropdownOpen = false;
		} else {
			// Open the form
			editingSubjectId = subject.id;
			editSubjectName = subject.name;
			editSubjectCode = subject.code;
			editSelectedGradeLevel = parseInt(subject.gradeLevel.replace('Grade ', ''));
		}
	}

	async function handleEditSubject() {
		if (!editSubjectName.trim() || !editSubjectCode.trim() || !editSelectedGradeLevel) {
			toastStore.error('Please fill in all required fields');
			return;
		}

		isUpdating = true;

		try {
			const result = await api.put('/api/subjects', {
				id: editingSubjectId,
				name: editSubjectName.trim(),
				code: editSubjectCode.trim(),
				gradeLevel: editSelectedGradeLevel
			});

			if (result.success) {
				// Update subject in the array
				recentSubjects = recentSubjects.map((subject) => {
					if (subject.id === editingSubjectId) {
						return result.data;
					}
					return subject;
				});

				// Show success toast
				toastStore.success(result.message);

				// Close edit form
				editingSubjectId = null;
				editSubjectName = '';
				editSubjectCode = '';
				editSelectedGradeLevel = '';
				isEditGradeDropdownOpen = false;
			} else {
				toastStore.error(result.message);
			}
		} catch (error) {
			console.error('Error updating subject:', error);
			toastStore.error('Failed to update subject. Please try again.');
		} finally {
			isUpdating = false;
		}
	}

	// Edit activity functions
	function toggleEditActivityForm(activity) {
		if (editingActivityId === activity.id) {
			// Close the form
			editingActivityId = null;
			editActivityName = '';
			editActivityCode = '';
			editActivityIcon = 'event';
			isEditIconDropdownOpen = false;
		} else {
			// Open the form
			editingActivityId = activity.id;
			editActivityName = activity.name;
			editActivityCode = activity.code;
			editActivityIcon = activity.icon;
		}
	}

	async function handleEditActivity() {
		if (!editActivityName.trim() || !editActivityCode.trim()) {
			toastStore.error('Please fill in all required fields');
			return;
		}

		isUpdatingActivity = true;

		try {
			const result = await api.put('/api/activity-types', {
				id: editingActivityId,
				name: editActivityName.trim(),
				code: editActivityCode.trim(),
				icon: editActivityIcon
			});

			if (result.success) {
				// Update activity in the array
				recentActivityTypes = recentActivityTypes.map((activity) => {
					if (activity.id === editingActivityId) {
						return result.data;
					}
					return activity;
				});

				// Show success toast
				toastStore.success(result.message);

				// Close edit form
				editingActivityId = null;
				editActivityName = '';
				editActivityCode = '';
				editActivityIcon = 'event';
				isEditIconDropdownOpen = false;
			} else {
				toastStore.error(result.message);
			}
		} catch (error) {
			console.error('Error updating activity type:', error);
			toastStore.error('Failed to update activity type. Please try again.');
		} finally {
			isUpdatingActivity = false;
		}
	}

	// Edit icon dropdown functions
	function toggleEditIconDropdown() {
		isEditIconDropdownOpen = !isEditIconDropdownOpen;
	}

	function selectEditIcon(icon) {
		editActivityIcon = icon;
		isEditIconDropdownOpen = false;
	}

	// Computed properties for edit form
	$: editSelectedGradeLevelObj = gradeLevels.find(
		(grade) => grade.value === editSelectedGradeLevel
	);

	// Activity types functions
	async function handleCreateActivity() {
		if (!activityName.trim() || !activityCode.trim()) {
			toastStore.error('Please fill in all required fields');
			return;
		}

		isCreatingActivity = true;

		try {
			const result = await api.post('/api/activity-types', {
				name: activityName.trim(),
				code: activityCode.trim(),
				icon: activityIcon
			});

			if (result.success) {
				// Add the new activity type to the list
				activityTypes = [result.data, ...activityTypes];

				// Reset form
				activityName = '';
				activityCode = '';
				activityIcon = 'event';

				toastStore.success('Activity type created successfully');
			} else {
				toastStore.error(result.message);
			}
		} catch (error) {
			console.error('Error creating activity type:', error);
			toastStore.error('Failed to create activity type. Please try again.');
		} finally {
			isCreatingActivity = false;
		}
	}

	async function handleUpdateActivity() {
		if (!editActivityName.trim() || !editActivityCode.trim()) {
			toastStore.error('Please fill in all required fields');
			return;
		}

		isUpdatingActivity = true;

		try {
			const result = await api.put('/api/activity-types', {
				id: editingActivityId,
				name: editActivityName.trim(),
				code: editActivityCode.trim(),
				icon: editActivityIcon
			});

			if (result.success) {
				// Update the activity type in the list
				activityTypes = activityTypes.map((activity) =>
					activity.id === editingActivityId ? result.data : activity
				);

				// Reset edit form
				editingActivityId = null;
				editActivityName = '';
				editActivityCode = '';
				editActivityIcon = 'event';

				toastStore.success('Activity type updated successfully');
			} else {
				toastStore.error(result.message);
			}
		} catch (error) {
			console.error('Error updating activity type:', error);
			toastStore.error('Failed to update activity type. Please try again.');
		} finally {
			isUpdatingActivity = false;
		}
	}

	// Handle activity type removal with modal
	async function handleDeleteActivity(activity) {
		modalStore.confirm(
			'Remove Activity Type',
			`<p>Are you sure you want to remove the activity type <strong>"${activity.name}"</strong>?</p>`,
			async () => {
				try {
					const result = await api.delete('/api/activity-types', {
						id: activity.id
					});

					if (result.success) {
						// Remove the activity type from the list
						activityTypes = activityTypes.filter((a) => a.id !== activity.id);
						toastStore.success(result.message);
					} else {
						toastStore.error(result.message);
					}
				} catch (error) {
					console.error('Error removing activity type:', error);
					toastStore.error('Failed to remove activity type. Please try again.');
				}
			},
			null, // onCancel - no action needed
			{ size: 'small' }
		);
	}

	// Remove auto-generation of subject code
</script>

<svelte:window on:click={handleClickOutside} />

<div class="admin-subject-creation-container">
	<!-- Header -->
	<div class="admin-subject-header">
		<div class="admin-header-content">
			<h1 class="admin-page-title">Subjects & Activities</h1>
			<p class="admin-page-subtitle">Manage subjects and activity types for the curriculum</p>
		</div>

		<!-- Tab Navigation -->
		<div class="admin-tab-navigation">
			<button
				class="admin-tab-button"
				class:active={activeTab === 'subjects'}
				on:click={() => (activeTab = 'subjects')}
			>
				<span class="material-icons">subject</span>
				Subjects
			</button>
			<button
				class="admin-tab-button"
				class:active={activeTab === 'activities'}
				on:click={() => (activeTab = 'activities')}
			>
				<span class="material-icons">event</span>
				Activity Types
			</button>
		</div>
	</div>

	<!-- Subjects Tab Content -->
	{#if activeTab === 'subjects'}
		<div class="admin-creation-layout">
			<!-- Left Column: Creation Form -->
			<div class="admin-creation-form-section">
				<div class="admin-section-header">
					<h2 class="admin-section-title">Create New Subject</h2>
					<p class="admin-section-subtitle">Fill in the details below to create a new subject</p>
				</div>

				<div class="admin-form-container">
					<form on:submit|preventDefault={handleCreateSubject}>
						<!-- Grade Level, Subject Name, and Subject Code Row -->
						<div class="admin-form-row">
							<!-- Grade Level Selection -->
							<div class="admin-form-group admin-form-group-third">
								<label class="admin-form-label" for="grade-level">Grade Level *</label>
								<div class="adminsubject-custom-dropdown" class:open={isGradeDropdownOpen}>
									<button
										type="button"
										class="adminsubject-dropdown-trigger"
										class:selected={selectedGradeLevel}
										on:click={toggleGradeDropdown}
										id="grade-level"
									>
										{#if selectedGradeLevelObj}
											<div class="adminsubject-selected-option">
												<span class="material-symbols-outlined adminsubject-option-icon"
													>school</span
												>
												<div class="adminsubject-option-content">
													<span class="adminsubject-option-name">{selectedGradeLevelObj.label}</span
													>
												</div>
											</div>
										{:else}
											<span class="adminsubject-placeholder">Select grade level</span>
										{/if}
										<span class="material-symbols-outlined adminsubject-dropdown-arrow"
											>expand_more</span
										>
									</button>
									<div class="adminsubject-dropdown-menu">
										{#each gradeLevels as grade (grade.value)}
											<button
												type="button"
												class="adminsubject-dropdown-option"
												class:selected={selectedGradeLevel === grade.value}
												on:click={() => selectGradeLevel(grade)}
											>
												<span class="material-symbols-outlined adminsubject-option-icon"
													>school</span
												>
												<div class="adminsubject-option-content">
													<span class="adminsubject-option-name">{grade.label}</span>
													<span class="adminsubject-option-description">{grade.description}</span>
												</div>
											</button>
										{/each}
									</div>
								</div>
							</div>

							<!-- Subject Name -->
							<div class="admin-form-group admin-form-group-third">
								<label for="subjectName" class="admin-form-label">Subject Name *</label>
								<input
									id="subjectName"
									type="text"
									class="admin-form-input"
									bind:value={subjectName}
									placeholder="e.g., Mathematics, English"
									disabled={!selectedGradeLevel}
									required
								/>
							</div>

							<!-- Subject Code -->
							<div class="admin-form-group admin-form-group-third">
								<label for="subjectCode" class="admin-form-label">Subject Code *</label>
								<input
									id="subjectCode"
									type="text"
									class="admin-form-input"
									bind:value={subjectCode}
									placeholder="e.g., MATH-7, ENG-8"
									required
								/>
							</div>
						</div>

						<!-- Submit Button -->
						<div class="admin-form-actions">
							<button
								type="submit"
								class="admin-create-button"
								class:loading={isCreating}
								disabled={isCreating || !selectedGradeLevel || !subjectName.trim()}
							>
								{#if isCreating}
									Creating...
								{:else}
									<span class="material-symbols-outlined">add_circle</span>
									Create Subject
								{/if}
							</button>
						</div>
					</form>
				</div>
			</div>

			<!-- Right Column: All Subjects -->
			<div class="admin-recent-subjects-section">
				<div class="admin-section-header">
					<div class="section-header-content">
						<div class="section-title-group">
							<h2 class="admin-section-title">All Subjects</h2>
							<p class="admin-section-subtitle">All subjects in the system</p>
						</div>

						<!-- Search Container -->
						<div class="adminsubject-search-container">
							<div class="adminsubject-search-input-wrapper">
								<span class="material-symbols-outlined adminsubject-search-icon">search</span>
								<input
									type="text"
									placeholder="Search by subject name or code..."
									class="adminsubject-search-input"
									bind:value={searchTerm}
								/>
								{#if searchTerm}
									<button
										type="button"
										class="adminsubject-clear-search-button"
										on:click={clearSubjectSearch}
									>
										<span class="material-symbols-outlined">close</span>
									</button>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<div class="adminsubject-subjects-grid">
					{#if isLoading}
						<div class="adminsubject-loading-container">
							<span class="system-loader"></span>
							<p class="adminsubject-loading-text">Loading subjects...</p>
						</div>
					{:else}
						{#each filteredSubjects as subject (subject.id)}
							<div class="adminsubject-subject-card" id="adminsubject-subject-card-{subject.id}">
								<div class="adminsubject-subject-header">
									<div class="adminsubject-subject-title">
										<h3 class="adminsubject-subject-name">{subject.name} · {subject.gradeLevel}</h3>
									</div>
									<div class="adminsubject-action-buttons">
										<a href="#adminsubject-subject-card-{subject.id}">
											<button
												type="button"
												class="adminsubject-edit-button"
												on:click={() => toggleEditForm(subject)}
												title={editingSubjectId === subject.id ? 'Cancel Edit' : 'Edit Subject'}
											>
												<span class="material-symbols-outlined">
													{editingSubjectId === subject.id ? 'close' : 'edit'}
												</span>
											</button>
										</a>
										<button
											type="button"
											class="adminsubject-remove-button"
											title="Remove Subject"
											on:click={() => handleRemoveSubject(subject)}
										>
											<span class="material-symbols-outlined">delete</span>
										</button>
									</div>
								</div>

								<div class="adminsubject-subject-details">
									<div class="adminsubject-subject-item-detail">
										<span class="material-symbols-outlined">qr_code_2</span>
										<span>{subject.code}</span>
									</div>
									<div class="adminsubject-subject-item-detail">
										<span class="material-symbols-outlined">calendar_today</span>
										<span>Created: {subject.createdDate}</span>
									</div>
									<div class="adminsubject-subject-item-detail">
										<span class="material-symbols-outlined">update</span>
										<span>Updated: {subject.updatedDate}</span>
									</div>
								</div>

								<!-- Inline Edit Form -->
								{#if editingSubjectId === subject.id}
									<div class="adminsubject-edit-form-section">
										<div
											class="adminsubject-edit-form-container"
											id="adminsubject-edit-form-container"
										>
											<div class="adminsubject-edit-form-header">
												<h2 class="adminsubject-edit-form-title">Edit Subject</h2>
												<p class="adminsubject-edit-form-subtitle">Update subject information</p>
											</div>

											<form
												class="adminsubject-edit-form-content"
												on:submit|preventDefault={handleEditSubject}
											>
												<!-- Grade Level, Subject Name, and Subject Code Row -->
												<div class="adminsubject-edit-form-row">
													<!-- Grade Level Selection -->
													<div class="adminsubject-form-group adminsubject-form-group-third">
														<label class="adminsubject-form-label" for="edit-grade-level"
															>Grade Level *</label
														>
														<div
															class="adminsubject-custom-dropdown"
															class:open={isEditGradeDropdownOpen}
														>
															<button
																type="button"
																class="adminsubject-dropdown-trigger"
																class:selected={editSelectedGradeLevel}
																on:click={toggleEditGradeDropdown}
																id="edit-grade-level"
															>
																{#if editSelectedGradeLevelObj}
																	<div class="adminsubject-selected-option">
																		<span class="material-symbols-outlined adminsubject-option-icon"
																			>school</span
																		>
																		<div class="adminsubject-option-content">
																			<span class="adminsubject-option-name"
																				>{editSelectedGradeLevelObj.label}</span
																			>
																		</div>
																	</div>
																{:else}
																	<span class="adminsubject-placeholder">Select grade level</span>
																{/if}
																<span class="material-symbols-outlined adminsubject-dropdown-arrow"
																	>expand_more</span
																>
															</button>
															<div class="adminsubject-dropdown-menu">
																{#each gradeLevels as grade (grade.value)}
																	<button
																		type="button"
																		class="adminsubject-dropdown-option"
																		class:selected={editSelectedGradeLevel === grade.value}
																		on:click={() => selectEditGradeLevel(grade)}
																	>
																		<span class="material-symbols-outlined adminsubject-option-icon"
																			>school</span
																		>
																		<div class="adminsubject-option-content">
																			<span class="adminsubject-option-name">{grade.label}</span>
																			<span class="adminsubject-option-description"
																				>{grade.description}</span
																			>
																		</div>
																	</button>
																{/each}
															</div>
														</div>
													</div>

													<!-- Subject Name -->
													<div class="adminsubject-form-group adminsubject-form-group-third">
														<label for="editSubjectName" class="adminsubject-form-label"
															>Subject Name *</label
														>
														<input
															id="editSubjectName"
															type="text"
															class="adminsubject-form-input"
															bind:value={editSubjectName}
															placeholder="e.g., Mathematics, English"
															required
														/>
													</div>

													<!-- Subject Code -->
													<div class="adminsubject-form-group adminsubject-form-group-third">
														<label for="editSubjectCode" class="adminsubject-form-label"
															>Subject Code *</label
														>
														<input
															id="editSubjectCode"
															type="text"
															class="adminsubject-form-input"
															bind:value={editSubjectCode}
															placeholder="e.g., MATH-7, ENG-8"
															required
														/>
													</div>
												</div>

												<!-- Form Actions -->
												<div class="adminsubject-edit-form-actions">
													<button
														type="button"
														class="adminsubject-cancel-button"
														on:click={() => toggleEditForm(subject)}
													>
														Cancel
													</button>
													<button
														type="submit"
														class="adminsubject-submit-button"
														disabled={isUpdating ||
															!editSubjectName.trim() ||
															!editSubjectCode.trim() ||
															!editSelectedGradeLevel}
													>
														{#if isUpdating}
															Updating...
														{:else}
															Update Subject
														{/if}
													</button>
												</div>
											</form>
										</div>
									</div>
								{/if}
							</div>
						{:else}
							<div class="adminsubject-no-results">
								<span class="material-symbols-outlined adminsubject-no-results-icon"
									>search_off</span
								>
								<p>No subjects found matching your search.</p>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Activity Types Tab Content -->
	{#if activeTab === 'activities'}
		<div class="admin-creation-layout">
			<!-- Left Column: Creation Form -->
			<div class="admin-creation-form-section">
				<div class="admin-section-header">
					<h2 class="admin-section-title">Create New Activity Type</h2>
					<p class="admin-section-subtitle">
						Fill in the details below to create a new activity type
					</p>
				</div>

				<div class="admin-form-container">
					<form on:submit|preventDefault={handleCreateActivity}>
						<!-- Activity Name, Code, and Icon Row -->
						<div class="admin-form-row">
							<!-- Activity Name -->
							<div class="admin-form-group admin-form-group-third">
								<label class="admin-form-label" for="activity-name">Activity Name *</label>
								<input
									id="activity-name"
									type="text"
									class="admin-form-input"
									bind:value={activityName}
									placeholder="e.g., Flag Ceremony, Break Time"
									required
								/>
							</div>

							<!-- Activity Code -->
							<div class="admin-form-group admin-form-group-third">
								<label class="admin-form-label" for="activity-code">Activity Code *</label>
								<input
									id="activity-code"
									type="text"
									class="admin-form-input"
									bind:value={activityCode}
									placeholder="e.g., FLAG, BREAK"
									required
								/>
							</div>

							<!-- Icon -->
							<div class="admin-form-group admin-form-group-third">
								<label class="admin-form-label" for="activity-icon">Icon</label>
								<div class="adminsubject-custom-dropdown" class:open={isIconDropdownOpen}>
									<button
										type="button"
										class="adminsubject-dropdown-trigger"
										class:selected={activityIcon}
										on:click={toggleIconDropdown}
										id="activity-icon"
									>
										{#if activityIcon}
											<div class="adminsubject-selected-option">
												<span class="material-symbols-outlined adminsubject-option-icon"
													>{activityIcon}</span
												>
												<div class="adminsubject-option-content">
													<span class="adminsubject-option-name">{getIconName(activityIcon)}</span>
												</div>
											</div>
										{:else}
											<span class="adminsubject-placeholder">Select icon</span>
										{/if}
										<span class="material-symbols-outlined adminsubject-dropdown-arrow"
											>expand_more</span
										>
									</button>
									<div class="adminsubject-dropdown-menu">
										{#each iconOptions as icon (icon.value)}
											<button
												type="button"
												class="adminsubject-dropdown-option"
												class:selected={activityIcon === icon.value}
												on:click={() => selectIcon(icon.value)}
											>
												<span class="material-symbols-outlined adminsubject-option-icon"
													>{icon.value}</span
												>
												<div class="adminsubject-option-content">
													<span class="adminsubject-option-name">{icon.name}</span>
												</div>
											</button>
										{/each}
									</div>
								</div>
							</div>
						</div>

						<!-- Submit Button -->
						<div class="admin-form-actions">
							<button
								type="submit"
								class="admin-create-button"
								class:loading={isCreatingActivity}
								disabled={isCreatingActivity || !activityName.trim() || !activityCode.trim()}
							>
								{#if isCreatingActivity}
									Creating...
								{:else}
									<span class="material-symbols-outlined">add_circle</span>
									Create Activity Type
								{/if}
							</button>
						</div>
					</form>
				</div>
			</div>

			<!-- Right Column: All Activities -->
			<div class="admin-recent-subjects-section">
				<div class="admin-section-header">
					<div class="section-header-content">
						<div class="section-title-group">
							<h2 class="admin-section-title">All Activities</h2>
							<p class="admin-section-subtitle">All activity types in the system</p>
						</div>

						<!-- Search Container -->
						<div class="adminactivity-search-container">
							<div class="adminactivity-search-input-wrapper">
								<span class="material-symbols-outlined adminactivity-search-icon">search</span>
								<input
									type="text"
									placeholder="Search by activity name or code..."
									class="adminactivity-search-input"
									bind:value={activitySearchTerm}
								/>
								{#if activitySearchTerm}
									<button
										type="button"
										class="adminactivity-clear-search-button"
										on:click={clearActivitySearch}
									>
										<span class="material-symbols-outlined">close</span>
									</button>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<div class="adminactivity-activities-grid">
					{#if filteredActivityTypes.length > 0}
						{#each filteredActivityTypes as activity (activity.id)}
							<div
								class="adminactivity-activity-card"
								id="adminactivity-activity-card-{activity.id}"
							>
								<div class="adminactivity-activity-header">
									<div class="adminactivity-activity-title">
										<h3 class="adminactivity-activity-name">{activity.name}</h3>
									</div>
									<div class="adminactivity-action-buttons">
										<a href="#adminactivity-activity-card-{activity.id}">
											<button
												type="button"
												class="adminactivity-edit-button"
												on:click={() => toggleEditActivityForm(activity)}
												title={editingActivityId === activity.id
													? 'Cancel Edit'
													: 'Edit Activity Type'}
											>
												<span class="material-symbols-outlined">
													{editingActivityId === activity.id ? 'close' : 'edit'}
												</span>
											</button>
										</a>
										<button
											type="button"
											class="adminactivity-remove-button"
											title="Remove Activity Type"
											on:click={() => handleDeleteActivity(activity)}
										>
											<span class="material-symbols-outlined">delete</span>
										</button>
									</div>
								</div>

								<div class="adminactivity-activity-details">
									<div class="adminactivity-activity-item-detail">
										<span class="material-symbols-outlined">qr_code_2</span>
										<span>{activity.code}</span>
									</div>
									<div class="adminactivity-activity-item-detail">
										<span
											class="material-symbols-outlined"
											style="color: var(--{activity.color}-500)">{activity.icon}</span
										>
										<span>Icon: {activity.icon}</span>
									</div>
									<div class="adminactivity-activity-item-detail">
										<span class="material-symbols-outlined">palette</span>
										<span>Color: {activity.color}</span>
									</div>
									<div class="adminactivity-activity-item-detail">
										<span class="material-symbols-outlined">calendar_today</span>
										<span>Created: {new Date().toLocaleDateString()}</span>
									</div>
								</div>

								<!-- Edit Form (shown when editing) -->
								{#if editingActivityId === activity.id}
									<div class="adminsubject-edit-form-section">
										<div class="adminsubject-edit-form-container">
											<div class="adminsubject-edit-form-header">
												<h2 class="adminsubject-edit-form-title">Edit Activity Type</h2>
												<p class="adminsubject-edit-form-subtitle">
													Update activity type information
												</p>
											</div>

											<form
												class="adminsubject-edit-form-content"
												on:submit|preventDefault={handleEditActivity}
											>
												<!-- Activity Name and Activity Code Row -->
												<div class="adminsubject-edit-form-row">
													<!-- Activity Name -->
													<div class="adminsubject-form-group adminsubject-form-group-third">
														<label class="adminsubject-form-label" for="edit-activity-name"
															>Activity Name *</label
														>
														<input
															type="text"
															class="adminsubject-form-input"
															id="edit-activity-name"
															bind:value={editActivityName}
															placeholder="e.g., Flag Ceremony"
															required
														/>
													</div>

													<!-- Activity Code -->
													<div class="adminsubject-form-group adminsubject-form-group-third">
														<label class="adminsubject-form-label" for="edit-activity-code"
															>Activity Code *</label
														>
														<input
															type="text"
															class="adminsubject-form-input"
															id="edit-activity-code"
															bind:value={editActivityCode}
															placeholder="e.g., FLAG"
															required
														/>
													</div>

													<!-- Icon -->
													<div class="adminsubject-form-group adminsubject-form-group-third">
														<label class="adminsubject-form-label" for="edit-activity-icon"
															>Icon</label
														>
														<div
															class="adminsubject-custom-dropdown"
															class:open={isEditIconDropdownOpen}
														>
															<button
																type="button"
																class="adminsubject-dropdown-trigger"
																class:selected={editActivityIcon}
																on:click={toggleEditIconDropdown}
																id="edit-activity-icon"
															>
																{#if editActivityIcon}
																	<div class="adminsubject-selected-option">
																		<span class="material-symbols-outlined adminsubject-option-icon"
																			>{editActivityIcon}</span
																		>
																		<div class="adminsubject-option-content">
																			<span class="adminsubject-option-name"
																				>{getIconName(editActivityIcon)}</span
																			>
																		</div>
																	</div>
																{:else}
																	<span class="adminsubject-placeholder">Select icon</span>
																{/if}
																<span class="material-symbols-outlined adminsubject-dropdown-arrow"
																	>expand_more</span
																>
															</button>
															<div class="adminsubject-dropdown-menu">
																{#each iconOptions as icon (icon.value)}
																	<button
																		type="button"
																		class="adminsubject-dropdown-option"
																		class:selected={editActivityIcon === icon.value}
																		on:click={() => selectEditIcon(icon.value)}
																	>
																		<span class="material-symbols-outlined adminsubject-option-icon"
																			>{icon.value}</span
																		>
																		<div class="adminsubject-option-content">
																			<span class="adminsubject-option-name">{icon.name}</span>
																		</div>
																	</button>
																{/each}
															</div>
														</div>
													</div>
												</div>

												<!-- Form Actions -->
												<div class="adminsubject-edit-form-actions">
													<a href="#adminactivity-activity-card-{activity.id}">
														<button
															type="button"
															class="adminsubject-cancel-button"
															on:click={() => toggleEditActivityForm(activity)}
														>
															Cancel
														</button>
													</a>
													<button
														type="submit"
														class="adminsubject-submit-button"
														class:loading={isUpdatingActivity}
														disabled={isUpdatingActivity ||
															!editActivityName.trim() ||
															!editActivityCode.trim()}
													>
														{#if isUpdatingActivity}
															Updating...
														{:else}
															Update Activity Type
														{/if}
													</button>
												</div>
											</form>
										</div>
									</div>
								{/if}
							</div>
						{/each}
					{:else}
						<div class="adminsubject-no-results">
							<span class="material-symbols-outlined adminsubject-no-results-icon">event_note</span>
							{#if activityTypes.length === 0}
								<p>No activity types created yet.</p>
							{:else}
								<p>No activity types found matching your search.</p>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
