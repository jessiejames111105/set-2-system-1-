<script>
	import './adminAccountCreation.css';
	import { modalStore } from '../../../../common/js/modalStore.js';
	import { toastStore } from '../../../../common/js/toastStore.js';
	import { authStore } from '../../../../login/js/auth.js';
	import { api } from '../../../../../routes/api/helper/api-helper.js';
	import { onMount } from 'svelte';

	// Account creation state
	let isCreating = false;
	let selectedAccountType = '';
	let selectedGender = '';
	let selectedGradeLevel = '';
	let firstName = '';
	let lastName = '';
	let middleInitial = '';
	let email = '';
	
	// Email validation state
	let emailError = '';
	let isCheckingEmail = false;
	let emailCheckTimeout = null;
	const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

	// Additional Information for students
	let birthdate = '';
	let address = '';
	let guardian = '';
	let contactNumber = '';
	let calculatedAge = 0;

	// Custom dropdown state
	let isDropdownOpen = false;
	let isGenderDropdownOpen = false;
	let isGradeLevelDropdownOpen = false;

	// Edit account state
	let editingAccountId = null;
	let editFirstName = '';
	let editLastName = '';
	let editMiddleInitial = '';
	let editGradeLevel = '';
	let isEditGradeLevelDropdownOpen = false;
	let isUpdating = false;

	// Edit additional information for students
	let editBirthdate = '';
	let editAddress = '';
	let editGuardian = '';
	let editContactNumber = '';
	let editCalculatedAge = 0;

	// Get yesterday's date in YYYY-MM-DD format for max attribute
	function getYesterday() {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		return yesterday.toISOString().split('T')[0];
	}

	// Current account being edited (reactive)
	$: currentAccount = editingAccountId
		? recentAccounts.find((account) => account.id === editingAccountId)
		: null;

	// Name capitalization function - converts to title case (capitalizes each word)
	function capitalizeFirstLetter(str) {
		if (!str) return str;
		return str
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	// Handle name input with automatic capitalization
	function handleNameInput(event, field, isEdit = false) {
		const value = event.target.value;
		const capitalizedValue =
			field === 'middleInitial' ? value.toUpperCase() : capitalizeFirstLetter(value);

		if (isEdit) {
			if (field === 'firstName') {
				editFirstName = capitalizedValue;
			} else if (field === 'lastName') {
				editLastName = capitalizedValue;
			} else if (field === 'middleInitial') {
				editMiddleInitial = capitalizedValue;
			}
		} else {
			if (field === 'firstName') {
				firstName = capitalizedValue;
			} else if (field === 'lastName') {
				lastName = capitalizedValue;
			} else if (field === 'middleInitial') {
				middleInitial = capitalizedValue;
			}
		}

		// Update the input field value
		event.target.value = capitalizedValue;
	}

	// Contact number validation
	function validateContactNumber(value) {
		if (!value) return false;

		// Remove any non-digit characters
		const digitsOnly = value.replace(/\D/g, '');

		// Check if it starts with 09 and has exactly 11 digits
		return digitsOnly.startsWith('09') && digitsOnly.length === 11;
	}

	function formatContactNumber(value) {
		// Remove any non-digit characters
		const digitsOnly = value.replace(/\D/g, '');

		// Limit to 11 digits
		return digitsOnly.slice(0, 11);
	}

	function handleContactNumberInput(event, isEdit = false) {
		const formatted = formatContactNumber(event.target.value);
		if (isEdit) {
			editContactNumber = formatted;
		} else {
			contactNumber = formatted;
		}
		event.target.value = formatted;
	}

	// Email validation function
	async function validateEmail(emailValue) {
		// Clear previous error
		emailError = '';
		
		// Check if email is empty
		if (!emailValue || emailValue.trim() === '') {
			return;
		}
		
		// Check email format
		if (!EMAIL_REGEX.test(emailValue)) {
			emailError = 'Invalid email format';
			return;
		}
		
		// Check if email is already taken
		isCheckingEmail = true;
		try {
			const data = await api.get(`/api/accounts/check-email?email=${encodeURIComponent(emailValue)}`);
			
			if (!data.valid) {
				emailError = data.error || 'Invalid email format';
			} else if (data.exists) {
				emailError = 'This email is already registered';
			} else {
				emailError = ''; // Email is valid and available
			}
		} catch (error) {
			console.error('Error checking email:', error);
			// Don't show error for network issues, allow submission attempt
		} finally {
			isCheckingEmail = false;
		}
	}

	// Handle email input with debouncing
	function handleEmailInput(event) {
		const value = event.target.value.trim().toLowerCase();
		email = value;
		
		// Clear previous timeout
		if (emailCheckTimeout) {
			clearTimeout(emailCheckTimeout);
		}
		
		// Only validate if there's a value
		if (value) {
			// Debounce email validation (wait 500ms after user stops typing)
			emailCheckTimeout = setTimeout(() => {
				validateEmail(value);
			}, 500);
		} else {
			emailError = '';
		}
	}

	// Date validation function
	function validateDate(dateString) {
		if (!dateString) return true; // Allow empty dates

		// Check if the date string is complete (YYYY-MM-DD format for HTML date input)
		if (dateString.length < 10) return true; // Allow partial input

		const date = new Date(dateString);
		const year = date.getFullYear();
		const today = new Date();
		const currentYear = today.getFullYear();

		// Check if date is valid and year is reasonable (between 1900 and current year)
		if (isNaN(date.getTime()) || year < 1900 || year > currentYear) {
			return false;
		}

		// Prevent today's date and future dates
		// Set today to start of day for accurate comparison
		const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
		const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

		if (inputDate >= todayStart) {
			return false;
		}

		return true;
	}

	function handleDateInput(event, isEdit = false) {
		const dateValue = event.target.value;

		// Update the bound value immediately without validation during typing
		if (isEdit) {
			editBirthdate = dateValue;
		} else {
			birthdate = dateValue;
		}

		// Only validate on blur (when user finishes typing) or if they try to submit
		// This prevents interruption during typing
	}

	// Account types
	const accountTypes = [
		{
			id: 'student',
			name: 'Student Account',
			description: 'Create a new student account',
			icon: 'school'
		},
		{
			id: 'teacher',
			name: 'Teacher Account',
			description: 'Create a new teacher account',
			icon: 'person'
		},
		{
			id: 'admin',
			name: 'Admin Account',
			description: 'Create a new admin account',
			icon: 'admin_panel_settings'
		}
	];

	// Gender options
	const genderOptions = [
		{ id: 'male', name: 'Male', icon: 'male' },
		{ id: 'female', name: 'Female', icon: 'female' }
	];

	// Grade level options for students
	const gradeLevelOptions = [
		{ id: '7', name: 'Grade 7', icon: 'looks_one' },
		{ id: '8', name: 'Grade 8', icon: 'looks_two' },
		{ id: '9', name: 'Grade 9', icon: 'looks_3' },
		{ id: '10', name: 'Grade 10', icon: 'looks_4' }
	];

	// Recent account creations (loaded from database)
	let recentAccounts = [];
	let isLoadingAccounts = false;

	// Search and filter states
	let accountsSearchTerm = '';
	let selectedFilter = 'all';
	let isFilterDropdownOpen = false;

	// Filter options
	const filterOptions = [
		{ id: 'all', name: 'All Accounts', icon: 'group' },
		{ id: 'student', name: 'Student Accounts', icon: 'school' },
		{ id: 'teacher', name: 'Teacher Accounts', icon: 'person' },
		{ id: 'admin', name: 'Admin Accounts', icon: 'admin_panel_settings' }
	];

	// Close dropdown when clicking outside
	function handleClickOutside(event) {
		if (!event.target.closest('.custom-dropdown') && !event.target.closest('.account-filter-dropdown')) {
			isDropdownOpen = false;
			isGenderDropdownOpen = false;
			isGradeLevelDropdownOpen = false;
			isEditGradeLevelDropdownOpen = false;
			isFilterDropdownOpen = false;
		}
	}

	// Handle account removal with modal confirmation
	async function handleRemoveAccount(account) {
		// Check if the account being deleted is the currently logged-in user
		const currentUser = $authStore.userData;
		if (currentUser && currentUser.accountNumber === account.number) {
			toastStore.error('You cannot delete your own account while logged in.');
			return;
		}

		modalStore.confirm(
			'Remove Account',
			`<p>Are you sure you want to remove the account for <strong>"${account.name}"</strong>?</p>`,
			async () => {
				try {
					// Call the DELETE API endpoint
					const result = await api.delete('/api/accounts', { id: account.id });

					if (!result.success) {
						throw new Error(result.message || 'Failed to delete account');
					}

					// Remove the account from the array
					recentAccounts = recentAccounts.filter((a) => a.id !== account.id);

					// Show success toast
					toastStore.success(`Account for "${account.name}" has been removed successfully`);
				} catch (error) {
					console.error('Error deleting account:', error);
					toastStore.error(`Failed to delete account: ${error.message}`);
				}
			},
			() => {
				// Do nothing on cancel
			},
			{ size: 'small' }
		);
	}

	// Edit account functions
	function toggleEditForm(account) {
		if (editingAccountId === account.id) {
			// Close the form
			editingAccountId = null;
			editFirstName = '';
			editLastName = '';
			editMiddleInitial = '';
			editGradeLevel = '';
			editBirthdate = '';
			editAddress = '';
			editGuardian = '';
			editContactNumber = '';
			editCalculatedAge = 0;
			isEditGradeLevelDropdownOpen = false;
		} else {
			// Open the form and populate with current values
			editingAccountId = account.id;
			// Use the individual fields from the API response if available
			if (account.firstName && account.lastName) {
				editFirstName = account.firstName;
				editLastName = account.lastName;
				editMiddleInitial = account.middleInitial || '';
				editGradeLevel = account.gradeLevel || '';
				// Format birthdate for date input (YYYY-MM-DD) - timezone safe
				if (account.birthdate) {
					const date = new Date(account.birthdate);
					const year = date.getFullYear();
					const month = String(date.getMonth() + 1).padStart(2, '0');
					const day = String(date.getDate()).padStart(2, '0');
					editBirthdate = `${year}-${month}-${day}`;
				} else {
					editBirthdate = '';
				}
				editAddress = account.address || '';
				editGuardian = account.guardian || '';
				editContactNumber = account.contactNumber || '';
			} else {
				// Fallback: Parse the name (assuming format: "LastName, FirstName M.I." or "LastName, FirstName")
				const nameParts = account.name.split(', ');
				if (nameParts.length >= 2) {
					editLastName = nameParts[0];
					const firstNamePart = nameParts[1];
					// Check if there's a middle initial
					const firstNameParts = firstNamePart.split(' ');
					editFirstName = firstNameParts[0];
					if (firstNameParts.length > 1 && firstNameParts[1].endsWith('.')) {
						editMiddleInitial = firstNameParts[1].replace('.', '');
					} else {
						editMiddleInitial = '';
					}
				}
				editGradeLevel = account.gradeLevel || '';
				// Format birthdate for date input (YYYY-MM-DD) - timezone safe
				if (account.birthdate) {
					const date = new Date(account.birthdate);
					const year = date.getFullYear();
					const month = String(date.getMonth() + 1).padStart(2, '0');
					const day = String(date.getDate()).padStart(2, '0');
					editBirthdate = `${year}-${month}-${day}`;
				} else {
					editBirthdate = '';
				}
				editAddress = account.address || '';
				editGuardian = account.guardian || '';
				editContactNumber = account.contactNumber || '';
			}
		}
	}

	async function handleEditAccount() {
		if (!editFirstName || !editLastName) {
			toastStore.error('Please fill in all required fields.');
			return;
		}

		// Additional validation for student accounts
		if (currentAccount && currentAccount.type.toLowerCase() === 'student') {
			if (!editBirthdate || !editAddress || !editGuardian || !editContactNumber) {
				toastStore.error('Please fill in all required student information fields.');
				return;
			}

			// Validate contact number format
			if (!validateContactNumber(editContactNumber)) {
				toastStore.error('Invalid contact number.');
				return;
			}
		}

		isUpdating = true;

		try {
			// Prepare the request body
			const requestBody = {
				id: editingAccountId,
				firstName: editFirstName.trim(),
				lastName: editLastName.trim(),
				middleInitial: editMiddleInitial ? editMiddleInitial.trim() : null
			};

			// Add grade level and additional info for student accounts
			if (currentAccount && currentAccount.type.toLowerCase() === 'student') {
				requestBody.gradeLevel = editGradeLevel || null;
				requestBody.birthdate = editBirthdate || null;
				requestBody.address = editAddress ? editAddress.trim() : null;
				requestBody.guardian = editGuardian ? editGuardian.trim() : null;
				requestBody.contactNumber = editContactNumber ? editContactNumber.trim() : null;
			}

			const result = await api.put('/api/accounts', requestBody);

			if (result.success) {
				// Update account in the array with the response data
				recentAccounts = recentAccounts.map((account) => {
					if (account.id === editingAccountId) {
						return result.account;
					}
					return account;
				});

				// Show success toast
				toastStore.success(result.message);

				// Close edit form
				editingAccountId = null;
				editFirstName = '';
				editLastName = '';
				editMiddleInitial = '';
				editGradeLevel = '';
				editBirthdate = '';
				editAddress = '';
				editGuardian = '';
				editContactNumber = '';
				editCalculatedAge = 0;
			} else {
				toastStore.error(result.error || 'Failed to update account');
			}
		} catch (error) {
			console.error('Error updating account:', error);
			toastStore.error('Failed to update account. Please try again.');
		} finally {
			isUpdating = false;
		}
	}

	// Toggle dropdown
	function toggleDropdown() {
		isDropdownOpen = !isDropdownOpen;
	}

	// Select account type and close dropdown
	function selectAccountType(type) {
		selectedAccountType = type.id;
		isDropdownOpen = false;
		// Clear grade level selection when switching account types
		if (type.id !== 'student') {
			selectedGradeLevel = '';
		}
	}

	// Toggle gender dropdown
	function toggleGenderDropdown() {
		isGenderDropdownOpen = !isGenderDropdownOpen;
	}

	// Select gender and close dropdown
	function selectGender(gender) {
		selectedGender = gender.id;
		isGenderDropdownOpen = false;
	}

	// Toggle grade level dropdown
	function toggleGradeLevelDropdown() {
		isGradeLevelDropdownOpen = !isGradeLevelDropdownOpen;
	}

	// Select grade level and close dropdown
	function selectGradeLevel(gradeLevel) {
		selectedGradeLevel = gradeLevel.id;
		isGradeLevelDropdownOpen = false;
	}

	// Toggle edit grade level dropdown
	function toggleEditGradeLevelDropdown() {
		isEditGradeLevelDropdownOpen = !isEditGradeLevelDropdownOpen;
	}

	// Select edit grade level and close dropdown
	function selectEditGradeLevel(gradeLevel) {
		editGradeLevel = gradeLevel.id;
		isEditGradeLevelDropdownOpen = false;
	}

	// Handle form submission
	async function handleCreateAccount() {
		if (!selectedAccountType || !selectedGender || !firstName || !lastName) {
			toastStore.error('Please fill in all required fields.');
			return;
		}

		// Check if student or teacher account requires email
		if ((selectedAccountType === 'student' || selectedAccountType === 'teacher') && !email) {
			toastStore.error('Please enter an email address.');
			return;
		}
		
		// Check for email validation errors
		if (emailError) {
			toastStore.error(emailError);
			return;
		}
		
		// Don't allow submission while checking email
		if (isCheckingEmail) {
			toastStore.error('Please wait while we verify the email address.');
			return;
		}

		// Check if student account requires grade level selection
		if (selectedAccountType === 'student' && !selectedGradeLevel) {
			toastStore.error('Please select a grade level for the student account.');
			return;
		}

		// Check if student account requires additional information
		if (selectedAccountType === 'student') {
			if (!birthdate || !address || !guardian || !contactNumber) {
				toastStore.error(
					'Please fill in all additional information fields for the student account.'
				);
				return;
			}

			// Validate contact number format
			if (!validateContactNumber(contactNumber)) {
				toastStore.error('Invalid contact number.');
				return;
			}
		}

		// Show confirmation modal before creating account
		const accountTypeLabel =
			selectedAccountType === 'student'
				? 'Student'
				: selectedAccountType === 'teacher'
					? 'Teacher'
					: 'Admin';
		const fullName = `${firstName} ${middleInitial ? middleInitial + '. ' : ''}${lastName}`;

		modalStore.confirm(
			'Confirm Account Creation',
			`<p>Are you sure you want to create a <strong>${accountTypeLabel}</strong> account for <strong>"${fullName}"</strong>?</p>`,
			async () => {
				await createAccountProcess();
			},
			() => {
				// Do nothing on cancel
			},
			{ size: 'small' }
		);
	}

	// Separate function for the actual account creation process
	async function createAccountProcess() {
		isCreating = true;

		try {
			// Get current user ID from auth store
			const currentUser = $authStore.userData;

			// Call API to create account
			const data = await api.post('/api/accounts', {
				accountType: selectedAccountType,
				gender: selectedGender,
				gradeLevel: selectedGradeLevel,
				firstName,
				lastName,
				middleInitial,
				email,
				birthdate: selectedAccountType === 'student' ? birthdate : null,
				address: selectedAccountType === 'student' ? address : null,
				guardian: selectedAccountType === 'student' ? guardian : null,
				contactNumber: selectedAccountType === 'student' ? contactNumber : null,
				createdBy: currentUser ? currentUser.id : null
			});

			if (!data.success) {
				throw new Error(data.message || 'Failed to create account');
			}

			// Add to recent accounts
			recentAccounts = [data.account, ...recentAccounts];

			// Show success toast
			const accountTypeLabel =
				selectedAccountType === 'student'
					? 'Student'
					: selectedAccountType === 'teacher'
						? 'Teacher'
						: 'Admin';
			toastStore.success(
				`${accountTypeLabel} account created successfully for ${data.account.name}! Password is the same as account number: ${data.account.number}`
			);

			// Reset form
			selectedAccountType = '';
			selectedGender = '';
			selectedGradeLevel = '';
			firstName = '';
			lastName = '';
			middleInitial = '';
			email = '';
			emailError = '';
			birthdate = '';
			address = '';
			guardian = '';
			contactNumber = '';
			calculatedAge = 0;
		} catch (error) {
			console.error('Error creating account:', error);
			toastStore.error(error.message || 'Failed to create account. Please try again.');
		} finally {
			isCreating = false;
		}
	}

	// Get selected account type object
	$: selectedTypeObj = accountTypes.find((type) => type.id === selectedAccountType);

	// Get selected gender object
	$: selectedGenderObj = genderOptions.find((gender) => gender.id === selectedGender);

	// Get selected grade level object
	$: selectedGradeLevelObj = gradeLevelOptions.find(
		(gradeLevel) => gradeLevel.id === selectedGradeLevel
	);

	// Get selected edit grade level object
	$: selectedEditGradeLevelObj = gradeLevelOptions.find(
		(gradeLevel) => gradeLevel.id === editGradeLevel
	);

	// Calculate age from birthdate
	$: {
		if (birthdate) {
			const birthDate = new Date(birthdate);
			const today = new Date();
			let age = today.getFullYear() - birthDate.getFullYear();
			const monthDiff = today.getMonth() - birthDate.getMonth();
			if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
				age--;
			}
			calculatedAge = age >= 0 ? age : 0;
		} else {
			calculatedAge = 0;
		}
	}

	// Calculate age from edit birthdate
	$: {
		if (editBirthdate) {
			const birthDate = new Date(editBirthdate);
			const today = new Date();
			let age = today.getFullYear() - birthDate.getFullYear();
			const monthDiff = today.getMonth() - birthDate.getMonth();
			if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
				age--;
			}
			editCalculatedAge = age >= 0 ? age : 0;
		} else {
			editCalculatedAge = 0;
		}
	}

	// Get selected filter object
	$: selectedFilterObj = filterOptions.find((filter) => filter.id === selectedFilter);

	// Filter accounts based on search term and selected filter
	$: filteredAccounts = recentAccounts.filter((account) => {
		// Filter by account type
		const matchesFilter =
			selectedFilter === 'all' || account.type.toLowerCase() === selectedFilter.toLowerCase();

		// Filter by search term (search in name, number, and type)
		const matchesSearch =
			!accountsSearchTerm ||
			account.name?.toLowerCase().includes(accountsSearchTerm.toLowerCase()) ||
			account.number?.toString().toLowerCase().includes(accountsSearchTerm.toLowerCase()) ||
			account.type?.toLowerCase().includes(accountsSearchTerm.toLowerCase());

		return matchesFilter && matchesSearch;
	});

	// Toggle filter dropdown
	function toggleFilterDropdown() {
		isFilterDropdownOpen = !isFilterDropdownOpen;
	}

	// Select filter option
	function selectFilter(filter) {
		selectedFilter = filter.id;
		isFilterDropdownOpen = false;
	}

	// Clear search function
	function clearSearch() {
		accountsSearchTerm = '';
	}

	// Preview account number by fetching from backend API
	let previewAccountNumber = '';
	let isLoadingPreview = false;

	async function getNextAccountNumber(accountType) {
		if (!accountType) {
			previewAccountNumber = '';
			return;
		}

		isLoadingPreview = true;
		try {
			const data = await api.get(`/api/accounts/next-number?type=${accountType}`);
			previewAccountNumber = data.accountNumber;
		} catch (error) {
			console.error('Error fetching next account number:', error);
			previewAccountNumber = 'Error loading preview';
		} finally {
			isLoadingPreview = false;
		}
	}

	// Update preview when account type changes
	$: if (selectedAccountType) {
		getNextAccountNumber(selectedAccountType);
	}

	// Load existing accounts from database
	async function loadAccounts() {
		isLoadingAccounts = true;
		try {
			const data = await api.get('/api/accounts');
			if (!data.success) {
				throw new Error('Failed to load accounts');
			}

			// API already returns data in the correct format
			recentAccounts = data.accounts;
		} catch (error) {
			console.error('Error loading accounts:', error);
			toastStore.error('Failed to load existing accounts');
		} finally {
			isLoadingAccounts = false;
		}
	}

	// Load accounts when component mounts
	onMount(() => {
		loadAccounts();
	});
