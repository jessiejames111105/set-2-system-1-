<script>
	import './studentProfile.css';
	import { toastStore } from '../../../../common/js/toastStore.js';
	import { modalStore } from '../../../../common/js/modalStore.js';
	import { showSuccess, showError } from '../../../../common/js/toastStore.js';
	import { authStore } from '../../../../../components/login/js/auth.js';
	import { studentProfileStore } from '../../../../../lib/stores/student/studentProfileStore.js';
	import { onMount } from 'svelte';

	// Get basic auth data
	let authState = $state();
	
	// Subscribe to auth store changes
	$effect(() => {
		const unsubscribe = authStore.subscribe(value => {
			authState = value;
		});
		return unsubscribe;
	});

	// Subscribe to student profile store
	let storeData = $derived($studentProfileStore);
	let { studentData, studentProfileData, isLoading, isRefreshing, error, lastUpdated } = $derived(storeData);

	// Handle refresh functionality
	function handleRefresh() {
		if (authState?.userData?.id) {
			studentProfileStore.forceRefresh(authState.userData.id);
		}
	}

	// Initialize store and load data when auth state changes
	$effect(() => {
		if (authState?.userData?.id) {
			// Try to initialize with cached data first
			const hasCachedData = studentProfileStore.init(authState.userData.id);
			
			// If no cached data, load fresh data
			if (!hasCachedData) {
				studentProfileStore.loadProfile(authState.userData.id, false);
			}
		}
	});

	// Set up periodic refresh (every 5 minutes)
	onMount(() => {
		const refreshInterval = setInterval(() => {
			if (authState?.userData?.id) {
				studentProfileStore.loadProfile(authState.userData.id, true); // Silent refresh
			}
		}, 5 * 60 * 1000); // 5 minutes

		return () => clearInterval(refreshInterval);
	});

	// Dynamic student profile data based on fetched data
	let studentProfile = $derived({
		id: studentData?.number || authState?.userData?.accountNumber || 'N/A',
		name: studentData?.name || authState?.userData?.name || 'Student Name',
		firstName: studentData?.firstName || authState?.userData?.firstName || '',
		lastName: studentData?.lastName || '',
		middleInitial: studentData?.middleInitial || '',
		yearLevel: studentData?.gradeLevel ? `Grade ${studentData.gradeLevel}` : 'Not assigned',
		section: studentProfileData?.section?.name || 'Not assigned',
		email: studentData?.email || 'Not available',
		phone: studentData?.contactNumber || 'Not available',
		address: studentData?.address || 'Not available',
		birthDate: studentData?.birthdate ? new Date(studentData.birthdate).toLocaleDateString('en-US', { 
			year: 'numeric', 
			month: 'long', 
			day: 'numeric' 
		}) : 'Not available',
		age: studentData?.age || 'Not available',
		guardian: studentData?.guardian || 'Not available',
		gender: studentData?.gender || authState?.userData?.gender || 'male',
		academicSummary: {
			adviser: studentProfileData?.section?.adviser || 'Not available',
			gpa: studentProfileData?.academicSummary?.generalAverage || 'Not available',
			rank: studentProfileData?.academicSummary?.classRank || 'Not available',
			totalStudents: studentProfileData?.academicSummary?.totalStudentsInSection || 'Not available'
		},
		subjects: studentProfileData?.subjects || []
	});

	// Calculate total subjects (will be 0 initially until subjects are loaded)
	let totalSubjects = $derived(studentProfile.subjects.length || 'Not available');

	// Collapsible state for mobile sections (collapsed by default)
	let isStudentInfoCollapsed = $state(true);
	let isAcademicPerformanceCollapsed = $state(false);
	let isEnrolledSubjectsCollapsed = $state(true);

	// Toggle functions for collapsible sections
	function toggleStudentInfo() {
		isStudentInfoCollapsed = !isStudentInfoCollapsed;
	}

	function toggleAcademicPerformance() {
		isAcademicPerformanceCollapsed = !isAcademicPerformanceCollapsed;
	}

	function toggleEnrolledSubjects() {
		isEnrolledSubjectsCollapsed = !isEnrolledSubjectsCollapsed;
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
			<div class="student-profile-password-form">
				<div class="student-profile-form-group">
					<label for="current-password">Current Password</label>
					<div class="student-profile-password-input-wrapper">
						<input 
							id="current-password"
							type="password" 
							placeholder="Enter current password"
							class="student-profile-form-input"
						/>
						<button type="button" class="student-profile-password-toggle" onclick="togglePasswordVisibility('current-password')">
							<svg class="password-eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
								<line x1="1" y1="1" x2="23" y2="23"/>
							</svg>
						</button>
					</div>
				</div>
				
				<div class="student-profile-form-group">
					<label for="new-password">New Password</label>
					<div class="student-profile-password-input-wrapper">
						<input 
							id="new-password"
							type="password" 
							placeholder="Enter new password"
							class="student-profile-form-input"
						/>
						<button type="button" class="student-profile-password-toggle" onclick="togglePasswordVisibility('new-password')">
							<svg class="password-eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
								<line x1="1" y1="1" x2="23" y2="23"/>
							</svg>
						</button>
					</div>
				</div>
				
				<div class="student-profile-form-group">
					<label for="confirm-password">Confirm New Password</label>
					<div class="student-profile-password-input-wrapper">
						<input 
							id="confirm-password"
							type="password" 
							placeholder="Confirm new password"
							class="student-profile-form-input"
						/>
						<button type="button" class="student-profile-password-toggle" onclick="togglePasswordVisibility('confirm-password')">
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
			console.error('Password change error:', error);
			showError(error.message || 'Failed to change password');
		} finally {
			passwordLoading = false;
		}
	}
