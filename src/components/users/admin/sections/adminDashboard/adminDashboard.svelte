<script>
	import './adminDashboard.css';
	import { onMount } from 'svelte';
	import { api } from '../../../../../routes/api/helper/api-helper.js';
	import { dashboardStore } from '../../../../../lib/stores/admin/dashboardStore.js';
	import DynamicDonutChart from './adminDashboardCharts/DynamicDonutChart.svelte';
	import SectionsPerGradeLevelChart from './adminDashboardCharts/SectionsPerGradeLevelChart.svelte';

	// Subscribe to dashboard store
	$: ({ data: dashboardStats, isLoading: statsLoading, error: statsError } = $dashboardStore);

	// Local state for activity logs (replacing activityLogsStore)
	let recentActivities = [];
	let activitiesLoading = false;
	let activitiesError = null;

	// Array of border color classes for each stat card
	const borderColors = ['border-blue', 'border-green', 'border-orange', 'border-purple'];

	// Function to get border color by index
	function getBorderColorByIndex(index) {
		return borderColors[index % borderColors.length];
	}

	// Fetch dashboard statistics from API
	async function fetchDashboardStats(silent = false) {
		try {
			if (!silent) {
				dashboardStore.setLoading(true);
			}

			const data = await api.get('/api/dashboard');

			if (data.success) {
				// Update the stats with real data
				const newStats = [
					{
						id: 'students',
						label: 'Total Students',
						value: data.data.students.toLocaleString(),
						icon: 'school',
						color: 'primary'
					},
					{
						id: 'teachers',
						label: 'Total Teachers',
						value: data.data.teachers.toLocaleString(),
						icon: 'person',
						color: 'primary'
					},
					{
						id: 'sections',
						label: 'Total Sections',
						value: data.data.sections.toLocaleString(),
						icon: 'class',
						color: 'primary'
					},
					{
						id: 'rooms',
						label: 'Total Rooms',
						value: data.data.rooms.toLocaleString(),
						icon: 'meeting_room',
						color: 'primary'
					}
				];

				dashboardStore.updateData(newStats);
			} else {
				throw new Error(data.error || 'Failed to fetch dashboard statistics');
			}
		} catch (error) {
			console.error('Error fetching dashboard statistics:', error);
			dashboardStore.setError(error.message);
		}
	}

	// Fetch chart data - Students per grade
	async function fetchStudentsPerGrade(silent = false) {
		try {
			if (!silent) {
				dashboardStore.setChartLoading('studentsPerGrade', true);
			}

			const response = await api.get('/api/dashboard/students-per-grade');

			if (response.success) {
				dashboardStore.updateChartData('studentsPerGrade', response.data);
			} else {
				throw new Error(response.error || 'Failed to fetch students per grade data');
			}
		} catch (error) {
			console.error('Error fetching students per grade:', error);
			dashboardStore.setChartError('studentsPerGrade', error.message);
		}
	}

	// Fetch chart data - Sections per grade
	async function fetchSectionsPerGrade(silent = false) {
		try {
			if (!silent) {
				dashboardStore.setChartLoading('sectionsPerGrade', true);
			}

			const response = await api.get('/api/dashboard/sections-per-grade');

			if (response.success) {
				dashboardStore.updateChartData('sectionsPerGrade', response.data);
			} else {
				throw new Error(response.error || 'Failed to fetch sections per grade data');
			}
		} catch (error) {
			console.error('Error fetching sections per grade:', error);
			dashboardStore.setChartError('sectionsPerGrade', error.message);
		}
	}

	// Fetch recent activities from API
	async function fetchRecentActivities(silent = false) {
		try {
			if (!silent) {
				activitiesLoading = true;
				activitiesError = null;
			}

			const data = await api.get('/api/activity-logs');

			if (data.success) {
				recentActivities = data.activities;
			} else {
				throw new Error(data.error || 'Failed to fetch activities');
			}
		} catch (error) {
			console.error('Error fetching activities:', error);
			activitiesError = error.message;
		} finally {
			activitiesLoading = false;
		}
	}

	// Load activities and statistics on component mount
	onMount(() => {
		// Initialize dashboard store with cached data (instant load)
		const cachedData = dashboardStore.getCachedData();
		if (cachedData) {
			dashboardStore.init(cachedData);
		}

		// Initialize chart data with cached data
		const cachedStudentsChart = dashboardStore.getCachedChartData('studentsPerGrade');
		if (cachedStudentsChart) {
			dashboardStore.initChartData('studentsPerGrade', cachedStudentsChart);
		}

		const cachedSectionsChart = dashboardStore.getCachedChartData('sectionsPerGrade');
		if (cachedSectionsChart) {
			dashboardStore.initChartData('sectionsPerGrade', cachedSectionsChart);
		}

		// Fetch fresh data (silent if we have cache, visible loading if not)
		fetchDashboardStats(!!cachedData);
		fetchStudentsPerGrade(!!cachedStudentsChart);
		fetchSectionsPerGrade(!!cachedSectionsChart);
		fetchRecentActivities(false); // Always show loading for activity logs

		// Set up periodic silent refresh every 30 seconds
		const refreshInterval = setInterval(() => {
			fetchDashboardStats(true); // Always silent for periodic refresh
			fetchStudentsPerGrade(true); // Always silent for periodic refresh
			fetchSectionsPerGrade(true); // Always silent for periodic refresh
			fetchRecentActivities(true); // Always silent for periodic refresh
		}, 30000);

		// Cleanup interval on component destroy
		return () => {
			clearInterval(refreshInterval);
		};
	});
