<script>
	import './studentNavbar.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { showSuccess } from '../../../../common/js/toastStore.js';
	import { authenticatedFetch } from '../../../../../routes/api/helper/api-helper.js';
	import { authStore } from '../../../../login/js/auth.js';
	import { studentNotificationStore } from '../../../../../lib/stores/student/studentNotificationStore.js';

	// Props
	let { studentName = 'John Does', firstName = 'John', gender = 'male', accountNumber = 'STU-2025-0001', profileImage = null, onlogout, onToggleNavRail, onnavigate, onNavigateToSettings } = $props();

	// Notification state from shared store
	let unreadNotificationCount = $derived($studentNotificationStore.unreadCount);

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
	let displayName = $derived(`${getTitle(gender)} ${extractLastName(studentName)}`);

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

	// Fetch notification count and update store
	async function fetchNotificationCount() {
		if (!browser) return;
		
		const authState = $authStore;
		if (!authState.isAuthenticated || !authState.userData?.id) return;
		
		try {
			// Use the store's loadNotifications method with silent refresh
			await studentNotificationStore.loadNotifications(authState.userData.id, 'all', true);
		} catch (err) {
			console.error('Error fetching notification count:', err);
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

		// Wait for auth store to be initialized before fetching notifications
		let unsubscribe;
		unsubscribe = authStore.subscribe((authState) => {
			if (authState.isAuthenticated) {
				fetchNotificationCount();
				if (unsubscribe) {
					unsubscribe();
				}
			}
		});

		// Refresh notification count every 10 seconds
		const interval = setInterval(() => {
			if ($authStore.isAuthenticated) {
				fetchNotificationCount();
			}
		}, 10000);

		// Cleanup
		return () => {
			document.removeEventListener('click', handleClickOutside);
			clearInterval(interval);
			if (unsubscribe) unsubscribe();
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

<nav class="student-navbar">
	<div class="navbar-container">
		<!-- Left section - Hamburger menu and Logo/Title -->
		<div class="navbar-left">
			<!-- Hamburger menu button (desktop only) -->
			<button 
				class="icon-button hamburger-menu" 
				onclick={onToggleNavRail}
				aria-label="Toggle navigation menu"
			>
				<span class="material-symbols-outlined">menu</span>
			</button>
			
			<div class="logo-section">
				<span class="material-symbols-outlined logo-icon">school</span>
				<span class="app-title">Welcome, {displayName}</span>
			</div>
		</div>

		<!-- Right section - User info and controls -->
		<div class="navbar-right">
			<!-- Dark mode toggle -->
			<button 
				class="icon-button dark-mode-toggle" 
				onclick={toggleDarkMode}
				aria-label="Toggle dark mode"
			>
				<span class="material-symbols-outlined">
					{isDarkMode ? 'light_mode' : 'dark_mode'}
				</span>
			</button>

			<!-- Notifications button -->
			<button 
				class="icon-button notifications-button" 
				onclick={() => onnavigate('notifications')}
				aria-label="Notifications"
			>
				<span class="material-symbols-outlined">notifications</span>
				{#if unreadNotificationCount > 0}
					<span class="navbar-notification-badge">
						{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
					</span>
				{/if}
			</button>

			<!-- User profile section with dropdown -->
			<div class="user-profile-container">
				<button class="user-profile" onclick={toggleDropdown}>
					<div class="user-info">
						<span class="user-name">{studentName}</span>
						<span class="user-id">Account: {accountNumber}</span>
					</div>
					
					<div class="user-avatar">
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
					<div class="user-dropdown-menu">
						<button class="dropdown-item" onclick={() => { closeDropdown(); onnavigate('profile'); }}>
							<span class="material-symbols-outlined">person</span>
							Profile
						</button>
						<button class="dropdown-item" onclick={async () => { closeDropdown(); await onlogout(); showSuccess('Logged out successfully. See you next time!'); }}>
							<span class="material-symbols-outlined">logout</span>
							Logout
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</nav>