</script>

<svelte:window on:click={handleClickOutside} />

<div class="account-creation-container">
	<!-- Header -->
	<div class="account-header">
		<div class="header-content">
			<h1 class="page-title">Account Creation</h1>
			<p class="page-subtitle">Create new student, teacher, and admin accounts for the system</p>
		</div>
	</div>

	<!-- Account Creation Form -->
	<div class="creation-form-section">
		<div class="account-section-header">
			<h2 class="section-title">Create New Account</h2>
			<p class="section-subtitle">Fill in the details below to create a new account</p>
		</div>

		<div class="form-container">
			<form on:submit|preventDefault={handleCreateAccount}>
				<!-- Account Type and Gender Selection Row -->
				<div class="account-type-gender-row">
					<!-- Account Type Selection -->
					<div class="form-group admin">
						<label class="form-label" for="account-type">Account Type *</label>
						<div class="custom-dropdown" class:open={isDropdownOpen}>
							<button
								type="button"
								class="dropdown-trigger"
								class:selected={selectedAccountType}
								on:click={toggleDropdown}
								id="account-type"
							>
								{#if selectedTypeObj}
									<div class="selected-option">
										<span class="material-symbols-outlined option-icon">{selectedTypeObj.icon}</span
										>
										<div class="option-content">
											<span class="option-name">{selectedTypeObj.name}</span>
											<span class="option-description">{selectedTypeObj.description}</span>
										</div>
									</div>
								{:else}
									<span class="placeholder">Select account type</span>
								{/if}
								<span class="material-symbols-outlined dropdown-arrow">expand_more</span>
							</button>
							<div class="dropdown-menu">
								{#each accountTypes as type (type.id)}
									<button
										type="button"
										class="dropdown-option"
										class:selected={selectedAccountType === type.id}
										on:click={() => selectAccountType(type)}
									>
										<span class="material-symbols-outlined option-icon">{type.icon}</span>
										<div class="option-content">
											<span class="option-name">{type.name}</span>
											<span class="option-description">{type.description}</span>
										</div>
									</button>
								{/each}
							</div>
						</div>
					</div>

					<!-- Gender Selection -->
					<div class="form-group">
						<label class="form-label" for="gender">Gender *</label>
						<div class="custom-dropdown" class:open={isGenderDropdownOpen}>
							<button
								type="button"
								class="dropdown-trigger"
								class:selected={selectedGender}
								on:click={toggleGenderDropdown}
								id="gender"
							>
								{#if selectedGenderObj}
									<div class="selected-option">
										<span class="material-symbols-outlined option-icon"
											>{selectedGenderObj.icon}</span
										>
										<div class="option-content">
											<span class="option-name">{selectedGenderObj.name}</span>
										</div>
									</div>
								{:else}
									<span class="placeholder">Select gender</span>
								{/if}
								<span class="material-symbols-outlined dropdown-arrow">expand_more</span>
							</button>
							<div class="dropdown-menu">
								{#each genderOptions as gender (gender.id)}
									<button
										type="button"
										class="dropdown-option"
										class:selected={selectedGender === gender.id}
										on:click={() => selectGender(gender)}
									>
										<span class="material-symbols-outlined option-icon">{gender.icon}</span>
										<div class="option-content">
											<span class="option-name">{gender.name}</span>
										</div>
									</button>
								{/each}
							</div>
						</div>
					</div>

					<!-- Grade Level Selection (only for students) -->
					{#if selectedAccountType === 'student'}
						<div class="form-group">
							<label class="form-label" for="grade-level">Grade Level *</label>
							<div class="custom-dropdown" class:open={isGradeLevelDropdownOpen}>
								<button
									type="button"
									class="dropdown-trigger"
									class:selected={selectedGradeLevel}
									on:click={toggleGradeLevelDropdown}
									id="grade-level"
								>
									{#if selectedGradeLevelObj}
										<div class="selected-option">
											<span class="material-symbols-outlined option-icon"
												>{selectedGradeLevelObj.icon}</span
											>
											<div class="option-content">
												<span class="option-name">{selectedGradeLevelObj.name}</span>
											</div>
										</div>
									{:else}
										<span class="placeholder">Select grade level</span>
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
					{/if}
				</div>

				<!-- Name Fields -->
				<div class="name-fields-row">
					<div class="form-group">
						<label class="form-label" for="last-name">Last Name *</label>
						<input
							type="text"
							id="last-name"
							class="form-input"
							bind:value={lastName}
							on:input={(e) => handleNameInput(e, 'lastName')}
							placeholder="Enter last name"
							required
						/>
					</div>

					<div class="form-group">
						<label class="form-label" for="first-name">First Name *</label>
						<input
							type="text"
							id="first-name"
							class="form-input"
							bind:value={firstName}
							on:input={(e) => handleNameInput(e, 'firstName')}
							placeholder="Enter first name"
							required
						/>
					</div>

					<div class="form-group">
						<label class="form-label" for="middle-initial">M.I.</label>
						<input
							type="text"
							id="middle-initial"
							class="form-input"
							bind:value={middleInitial}
							on:input={(e) => handleNameInput(e, 'middleInitial')}
							placeholder="M"
							maxlength="1"
						/>
					</div>
				</div>

				<!-- Email Field (for students and teachers only) -->
				{#if selectedAccountType === 'student' || selectedAccountType === 'teacher'}
					<div class="form-group">
						<label class="form-label" for="email">Email Address *</label>
						<div class="email-input-wrapper">
							<input
								type="email"
								id="email"
								class="form-input"
								class:error={emailError}
								class:valid={email && !emailError && !isCheckingEmail}
								bind:value={email}
								on:input={handleEmailInput}
								placeholder="Enter email address"
								required
							/>
							{#if isCheckingEmail}
								<span class="email-status checking">
									<span class="material-symbols-outlined spinning">progress_activity</span>
								</span>
							{:else if email && !emailError}
								<span class="email-status valid">
									<span class="material-symbols-outlined">check_circle</span>
								</span>
							{:else if emailError}
								<span class="email-status error">
									<span class="material-symbols-outlined">error</span>
								</span>
							{/if}
						</div>
						{#if emailError}
							<p class="form-error">{emailError}</p>
						{:else if email && !isCheckingEmail}
							<p class="form-success">Email is available</p>
						{/if}
					</div>
				{/if}

				<!-- Additional Information Section (for students only) -->
				{#if selectedAccountType === 'student'}
					<div class="additional-info-section">
						<h3 class="section-subtitle">Additional Information</h3>
						<p class="section-description">Required information for student accounts</p>

						<div class="form-row">
							<div class="form-group">
								<label class="form-label" for="birthdate">Birthdate *</label>
								<input
									type="date"
									id="birthdate"
									class="form-input"
									bind:value={birthdate}
									max={getYesterday()}
									on:blur={(e) => {
										if (birthdate && !validateDate(birthdate)) {
											toastStore.error('Invalid date. Please enter a valid date.');
											birthdate = '';
											e.target.value = '';
										}
									}}
									required
								/>
							</div>

							<div class="form-group">
								<label class="form-label" for="age">Age</label>
								<input
									type="number"
									id="age"
									class="form-input age-display"
									value={calculatedAge}
									readonly
									placeholder="Auto-calculated"
								/>
							</div>
						</div>

						<div class="form-group">
							<label class="form-label" for="address">Address *</label>
							<textarea
								id="address"
								class="form-input form-textarea"
								bind:value={address}
								placeholder="Enter complete address"
								rows="3"
								required
							></textarea>
						</div>

						<div class="form-row">
							<div class="form-group">
								<label class="form-label" for="guardian">Guardian/Parent Name *</label>
								<input
									type="text"
									id="guardian"
									class="form-input"
									bind:value={guardian}
									placeholder="Enter guardian/parent name"
									required
								/>
							</div>

							<div class="form-group">
								<label class="form-label" for="contact-number">Guardian's Contact Number *</label>
								<input
									type="tel"
									id="contact-number"
									class="form-input"
									bind:value={contactNumber}
									on:input={(e) => handleContactNumberInput(e, false)}
									placeholder="09xxxxxxxxxx"
									maxlength="11"
									required
								/>
							</div>
						</div>
					</div>
				{/if}

				<!-- Account Number Info -->
				<div class="form-group">
					<div class="form-label">
						{selectedAccountType === 'student'
							? 'Student Number'
							: selectedAccountType === 'teacher'
								? 'Teacher Number'
								: selectedAccountType === 'admin'
									? 'Admin Number'
									: 'Account Number'}
					</div>
					<div class="number-display">
						{#if selectedAccountType}
							{#if isLoadingPreview}
								<span class="auto-label">Loading preview...</span>
							{:else if previewAccountNumber}
								<span class="auto-number">{previewAccountNumber}</span>
								<span class="auto-label">(Preview - will use lowest available)</span>
							{:else}
								<span class="auto-label">Will be auto-assigned (lowest available number)</span>
							{/if}
						{:else}
							<span class="placeholder-number">Select account type first</span>
						{/if}
					</div>
					<p class="form-help">
						Account number will be automatically assigned using the lowest available number.
						Password will be set to the same as the account number.
					</p>
				</div>

				<!-- Submit Button -->
				<div class="form-actions">
					<button
						type="submit"
						class="account-create-button"
						class:loading={isCreating}
						disabled={isCreating ||
							!selectedAccountType ||
							!selectedGender ||
							!firstName ||
							!lastName ||
							((selectedAccountType === 'student' || selectedAccountType === 'teacher') &&
								(!email || emailError || isCheckingEmail)) ||
							(selectedAccountType === 'student' &&
								(!birthdate || !address || !guardian || !contactNumber))}
					>
						{#if isCreating}
							Creating Account...
						{:else}
							<span class="material-symbols-outlined">person_add</span>
							Create Account
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>

	<!-- All Account Creations -->
	<div class="recent-accounts-section">
		<div class="account-section-header">
			<div class="section-header-content">
				<div class="section-title-group">
					<h2 class="section-title">All Account Creations</h2>
					<p class="account-creation-section-subtitle">All accounts in the system</p>
				</div>

				<!-- Search and Filter Container -->
				<div class="account-search-filter-container">
					<!-- Search Input -->
					<div class="account-search-container">
						<div class="account-search-input-wrapper">
							<span class="material-symbols-outlined account-search-icon">search</span>
							<input
								type="text"
								placeholder="Search by name, account number, or account type..."
								class="account-search-input"
								bind:value={accountsSearchTerm}
							/>
							{#if accountsSearchTerm}
								<button
									type="button"
									class="account-clear-search-button"
									on:click={clearSearch}
								>
									<span class="material-symbols-outlined">close</span>
								</button>
							{/if}
						</div>
					</div>

					<!-- Filter Dropdown -->
					<div class="account-filter-container">
						<div class="account-filter-dropdown" class:open={isFilterDropdownOpen}>
							<button
								type="button"
								class="account-filter-trigger"
								class:selected={selectedFilter !== 'all'}
								on:click={toggleFilterDropdown}
							>
								{#if selectedFilterObj}
									<div class="account-filter-selected-option">
										<span class="material-symbols-outlined account-filter-option-icon"
											>{selectedFilterObj.icon}</span
										>
										<div class="account-filter-option-content">
											<span class="account-filter-option-name">{selectedFilterObj.name}</span>
										</div>
									</div>
								{:else}
									<span class="account-filter-placeholder">Filter by type</span>
								{/if}
								<span class="material-symbols-outlined account-filter-dropdown-arrow">expand_more</span>
							</button>
							<div class="account-filter-dropdown-menu">
								{#each filterOptions as filter (filter.id)}
									<button
										type="button"
										class="account-filter-dropdown-option"
										class:selected={selectedFilter === filter.id}
										on:click={() => selectFilter(filter)}
									>
										<span class="material-symbols-outlined account-filter-option-icon"
											>{filter.icon}</span
										>
										<div class="account-filter-option-content">
											<span class="account-filter-option-name">{filter.name}</span>
										</div>
									</button>
								{/each}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="accounts-grid">
			{#if isLoadingAccounts}
				<div class="loading-container">
					<span class="system-loader"></span>
					<p class="loading-text">Loading accounts...</p>
				</div>
			{:else if filteredAccounts.length === 0}
				<div class="no-results">
					<span class="material-symbols-outlined no-results-icon">group_off</span>
					{#if recentAccounts.length === 0}
						<p>No accounts created yet.</p>
					{:else}
						<p>No accounts found matching your search or filter.</p>
					{/if}
				</div>
			{:else}
				{#each filteredAccounts as account (account.id)}
					<div class="account-card" id="account-card-{account.id}">
						<div class="account-card-header">
							<div class="account-title">
								<h3 class="account-name">{account.name} · {account.type}</h3>
							</div>
							<div class="account-action-buttons">
								<a href="#account-card-{account.id}">
									<button
										type="button"
										class="account-edit-button"
										title={editingAccountId === account.id ? 'Cancel Edit' : 'Edit Account'}
										on:click={() => toggleEditForm(account)}
									>
										<span class="material-symbols-outlined"
											>{editingAccountId === account.id ? 'close' : 'edit'}</span
										>
									</button>
								</a>
								<button
									type="button"
									class="account-remove-button"
									title="Remove Account"
									on:click={() => handleRemoveAccount(account)}
								>
									<span class="material-symbols-outlined">delete</span>
								</button>
							</div>
						</div>

						<div class="account-details">
							<div class="account-detail-item">
								<span class="material-symbols-outlined"
									>{account.type === 'Student'
										? 'school'
										: account.type === 'Teacher'
											? 'person'
											: 'admin_panel_settings'}</span
								>
								<span>{account.number}</span>
							</div>
							<div class="account-detail-item">
								<span class="material-symbols-outlined">badge</span>
								<span>{account.type} Account</span>
							</div>
							{#if account.type === 'Teacher'}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">class</span>
									<span>{account.advisorySection || 'No advisory section assigned'}</span>
								</div>
							{/if}
							{#if account.type === 'Student' && account.gradeLevel}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">school</span>
									<span>Grade {account.gradeLevel}</span>
								</div>
							{/if}
							{#if account.type === 'Student' && account.age}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">cake</span>
									<span>Age: {account.age}</span>
								</div>
							{/if}
							{#if account.type === 'Student' && account.guardian}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">family_restroom</span>
									<span>Guardian: {account.guardian}</span>
								</div>
							{/if}
							{#if account.type === 'Student' && account.contactNumber}
								<div class="account-detail-item">
									<span class="material-symbols-outlined">phone</span>
									<span>Contact: {account.contactNumber}</span>
								</div>
							{/if}
							<div class="account-detail-item">
								<span class="material-symbols-outlined">calendar_today</span>
								<span>Created: {account.createdDate}</span>
							</div>
							<div class="account-detail-item">
								<span class="material-symbols-outlined">update</span>
								<span>Updated: {account.updatedDate}</span>
							</div>
						</div>

						<!-- Edit Form (shown when editing this account) -->
						{#if editingAccountId === account.id}
							<div class="edit-form-section">
								<div class="edit-form-container">
									<div class="edit-form-header">
										<h4 class="edit-form-title">Edit Account Information</h4>
										<p class="edit-form-subtitle">Update the name information for this account</p>
									</div>

									<form on:submit|preventDefault={handleEditAccount} class="edit-form-content">
										<div class="edit-name-fields-row">
											<div class="form-group">
												<label class="form-label" for="edit-last-name-{account.id}"
													>Last Name *</label
												>
												<input
													type="text"
													id="edit-last-name-{account.id}"
													class="form-input"
													bind:value={editLastName}
													on:input={(e) => handleNameInput(e, 'lastName', true)}
													placeholder="Enter last name"
													required
												/>
											</div>

											<div class="form-group">
												<label class="form-label" for="edit-first-name-{account.id}"
													>First Name *</label
												>
												<input
													type="text"
													id="edit-first-name-{account.id}"
													class="form-input"
													bind:value={editFirstName}
													on:input={(e) => handleNameInput(e, 'firstName', true)}
													placeholder="Enter first name"
													required
												/>
											</div>

											<div class="form-group">
												<label class="form-label" for="edit-middle-initial-{account.id}">M.I.</label
												>
												<input
													type="text"
													id="edit-middle-initial-{account.id}"
													class="form-input"
													bind:value={editMiddleInitial}
													on:input={(e) => handleNameInput(e, 'middleInitial', true)}
													placeholder="M"
													maxlength="1"
												/>
											</div>
										</div>

										<!-- Grade Level field for student accounts only -->
										{#if account.type.toLowerCase() === 'student'}
											<div class="form-group">
												<label class="form-label" for="edit-grade-level-{account.id}"
													>Grade Level</label
												>
												<div class="custom-dropdown" class:open={isEditGradeLevelDropdownOpen}>
													<button
														type="button"
														class="dropdown-trigger"
														class:selected={editGradeLevel}
														on:click={toggleEditGradeLevelDropdown}
														id="edit-grade-level-{account.id}"
													>
														{#if selectedEditGradeLevelObj}
															<div class="selected-option">
																<span class="material-symbols-outlined option-icon"
																	>{selectedEditGradeLevelObj.icon}</span
																>
																<div class="option-content">
																	<span class="option-name">{selectedEditGradeLevelObj.name}</span>
																</div>
															</div>
														{:else}
															<span class="placeholder">Select grade level</span>
														{/if}
														<span class="material-symbols-outlined dropdown-arrow">expand_more</span
														>
													</button>
													<div class="dropdown-menu">
														{#each gradeLevelOptions as gradeLevel (gradeLevel.id)}
															<button
																type="button"
																class="dropdown-option"
																class:selected={editGradeLevel === gradeLevel.id}
																on:click={() => selectEditGradeLevel(gradeLevel)}
															>
																<span class="material-symbols-outlined option-icon"
																	>{gradeLevel.icon}</span
																>
																<div class="option-content">
																	<span class="option-name">{gradeLevel.name}</span>
																</div>
															</button>
														{/each}
													</div>
												</div>
											</div>

											<!-- Additional Information for Student Edit -->
											<div class="additional-info-section">
												<h4 class="section-subtitle">Additional Information</h4>
												<p class="section-description">Update student additional information</p>

												<div class="form-row">
													<div class="form-group">
														<label class="form-label" for="edit-birthdate-{account.id}"
															>Birthdate *</label
														>
														<input
															type="date"
															id="edit-birthdate-{account.id}"
															class="form-input"
															bind:value={editBirthdate}
															max={getYesterday()}
															on:blur={(e) => {
																if (editBirthdate && !validateDate(editBirthdate)) {
																	toastStore.error('Invalid date. Please enter a valid date.');
																	editBirthdate = '';
																	e.target.value = '';
																}
															}}
															required
														/>
													</div>

													<div class="form-group">
														<label class="form-label" for="edit-age-{account.id}">Age</label>
														<input
															type="number"
															id="edit-age-{account.id}"
															class="form-input age-display"
															value={editCalculatedAge}
															readonly
															placeholder="Auto-calculated"
														/>
													</div>
												</div>

												<div class="form-group">
													<label class="form-label" for="edit-address-{account.id}">Address *</label
													>
													<textarea
														id="edit-address-{account.id}"
														class="form-input form-textarea"
														bind:value={editAddress}
														placeholder="Enter complete address"
														rows="3"
														required
													></textarea>
												</div>

												<div class="form-row">
													<div class="form-group">
														<label class="form-label" for="edit-guardian-{account.id}"
															>Guardian/Parent Name *</label
														>
														<input
															type="text"
															id="edit-guardian-{account.id}"
															class="form-input"
															bind:value={editGuardian}
															placeholder="Enter guardian/parent name"
															required
														/>
													</div>

													<div class="form-group">
														<label class="form-label" for="edit-contact-number-{account.id}"
															>Guardian's Contact Number *</label
														>
														<input
															type="tel"
															id="edit-contact-number-{account.id}"
															class="form-input"
															bind:value={editContactNumber}
															on:input={(e) => handleContactNumberInput(e, true)}
															placeholder="09xxxxxxxxxx"
															maxlength="11"
															required
														/>
													</div>
												</div>
											</div>
										{/if}

										<div class="edit-form-actions">
											<a href="#account-card-{account.id}">
												<button
													type="button"
													class="account-cancel-button"
													on:click={() => toggleEditForm(account)}
												>
													Cancel
												</button>
											</a>
											<button
												type="submit"
												class="account-submit-button"
												class:loading={isUpdating}
												disabled={isUpdating ||
													!editFirstName ||
													!editLastName ||
													(currentAccount &&
														currentAccount.type.toLowerCase() === 'student' &&
														(!editBirthdate ||
															!editAddress ||
															!editGuardian ||
															!editContactNumber))}
											>
												{#if isUpdating}
													Updating...
												{:else}
													Update Account
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
