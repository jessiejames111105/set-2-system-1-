<script>
	import './adminRoomForm.css';
	import { toastStore } from '../../../../../common/js/toastStore.js';
	import { modalStore } from '../../../../../common/js/modalStore.js';
	import { api } from '../../../../../../routes/api/helper/api-helper.js';
	import { roomManagementStore } from '../../../../../../lib/stores/admin/roomManagementStore.js';
	import { onMount } from 'svelte';

	// Subscribe to room management store
	$: ({
		rooms: existingRooms,
		availableSections,
		isLoading,
		error: storeError
	} = $roomManagementStore);

	// Room management state
	let isCreating = false;
	let roomsSearchTerm = '';

	// Room creation state
	let roomName = '';
	let building = '';
	let floor = '';

	// Edit room states
	let editingRoomId = null;
	let editRoomName = '';
	let editBuilding = '';
	let editFloor = '';
	let isUpdating = false;

	// Assign room states (for inline assignment)
	let assigningRoomId = null;
	let assignSelectedSection = '';
	let isAssigningInline = false;
	let isAssignSectionDropdownOpen = false;
	let assignSectionSearchTerm = '';

	// Load rooms data from API
	async function loadRooms(silent = false) {
		try {
			if (!silent) {
				roomManagementStore.setLoading(true);
			}

			const data = await api.get('/api/rooms');

			if (data.success) {
				roomManagementStore.updateRooms(data.data || []);
			} else {
				throw new Error(data.message || 'Failed to load rooms');
			}
		} catch (error) {
			console.error('Error loading rooms:', error);
			roomManagementStore.setError('Failed to load rooms. Please try again.');
			toastStore.error('Failed to load rooms. Please try again.');
		}
	}

	// Load available sections from API
	async function loadAvailableSections(silent = false) {
		try {
			const data = await api.get('/api/sections?action=available-sections');

			if (data.success) {
				roomManagementStore.updateSections(data.data || []);
			} else {
				throw new Error(data.message || 'Failed to load sections');
			}
		} catch (error) {
			console.error('Error loading sections:', error);
			if (!silent) {
				toastStore.error('Failed to load sections. Please try again.');
			}
		}
	}

	// Handle room removal with confirmation
	const handleRemoveRoom = (room) => {
		modalStore.confirm(
			'Remove Room',
			`Are you sure you want to remove room ${room.name}? This action cannot be undone.`,
			async () => {
				try {
					const data = await api.delete('/api/rooms', { id: room.id });

					if (data.success) {
						// Remove room from the store
						roomManagementStore.removeRoom(room.id);
						toastStore.success(data.message);
					} else {
						throw new Error(data.message || 'Failed to remove room');
					}
				} catch (error) {
					console.error('Error removing room:', error);
					toastStore.error('Failed to remove room. Please try again.');
				}
			},
			() => {
				// User cancelled - do nothing
			}
		);
	};

	// Handle room creation
	async function handleCreateRoom() {
		if (!roomName || !building || !floor) {
			toastStore.warning('Please fill in all required fields.');
			return;
		}

		isCreating = true;

		try {
			const data = await api.post('/api/rooms', {
				name: roomName,
				building: building,
				floor: floor
			});

			if (data.success) {
				// Add new room to the store
				roomManagementStore.addRoom(data.data);
				toastStore.success(data.message);
				resetRoomForm();
			} else {
				throw new Error(data.message || 'Failed to create room');
			}
		} catch (error) {
			console.error('Error creating room:', error);
			toastStore.error('Failed to create room. Please try again.');
		} finally {
			isCreating = false;
		}
	}

	// Unassign room with confirmation modal
	async function unassignRoom(roomId) {
		const room = existingRooms.find((r) => r.id === roomId);
		if (!room) return;

		modalStore.confirm(
			'Unassign Room',
			`Are you sure you want to unassign room "${room.name}"? This will remove all section assignments from this room.`,
			async () => {
				await performUnassignment(roomId);
			},
			() => {
				// User cancelled - do nothing
			}
		);
	}

	// Perform the actual unassignment
	async function performUnassignment(roomId) {
		try {
			const room = existingRooms.find((r) => r.id === roomId);
			if (!room) return;

			const data = await api.patch('/api/rooms', {
				roomId: roomId,
				action: 'unassign'
			});

			if (data.success) {
				// Reload rooms to get updated data
				await loadRooms();
				// Reload available sections as they may have changed
				await loadAvailableSections();
				toastStore.success(data.message);
			} else {
				throw new Error(data.message || 'Failed to unassign room');
			}
		} catch (error) {
			console.error('Error unassigning room:', error);
			toastStore.error('Failed to unassign room. Please try again.');
		}
	}

	// Reset forms
	function resetRoomForm() {
		roomName = '';
		building = '';
		floor = '';
	}

	// Close dropdowns when clicking outside
	function handleClickOutside(event) {
		if (!event.target.closest('.custom-dropdown')) {
			isAssignSectionDropdownOpen = false;
		}
	}

	// Edit room functions
	function toggleEditForm(room) {
		if (editingRoomId === room.id) {
			// Close the form
			editingRoomId = null;
			editRoomName = '';
			editBuilding = '';
			editFloor = '';
		} else {
			// Close assign form if it's open for this room
			if (assigningRoomId === room.id) {
				assigningRoomId = null;
				assignSelectedSection = '';
				isAssignSectionDropdownOpen = false;
			}
			// Open the form
			editingRoomId = room.id;
			editRoomName = room.name;
			editBuilding = room.building;
			editFloor = room.floor;
		}
	}

	async function handleEditRoom() {
		if (!editRoomName || !editBuilding || !editFloor) {
			toastStore.warning('Please fill in all required fields.');
			return;
		}

		isUpdating = true;

		try {
			const room = existingRooms.find((r) => r.id === editingRoomId);

			const data = await api.put('/api/rooms', {
				id: editingRoomId,
				name: editRoomName,
				building: editBuilding,
				floor: editFloor,
				status: room.status,
				assignedTo: room.assignedTo
			});

			if (data.success) {
				// Update room in the store
				roomManagementStore.updateRoom(editingRoomId, data.data);

				toastStore.success(data.message);

				// Close edit form
				editingRoomId = null;
				editRoomName = '';
				editBuilding = '';
				editFloor = '';
			} else {
				throw new Error(data.message || 'Failed to update room');
			}
		} catch (error) {
			console.error('Error updating room:', error);
			toastStore.error('Failed to update room. Please try again.');
		} finally {
			isUpdating = false;
		}
	}

	// Inline assign room functions
	function toggleAssignForm(room) {
		if (assigningRoomId === room.id) {
			// Close the form
			assigningRoomId = null;
			assignSelectedSection = '';
			isAssignSectionDropdownOpen = false;
		} else {
			// Close edit form if it's open for this room
			if (editingRoomId === room.id) {
				editingRoomId = null;
				editRoomName = '';
				editBuilding = '';
				editFloor = '';
			}
			// Open the form
			assigningRoomId = room.id;
			assignSelectedSection = '';
			isAssignSectionDropdownOpen = false;
		}
	}

	function toggleAssignSectionDropdown() {
		isAssignSectionDropdownOpen = !isAssignSectionDropdownOpen;
	}

	function selectAssignSection(section) {
		assignSelectedSection = section.id || section._id?.toString();
		isAssignSectionDropdownOpen = false;
		assignSectionSearchTerm = ''; // Clear search term
	}

	async function handleInlineAssignRoom() {
		if (!assignSelectedSection) {
			toastStore.warning('Please select a section.');
			return;
		}

		isAssigningInline = true;

		try {
			const data = await api.patch('/api/rooms', {
				roomId: assigningRoomId,
				sectionIds: [assignSelectedSection],
				action: 'assign'
			});

			if (data.success) {
				// Reload rooms to get updated data
				await loadRooms();
				// Reload available sections as they may have changed
				await loadAvailableSections();
				toastStore.success(data.message);

				// Close assign form
				assigningRoomId = null;
				assignSelectedSection = '';
			} else {
				throw new Error(data.message || 'Failed to assign room');
			}
		} catch (error) {
			console.error('Error assigning room:', error);
			toastStore.error('Failed to assign room. Please try again.');
		} finally {
			isAssigningInline = false;
		}
	}

	// Computed properties
	$: filteredRooms = existingRooms.filter((room) => {
		const matchesSearchTerm =
			room.name.toLowerCase().includes(roomsSearchTerm.toLowerCase()) ||
			room.building.toLowerCase().includes(roomsSearchTerm.toLowerCase()) ||
			room.floor.toLowerCase().includes(roomsSearchTerm.toLowerCase());

		return matchesSearchTerm;
	});

	$: filteredAvailableSections = availableSections.filter((section) => {
		const matchesSearchTerm =
			section.name.toLowerCase().includes(assignSectionSearchTerm.toLowerCase()) ||
			(`Grade ${section.grade_level}`).toLowerCase().includes(assignSectionSearchTerm.toLowerCase());

		return matchesSearchTerm;
	});

	// Load rooms and sections when component mounts
	onMount(() => {
		// Initialize room management store with cached data (instant load)
		const cachedData = roomManagementStore.getCachedData();
		if (cachedData) {
			roomManagementStore.init(cachedData);
		}

		// Fetch fresh data (silent if we have cache, visible loading if not)
		loadRooms(!!cachedData);
		loadAvailableSections(!!cachedData);

		// Set up periodic silent refresh every 30 seconds
		const refreshInterval = setInterval(() => {
			loadRooms(true); // Always silent for periodic refresh
			loadAvailableSections(true); // Always silent for periodic refresh
		}, 30000);

		// Cleanup interval on component destroy
		return () => {
			clearInterval(refreshInterval);
		};
	});
