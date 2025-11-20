<script>
	import AdminScheduleForm from './adminScheduleForm/adminScheduleForm.svelte';
	import AdminRoomForm from './adminRoomForm/adminRoomForm.svelte';
	import AdminSectionForm from './adminSectionForm/adminSectionForm.svelte';

	// Tab state management
	let activeTab = 'schedule'; // 'schedule', 'section', 'room'

	// Tab navigation functions
	function setActiveTab(tab) {
		activeTab = tab;
	}
</script>

<div class="scheduleassign-container">
	<!-- Header -->
	<div class="scheduleassign-header">
		<div class="scheduleassign-header-content">
			<h1 class="scheduleassign-page-title">Schedule Management</h1>
			<p class="scheduleassign-page-subtitle">
				Assign subjects and teachers to sections with specific time periods
			</p>
		</div>
		<div class="admin-tab-navigation">
			<button
				class="admin-tab-button"
				class:active={activeTab === 'schedule'}
				on:click={() => setActiveTab('schedule')}
			>
				<span class="material-icons">schedule</span>
				Schedule
			</button>
			<button
				class="admin-tab-button"
				class:active={activeTab === 'section'}
				on:click={() => setActiveTab('section')}
			>
				<span class="material-icons">groups</span>
				Section
			</button>
			<button
				class="admin-tab-button"
				class:active={activeTab === 'room'}
				on:click={() => setActiveTab('room')}
			>
				<span class="material-icons">meeting_room</span>
				Room
			</button>
		</div>
	</div>
	<div class="schedule-content-container">
		<!-- Schedule Tab Content -->
		{#if activeTab === 'schedule'}
			<AdminScheduleForm />
		{/if}

		<!-- Section Tab Content -->
		{#if activeTab === 'section'}
			<AdminSectionForm />
		{/if}

		<!-- Room Tab Content -->
		{#if activeTab === 'room'}
			<AdminRoomForm />
		{/if}
	</div>
</div>
