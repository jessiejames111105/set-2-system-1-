<script>
	import './teacherProfile.css';
	import { toastStore } from '../../../../common/js/toastStore.js';
	import { modalStore } from '../../../../common/js/modalStore.js';
	import { showSuccess, showError } from '../../../../common/js/toastStore.js';
	import { authStore } from '../../../../../components/login/js/auth.js';
	import { api } from '../../../../../routes/api/helper/api-helper.js';
	import { teacherProfileStore } from '../../../../../lib/stores/teacher/teacherProfileStore.js';
	import { onMount } from 'svelte';

	// Use derived to get auth state reactively
	let authState = $derived($authStore);
	
	// Subscribe to the profile store
	let { teacherData, teacherProfileData, teacherSections, isLoading, isRefreshing, error, lastUpdated } = $derived($teacherProfileStore);
	
	// Track if we've initialized to prevent double loading
	let hasInitialized = $state(false);

	// Load profile data when auth state changes
	$effect(() => {
		if (authState?.userData?.id && !hasInitialized) {
			hasInitialized = true;
			const teacherId = authState.userData.id;
			
			console.log('Loading teacher profile for ID:', teacherId);
			
			// Try to initialize with cached data first
			const hasCachedData = teacherProfileStore.init(teacherId);
			
			// Always load fresh data (silently if we have cached data)
			teacherProfileStore.loadProfile(teacherId, hasCachedData);
		}
	});

	// Set up periodic refresh
	onMount(() => {
		const refreshInterval = setInterval(async () => {
			if (authState?.userData?.id) {
				await teacherProfileStore.loadProfile(authState.userData.id, true); // Silent refresh
			}
		}, 5 * 60 * 1000); // 5 minutes

		// Cleanup interval on component destroy
		return () => {
			clearInterval(refreshInterval);
		};
	});

	// Manual refresh function
	async function handleRefresh() {
		if (!authState?.isAuthenticated || !authState?.userData?.id) {
			console.error('User not authenticated');
			return;
		}

		const teacherId = authState.userData.id;
		await teacherProfileStore.forceRefresh(teacherId);
	}

	// Dynamic teacher profile data based on fetched data
	let teacherProfile = $derived({
		id: teacherData?.number || authState?.userData?.accountNumber || 'N/A',
		name: teacherData?.name || authState?.userData?.name || 'Teacher Name',
		firstName: teacherData?.firstName || authState?.userData?.firstName || '',
		lastName: teacherData?.lastName || '',
		middleInitial: teacherData?.middleInitial || '',
		department: teacherData?.department || 'Not assigned',
		position: teacherData?.position || 'Teacher',
		email: teacherData?.email || 'Not available',
		phone: teacherData?.contactNumber || 'Not available',
		address: teacherData?.address || 'Not available',
		birthDate: teacherData?.birthdate ? new Date(teacherData.birthdate).toLocaleDateString('en-US', { 
			year: 'numeric', 
			month: 'long', 
			day: 'numeric' 
		}) : 'Not available',
		age: teacherData?.age || 'Not available',
		gender: teacherData?.gender || authState?.userData?.gender || 'male',
		employmentInfo: {
			hireDate: teacherData?.hireDate ? new Date(teacherData.hireDate).toLocaleDateString('en-US', { 
				year: 'numeric', 
				month: 'long', 
				day: 'numeric' 
			}) : 'Not available',
			yearsOfService: teacherData?.yearsOfService || 'Not available',
			employeeId: teacherData?.employeeId || 'Not available'
		},
		subjects: teacherProfileData?.subjects || [],
		classes: teacherProfileData?.classes || [],
		sections: teacherProfileData?.sections || []
	});

	// Calculate total subjects and classes
	let totalSubjects = $derived(teacherProfile.subjects.length || 'Not available');
	let totalClasses = $derived(teacherProfile.sections.length || 'Not available');

	// Collapsible state for mobile sections (collapsed by default)
	let isTeacherInfoCollapsed = $state(true);
	let isSectionsCollapsed = $state(true);
	let isTeachingAssignmentsCollapsed = $state(true);

	// Toggle functions for collapsible sections
	function toggleTeacherInfo() {
		isTeacherInfoCollapsed = !isTeacherInfoCollapsed;
	}

	function toggleSections() {
		isSectionsCollapsed = !isSectionsCollapsed;
	}

	function toggleTeachingAssignments() {
		isTeachingAssignmentsCollapsed = !isTeachingAssignmentsCollapsed;
	}

	// Password change functionality
	let passwordLoading = $state(false);

	// Toggle password visibility function
	function togglePasswordVisibility(inputId) {
		const input = document.getElementById(inputId);
		const button = input.nextElementSibling;
		const icon = button.querySelector('.password-eye-icon');
		
		if (input.type === 'password') {
			input.type = 'text';
			icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
		} else {
			input.type = 'password';
			icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
		}
	}

	// Make function globally available
	if (typeof window !== 'undefined') {
		window.togglePasswordVisibility = togglePasswordVisibility;
	}

	// Handle password change button click
	function handlePasswordChangeModal() {
		const passwordFormContent = `
			<div class="teacher-profile-password-form">
				<div class="teacher-profile-form-group">
					<label for="current-password">Current Password</label>
					<div class="teacher-profile-password-input-wrapper">
						<input 
							id="current-password"
							type="password" 
							placeholder="Enter current password"
							class="teacher-profile-form-input"
						/>
						<button type="button" class="teacher-profile-password-toggle" onclick="togglePasswordVisibility('current-password')">
							<svg class="password-eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
								<line x1="1" y1="1" x2="23" y2="23"/>
							</svg>
						</button>
					</div>
				</div>
				
				<div class="teacher-profile-form-group">
					<label for="new-password">New Password</label>
					<div class="teacher-profile-password-input-wrapper">
						<input 
							id="new-password"
							type="password" 
							placeholder="Enter new password"
							class="teacher-profile-form-input"
						/>
						<button type="button" class="teacher-profile-password-toggle" onclick="togglePasswordVisibility('new-password')">
							<svg class="password-eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
								<line x1="1" y1="1" x2="23" y2="23"/>
							</svg>
						</button>
					</div>
				</div>
				
				<div class="teacher-profile-form-group">
					<label for="confirm-password">Confirm New Password</label>
					<div class="teacher-profile-password-input-wrapper">
						<input 
							id="confirm-password"
							type="password" 
							placeholder="Confirm new password"
							class="teacher-profile-form-input"
						/>
						<button type="button" class="teacher-profile-password-toggle" onclick="togglePasswordVisibility('confirm-password')">
							<svg class="password-eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
								<line x1="1" y1="1" x2="23" y2="23"/>
							</svg>
						</button>
					</div>
				</div>
			</div>
		`;

		modalStore.confirm(
			'Change Password',
			passwordFormContent,
			handlePasswordChange,
			() => {
				// Reset password fields - no need to reset state variables since we're using DOM inputs
			},
			{ size: 'medium' }
		);
	}

	async function handlePasswordChange() {
		// Get values from the modal inputs
		const currentPasswordInput = document.getElementById('current-password');
		const newPasswordInput = document.getElementById('new-password');
		const confirmPasswordInput = document.getElementById('confirm-password');
		
		if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
			showError('Password form inputs not found');
			return;
		}
		
		const currentPassword = currentPasswordInput.value;
		const newPassword = newPasswordInput.value;
		const confirmPassword = confirmPasswordInput.value;

		// Validation
		if (!currentPassword) {
			showError('Current password is required');
			return;
		}

		if (!newPassword) {
			showError('New password is required');
			return;
		}

		if (newPassword !== confirmPassword) {
			showError('New passwords do not match');
			return;
		}

		if (newPassword.length < 8) {
			showError('Password must be at least 8 characters long');
			return;
		}

		// Check if new password is different from current
		if (currentPassword === newPassword) {
			showError('New password must be different from current password');
			return;
		}

		try {
			passwordLoading = true;
			
			// Call the password change API
			const response = await api.post('/api/change-password', {
				currentPassword,
				newPassword
			});

			if (response.success) {
				// Reset form inputs
				currentPasswordInput.value = '';
				newPasswordInput.value = '';
				confirmPasswordInput.value = '';
				
				showSuccess('Password changed successfully!');
				
				// Close the modal
				modalStore.close();
			} else {
				showError(response.error || 'Failed to change password');
			}
		} catch (error) {
			showError(error.message || 'Failed to change password');
		} finally {
			passwordLoading = false;
		}
	}