</script>

<div class="dashboard-container">
	<!-- Header -->
	<div class="dashboard-header">
		<div class="header-content">
			<h1 class="page-title">Admin Dashboard</h1>
			<p class="page-subtitle">Overview of school management system statistics</p>
		</div>
	</div>

	<!-- Statistics Section -->
	<div class="stats-section">
		{#if statsError}
			<div class="stats-error">
				<span class="material-symbols-outlined">error</span>
				<p>Error loading statistics: {statsError}</p>
				<button class="retry-button" on:click={() => fetchDashboardStats(false)}>
					<span class="material-symbols-outlined">refresh</span>
					Retry
				</button>
			</div>
		{:else}
			<div class="stats-grid">
				{#each dashboardStats as stat, index (stat.id)}
				<div class="stat-card {getBorderColorByIndex(index)}">
						<div class="stat-card-header">
							<p class="stat-label">{stat.label}</p>
							<div class="dashboard-stat-icon">
								<span class="material-symbols-outlined">{stat.icon}</span>
							</div>
						</div>
						<div class="stat-card-content">
							<h3 class="stat-card-value">
								{#if statsLoading}
									Loading...
								{:else}
									{stat.value}
								{/if}
							</h3>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="graph-row">
		<div class="accounts-stats-container">
			<DynamicDonutChart />
		</div>
		<div class="average-grades-stats-container">
			<SectionsPerGradeLevelChart />
		</div>
	</div>

	<!-- Recent Activities Section -->
	<div class="activities-section">
		<div class="section-header">
			<h2 class="section-title">Activity Logs</h2>
			<button
				class="refresh-button"
				on:click={() => fetchRecentActivities(false)}
				disabled={activitiesLoading}
				title="Refresh activity logs"
			>
				<span class="material-symbols-outlined">refresh</span>
				Refresh
			</button>
		</div>

		<div class="activities-list">
			{#if activitiesLoading}
				<div class="activities-loading">
					<div class="system-loader"></div>
					<p>Loading recent activities...</p>
				</div>
			{:else if activitiesError}
				<div class="activities-error">
					<span class="material-symbols-outlined error-icon">error</span>
					<p>Error loading activities: {activitiesError}</p>
				</div>
			{:else if recentActivities.length === 0}
				<div class="activities-empty">
					<span class="material-symbols-outlined">inbox</span>
					<p>No recent activities found</p>
				</div>
			{:else}
				{#each recentActivities as activity (activity.id)}
					<div class="activity-item">
						<div class="activity-icon">
							<span class="material-symbols-outlined">{activity.icon}</span>
						</div>
						<div class="activity-content">
							<p class="activity-message">{activity.message}</p>
							{#if activity.performed_by && activity.performed_by !== 'System'}
								<p class="activity-user">{activity.performed_by}</p>
							{/if}
						</div>
						<span class="activity-timestamp">{activity.timestamp}</span>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>