</script>

<svelte:window on:click={handleClickOutside} />

<div class="admin-room-creation-form-container">
	<div class="admin-room-creation-form-section">
		<div class="admin-room-section-header">
			<h2 class="admin-room-section-title">Create New Room</h2>
			<p class="admin-room-section-subtitle">Fill in the details below to create a new room</p>
		</div>

		<div class="admin-room-form-container">
			<form on:submit|preventDefault={handleCreateRoom}>
				<!-- Room Info -->
				<div class="admin-room-form-row">
					<div class="admin-room-form-group">
						<label class="admin-room-form-label" for="room-name">Room Name *</label>
						<input
							type="text"
							id="room-name"
							class="admin-room-form-input"
							bind:value={roomName}
							placeholder="Enter room name"
							required
						/>
					</div>

					<div class="admin-room-form-group">
						<label class="admin-room-form-label" for="building">Building *</label>
						<input
							type="text"
							id="building"
							class="admin-room-form-input"
							bind:value={building}
							placeholder="Enter building name"
							required
						/>
					</div>

					<div class="admin-room-form-group">
						<label class="admin-room-form-label" for="floor">Floor *</label>
						<input
							type="text"
							id="floor"
							class="admin-room-form-input"
							bind:value={floor}
							placeholder="e.g., 1st Floor"
							required
						/>
					</div>
				</div>

				<!-- Submit Button -->
				<div class="admin-room-form-actions">
					<button
						type="submit"
						class="admin-room-create-button"
						disabled={isCreating || !roomName || !building || !floor}
					>
						{#if isCreating}
							Creating...
						{:else}
							<span class="material-symbols-outlined">add_ad</span>
							Create Room
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
	<!-- All Rooms List -->
	<div class="admin-room-rooms-list-section">
		<div class="admin-room-section-header">
			<div class="section-header-content">
				<div class="section-title-group">
					<h2 class="admin-room-section-title">All Rooms</h2>
					<p class="admin-room-section-subtitle">All rooms in the system</p>
				</div>

				<!-- Search and Filter Container -->
				<div class="adminroom-filters-container">
					<!-- Search Input -->
					<div class="adminroom-search-container">
						<div class="adminroom-search-input-wrapper">
							<span class="material-symbols-outlined adminroom-search-icon">search</span>
							<input
								type="text"
								placeholder="Search by room name, building, or floor..."
								class="adminroom-search-input"
								bind:value={roomsSearchTerm}
							/>
							{#if roomsSearchTerm}
								<button
									type="button"
									class="adminroom-clear-search-button"
									on:click={() => (roomsSearchTerm = '')}
								>
									<span class="material-symbols-outlined">close</span>
								</button>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>

		{#if isLoading}
			<div class="admin-room-loading">
				<span class="system-loader"></span>
				<p>Loading rooms...</p>
			</div>
		{:else if filteredRooms.length === 0}
			<div class="admin-room-empty-state">
				<span class="material-symbols-outlined">meeting_room</span>
				{#if existingRooms.length === 0}
					<p>No rooms found. Create your first room using the form above.</p>
				{:else}
					<p>No rooms found matching your search.</p>
				{/if}
			</div>
		{:else}
			<div class="admin-room-rooms-grid">
				{#each filteredRooms as room (room.id)}
					<div
						class="admin-room-room-card"
						class:editing={editingRoomId === room.id}
						class:assigning={assigningRoomId === room.id}
						id="admin-room-room-card-{room.id}"
					>
						<div class="admin-room-room-header">
							<div class="admin-room-room-title">
								<h3 class="admin-room-room-name">{room.name}</h3>
							</div>
							<div class="admin-room-action-buttons">
								{#if room.assignedSections && room.assignedSections.length > 0}
									<button
										type="button"
										class="admin-room-unassign-button"
										on:click={() => unassignRoom(room.id)}
										title="Unassign Room"
									>
										<span class="material-symbols-outlined">remove_circle</span>
									</button>
								{:else}
									<a href="#admin-room-room-card-{room.id}">
										<button
											type="button"
											class="admin-room-assign-button"
											on:click={() => toggleAssignForm(room)}
											title={assigningRoomId === room.id ? 'Cancel Assign' : 'Assign Room'}
										>
											<span class="material-symbols-outlined"
												>{assigningRoomId === room.id ? 'close' : 'add_circle'}</span
											>
										</button>
									</a>
								{/if}
								<a href="#admin-room-room-card-{room.id}">
									<button
										type="button"
										class="admin-room-edit-button"
										on:click={() => toggleEditForm(room)}
										title={editingRoomId === room.id ? 'Cancel Edit' : 'Edit Room'}
									>
										<span class="material-symbols-outlined"
											>{editingRoomId === room.id ? 'close' : 'edit'}</span
										>
									</button>
								</a>
								<button
									type="button"
									class="admin-room-remove-button"
									on:click={() => handleRemoveRoom(room)}
									title="Remove Room"
								>
									<span class="material-symbols-outlined">delete</span>
								</button>
							</div>
						</div>

						<div class="admin-room-room-details">
							<div class="admin-room-room-location">
								<span class="material-symbols-outlined">location_on</span>
								<span>{room.building}, {room.floor}</span>
							</div>
							{#if room.assignedSections && room.assignedSections.length > 0}
								<div class="admin-room-room-assignment">
									<span class="material-symbols-outlined">group</span>
									<span>Assigned to: {room.assignedSections.map((s) => s.name).join(', ')}</span>
								</div>
							{:else}
								<div class="admin-room-room-assignment">
									<span class="material-symbols-outlined">check_circle</span>
									<span>Available</span>
								</div>
							{/if}
							<div class="admin-room-room-created">
								<span class="material-symbols-outlined">schedule</span>
								<span>Created: {room.createdDate}</span>
							</div>
							{#if room.updatedDate && room.updatedDate !== room.createdDate}
								<div class="admin-room-room-updated">
									<span class="material-symbols-outlined">update</span>
									<span>Updated: {room.updatedDate}</span>
								</div>
							{/if}
						</div>

						<!-- Inline Edit Form -->
						{#if editingRoomId === room.id}
							<div class="admin-room-edit-form-section">
								<div class="admin-room-edit-form-container">
									<div class="admin-room-edit-form-header">
										<h2 class="admin-room-edit-form-title">Edit Room</h2>
										<p class="admin-room-edit-form-subtitle">Update room information</p>
									</div>

									<form
										class="admin-room-edit-form-content"
										on:submit|preventDefault={handleEditRoom}
									>
										<!-- Room Info -->
										<div class="admin-room-edit-info-row">
											<div class="admin-room-form-group">
												<label class="admin-room-form-label" for="edit-room-name">
													Room Name *
												</label>
												<input
													type="text"
													id="edit-room-name"
													class="admin-room-form-input"
													bind:value={editRoomName}
													placeholder="Enter room name"
													required
												/>
											</div>

											<div class="admin-room-form-group">
												<label class="admin-room-form-label" for="edit-building">
													Building *
												</label>
												<input
													type="text"
													id="edit-building"
													class="admin-room-form-input"
													bind:value={editBuilding}
													placeholder="Enter building name"
													required
												/>
											</div>

											<div class="admin-room-form-group">
												<label class="admin-room-form-label" for="edit-floor"> Floor * </label>
												<input
													type="text"
													id="edit-floor"
													class="admin-room-form-input"
													bind:value={editFloor}
													placeholder="e.g., 1st Floor"
													required
												/>
											</div>
										</div>

										<!-- Form Actions -->
										<div class="admin-room-edit-form-actions">
											<button
												type="button"
												class="admin-room-cancel-button"
												on:click={() => toggleEditForm(room)}
											>
												Cancel
											</button>
											<button
												type="submit"
												class="admin-room-update-button"
												disabled={isUpdating || !editRoomName || !editBuilding || !editFloor}
											>
												{#if isUpdating}
													Updating...
												{:else}
													Update
												{/if}
											</button>
										</div>
									</form>
								</div>
							</div>
						{/if}

						<!-- Inline Assign Form -->
						{#if assigningRoomId === room.id}
							<div class="admin-room-assign-form-section">
								<div class="admin-room-assign-form-container">
									<div class="admin-room-assign-form-header">
										<h2 class="admin-room-assign-form-title">Assign Room</h2>
										<p class="admin-room-assign-form-subtitle">
											Select a section to assign this room to
										</p>
									</div>

									<form
										class="admin-room-assign-form-content"
										on:submit|preventDefault={handleInlineAssignRoom}
									>
										<!-- Section Selection -->
										<div class="admin-room-assign-info-row">
											<div class="admin-room-form-group">
												<label class="admin-room-form-label" for="assign-section-select"
													>Select Section *</label
												>
												<div class="custom-dropdown" class:open={isAssignSectionDropdownOpen}>
													<button
														type="button"
														class="dropdown-trigger"
														class:selected={assignSelectedSection}
														on:click|stopPropagation={toggleAssignSectionDropdown}
														id="assign-section-select"
													>
														{#if assignSelectedSection}
															{@const selectedSectionObj = availableSections.find(
																(section) =>
																	(section.id || section._id?.toString()) === assignSelectedSection
															)}
															{#if selectedSectionObj}
																<div class="selected-option">
																	<span class="material-symbols-outlined option-icon">group</span>
																	<div class="option-content">
																		<span class="option-name">{selectedSectionObj.name}</span>
																		<span class="option-description"
																			>Grade {selectedSectionObj.grade_level} Section</span
																		>
																	</div>
																</div>
															{/if}
														{:else}
															<span class="placeholder">Select a section</span>
														{/if}
														<span class="material-symbols-outlined dropdown-arrow">expand_more</span
														>
													</button>
													<div class="room-dropdown-menu">
														<!-- Search Container -->
														<div class="dropdown-search-container">
															<input
																type="text"
																class="dropdown-search-input"
																placeholder="Search sections..."
																bind:value={assignSectionSearchTerm}
															/>
															<span class="material-icons dropdown-search-icon">search</span>
														</div>
														{#if filteredAvailableSections.length > 0}
															{#each filteredAvailableSections as section (section.id || section._id)}
																<button
																	type="button"
																	class="dropdown-option"
																	class:selected={assignSelectedSection ===
																		(section.id || section._id?.toString())}
																	on:click|stopPropagation={() => selectAssignSection(section)}
																>
																	<span class="material-symbols-outlined option-icon">group</span>
																	<div class="option-content">
																		<span class="option-name">{section.name}</span>
																		<span class="option-description"
																			>Grade {section.grade_level} Section</span
																		>
																	</div>
																</button>
															{/each}
														{:else}
															<div class="dropdown-empty-state">
																<span class="material-symbols-outlined empty-icon">inbox</span>
																<span class="empty-text">
																	{assignSectionSearchTerm ? 'No sections found' : 'No sections available'}
																</span>
															</div>
														{/if}
													</div>
												</div>
											</div>
										</div>

										<!-- Form Actions -->
										<div class="admin-room-assign-form-actions">
											<button
												type="button"
												class="admin-room-cancel-button"
												on:click={() => toggleAssignForm(room)}
											>
												Cancel
											</button>
											<button
												type="submit"
												class="admin-room-assign-submit-button"
												disabled={isAssigningInline || !assignSelectedSection}
											>
												{#if isAssigningInline}
													Assigning
												{:else}
													Assign
												{/if}
											</button>
										</div>
									</form>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
