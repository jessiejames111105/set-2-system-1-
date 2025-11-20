<script>
	import { onMount } from 'svelte';
	import { authStore } from '../../../../login/js/auth.js';
	import { teacherScheduleStore } from '../../../../../lib/stores/teacher/teacherScheduleStore.js';
	import './teacherSchedule.css';

	// Get current date info
	const today = new Date();
	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'];
	const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const currentMonth = monthNames[today.getMonth()];
	const currentDay = today.getDate();
	const currentDayName = dayNames[today.getDay()];
	
	// Map day index to abbreviated day names for weekdays only
	const dayIndexToAbbrev = {
		1: 'Mon', // Monday
		2: 'Tue', // Tuesday
		3: 'Wed', // Wednesday
		4: 'Thu', // Thursday
		5: 'Fri'  // Friday
	};
	
	// Get current day abbreviation (default to Monday if weekend)
	const todayIndex = today.getDay();
	let selectedDay = dayIndexToAbbrev[todayIndex] || 'Mon'; // Default to Monday if weekend

	let currentTime = new Date();
	let timeInterval;

	// Subscribe to the store
	$: ({ scheduleData, isLoading, isRefreshing, error, lastUpdated } = $teacherScheduleStore);

	// Load schedule data on component mount
	onMount(async () => {
		// Get current user data from auth store
		const authState = $authStore;
		if (!authState.isAuthenticated || !authState.userData?.id) {
			console.error('User not authenticated');
			return;
		}

		const teacherId = authState.userData.id;
		
		// Try to initialize with cached data first
		const hasCachedData = teacherScheduleStore.init(teacherId, null);
		
		// Always load fresh data (silently if we have cached data)
		await teacherScheduleStore.loadSchedule(teacherId, null, hasCachedData);
		
		// Set up periodic refresh every 5 minutes
		const refreshInterval = setInterval(async () => {
			await teacherScheduleStore.loadSchedule(teacherId, null, true); // Silent refresh
		}, 5 * 60 * 1000); // 5 minutes

		// Set up time update every minute
		timeInterval = setInterval(() => {
			currentTime = new Date();
		}, 60000); // 1 minute

		// Cleanup intervals on component destroy
		return () => {
			clearInterval(refreshInterval);
			clearInterval(timeInterval);
		};
	});

	// Manual refresh function
	async function handleRefresh() {
		const authState = $authStore;
		if (!authState.isAuthenticated || !authState.userData?.id) {
			console.error('User not authenticated');
			return;
		}

		const teacherId = authState.userData.id;
		await teacherScheduleStore.forceRefresh(teacherId, null);
	}

	// Map day abbreviations to full names
	const dayNameMap = {
		Mon: 'Monday',
		Tue: 'Tuesday', 
		Wed: 'Wednesday',
		Thu: 'Thursday',
		Fri: 'Friday'
	};

	// Week days for navigation
	const weekDays = [
		{ day: 'Mon' },
		{ day: 'Tue' },
		{ day: 'Wed' },
		{ day: 'Thu' },
		{ day: 'Fri' }
	];

	// Reactive statements
	$: currentClasses = scheduleData[selectedDay] || [];
	$: fullDayName = dayNameMap[selectedDay] || 'Monday';
	// Use the live currentTime (updates every minute) to compute whether the selected day is today
	$: currentWeekdayAbbrev = dayIndexToAbbrev[currentTime.getDay()];
	$: isToday = currentWeekdayAbbrev === selectedDay;
	
	// Add animation key to trigger re-render on day change
	let animationKey = 0;
	$: {
		// Increment key whenever selectedDay changes to trigger animation
		selectedDay;
		animationKey++;
	}

	// Dropdown state
	let isDropdownOpen = false;

	// Close dropdown when clicking outside
	function handleClickOutside(event) {
		if (!event.target.closest('.teacher-mobile-dropdown')) {
			isDropdownOpen = false;
		}
	}

	// Toggle dropdown
	function toggleDropdown() {
		isDropdownOpen = !isDropdownOpen;
	}
	
	// Select day and close dropdown
	function selectDay(day) {
		selectedDay = day;
		isDropdownOpen = false;
	}

	// Check if current time is within class time
	function isCurrentClass(timeString) {
		if (!isToday || !timeString) return false;
		// Normalize NBSP and different dash characters
		const normalized = timeString.replace(/\u00A0/g, ' ').trim();
		const dashMatch = normalized.match(/(.*?)\s*[-–—]\s*(.*)/);
		let startStr, endStr;
		if (dashMatch) {
			startStr = dashMatch[1];
			endStr = dashMatch[2];
		} else {
			const parts = normalized.split(' - ');
			if (parts.length === 2) {
				startStr = parts[0];
				endStr = parts[1];
			} else {
				return false;
			}
		}
		startStr = startStr.trim();
		endStr = endStr.trim();
		if (!startStr || !endStr) return false;
		const startMinutes = parseTimeToMinutes(startStr);
		const endMinutes = parseTimeToMinutes(endStr);
		const now = currentTime;
		const nowMinutes = now.getHours() * 60 + now.getMinutes();
		return nowMinutes >= startMinutes && nowMinutes < endMinutes;
	}

	// Parse time string to minutes since midnight
	function parseTimeToMinutes(timeStr) {
		const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
		if (!match) return 0;
		let hours = parseInt(match[1]);
		const minutes = parseInt(match[2]);
		const ampm = match[3].toUpperCase();
		if (ampm === 'PM' && hours !== 12) hours += 12;
		if (ampm === 'AM' && hours === 12) hours = 0;
		return hours * 60 + minutes;
	}