</script>

<div class="teacher-profile-container">
	<!-- Error State -->
	{#if error}
		<div class="teacher-error-container">
			<div class="teacher-error-icon">
				<span class="material-symbols-outlined">error</span>
			</div>
			<p class="teacher-error-message">Failed to load profile data: {error}</p>
			<button class="teacher-retry-btn" onclick={handleRefresh}>
				<span class="material-symbols-outlined">refresh</span>
				Retry
			</button>
		</div>
	{:else}
		<!-- Header Section - Always visible -->
		<div class="teacher-profile-header">
			<div class="teacher-header-content">
				<h1 class="teacher-page-title">Teacher Profile</h1>
				<p class="teacher-page-subtitle">Personal Information & Teaching Details</p>
			</div>
			<div class="teacher-header-actions">
				<button 
					class="teacher-refresh-btn" 
					onclick={handleRefresh} 
					disabled={isLoading}
					aria-label="Refresh profile data"
				>
					<span class="material-symbols-outlined">refresh</span>
				</button>
			</div>
		</div>

		<!-- Teacher Information Cards -->
		<div class="teacher-profile-info-section">
			<h2 class="teacher-section-title teacher-section-title-desktop">Teacher Information</h2>
			<button class="teacher-section-header-mobile" onclick={toggleTeacherInfo} aria-label="Toggle teacher information">
				<h2 class="teacher-section-title">Teacher Information</h2>
				<span class="material-symbols-outlined teacher-collapse-icon" class:rotated={isTeacherInfoCollapsed}>
					expand_more
				</span>
			</button>
			<div class="teacher-section-content" class:collapsed={isTeacherInfoCollapsed}>
				{#if isLoading}
					<div class="teacher-profile-loading-container">
						<span class="system-loader"></span>
						<p class="teacher-profile-loading-text">Loading teacher information...</p>
					</div>
				{:else}
				<!-- Row 1: 3 cards -->
				<div class="teacher-info-row teacher-row-three">
					<!-- Teacher ID Card -->
					<div class="teacher-info-card">
						<div class="teacher-info-icon">
							<span class="material-symbols-outlined">badge</span>
						</div>
						<div class="teacher-info-content">
							<div class="teacher-info-label">Teacher ID</div>
							<div class="teacher-info-value">{teacherProfile.id}</div>
						</div>
					</div>

					<!-- Full Name Card -->
					<div class="teacher-info-card">
						<div class="teacher-info-icon">
							<span class="material-symbols-outlined">person</span>
						</div>
						<div class="teacher-info-content">
							<div class="teacher-info-label">Full Name</div>
							<div class="teacher-info-value">{teacherProfile.name}</div>
						</div>
					</div>

					<!-- Position Card -->
					<div class="teacher-info-card">
						<div class="teacher-info-icon">
							<span class="material-symbols-outlined">work</span>
						</div>
						<div class="teacher-info-content">
							<div class="teacher-info-label">Position</div>
							<div class="teacher-info-value">{teacherProfile.position}</div>
						</div>
					</div>
				</div>

				<!-- Row 2: 3 cards -->
				<div class="teacher-info-row teacher-row-three">
					<!-- Email Card -->
					<div class="teacher-info-card">
						<div class="teacher-info-icon">
							<span class="material-symbols-outlined">email</span>
						</div>
						<div class="teacher-info-content">
							<div class="teacher-info-label">Email</div>
							<div class="teacher-info-value">{teacherProfile.email || 'Not provided'}</div>
						</div>
					</div>

					<!-- Total Subjects Card -->
					<div class="teacher-info-card">
						<div class="teacher-info-icon">
							<span class="material-symbols-outlined">menu_book</span>
						</div>
						<div class="teacher-info-content">
							<div class="teacher-info-label">Total Subjects</div>
							<div class="teacher-info-value">{totalSubjects}</div>
						</div>
					</div>

					<!-- Department Card -->
					<div class="teacher-info-card">
						<div class="teacher-info-icon">
							<span class="material-symbols-outlined">domain</span>
						</div>
						<div class="teacher-info-content">
							<div class="teacher-info-label">Department</div>
							<div class="teacher-info-value">{teacherProfile.department}</div>
						</div>
					</div>
				</div>


				{/if}
			</div>
		</div>

		<!-- Sections Section -->
		<div class="teacher-profile-sections-section">
			<h2 class="teacher-section-title teacher-section-title-desktop">Teaching Sections</h2>
			<button class="teacher-section-header-mobile" onclick={toggleSections} aria-label="Toggle teaching sections">
				<h2 class="teacher-section-title">Teaching Sections</h2>
				<span class="material-symbols-outlined teacher-collapse-icon" class:rotated={isSectionsCollapsed}>
					expand_more
				</span>
			</button>
			<div class="teacher-section-content" class:collapsed={isSectionsCollapsed}>
				{#if isLoading}
					<div class="teacher-profile-loading-container">
						<span class="system-loader"></span>
						<p class="teacher-profile-loading-text">Loading teaching sections...</p>
					</div>
				{:else if teacherSections.length > 0}
					<div class="teacher-info-row teacher-row-three">
						{#each teacherSections as gradeLevel}
							{#each gradeLevel.sections as section}
								<div class="teacher-info-card">
									<div class="teacher-info-icon">
										<span class="material-symbols-outlined">groups</span>
									</div>
									<div class="teacher-info-content">
										<div class="teacher-info-label">{section.name}</div>
										<div class="teacher-info-value">
											{gradeLevel.gradeName} • {section.students} students
										</div>
									</div>
								</div>
							{/each}
						{/each}
					</div>
				{:else}
					<div class="teacher-sections-empty">
						<span class="material-symbols-outlined">groups</span>
						<p>No teaching sections assigned yet</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Teaching Assignments Section -->
		<div class="teacher-profile-subjects-section">
			<h2 class="teacher-section-title teacher-section-title-desktop">Teaching Assignments</h2>
			<button class="teacher-section-header-mobile" onclick={toggleTeachingAssignments} aria-label="Toggle teaching assignments">
				<h2 class="teacher-section-title">Teaching Assignments</h2>
				<span class="material-symbols-outlined teacher-collapse-icon" class:rotated={isTeachingAssignmentsCollapsed}>
					expand_more
				</span>
			</button>
			<div class="teacher-section-content" class:collapsed={isTeachingAssignmentsCollapsed}>
				{#if isLoading}
					<div class="teacher-profile-loading-container">
						<span class="system-loader"></span>
						<p class="teacher-profile-loading-text">Loading teaching assignments...</p>
					</div>
				{:else if teacherProfile.subjects.length > 0}
				<div class="teacher-subjects-grid">
					{#each teacherProfile.subjects as subject (subject.id)}
						<div class="teacher-subject-card" style="border-color: {subject.color};">
							<!-- Subject Icon -->
							<div class="teacher-subject-icon-column">
								<div class="teacher-subject-icon" style="background-color: {subject.color}20; color: {subject.color}">
									<span class="material-symbols-outlined">book</span>
								</div>
							</div>
							
							<!-- Subject Details -->
							<div class="teacher-subject-details-column">
								<h3 class="teacher-subject-name">{subject.name}</h3>
								<p class="teacher-subject-classes">
									{#if subject.section_count}
										{subject.section_count} {subject.section_count === 1 ? 'section' : 'sections'}
									{:else}
										No sections assigned
									{/if}
								</p>
							</div>
						</div>
					{/each}
				</div>
			{:else}
					<div class="teacher-subjects-empty">
						<span class="material-symbols-outlined">menu_book</span>
						<p>No subjects assigned yet</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Account Security Section -->
		<div class="teacher-profile-security-section">
			<h2 class="teacher-section-title teacher-section-title-desktop">Account Security</h2>
			<div class="teacher-section-content">
				<div class="teacher-info-row teacher-row-one">
					<div class="teacher-info-card teacher-security-card">
						<div class="teacher-info-content-container">
							<div class="teacher-info-icon">
								<span class="material-symbols-outlined">lock</span>
							</div>
							<div class="teacher-info-content">
								<div class="teacher-info-label">Password</div>
								<div class="teacher-info-value">Change your account password for security</div>
							</div>
						</div>
						<div class="teacher-security-actions">
							<button 
								class="teacher-security-action-button" 
								onclick={handlePasswordChangeModal}
							>
								<span class="material-symbols-outlined">lock</span>
								Change Password
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>