</script>

<div class="profile-container">
	<!-- Error State -->
	{#if error}
		<div class="error-container">
			<div class="error-icon">
				<span class="material-symbols-outlined">error</span>
			</div>
			<p class="error-message">Failed to load profile data: {error}</p>
			<button class="retry-btn" onclick={handleRefresh}>
				<span class="material-symbols-outlined">refresh</span>
				Retry
			</button>
		</div>
	{:else}
		<!-- Header Section - Always visible -->
		<div class="profile-header">
			<div class="header-content">
				<h1 class="page-title">Student Profile</h1>
				<p class="page-subtitle">Personal Information & Academic Details</p>
			</div>
			<div class="header-actions">
				{#if isRefreshing}
					<div class="silent-refresh-indicator">
						<span class="refresh-spinner"></span>
					</div>
				{/if}
				<button 
					class="student-refresh-btn" 
					onclick={handleRefresh} 
					disabled={isLoading}
					aria-label="Refresh profile data"
				>
					<span class="material-symbols-outlined">refresh</span>
				</button>
			</div>
		</div>

		<!-- Student Information Cards -->
		<div class="profile-info-section">
			<h2 class="section-title section-title-desktop">Student Information</h2>
			<button class="section-header-mobile" onclick={toggleStudentInfo} aria-label="Toggle student information">
				<h2 class="section-title">Student Information</h2>
				<span class="material-symbols-outlined collapse-icon" class:rotated={isStudentInfoCollapsed}>
					expand_more
				</span>
			</button>
			<div class="section-content" class:collapsed={isStudentInfoCollapsed}>
				{#if isLoading}
					<div class="profile-loading-container">
						<span class="profile-loader"></span>
						<p class="profile-loading-text">Loading student information...</p>
					</div>
				{:else}
				<!-- Row 1: 5 cards -->
				<div class="info-row row-five">
					<!-- Student ID Card -->
					<div class="info-card">
						<div class="info-icon">
							<span class="material-symbols-outlined">badge</span>
						</div>
						<div class="info-content">
							<div class="info-label">Student ID</div>
							<div class="info-value">{studentProfile.id}</div>
						</div>
					</div>

					<!-- Full Name Card -->
					<div class="info-card">
						<div class="info-icon">
							<span class="material-symbols-outlined">person</span>
						</div>
						<div class="info-content">
							<div class="info-label">Full Name</div>
							<div class="info-value">{studentProfile.name}</div>
						</div>
					</div>

					<!-- Year Level Card -->
					<div class="info-card">
						<div class="info-icon">
							<span class="material-symbols-outlined">school</span>
						</div>
						<div class="info-content">
							<div class="info-label">Year Level</div>
							<div class="info-value">{studentProfile.yearLevel}</div>
						</div>
					</div>

					<!-- Section Card -->
					<div class="info-card">
						<div class="info-icon">
							<span class="material-symbols-outlined">group</span>
						</div>
						<div class="info-content">
							<div class="info-label">Section</div>
							<div class="info-value">{studentProfile.section}</div>
						</div>
					</div>

					<!-- Total Subjects Card -->
					<div class="info-card">
						<div class="info-icon">
							<span class="material-symbols-outlined">menu_book</span>
						</div>
						<div class="info-content">
							<div class="info-label">Total Subjects</div>
							<div class="info-value">{totalSubjects}</div>
						</div>
					</div>
					
				</div>

				<!-- Row 2: 3 cards -->
				<div class="info-row row-three">
					<!-- Email Card -->
					<div class="info-card">
						<div class="info-icon">
							<span class="material-symbols-outlined">email</span>
						</div>
						<div class="info-content">
							<div class="info-label">Email</div>
							<div class="info-value">{studentProfile.email || 'Not provided'}</div>
						</div>
					</div>

					<!-- Contact Number Card -->
					<div class="info-card">
						<div class="info-icon">
							<span class="material-symbols-outlined">phone</span>
						</div>
						<div class="info-content">
							<div class="info-label">Contact Number</div>
							<div class="info-value">{studentProfile.phone || 'Not provided'}</div>
						</div>
					</div>

					<!-- Guardian Card -->
					<div class="info-card">
						<div class="info-icon">
							<span class="material-symbols-outlined">family_restroom</span>
						</div>
						<div class="info-content">
							<div class="info-label">Guardian</div>
							<div class="info-value">{studentProfile.guardian || 'Not provided'}</div>
						</div>
					</div>
				</div>

				<!-- Row 3: 1 card -->
				<div class="info-row row-one">
					<!-- Address Card -->
					<div class="info-card address-card">
						<div class="info-icon">
							<span class="material-symbols-outlined">home</span>
						</div>
						<div class="info-content">
							<div class="info-label">Address</div>
							<div class="info-value">{studentProfile.address || 'Not provided'}</div>
						</div>
					</div>
				</div>

				<!-- Row 4: 2 cards -->
				<div class="info-row row-two">
					<!-- Birth Date Card -->
					<div class="info-card">
						<div class="info-icon">
							<span class="material-symbols-outlined">cake</span>
						</div>
						<div class="info-content">
							<div class="info-label">Birth Date</div>
							<div class="info-value">{studentProfile.birthDate || 'Not provided'}</div>
						</div>
					</div>

					<!-- Age Card -->
					<div class="info-card">
						<div class="info-icon">
							<span class="material-symbols-outlined">person_outline</span>
						</div>
						<div class="info-content">
							<div class="info-label">Age</div>
							<div class="info-value">{studentProfile.age ? `${studentProfile.age} years old` : 'Not available'}</div>
						</div>
					</div>
				</div>
				{/if}
			</div>
		</div>

		<!-- Academic Performance Section -->
		<div class="profile-academic-section">
			<h2 class="section-title section-title-desktop">Academic Performance</h2>
			<button class="section-header-mobile" onclick={toggleAcademicPerformance} aria-label="Toggle academic performance">
				<h2 class="section-title">Academic Performance</h2>
				<span class="material-symbols-outlined collapse-icon" class:rotated={isAcademicPerformanceCollapsed}>
					expand_more
				</span>
			</button>
			<div class="section-content" class:collapsed={isAcademicPerformanceCollapsed}>
				{#if isLoading}
					<div class="profile-loading-container">
						<span class="profile-loader"></span>
						<p class="profile-loading-text">Loading academic performance...</p>
					</div>
				{:else}
				<!-- Academic Performance Row (3 cards) -->
				<div class="info-row row-three">	
					<div class="info-card">
						<div class="info-icon">
							<span class="material-symbols-outlined">person_outline</span>
						</div>
						<div class="info-content">
							<div class="info-label">Adviser</div>
							<div class="info-value">{studentProfile.academicSummary.adviser}</div>
						</div>
					</div>
					<!-- GPA Card -->
					<div class="info-card">
						<div class="info-icon">
							<span class="material-symbols-outlined">grade</span>
						</div>
						<div class="info-content">
							<div class="info-label">General Average</div>
							<div class="info-value">{studentProfile.academicSummary.gpa !== 'Not available' ? `${studentProfile.academicSummary.gpa}` : 'Not available'}</div>
						</div>
					</div>

					<!-- Class Rank Card -->
					<div class="info-card">
						<div class="info-icon">
							<span class="material-symbols-outlined">leaderboard</span>
						</div>
						<div class="info-content">
							<div class="info-label">Class Rank</div>
							<div class="info-value">{studentProfile.academicSummary.rank !== 'Not available' && studentProfile.academicSummary.totalStudents !== 'Not available' ? `${studentProfile.academicSummary.rank} of ${studentProfile.academicSummary.totalStudents}` : 'Not available'}</div>
						</div>
					</div>
				</div>
				{/if}
			</div>
		</div>

		<!-- Subjects Section -->
		<div class="profile-subjects-section">
			<h2 class="section-title section-title-desktop">Enrolled Subjects</h2>
			<button class="section-header-mobile" onclick={toggleEnrolledSubjects} aria-label="Toggle enrolled subjects">
				<h2 class="section-title">Enrolled Subjects</h2>
				<span class="material-symbols-outlined collapse-icon" class:rotated={isEnrolledSubjectsCollapsed}>
					expand_more
				</span>
			</button>
			<div class="section-content" class:collapsed={isEnrolledSubjectsCollapsed}>
				{#if isLoading}
					<div class="profile-loading-container">
						<span class="profile-loader"></span>
						<p class="profile-loading-text">Loading enrolled subjects...</p>
					</div>
				{:else if studentProfile.subjects.length > 0}
				<div class="subjects-grid">
					{#each studentProfile.subjects as subject (subject.id)}
						<div class="subject-card" style="border-color: {subject.color};">
							<!-- Subject Icon -->
							<div class="subject-icon-column">
								<div class="subject-icon" style="background-color: {subject.color}20; color: {subject.color}">
									<span class="material-symbols-outlined">book</span>
								</div>
							</div>
							
							<!-- Subject Details -->
							<div class="subject-details-column">
								<h3 class="subject-name">{subject.name}</h3>
								<p class="teacher-name">{subject.teacher}</p>
							</div>
						</div>
					{/each}
				</div>
			{:else}
					<div class="subjects-empty">
						<span class="material-symbols-outlined">menu_book</span>
						<p>No subjects enrolled yet</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Account Security Section -->
		<div class="profile-security-section">
			<h2 class="section-title section-title-desktop">Account Security</h2>
			<div class="section-content">
				<div class="info-row row-one">
					<div class="info-card security-card">
						<div class="info-content-container">
							<div class="info-icon">
								<span class="material-symbols-outlined">lock</span>
							</div>
							<div class="info-content">
								<div class="info-label">Password</div>
								<div class="info-value">Change your account password for security</div>
							</div>
						</div>
						<div class="security-actions">
							<button 
								class="security-action-button" 
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