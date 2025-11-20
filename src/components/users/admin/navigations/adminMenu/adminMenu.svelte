<script>
	import './adminMenu.css';
	// Props
	let {
		adminActiveSection = $bindable('dashboard'),
		adminNavRailVisible = true,
		onnavigate
	} = $props();

	// Folder state
	let managementFolderExpanded = $state(false);

	// Navigation items with folder structure
	const navigationItems = [
		{
			id: 'dashboard',
			label: 'Dashboard',
			icon: 'dashboard',
			type: 'item'
		},
		{
			id: 'management-folder',
			label: 'Management',
			icon: 'folder',
			type: 'folder',
			items: [
				{
					id: 'schedule-management',
					label: 'Schedule',
					icon: 'schedule'
				},
				{
					id: 'department-management',
					label: 'Department',
					icon: 'corporate_fare'
				},
				{
					id: 'subjects-and-activities',
					label: 'Subjects & Activities',
					icon: 'school'
				}
			]
		},
		{
			id: 'account-creation',
			label: 'Account Creation',
			icon: 'person_add',
			type: 'item'
		},
		{
			id: 'document-requests',
			label: 'Document Requests',
			icon: 'description',
			type: 'item'
		},
		{
			id: 'student-masterlist',
			label: 'Student Masterlist',
			icon: 'groups',
			type: 'item'
		},
		{
			id: 'teacher-masterlist',
			label: 'Teacher Masterlist',
			icon: 'school',
			type: 'item'
		},
		{
			id: 'student-grades-list',
			label: 'Student Grades List',
			icon: 'grade',
			type: 'item'
		},
		{
			id: 'archived-accounts',
			label: 'Archived Accounts',
			icon: 'archive',
			type: 'item'
		}
	];

	// Handle navigation
	function handleNavigation(sectionId) {
		adminActiveSection = sectionId;
		// Call the parent's navigation handler
		if (onnavigate) {
			onnavigate({ detail: { section: sectionId } });
		}
	}

	// Handle folder toggle
	function toggleFolder(folderId) {
		if (folderId === 'management-folder') {
			managementFolderExpanded = !managementFolderExpanded;
		}
	}

	// Check if any item in folder is active
	function isFolderActive(folder) {
		return folder.items?.some((item) => item.id === adminActiveSection) || false;
	}
</script>

<!-- Navigation Rail (Desktop) -->
<nav
	class="admin-menu-navigation-rail"
	class:collapsed={!adminNavRailVisible}
	aria-label="Admin portal navigation"
>
	<div class="admin-menu-rail-container">
		{#each navigationItems as item (item.id)}
			{#if item.type === 'folder'}
				<!-- Folder item -->
				<button
					class="admin-menu-rail-item admin-menu-folder"
					class:active={isFolderActive(item)}
					class:expanded={managementFolderExpanded}
					onclick={() => toggleFolder(item.id)}
					aria-label={item.label}
					aria-expanded={managementFolderExpanded}
				>
					<div class="admin-menu-rail-icon-container">
						<span class="material-symbols-outlined admin-menu-rail-icon">
							{managementFolderExpanded ? 'folder_open' : 'folder'}
						</span>
					</div>
					<span class="admin-menu-rail-label">{item.label}</span>
				</button>

				<!-- Folder contents -->
				{#if managementFolderExpanded}
					<div class="admin-menu-folder-contents">
						{#each item.items as subItem (subItem.id)}
							<button
								class="admin-menu-rail-item admin-menu-sub-item"
								class:active={subItem.id === adminActiveSection}
								onclick={() => handleNavigation(subItem.id)}
								aria-label={subItem.label}
								aria-current={subItem.id === adminActiveSection ? 'page' : undefined}
							>
								<div class="admin-menu-rail-icon-container">
									<span class="material-symbols-outlined admin-menu-rail-icon">
										{subItem.icon}
									</span>
								</div>
								<span class="admin-menu-rail-label">{subItem.label}</span>
							</button>
						{/each}
					</div>
				{/if}
			{:else}
				<!-- Regular item -->
				<button
					class="admin-menu-rail-item"
					class:active={item.id === adminActiveSection}
					onclick={() => handleNavigation(item.id)}
					aria-label={item.label}
					aria-current={item.id === adminActiveSection ? 'page' : undefined}
				>
					<div class="admin-menu-rail-icon-container">
						<span class="material-symbols-outlined admin-menu-rail-icon">
							{item.icon}
						</span>
					</div>
					<span class="admin-menu-rail-label">{item.label}</span>
				</button>
			{/if}
		{/each}
	</div>
</nav>

<!-- Bottom Navigation (Mobile) -->
<nav class="admin-menu-bottom-navigation" aria-label="Admin portal navigation">
	<div class="admin-menu-nav-container">
		<!-- Navigation items -->
		{#each navigationItems as item (item.id)}
			{#if item.type === 'folder'}
				<!-- Folder item for mobile -->
				<button
					class="admin-menu-nav-item admin-menu-folder"
					class:active={isFolderActive(item)}
					onclick={() => toggleFolder(item.id)}
					aria-label={item.label}
					aria-expanded={managementFolderExpanded}
				>
					<div class="admin-menu-nav-icon-container">
						<span class="material-symbols-outlined admin-menu-nav-icon">
							{managementFolderExpanded ? 'folder_open' : 'folder'}
						</span>
					</div>
				</button>
			{:else}
				<!-- Regular item for mobile -->
				<button
					class="admin-menu-nav-item"
					class:active={item.id === adminActiveSection}
					onclick={() => handleNavigation(item.id)}
					aria-label={item.label}
					aria-current={item.id === adminActiveSection ? 'page' : undefined}
				>
					<div class="admin-menu-nav-icon-container">
						<span class="material-symbols-outlined admin-menu-nav-icon">
							{item.icon}
						</span>
					</div>
				</button>
			{/if}
		{/each}

		<!-- Mobile folder overlay -->
		{#if managementFolderExpanded}
			<div
				class="admin-menu-mobile-folder-overlay"
				onclick={() => toggleFolder('management-folder')}
				onkeydown={(e) => e.key === 'Enter' || e.key === ' ' ? toggleFolder('management-folder') : null}
				role="button"
				tabindex="0"
				aria-label="Close management folder"
			>
				<div 
					class="admin-menu-mobile-folder-content" 
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
					role="dialog"
					aria-label="Management folder menu"
					tabindex="-1"
				>
					<div class="admin-menu-mobile-folder-header">
						<h3>Management</h3>
						<button
							class="admin-menu-close-folder"
							onclick={() => toggleFolder('management-folder')}
						>
							<span class="material-symbols-outlined">close</span>
						</button>
					</div>
					<div class="admin-menu-mobile-folder-items">
						{#each navigationItems.find((item) => item.id === 'management-folder')?.items || [] as subItem (subItem.id)}
							<button
								class="admin-menu-mobile-folder-item"
								class:active={subItem.id === adminActiveSection}
								onclick={() => {
									handleNavigation(subItem.id);
									toggleFolder('management-folder');
								}}
							>
								<span class="material-symbols-outlined">{subItem.icon}</span>
								<span>{subItem.label}</span>
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>
</nav>
