<script>
	import './adminArchivedAccounts.css';
	import { onMount } from 'svelte';
	import { toastStore } from '../../../../common/js/toastStore.js';
	import { modalStore } from '../../../../common/js/modalStore.js';
	import { api } from '../../../../../routes/api/helper/api-helper.js';

	// State variables
	let accounts = [];
	let filteredAccounts = [];
	let isLoading = true;
	let searchQuery = '';
	let selectedGradeLevel = '';
	let selectedAccountType = ''; // New filter for account type
	let selectedDepartment = ''; // New filter for department
	let departmentOptions = []; // Departments loaded from database

	// Dropdown states
	let isGradeLevelDropdownOpen = false;
	let isAccountTypeDropdownOpen = false; // New dropdown state
	let isDepartmentDropdownOpen = false; // New dropdown state for departments

	// Account type options
	const accountTypeOptions = [
		{ id: '', name: 'All Accounts', icon: 'group' },
		{ id: 'student', name: 'Students', icon: 'school' },
		{ id: 'teacher', name: 'Teachers', icon: 'person' }
	];

	// Grade level options
	const gradeLevelOptions = [
		{ id: '', name: 'All Grade Levels', icon: 'school' },
		{ id: '7', name: 'Grade 7', icon: 'looks_one' },
		{ id: '8', name: 'Grade 8', icon: 'looks_two' },
		{ id: '9', name: 'Grade 9', icon: 'looks_3' },
		{ id: '10', name: 'Grade 10', icon: 'looks_4' }
	];

	// Computed values
	$: selectedAccountTypeObj = accountTypeOptions.find((type) => type.id === selectedAccountType);
	$: selectedGradeLevelObj = gradeLevelOptions.find((level) => level.id === selectedGradeLevel);
	$: selectedDepartmentObj = departmentOptions.find((dept) => dept.id === selectedDepartment);

	// Load archived accounts data
	async function loadArchivedAccounts() {
		isLoading = true;
		try {
			const data = await api.get('/api/archived-accounts');

			// Check if we have accounts data (API returns { accounts: [...] })
			if (!data.accounts) {
				throw new Error('No accounts data received');
			}

			// Transform API data to match our component structure
			accounts = data.accounts.map((account) => ({
				id: account.id,
				name: account.name,
				number: account.number,
				email: account.email,
				accountType: account.accountType, // 'student' or 'teacher'
				gradeLevel: account.gradeLevel || 'Not specified',
				department: account.department || 'Not specified', // For teachers
				birthdate: account.birthdate || 'Not specified',
				address: account.address || 'Not specified',
				guardian: account.guardian || 'Not specified',
				contactNumber: account.contactNumber || 'Not specified',
				archivedDate: account.archivedDate || 'Not specified'
			}));
			filterAccounts();
		} catch (error) {
			console.error('Error loading archived accounts:', error);
			toastStore.error('Failed to load archived accounts. Please try again.');
			// Fallback to empty array on error
			accounts = [];
		} finally {
			isLoading = false;
		}
	}

	// Load departments from database
	async function loadDepartments() {
		try {
			const data = await api.get('/api/departments');
			if (data.success && data.data) {
				departmentOptions = [
					{ id: '', name: 'All Departments', icon: 'corporate_fare' },
					...data.data.map((dept) => ({
						id: dept.id,
						name: dept.name,
						icon: 'corporate_fare'
					}))
				];
			}
		} catch (error) {
			console.error('Error loading departments:', error);
			toastStore.error('Failed to load departments.');
		}
	}

	// Filter accounts based on search query, account type, grade level, and department
	function filterAccounts() {
		filteredAccounts = accounts.filter((account) => {
			const matchesSearch =
				!searchQuery ||
				account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				account.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(account.number && account.number.toLowerCase().includes(searchQuery.toLowerCase()));

			const matchesAccountType = !selectedAccountType || account.accountType === selectedAccountType;

			const matchesGradeLevel = !selectedGradeLevel || account.gradeLevel === selectedGradeLevel;

			// For departments, match against account.department field using the selected department's name
			let matchesDepartment = true;
			if (selectedDepartment && selectedDepartmentObj) {
				// Match account department with the selected department name
				const matches = account.department === selectedDepartmentObj.name;
				console.log(`Comparing account dept "${account.department}" with selected dept "${selectedDepartmentObj.name}": ${matches}`);
				matchesDepartment = matches;
			}

			return matchesSearch && matchesAccountType && matchesGradeLevel && matchesDepartment;
		});
	}

	// Filter accounts with a specific department object (used when selecting from dropdown)
	function filterAccountsWithDepartment(departmentObj) {
		filteredAccounts = accounts.filter((account) => {
			const matchesSearch =
				!searchQuery ||
				account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				account.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(account.number && account.number.toLowerCase().includes(searchQuery.toLowerCase()));

			const matchesAccountType = !selectedAccountType || account.accountType === selectedAccountType;

			const matchesGradeLevel = !selectedGradeLevel || account.gradeLevel === selectedGradeLevel;

			// For departments, match against account.department field using the passed department object
			let matchesDepartment = true;
			if (departmentObj.id) {
				// Match account department with the selected department name
				matchesDepartment = account.department === departmentObj.name;
			}

			return matchesSearch && matchesAccountType && matchesGradeLevel && matchesDepartment;
		});
	}

	// Dropdown functions
	function toggleAccountTypeDropdown() {
		isAccountTypeDropdownOpen = !isAccountTypeDropdownOpen;
		isGradeLevelDropdownOpen = false;
		isDepartmentDropdownOpen = false;
	}

	function toggleGradeLevelDropdown() {
		isGradeLevelDropdownOpen = !isGradeLevelDropdownOpen;
		isAccountTypeDropdownOpen = false;
		isDepartmentDropdownOpen = false;
	}

	function toggleDepartmentDropdown() {
		isDepartmentDropdownOpen = !isDepartmentDropdownOpen;
		isAccountTypeDropdownOpen = false;
		isGradeLevelDropdownOpen = false;
	}

	function selectAccountType(accountType) {
		selectedAccountType = accountType.id;
		isAccountTypeDropdownOpen = false;
		// Reset grade level and department when switching account types
		selectedGradeLevel = '';
		selectedDepartment = '';
		filterAccounts();
	}

	function selectGradeLevel(gradeLevel) {
		selectedGradeLevel = gradeLevel.id;
		isGradeLevelDropdownOpen = false;
		filterAccounts();
	}

	function selectDepartment(department) {
		selectedDepartment = department.id;
		isDepartmentDropdownOpen = false;
		// Call filterAccounts with the department object to ensure correct comparison
		filterAccountsWithDepartment(department);
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

	// Format archived date for display
	function formatArchivedDate(archivedAt) {
		if (!archivedAt) return 'N/A';
		const date = new Date(archivedAt);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	// Restore account from archive with confirmation
	async function restoreAccount(accountId, accountName, accountType) {
		const typeLabel = accountType === 'student' ? 'Student' : 'Teacher';
		modalStore.confirm(
			`Restore ${typeLabel}`,
			`Are you sure you want to restore ${accountName}? This action will move the ${typeLabel.toLowerCase()} back to the active list.`,
			async () => {
				try {
					const result = await api.put('/api/archived-accounts', { id: accountId });

					// Show success toast
					toastStore.success(result.message || `${typeLabel} restored successfully`);

					// Reload the archived accounts list
					await loadArchivedAccounts();
				} catch (error) {
					console.error(`Error restoring ${typeLabel.toLowerCase()}:`, error);
					toastStore.error(error.message || `Failed to restore ${typeLabel.toLowerCase()}. Please try again.`);
				}
			},
			() => {
				// User cancelled - do nothing
			}
		);
	}

	// Clear all filters
	function clearFilters() {
		searchQuery = '';
		selectedAccountType = '';
		selectedGradeLevel = '';
		selectedDepartment = '';
		filterAccounts();
	}

	// Reactive statements
	$: if (searchQuery !== undefined) filterAccounts();

	// Close dropdowns when clicking outside
	function handleClickOutside(event) {
		if (!event.target.closest('.aas-custom-dropdown')) {
			isAccountTypeDropdownOpen = false;
			isGradeLevelDropdownOpen = false;
			isDepartmentDropdownOpen = false;
		}
	}

	onMount(() => {
		loadArchivedAccounts();
		loadDepartments();
		document.addEventListener('click', handleClickOutside);

		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div class="aas-archived-students-container">
	<!-- Header -->
	<div class="aas-admin-student-header">
		<div class="aas-header-content">
			<h1 class="aas-page-title">Archived Accounts</h1>
			<p class="aas-page-subtitle">View and manage archived student and teacher records</p>
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
						placeholder="Search archived accounts by name, email, or ID..."
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
				<!-- Account Type Filter -->
				<div class="filter-group">
					<label class="filter-label" for="archived-account-type-dropdown">Account Type</label>
					<div class="aas-custom-dropdown" class:open={isAccountTypeDropdownOpen}>
						<button
							type="button"
							id="archived-account-type-dropdown"
							class="aas-dropdown-trigger aas-filter-trigger"
							on:click={toggleAccountTypeDropdown}
						>
							{#if selectedAccountTypeObj && selectedAccountType}
								<div class="aas-selected-option">
									<span class="material-symbols-outlined aas-option-icon"
										>{selectedAccountTypeObj.icon}</span
									>
									<span class="aas-option-name">{selectedAccountTypeObj.name}</span>
								</div>
							{:else}
								<span class="aas-placeholder">All Accounts</span>
							{/if}
							<span class="material-symbols-outlined aas-dropdown-arrow">expand_more</span>
						</button>
						<div class="aas-dropdown-menu">
							{#each accountTypeOptions as accountType (accountType.id)}
								<button
									type="button"
									class="aas-dropdown-option"
									class:selected={selectedAccountType === accountType.id}
									on:click={() => selectAccountType(accountType)}
								>
									<span class="material-symbols-outlined aas-option-icon">{accountType.icon}</span>
									<div class="aas-option-content">
										<span class="aas-option-name">{accountType.name}</span>
									</div>
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Grade Level Filter (only show for students) -->
				{#if selectedAccountType === 'student'}
					<div class="filter-group">
						<label class="filter-label" for="archived-grade-level-dropdown">Grade Level</label>
						<div class="aas-custom-dropdown" class:open={isGradeLevelDropdownOpen}>
							<button
								type="button"
								id="archived-grade-level-dropdown"
								class="aas-dropdown-trigger aas-filter-trigger"
								on:click={toggleGradeLevelDropdown}
							>
								{#if selectedGradeLevelObj && selectedGradeLevel}
									<div class="aas-selected-option">
										<span class="material-symbols-outlined aas-option-icon"
											>{selectedGradeLevelObj.icon}</span
										>
										<span class="aas-option-name">{selectedGradeLevelObj.name}</span>
									</div>
								{:else}
									<span class="aas-placeholder">All Grade Levels</span>
								{/if}
								<span class="material-symbols-outlined aas-dropdown-arrow">expand_more</span>
							</button>
							<div class="aas-dropdown-menu">
								{#each gradeLevelOptions as gradeLevel (gradeLevel.id)}
									<button
										type="button"
										class="aas-dropdown-option"
										class:selected={selectedGradeLevel === gradeLevel.id}
										on:click={() => selectGradeLevel(gradeLevel)}
									>
										<span class="material-symbols-outlined aas-option-icon">{gradeLevel.icon}</span>
										<div class="aas-option-content">
											<span class="aas-option-name">{gradeLevel.name}</span>
										</div>
									</button>
								{/each}
							</div>
						</div>
					</div>
				{/if}

				<!-- Department Filter (only show for teachers) -->
				{#if selectedAccountType === 'teacher'}
					<div class="filter-group">
						<label class="filter-label" for="archived-department-dropdown">Department</label>
						<div class="aas-custom-dropdown" class:open={isDepartmentDropdownOpen}>
							<button
								type="button"
								id="archived-department-dropdown"
								class="aas-dropdown-trigger aas-filter-trigger"
								on:click={toggleDepartmentDropdown}
							>
								{#if selectedDepartmentObj && selectedDepartment}
									<div class="aas-selected-option">
										<span class="material-symbols-outlined aas-option-icon"
											>{selectedDepartmentObj.icon}</span
										>
										<span class="aas-option-name">{selectedDepartmentObj.name}</span>
									</div>
								{:else}
									<span class="aas-placeholder">All Departments</span>
								{/if}
								<span class="material-symbols-outlined aas-dropdown-arrow">expand_more</span>
							</button>
							<div class="aas-dropdown-menu">
								{#each departmentOptions as department (department.id)}
									<button
										type="button"
										class="aas-dropdown-option"
										class:selected={selectedDepartment === department.id}
										on:click={() => selectDepartment(department)}
									>
										<span class="material-symbols-outlined aas-option-icon">{department.icon}</span>
										<div class="aas-option-content">
											<span class="aas-option-name">{department.name}</span>
										</div>
									</button>
								{/each}
							</div>
						</div>
					</div>
				{/if}

				<!-- Clear Filters Button -->
				{#if searchQuery || selectedAccountType || selectedGradeLevel || selectedDepartment}
					<button type="button" class="clear-filters-button" on:click={clearFilters}>
						<span class="material-symbols-outlined">filter_alt_off</span>
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Accounts List -->
	<div class="aas-students-list-section">
		{#if isLoading}
			<div class="aas-loading-container">
				<span class="system-loader"></span>
				<p class="aas-loading-text">Loading archived accounts...</p>
			</div>
		{:else if filteredAccounts.length > 0}
			<div class="aas-students-grid">
				{#each filteredAccounts as account (account.id)}
					<div class="aas-account-card">
						<div class="aas-account-card-header">
							<div class="aas-account-title">
								<h3 class="aas-account-name">
									{#if account.number}{account.number}{/if} · {account.name}
								</h3>
								<div class="aas-archived-badge">
									<span class="material-symbols-outlined">archive</span>
									<span>Archived {formatArchivedDate(account.archivedDate)}</span>
								</div>
							</div>
							<div class="aas-action-buttons">
								<button
									type="button"
									class="aas-restore-button"
									title="Restore {account.accountType === 'student' ? 'Student' : 'Teacher'}"
									on:click={() => restoreAccount(account.id, account.name, account.accountType)}
								>
									<span class="material-symbols-outlined">unarchive</span>
								</button>
							</div>
						</div>

						<div class="aas-account-details">
							<!-- Account Type Badge -->
							<div class="aas-account-detail-item">
								<span class="material-symbols-outlined"
									>{account.accountType === 'student' ? 'school' : 'person'}</span
								>
								<span class="account-type-badge"
									>{account.accountType === 'student' ? 'Student' : 'Teacher'}</span
								>
							</div>

							{#if account.email}
								<div class="aas-account-detail-item">
									<span class="material-symbols-outlined">email</span>
									<span>{account.email}</span>
								</div>
							{/if}

							<!-- Student-specific fields -->
							{#if account.accountType === 'student'}
								{#if account.gradeLevel && account.gradeLevel !== 'Not specified'}
									<div class="aas-account-detail-item">
										<span class="material-symbols-outlined">school</span>
										<span
											>{gradeLevelOptions.find((level) => level.id === account.gradeLevel)?.name ||
												account.gradeLevel}</span
									>
								</div>
							{/if}
							{#if account.guardian && account.guardian !== 'Not specified'}
								<div class="aas-account-detail-item">
									<span class="material-symbols-outlined">family_restroom</span>
									<span>Guardian: {account.guardian}</span>
								</div>
							{/if}
						{/if}							<!-- Teacher-specific fields -->
							{#if account.accountType === 'teacher'}
								{#if account.department && account.department !== 'Not specified'}
									<div class="aas-account-detail-item">
										<span class="material-symbols-outlined">corporate_fare</span>
										<span>Department: {account.department}</span>
									</div>
								{/if}
							{/if}

							<!-- Common fields -->
							{#if account.birthdate && account.birthdate !== 'Not specified'}
								<div class="aas-account-detail-item">
									<span class="material-symbols-outlined">cake</span>
									<span>Age: {calculateAge(account.birthdate)} years old</span>
								</div>
							{/if}
							{#if account.contactNumber && account.contactNumber !== 'Not specified'}
								<div class="aas-account-detail-item">
									<span class="material-symbols-outlined">phone</span>
									<span>Contact: {account.contactNumber}</span>
								</div>
							{/if}
							{#if account.address && account.address !== 'Not specified'}
								<div class="aas-account-detail-item">
									<span class="material-symbols-outlined">home</span>
									<span>Address: {account.address}</span>
								</div>
							{/if}
							{#if account.birthdate && account.birthdate !== 'Not specified'}
								<div class="aas-account-detail-item">
									<span class="material-symbols-outlined">calendar_today</span>
									<span>Birthdate: {formatBirthdate(account.birthdate)}</span>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="aas-no-results">
				<span class="material-symbols-outlined aas-no-results-icon">
					{searchQuery || selectedAccountType || selectedGradeLevel ? 'search_off' : 'archive'}
				</span>
				<p>
					{#if searchQuery || selectedAccountType || selectedGradeLevel}
						No archived accounts found matching your search criteria.
					{:else}
						No archived accounts found in the system.
					{/if}
				</p>
				{#if searchQuery || selectedAccountType || selectedGradeLevel}
					<button type="button" class="aas-clear-search-button-inline" on:click={clearFilters}
						>Clear
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>
