<script>
	import './adminTeacherMasterlist.css';
	import { onMount } from 'svelte';
	import { toastStore } from '../../../../common/js/toastStore.js';
	import { modalStore } from '../../../../common/js/modalStore.js';
	import { api } from '../../../../../routes/api/helper/api-helper.js';
	import { teacherMasterlistStore } from '../../../../../lib/stores/admin/teacherMasterlistStore.js';

	// Subscribe to store
	$: ({ teachers, departments: departmentOptions, isLoading, error } = $teacherMasterlistStore);

	// Local UI state
	let filteredTeachers = [];
	let searchQuery = '';
	let selectedDepartment = '';

	// Initialize departments with default value
	$: if (!departmentOptions || departmentOptions.length === 0) {
		teacherMasterlistStore.updateDepartments([{ id: '', name: 'All Departments' }]);
	}

	// Dropdown states
	let isDepartmentDropdownOpen = false;

	// Computed values
	$: selectedDepartmentObj = departmentOptions.find((dept) => dept.id === selectedDepartment);

	// Reactive filter
	$: if (teachers) {
		filterTeachers();
	}

	// Load teachers data
	async function loadTeachers(silent = false) {
		try {
			if (!silent) {
				teacherMasterlistStore.setLoading(true);
			}

			const data = await api.get('/api/accounts?type=teacher');
			if (!data.success) {
				throw new Error('Failed to load teachers');
			}

			// Transform API data to match our component structure
			const transformedTeachers = data.accounts.map((account) => ({
				id: account.id,
				name: account.name,
				number: account.number, // Add the teacher ID number
				email: account.email,
				department: account.department || 'Not specified',
				birthdate: account.birthdate || 'Not specified',
				address: account.address || 'Not specified',
				contactNumber: account.contactNumber || 'Not specified',
				status: account.status || 'active',
				subjects: account.subjects || []
			}));
			teacherMasterlistStore.updateTeachers(transformedTeachers);
		} catch (error) {
			console.error('Error loading teachers:', error);
			teacherMasterlistStore.setError(error.message);
			if (!silent) {
				toastStore.error('Failed to load teachers. Please try again.');
			}
		}
	}

	// Load departments data
	async function loadDepartments() {
		try {
			const data = await api.get('/api/departments');
			if (data.success && data.data) {
				// Transform departments data and add to dropdown options
				const departmentsFromDB = data.data.map((dept) => ({
					id: dept.name, // Use department name as ID for filtering
					name: dept.name
				}));

				// Combine "All Departments" with actual departments
				const allDepartments = [{ id: '', name: 'All Departments' }, ...departmentsFromDB];
				teacherMasterlistStore.updateDepartments(allDepartments);
			}
		} catch (error) {
			console.error('Error loading departments:', error);
			// Keep default "All Departments" option if loading fails
			teacherMasterlistStore.updateDepartments([{ id: '', name: 'All Departments' }]);
		}
	}

	// Filter teachers based on search query and department
	function filterTeachers() {
		filteredTeachers = teachers.filter((teacher) => {
			const matchesSearch =
				!searchQuery ||
				teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				teacher.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(teacher.number && teacher.number.toLowerCase().includes(searchQuery.toLowerCase()));

			const matchesDepartment = !selectedDepartment || teacher.department === selectedDepartment;

			return matchesSearch && matchesDepartment;
		});
	}

	// Dropdown functions
	function toggleDepartmentDropdown() {
		isDepartmentDropdownOpen = !isDepartmentDropdownOpen;
	}

	function selectDepartment(department) {
		selectedDepartment = department.id;
		isDepartmentDropdownOpen = false;
		filterTeachers();
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
		selectedDepartment = '';
		filterTeachers();
	}

	// Reactive statements
	$: if (searchQuery !== undefined) filterTeachers();

	// Close dropdowns when clicking outside
	function handleClickOutside(event) {
		if (!event.target.closest('.custom-dropdown')) {
			isDepartmentDropdownOpen = false;
		}
	}

	// Archive teacher function with confirmation
	async function archiveTeacher(teacherId, teacherName) {
		modalStore.confirm(
			'Archive Teacher',
			`Are you sure you want to archive ${teacherName}? This action will move the teacher to the archived list.`,
			async () => {
				try {
					const result = await api.patch('/api/accounts', { id: teacherId, action: 'archive' });

					if (result.success) {
						toastStore.success(result.message);
						// Reload teachers to reflect the change
						await loadTeachers();
					} else {
						toastStore.error(result.message || 'Failed to archive teacher');
					}
				} catch (error) {
					console.error('Error archiving teacher:', error);
					toastStore.error('Failed to archive teacher. Please try again.');
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
		const cachedData = teacherMasterlistStore.getCachedData();
		if (cachedData) {
			teacherMasterlistStore.init(cachedData);
		}

		// Fetch fresh data (silent if we have cache, visible loading if not)
		loadDepartments();
		loadTeachers(!!cachedData);

		// Set up periodic silent refresh every 30 seconds
		const refreshInterval = setInterval(() => {
			loadTeachers(true); // Always silent for periodic refresh
		}, 30000);

		document.addEventListener('click', handleClickOutside);

		return () => {
			clearInterval(refreshInterval);
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div class="teacher-masterlist-container">
	<!-- Header -->
	<div class="admin-teacher-header">
		<div class="header-content">
			<h1 class="page-title">Teacher Masterlist</h1>
			<p class="page-subtitle">View and manage all teacher records in the system</p>
		</div>
	</div>

	<!-- Filters Section -->
	<div class="filters-section">
		<div class="teachmaster-search-filter-container">
			<!-- Search Bar -->
			<div class="search-container">
				<div class="search-input-wrapper">
					<span class="material-symbols-outlined search-icon">search</span>
					<input
						type="text"
						class="search-input"
						placeholder="Search teachers by name, email, or ID..."
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
			<div class="teachmaster-filter-container">
				<!-- Department Filter -->
				<div class="filter-group">
					<label class="filter-label" for="department-dropdown">Department</label>
					<div class="custom-dropdown" class:open={isDepartmentDropdownOpen}>
						<button
							type="button"
							id="department-dropdown"
							class="dropdown-trigger filter-trigger"
							on:click={toggleDepartmentDropdown}
						>
							{#if selectedDepartmentObj && selectedDepartment}
								<div class="selected-option">
									<span class="option-name">{selectedDepartmentObj.name}</span>
								</div>
							{:else}
								<span class="placeholder">All Departments</span>
							{/if}
							<span class="material-symbols-outlined dropdown-arrow">expand_more</span>
						</button>
						<div class="dropdown-menu">
							{#each departmentOptions as department (department.id)}
								<button
									type="button"
									class="dropdown-option"
									class:selected={selectedDepartment === department.id}
									on:click={() => selectDepartment(department)}
								>
									<div class="option-content">
										<span class="option-name">{department.name}</span>
									</div>
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Clear Filters Button -->
				{#if searchQuery || selectedDepartment}
					<button type="button" class="clear-filters-button" on:click={clearFilters}>
						<span class="material-symbols-outlined">filter_alt_off</span>
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Teachers List -->
	<div class="teachers-list-section">
		{#if isLoading}
			<div class="masterlist-loading-container">
				<span class="system-loader"></span>
				<p class="masterlist-loading-text">Loading teachers...</p>
			</div>
		{:else if filteredTeachers.length > 0}
			<div class="teachers-grid">
				{#each filteredTeachers as teacher (teacher.id)}
					<div class="account-card">
						<div class="account-card-header">
							<div class="account-title">
								<h3 class="account-name">
									{#if teacher.number}{teacher.number} · {/if} {teacher.name}
								</h3>
							</div>
							<div class="action-buttons">
								<button
									type="button"
									class="archive-button"
									title="Archive Teacher"
									on:click={() => archiveTeacher(teacher.id, teacher.name)}
								>
									<span class="material-symbols-outlined">archive</span>
								</button>
							</div>
						</div>

						<div class="master-account-details">
							{#if teacher.email}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">email</span>
									<span>{teacher.email}</span>
								</div>
							{/if}
							{#if teacher.department && teacher.department !== 'Not specified'}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">corporate_fare</span>
									<span>{teacher.department}</span>
								</div>
							{/if}
							{#if teacher.subjects && teacher.subjects.length > 0}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">menu_book</span>
									<span>Subjects: {teacher.subjects.join(', ')}</span>
								</div>
							{/if}
							{#if teacher.birthdate && teacher.birthdate !== 'Not specified'}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">cake</span>
									<span>Age: {calculateAge(teacher.birthdate)} years old</span>
								</div>
							{/if}
							{#if teacher.contactNumber && teacher.contactNumber !== 'Not specified'}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">phone</span>
									<span>Contact: {teacher.contactNumber}</span>
								</div>
							{/if}
							{#if teacher.address && teacher.address !== 'Not specified'}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">home</span>
									<span>Address: {teacher.address}</span>
								</div>
							{/if}
							{#if teacher.birthdate && teacher.birthdate !== 'Not specified'}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">calendar_today</span>
									<span>Birthdate: {formatBirthdate(teacher.birthdate)}</span>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="no-results">
				<span class="material-symbols-outlined no-results-icon">
					{searchQuery || selectedDepartment ? 'search_off' : 'school'}
				</span>
				<p>
					{#if searchQuery || selectedDepartment}
						No teachers found matching your search criteria.
					{:else}
						No teachers found in the system.
					{/if}
				</p>
			</div>
		{/if}
	</div>
</div>
