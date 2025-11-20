<script>
	import './teacherNavbar.css';
	import { onMount } from 'svelte';
	import { showSuccess } from '../../../../common/js/toastStore.js';

	// Props
	let { teacherName = 'John Does', firstName = 'John', gender = 'male', accountNumber = 'TCH-2025-0001', profileImage = null, onlogout, onToggleNavRail, onnavigate } = $props();

	// Function to get title based on gender
	function getTitle(gender) {
		return gender === 'female' ? 'Ms.' : 'Mr.';
	}

	// Helper: extract last name from full name
	function extractLastName(fullName) {
		if (!fullName) return '';
		if (fullName.includes(',')) return fullName.split(',')[0].trim();
		const parts = fullName.trim().split(' ');
		return parts.length > 1 ? parts[parts.length - 1] : parts[0];
	}

	// Computed display name with title (uses last name from full name)
	let displayName = $derived(`${getTitle(gender)} ${extractLastName(teacherName)}`);

	// Theme state (default to dark mode)
	let isDarkMode = $state(true);

	// Dropdown state
	let isDropdownOpen = $state(false);

	// Toggle dropdown
	function toggleDropdown() {
		isDropdownOpen = !isDropdownOpen;
	}

	// Close dropdown when clicking outside
	function closeDropdown() {
		isDropdownOpen = false;
	}



	// Handle click outside to close dropdown
	function handleClickOutside(event) {
		if (isDropdownOpen && !event.target.closest('.user-profile-container')) {
			closeDropdown();
		}
	}

	// Add event listener for click outside
	onMount(() => {
		const savedTheme = localStorage.getItem('theme');
		
		// Default to dark mode if no saved preference
		isDarkMode = savedTheme !== 'light';
		updateTheme();

		// Add click outside listener
		document.addEventListener('click', handleClickOutside);

		// Cleanup
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

	// Toggle theme mode
	function toggleDarkMode() {
		isDarkMode = !isDarkMode;
		updateTheme();
	}

	// Update theme
	function updateTheme() {
		if (isDarkMode) {
			document.documentElement.setAttribute('data-theme', 'dark');
			localStorage.setItem('theme', 'dark');
			// Update theme-color for PWA
			updateThemeColor('#121212');
		} else {
			document.documentElement.setAttribute('data-theme', 'light');
			localStorage.setItem('theme', 'light');
			// Update theme-color for PWA
			updateThemeColor('#FFFFFF');
		}
	}

	// Update theme-color meta tag for PWA
	function updateThemeColor(color) {
		let metaThemeColor = document.querySelector('meta[name="theme-color"]:not([media])');
		if (!metaThemeColor) {
			metaThemeColor = document.createElement('meta');
			metaThemeColor.setAttribute('name', 'theme-color');
			document.head.appendChild(metaThemeColor);
		}
		metaThemeColor.setAttribute('content', color);
	}

	// Get initials for avatar
	function getInitials(name) {
		return name
			.split(' ')
			.map(word => word.charAt(0))
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}
</script>

<nav class="teacher-navbar" aria-label="Teacher navigation">
	<div class="teacher-navbar-container">
		<!-- Left section - Hamburger menu and Logo/Title -->
		<div class="teacher-navbar-left">
			<!-- Hamburger menu button (desktop only) -->
			<button 
				class="teacher-navbar-icon-button hamburger-menu" 
				onclick={onToggleNavRail}
				aria-label="Toggle navigation menu"
			>
				<span class="material-symbols-outlined">menu</span>
			</button>
			
			<div class="logo-section">
				<span class="material-symbols-outlined logo-icon">person_book</span>
				<span class="app-title">Welcome, {displayName}</span>
			</div>
		</div>

		<!-- Right section - User info and controls -->
		<div class="teacher-navbar-right">
			<!-- Dark mode toggle -->
			<button 
				class="teacher-navbar-icon-button dark-mode-toggle" 
				onclick={toggleDarkMode}
				aria-label="Toggle dark mode"
			>
				<span class="material-symbols-outlined">
					{isDarkMode ? 'light_mode' : 'dark_mode'}
				</span>
			</button>

			<!-- User profile section with dropdown -->
			<div class="user-profile-container">
				<button class="teacher-navbar-user-profile" onclick={toggleDropdown}>
					<div class="teacher-navbar-user-info">
						<span class="teacher-navbar-user-name">{teacherName}</span>
				<span class="user-id">Account: {accountNumber}</span>
					</div>
					
					<div class="teacher-navbar-user-avatar">
						{#if profileImage}
							<img src={profileImage} alt="Profile" class="avatar-image" />
						{:else}
							<div class="avatar-placeholder">
				{getInitials(firstName)}
			</div>
						{/if}
					</div>
				</button>

				<!-- Dropdown menu -->
				{#if isDropdownOpen}
					<div class="teacher-navbar-dropdown-menu">
						<button class="teacher-navbar-dropdown-item" onclick={() => { closeDropdown(); onnavigate('profile'); }}>
							<span class="material-symbols-outlined">person</span>
							Profile
						</button>
						<button class="teacher-navbar-dropdown-item" onclick={async () => { closeDropdown(); await onlogout(); showSuccess('Logged out successfully. See you next time!'); }}>
							<span class="material-symbols-outlined">logout</span>
							Logout
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</nav>