<script>
	import './teacherMenu.css';
	import { api } from '../../../../../routes/api/helper/api-helper.js';
	// Props
	let { teacherActiveSection = $bindable('schedule'), teacherNavRailVisible = true, onnavigate, teacherId } = $props();

	// Navigation items
	const allNavigationItems = [
		{
			id: 'schedule',
			label: 'Schedule',
			icon: 'schedule'
		},
		{
			id: 'students',
			label: 'Class Management',
			icon: 'group'
		},
		{
			id: 'advisory',
			label: 'Advisory Class',
			icon: 'supervisor_account'
		}
	];

	// Check if teacher has advisory class
	let hasAdvisory = $state(false);
	let advisoryChecked = $state(false);

	$effect(() => {
		if (teacherId && !advisoryChecked) {
			checkAdvisoryStatus();
		}
	});

	async function checkAdvisoryStatus() {
		try {
			const response = await api.get(`/api/teacher-advisory?teacher_id=${teacherId}`);
			hasAdvisory = response.success && response.data.advisoryData !== null;
		} catch (error) {
			console.error('Error checking advisory status:', error);
			hasAdvisory = false;
		} finally {
			advisoryChecked = true;
		}
	}

	// Filter navigation items based on advisory status
	let navigationItems = $derived(
		allNavigationItems.filter(item => item.id !== 'advisory' || hasAdvisory)
	);

	// Handle navigation
	function handleNavigation(sectionId) {
		teacherActiveSection = sectionId;
		// Call the parent's navigation handler
		if (onnavigate) {
			onnavigate({ detail: { section: sectionId } });
		}
	}
</script>

<!-- Navigation Rail (Desktop) -->
<nav class="teacher-menu-navigation-rail" class:collapsed={!teacherNavRailVisible} aria-label="Teacher portal navigation">
	<div class="teacher-menu-rail-container">
		{#each navigationItems as item (item.id)}
			<button 
				class="teacher-menu-rail-item" 
				class:active={item.id === teacherActiveSection}
				onclick={() => handleNavigation(item.id)}
				aria-label={item.label}
				aria-current={item.id === teacherActiveSection ? 'page' : undefined}
			>
				<div class="teacher-menu-rail-icon-container">
					<span class="material-symbols-outlined teacher-menu-rail-icon">
						{item.icon}
					</span>
				</div>
				<span class="teacher-menu-rail-label">{item.label}</span>
			</button>
		{/each}
	</div>
</nav>

<!-- Bottom Navigation (Mobile) -->
<nav class="teacher-menu-bottom-navigation" aria-label="Teacher portal navigation">
	<div class="teacher-menu-nav-container">
		<!-- Navigation items -->
		{#each navigationItems as item (item.id)}
			<button 
				class="teacher-menu-nav-item" 
				class:active={item.id === teacherActiveSection}
				onclick={() => handleNavigation(item.id)}
				aria-label={item.label}
				aria-current={item.id === teacherActiveSection ? 'page' : undefined}
			>
				<div class="teacher-menu-nav-icon-container">
					<span class="material-symbols-outlined teacher-menu-nav-icon">
						{item.icon}
					</span>
				</div>
			</button>
		{/each}
	</div>
</nav>