</script>

<div class="schedule-container" on:click={handleClickOutside} on:keydown={handleClickOutside} role="button" tabindex="0">
	<div class="schedule-schedule-header">
		<h1 class="schedule-page-title">Teaching Schedule</h1>
		<p class="schedule-page-subtitle">Your weekly teaching schedule</p>
	</div>

	<div class="week-navigation">
		<div class="week-title">
			<span>{currentDayName}, {currentMonth} {currentDay}</span>
		</div>

		<div class="schedule-day-selector">
			{#each weekDays as { day }}
				<button 
					class="schedule-day-btn {day === selectedDay ? 'active' : ''}"
					on:click={() => selectDay(day)}
				>
					<div class="day-name">{day}</div>
					<div class="day-name-full">{dayNameMap[day]}</div>
				</button>
			{/each}
		</div>
		
		<!-- Mobile Dropdown -->
		<div class="teacher-mobile-dropdown">
			<button class="teacher-dropdown-toggle-date" on:click={toggleDropdown}>
				<span>{dayNameMap[selectedDay] || 'Select Day'}</span>
				<span class="material-symbols-outlined teacher-dropdown-icon {isDropdownOpen ? 'open' : ''}">
					expand_more
				</span>
			</button>
			
			{#if isDropdownOpen}
				<div class="teacher-dropdown-menu">
					{#each weekDays as { day }}
						<button 
							class="teacher-dropdown-item {day === selectedDay ? 'selected' : ''}"
							on:click={() => selectDay(day)}
						>
							{dayNameMap[day]}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<div class="classes-section">
		<div class="classes-header">
			<h2>{fullDayName} Classes</h2>
			<div class="refresh-controls">
				<button class="refresh-button" on:click={handleRefresh} disabled={isLoading}>
					<span class="material-symbols-outlined">refresh</span>
				</button>
			</div>
		</div>
		
		{#if isLoading}
			<div class="loading-message">
				<div class="system-loader"></div>
				<p>Loading Schedule...</p>
			</div>
		{:else if error}
			<div class="error-message">
				<div class="error-icon">
					<span class="material-symbols-outlined">error</span>
				</div>
				<h3>Error Loading Schedule</h3>
				<p>{error}</p>
				<button class="retry-button" on:click={handleRefresh}>
					<span class="material-symbols-outlined">refresh</span>
					Try Again
				</button>
			</div>
		{:else if currentClasses.length > 0}
			{#key animationKey}
				<div class="schedule-classes-grid">
					{#each currentClasses as classItem, index}
						<div class="schedule-class-card {classItem.color} {isCurrentClass(classItem.time) ? 'current' : ''}" style="--card-index: {index};">
							<div class="class-header">
								<h3 class="schedule-class-name">{classItem.name}</h3>
								<span class="schedule-class-time">{classItem.time}</span>
							</div>
							
							<div class="class-details">
								{#if classItem.scheduleType === 'vacant'}
									<div class="schedule-class-location">
										<span class="material-symbols-outlined">schedule</span>
										<span>Available Time</span>
									</div>
								{:else}
									<div class="schedule-class-location">
										<span class="material-symbols-outlined"> location_on</span>
										<span>{classItem.room}</span>
									</div>
									{#if classItem.subject}
										<div class="schedule-class-teacher">
											<span class="material-symbols-outlined"> book </span>
											<span>{classItem.subject}</span>
										</div>
									{/if}
									{#if classItem.gradeLevel && classItem.scheduleType === 'subject'}
										<div class="schedule-class-grade">
											<span class="material-symbols-outlined"> school </span>
											<span>Grade {classItem.gradeLevel}</span>
										</div>
									{/if}
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/key}
		{:else}
			<div class="no-classes-message">
				<div class="no-classes-icon">
					<span class="material-symbols-outlined">event_available</span>
				</div>
				<h3>No Classes Scheduled</h3>
				<p>You don't have any classes scheduled for {fullDayName}. Enjoy your free day!</p>
			</div>
		{/if}
	</div>
</div>