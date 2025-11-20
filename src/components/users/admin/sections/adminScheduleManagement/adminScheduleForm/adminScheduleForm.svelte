<script>
	import './adminScheduleForm.css';
	import { toastStore } from '../../../../../common/js/toastStore.js';
	import { modalStore } from '../../../../../common/js/modalStore.js';
	import { api, authenticatedFetch } from '../../../../../../routes/api/helper/api-helper.js';
	import { authStore } from '../../../../../login/js/auth.js';
	import { onMount, afterUpdate } from 'svelte';
	import TimeInput from './TimeInput.svelte';

	// Schedule assignment state
	let selectedFormYear = '';
	let selectedFormSection = '';

	// Form dropdown states
	let isFormYearDropdownOpen = false;
	let isFormSectionDropdownOpen = false;

	// Search states for dropdowns
	let sectionSearchTerm = '';
	let subjectSearchTerm = '';
	let teacherSearchTerm = '';

	// Loading states
	let isLoadingSections = false;

	// Grade levels for Philippines DepEd (Grades 7-10)
	const years = [
		{ id: 'grade-7', name: 'Grade 7', description: 'Junior High School - First Year' },
		{ id: 'grade-8', name: 'Grade 8', description: 'Junior High School - Second Year' },
		{ id: 'grade-9', name: 'Grade 9', description: 'Junior High School - Third Year' },
		{ id: 'grade-10', name: 'Grade 10', description: 'Junior High School - Fourth Year' }
	];

	// Days array for display
	const days = [
		{ id: 'monday', name: 'Monday' },
		{ id: 'tuesday', name: 'Tuesday' },
		{ id: 'wednesday', name: 'Wednesday' },
		{ id: 'thursday', name: 'Thursday' },
		{ id: 'friday', name: 'Friday' }
	];

	// Dynamic sections loaded from API
	let sections = [];
	
	// Current school year from database
	let currentSchoolYear = '2024-2025'; // Default fallback

	// Fetch current school year from database
	async function fetchCurrentSchoolYear() {
		try {
			const response = await fetch('/api/current-quarter');
			const result = await response.json();

			if (result.success && result.data) {
				currentSchoolYear = result.data.currentSchoolYear;
				console.log(`School year set to: ${currentSchoolYear}`);
			} else {
				console.warn('Failed to fetch current school year, using default: 2024-2025');
			}
		} catch (error) {
			console.error('Error fetching current school year:', error);
		}
	}

	// Load sections from API
	async function loadSections() {
		isLoadingSections = true;
		try {
			const response = await authenticatedFetch('/api/sections?action=available-sections');
			const result = await response.json();

			if (result.success) {
				sections = result.data.map((section) => ({
					id: section._id,
					name: section.name,
					grade: `Grade ${section.grade_level}`,
					year: `grade-${section.grade_level}`,
					grade_level: section.grade_level,
					school_year: section.school_year,
					status: section.status
				}));
			}
		} catch (error) {
			console.error('Error loading sections:', error);
		} finally {
			isLoadingSections = false;
		}
	}

	let scheduleAssignments = [];

	// Add schedule form state
	let showAddForm = false;
	let isSubmitting = false;
	let selectedDays = [];
	let formData = {
		startTime: '',
		endTime: '',
		scheduleType: 'subject',
		subjectId: '',
		activityTypeId: '',
		teacherId: ''
	};

	// Dropdown states for add form
	let subjects = [];
	let activityTypes = [];
	let teachers = [];
	let isLoadingSubjects = false;
	let isLoadingActivityTypes = false;
	let isLoadingTeachers = false;

	// Custom dropdown states
	let isSubjectDropdownOpen = false;
	let isActivityTypeDropdownOpen = false;
	let isTeacherDropdownOpen = false;
	let isScheduleTypeDropdownOpen = false;

	// Time input states
	let isStartTimeOpen = false;
	let isEndTimeOpen = false;

	// Time validation variables
	let timeValidationMessage = '';
	let calculatedDuration = '';

	// Conflict detection variables
	let conflictCheckMessage = '';
	let isCheckingConflicts = false;
	let hasConflicts = false;
	let currentConflicts = [];

	// Reactive time validation and duration calculation
	$: {
		if (formData.startTime && formData.endTime) {
			validateTimeRange();
		} else {
			timeValidationMessage = '';
			calculatedDuration = '';
		}
	}

	// Reactive conflict checking when key parameters change
	$: {
		if (selectedFormSection && formData.startTime && formData.endTime && selectedDays.length > 0) {
			checkScheduleConflicts();
		} else {
			conflictCheckMessage = '';
			hasConflicts = false;
			currentConflicts = [];
		}
	}

	// Function to validate time range and calculate duration
	function validateTimeRange() {
		const startTime = formData.startTime;
		const endTime = formData.endTime;

		if (!startTime || !endTime) {
			timeValidationMessage = '';
			calculatedDuration = '';
			return;
		}

		// Convert time strings to minutes for comparison
		const startMinutes = timeStringToMinutes(startTime);
		const endMinutes = timeStringToMinutes(endTime);

		if (endMinutes <= startMinutes) {
			timeValidationMessage = 'End time must be after start time';
			calculatedDuration = '';
		} else {
			timeValidationMessage = '';
			const durationMinutes = endMinutes - startMinutes;
			const hours = Math.floor(durationMinutes / 60);
			const minutes = durationMinutes % 60;

			if (hours > 0 && minutes > 0) {
				calculatedDuration = `${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes > 1 ? 's' : ''}`;
			} else if (hours > 0) {
				calculatedDuration = `${hours} hour${hours > 1 ? 's' : ''}`;
			} else {
				calculatedDuration = `${minutes} minute${minutes > 1 ? 's' : ''}`;
			}
		}
	}

	// Helper function to convert time string (HH:MM) to minutes
	function timeStringToMinutes(timeString) {
		const [hours, minutes] = timeString.split(':').map(Number);
		return hours * 60 + minutes;
	}

	// Debounce function to avoid excessive API calls
	let conflictCheckTimeout;
	function debounce(func, wait) {
		clearTimeout(conflictCheckTimeout);
		conflictCheckTimeout = setTimeout(func, wait);
	}

	// Check for schedule conflicts
	async function checkScheduleConflicts() {
		// Debounce the API call to avoid excessive requests
		debounce(async () => {
			if (
				!selectedFormSection ||
				!formData.startTime ||
				!formData.endTime ||
				selectedDays.length === 0
			) {
				return;
			}

			isCheckingConflicts = true;
			hasConflicts = false;
			currentConflicts = [];
			conflictCheckMessage = '';

			try {
				// Check conflicts for each selected day
				const conflictPromises = selectedDays.map(async (dayId) => {
					const dayName = days.find((d) => d.id === dayId)?.name.toLowerCase();

					const params = new URLSearchParams({
						action: 'check-conflicts',
						sectionId: selectedFormSection,
						dayOfWeek: dayName,
						startTime: formData.startTime,
						endTime: formData.endTime,
						schoolYear: currentSchoolYear
					});

				// Add teacher ID if selected
				if (formData.teacherId && formData.scheduleType === 'subject') {
					params.append('teacherId', formData.teacherId);
				}

				const response = await authenticatedFetch(`/api/schedules?${params}`);
				const result = await response.json();					return {
						day: dayName,
						dayDisplay: days.find((d) => d.id === dayId)?.name,
						...result
					};
				});

				const conflictResults = await Promise.all(conflictPromises);

				// Process results
				const allConflicts = [];
				const conflictingDays = [];

				conflictResults.forEach((result) => {
					if (result.hasConflicts) {
						conflictingDays.push(result.dayDisplay);
						result.conflicts.forEach((conflict) => {
							allConflicts.push({
								...conflict,
								day: result.dayDisplay
							});
						});
					}
				});

				if (allConflicts.length > 0) {
					hasConflicts = true;
					currentConflicts = allConflicts;

					// Group conflicts by type and create toast messages
					const teacherConflicts = allConflicts.filter((c) => c.type === 'teacher_conflict');
					const sectionConflicts = allConflicts.filter((c) => c.type === 'section_conflict');

					// Show toast notifications
					if (teacherConflicts.length === 1) {
						// Single teacher conflict - show detailed message
						toastStore.error(teacherConflicts[0].message, 6000);
					} else if (teacherConflicts.length > 1) {
						// Multiple teacher conflicts - show summary
						const conflictDays = [...new Set(teacherConflicts.map((c) => c.day))];
						const teacherName = teacherConflicts[0].details?.teacher_name || 'Selected teacher';
						toastStore.error(
							`${teacherName} has schedule conflicts on ${conflictDays.join(', ')}. Please choose different times or another teacher.`,
							8000
						);
					}

					if (sectionConflicts.length === 1) {
						// Single section conflict - show detailed message
						toastStore.error(sectionConflicts[0].message, 6000);
					} else if (sectionConflicts.length > 1) {
						// Multiple section conflicts - show summary
						const conflictDays = [...new Set(sectionConflicts.map((c) => c.day))];
						toastStore.error(
							`Time conflicts detected for this section on ${conflictDays.join(', ')}. Please choose different time slots.`,
							6000
						);
					}

					// Create a summary message for the button
					let messages = [];

					if (teacherConflicts.length > 0) {
						messages.push(
							`Teacher conflicts detected on ${[...new Set(teacherConflicts.map((c) => c.day))].join(', ')}`
						);
					}

					if (sectionConflicts.length > 0) {
						messages.push(
							`Section time conflicts detected on ${[...new Set(sectionConflicts.map((c) => c.day))].join(', ')}`
						);
					}

					conflictCheckMessage = messages.join('. ');
				} else {
					hasConflicts = false;
					conflictCheckMessage = '';
				}
			} catch (error) {
				console.error('Error checking conflicts:', error);
				toastStore.error('Error checking for conflicts. Please try again.');
				hasConflicts = false;
			} finally {
				isCheckingConflicts = false;
			}
		}, 500); // 500ms debounce delay
	}

	// Filter form sections based on selected form year
	$: filteredFormSections = selectedFormYear
		? sections.filter((section) => section.year === selectedFormYear)
		: [];

	// Filtered arrays for search functionality
	$: filteredSectionsWithSearch = filteredFormSections.filter(
		(section) =>
			section.name.toLowerCase().includes(sectionSearchTerm.toLowerCase()) ||
			section.grade.toLowerCase().includes(sectionSearchTerm.toLowerCase())
	);

	$: filteredSubjects = subjects.filter(
		(subject) =>
			subject.name?.toLowerCase().includes(subjectSearchTerm.toLowerCase()) ||
			subject.description?.toLowerCase().includes(subjectSearchTerm.toLowerCase())
	);

	$: filteredTeachers = teachers.filter(
		(teacher) => {
			// First, filter by department if a subject is selected
			if (formData.subjectId) {
				const selectedSubject = subjects.find((s) => s.id === formData.subjectId);
				if (selectedSubject && selectedSubject.department_id) {
					// Only show teachers whose department_ids array includes the selected subject's department
					if (!teacher.department_ids || !teacher.department_ids.includes(selectedSubject.department_id)) {
						return false;
					}
				}
			}
			
			// Then filter by search term
			const searchLower = teacherSearchTerm.toLowerCase();
			const fullName = teacher.full_name?.toLowerCase() || '';
			const firstName = teacher.first_name?.toLowerCase() || '';
			const lastName = teacher.last_name?.toLowerCase() || '';
			const email = teacher.email?.toLowerCase() || '';
			
			return fullName.includes(searchLower) ||
				firstName.includes(searchLower) ||
				lastName.includes(searchLower) ||
				email.includes(searchLower);
		}
	);

	// Get selected objects for form display
	$: selectedFormYearObj = years.find((y) => y.id === selectedFormYear);
	$: selectedFormSectionObj = sections.find((s) => s.id === selectedFormSection);

	// Get schedules for each day
	$: schedulesByDay = days.reduce((acc, day) => {
		acc[day.id] = scheduleAssignments
			.filter((assignment) => {
				if (!selectedFormYear || !selectedFormSection) return false;

				const yearMatch = assignment.year === selectedFormYear;
				const sectionMatch = assignment.section === selectedFormSectionObj?.name;
				const dayMatch = assignment.day === day.name;

				return yearMatch && sectionMatch && dayMatch;
			})
			.sort((a, b) => {
				// Sort by start time in ascending order
				const aStartTime = timeToMinutes(a.startTime);
				const bStartTime = timeToMinutes(b.startTime);
				return aStartTime - bStartTime;
			});
		return acc;
	}, {});

	// Check if year and section are selected for display logic
	$: isYearSelected = !!selectedFormYear;
	$: isSectionSelected = !!selectedFormSection;

	// Function to convert time string to minutes for comparison
	function timeToMinutes(timeString) {
		if (!timeString) return 0;

		const [time, period] = timeString.split(' ');
		const [hours, minutes] = time.split(':').map(Number);

		let totalMinutes = minutes;
		if (period === 'PM' && hours !== 12) {
			totalMinutes += (hours + 12) * 60;
		} else if (period === 'AM' && hours === 12) {
			totalMinutes += 0; // 12 AM is 0 hours
		} else {
			totalMinutes += hours * 60;
		}

		return totalMinutes;
	}

	function handleClickOutside(event) {
		if (!event.target.closest('.scheduleassign-custom-dropdown')) {
			// New form dropdowns
			isFormYearDropdownOpen = false;
			isFormSectionDropdownOpen = false;
			// Add schedule form dropdowns
			isSubjectDropdownOpen = false;
			isActivityTypeDropdownOpen = false;
			isTeacherDropdownOpen = false;
			isScheduleTypeDropdownOpen = false;
		}
		
		// Close time inputs when clicking outside
		if (!event.target.closest('.time-input-container')) {
			isStartTimeOpen = false;
			isEndTimeOpen = false;
		}
	}

	// New form dropdown toggle functions
	function toggleFormYearDropdown() {
		isFormYearDropdownOpen = !isFormYearDropdownOpen;
	}

	function toggleFormSectionDropdown() {
		if (!selectedFormYear) return; // Disabled if no year selected
		isFormSectionDropdownOpen = !isFormSectionDropdownOpen;
	}

	// New form selection functions with cascading reset
	function selectFormYear(year) {
		selectedFormYear = year ? year.id : '';
		// Reset section selection
		selectedFormSection = '';
		isFormYearDropdownOpen = false;
	}

	function selectFormSection(section) {
		selectedFormSection = section ? section.id : '';
		isFormSectionDropdownOpen = false;

		// Reset subjects when section changes to reload with new grade level filter
		subjects = [];
		formData.subjectId = '';
	}

	// Format time string from 24-hour format to 12-hour format with AM/PM
	function formatTimeString(timeString) {
		if (!timeString) return '';

		// Handle both HH:MM:SS and HH:MM formats
		const timeParts = timeString.split(':');
		let hours = parseInt(timeParts[0]);
		const minutes = timeParts[1];

		const ampm = hours >= 12 ? 'PM' : 'AM';
		hours = hours % 12;
		hours = hours ? hours : 12; // 0 should be 12

		// Remove leading zero from minutes if present
		const formattedMinutes =
			minutes.startsWith('0') && minutes !== '00' ? minutes.substring(1) : minutes;

		// Only show minutes if they're not 00
		if (formattedMinutes === '00') {
			return `${hours}:00 ${ampm}`;
		} else {
			return `${hours}:${formattedMinutes} ${ampm}`;
		}
	}

	// Load existing schedules from API
	async function loadSchedules() {
		try {
			const response = await authenticatedFetch('/api/schedules');
			const result = await response.json();

			if (result.success) {
				// Transform API data to match the component's expected format
				scheduleAssignments = result.data.map((schedule) => ({
					id: schedule.id,
					year: `grade-${schedule.grade_level}`,
					grade: `Grade ${schedule.grade_level}`,
					section: schedule.section_name,
					day: schedule.day_of_week.charAt(0).toUpperCase() + schedule.day_of_week.slice(1), // Capitalize first letter
					time: `${formatTimeString(schedule.start_time)} - ${formatTimeString(schedule.end_time)}`,
					subject: schedule.subject_name || schedule.activity_type_name,
					teacher: schedule.teacher_name,
					type: schedule.schedule_type,
					startTime: formatTimeString(schedule.start_time),
					endTime: formatTimeString(schedule.end_time),
					subjectId: schedule.subject_id,
					activityTypeId: schedule.activity_type_id,
					teacherId: schedule.teacher_id,
					sectionId: schedule.section_id,
					schoolYear: schedule.school_year,
					roomId: schedule.room_id,
					roomName: schedule.room_name,
					roomBuilding: schedule.room_building,
					roomFloor: schedule.room_floor
				}));
			} else {
				console.error('Failed to load schedules:', result.error);
			}
		} catch (error) {
			console.error('Error loading schedules:', error);
		}
	}

	// Delete assignment function
	async function handleDeleteAssignment(assignment) {
		modalStore.confirm(
			'Delete Assignment',
			`<p>Are you sure you want to delete this schedule assignment?</p>`,
			async () => {
				try {
					// Make API call to delete the schedule
					const result = await api.delete(`/api/schedules?id=${assignment.id}`);

					if (result.success) {
						// Remove assignment from the local array only after successful API call
						scheduleAssignments = scheduleAssignments.filter((a) => a.id !== assignment.id);

						// Force reactivity update by reassigning the array
						scheduleAssignments = [...scheduleAssignments];

						// Manually trigger height adjustment after DOM update
						setTimeout(() => adjustEmptyDayHeights(), 0);

						// Show success message
						toastStore.success(
							`Assignment for ${assignment.subject} has been deleted successfully`
						);
					} else {
						// Show error message
						toastStore.error(result.error || 'Failed to delete assignment');
					}
				} catch (error) {
					console.error('Error deleting assignment:', error);
					toastStore.error('Failed to delete assignment. Please try again.');
				}
			},
			() => {}
		);
	}

	// Add schedule form functions
	function toggleAddForm() {
		showAddForm = !showAddForm;
		if (!showAddForm) {
			resetForm();
		}
	}

	function resetForm() {
		selectedDays = [];
		formData = {
			startTime: '',
			endTime: '',
			scheduleType: 'subject',
			subjectId: '',
			activityTypeId: '',
			teacherId: ''
		};
	}

	function toggleDaySelection(dayId) {
		if (selectedDays.includes(dayId)) {
			selectedDays = selectedDays.filter((id) => id !== dayId);
		} else {
			selectedDays = [...selectedDays, dayId];
		}
	}

	// Custom dropdown toggle functions
	function toggleSubjectDropdown() {
		isSubjectDropdownOpen = !isSubjectDropdownOpen;
	}

	function toggleActivityTypeDropdown() {
		isActivityTypeDropdownOpen = !isActivityTypeDropdownOpen;
	}

	function toggleTeacherDropdown() {
		isTeacherDropdownOpen = !isTeacherDropdownOpen;
	}

	function toggleScheduleTypeDropdown() {
		isScheduleTypeDropdownOpen = !isScheduleTypeDropdownOpen;
	}

	// TimeInput handlers
	function handleStartTimeOpen() {
		isStartTimeOpen = true;
		isEndTimeOpen = false; // Close end time when start time opens
	}

	function handleEndTimeOpen() {
		isEndTimeOpen = true;
		isStartTimeOpen = false; // Close start time when end time opens
	}

	// Selection functions
	function selectSubject(subject) {
		const previousSubjectId = formData.subjectId;
		formData.subjectId = subject.id;
		isSubjectDropdownOpen = false;
		subjectSearchTerm = ''; // Clear search term
		
		// Reset teacher selection if switching to a different subject
		// (in case the current teacher is not in the new subject's department)
		if (previousSubjectId !== subject.id && formData.teacherId) {
			const selectedTeacher = teachers.find((t) => t.id === formData.teacherId);
			if (selectedTeacher && (!selectedTeacher.department_ids || !selectedTeacher.department_ids.includes(subject.department_id))) {
				formData.teacherId = '';
			}
		}
	}

	function selectActivityType(activityType) {
		formData.activityTypeId = activityType.id;
		isActivityTypeDropdownOpen = false;
	}

	function selectTeacher(teacher) {
		formData.teacherId = teacher.id;
		isTeacherDropdownOpen = false;
		teacherSearchTerm = ''; // Clear search term
	}

	function selectScheduleType(type) {
		formData.scheduleType = type;
		isScheduleTypeDropdownOpen = false;
		// Reset related fields when schedule type changes
		if (type === 'subject') {
			formData.activityTypeId = null;
		} else {
			formData.subjectId = null;
		}
	}

	// Load dropdown data functions
	async function loadSubjects() {
		if (subjects.length > 0) return;

		isLoadingSubjects = true;
		try {
			// Get the grade level from the selected section
			const selectedSection = sections.find((s) => s.id === selectedFormSection);
			const gradeLevel = selectedSection ? selectedSection.grade_level : '';

			// Add grade level parameter to the API call
			const url = gradeLevel
				? `/api/subjects?action=available-subjects&grade_level=${gradeLevel}`
				: '/api/subjects?action=available-subjects';

			const response = await authenticatedFetch(url);
			const result = await response.json();

			if (result.success) {
				subjects = result.data;
			}
		} catch (error) {
			console.error('Error loading subjects:', error);
		} finally {
			isLoadingSubjects = false;
		}
	}

	async function loadActivityTypes() {
		if (activityTypes.length > 0) return;

		isLoadingActivityTypes = true;
		try {
			const response = await authenticatedFetch('/api/activity-types?action=available-activity-types');
			const result = await response.json();

			if (result.success) {
				activityTypes = result.data;
			}
		} catch (error) {
			console.error('Error loading activity types:', error);
		} finally {
			isLoadingActivityTypes = false;
		}
	}

	async function loadTeachers() {
		if (teachers.length > 0) return;

		isLoadingTeachers = true;
		try {
			const response = await authenticatedFetch('/api/users?action=teachers');
			const result = await response.json();

			if (result.success) {
				teachers = result.data;
			}
		} catch (error) {
			console.error('Error loading teachers:', error);
		} finally {
			isLoadingTeachers = false;
		}
	}

	// Form submission function
	async function handleSubmitSchedule() {
		if (!selectedFormSection || selectedDays.length === 0) {
			toastStore.error('Please select a section and at least one day');
			return;
		}

		if (!formData.startTime || !formData.endTime) {
			toastStore.error('Please enter start and end times');
			return;
		}

		if (formData.scheduleType === 'subject' && !formData.subjectId) {
			toastStore.error('Please select a subject');
			return;
		}

		if (formData.scheduleType === 'activity' && !formData.activityTypeId) {
			toastStore.error('Please select an activity type');
			return;
		}

		isSubmitting = true;

		try {
			const promises = selectedDays.map(async (dayId) => {
				const dayName = days.find((d) => d.id === dayId)?.name.toLowerCase();

				try {
					// Use authenticatedFetch directly instead of api.post to handle both success and error responses
					const response = await authenticatedFetch('/api/schedules', {
						method: 'POST',
						body: JSON.stringify({
							sectionId: selectedFormSection,
							dayOfWeek: dayName,
							startTime: formData.startTime,
							endTime: formData.endTime,
							scheduleType: formData.scheduleType,
							subjectId: formData.scheduleType === 'subject' ? formData.subjectId : null,
							activityTypeId: formData.scheduleType === 'activity' ? formData.activityTypeId : null,
							teacherId: formData.teacherId || null,
							schoolYear: currentSchoolYear
						})
					});
					
					// Parse the response body
					const result = await response.json();
					
					// If response is not OK (status 409 for conflicts, etc.), mark as failed
					if (!response.ok) {
						return { 
							success: false, 
							error: result.error || 'Failed to create schedule',
							conflictType: result.conflictType,
							conflictingSchedule: result.conflictingSchedule
						};
					}
					
					return result;
				} catch (error) {
					// Convert error response to result format
					console.error('API Error:', error);
					return { success: false, error: error.message || 'Failed to create schedule' };
				}
			});

			const results = await Promise.all(promises);

			const failedResults = results.filter((r) => !r.success);
			const successfulResults = results.filter((r) => r.success);

			// Always reload schedules if there were any successful additions
			if (successfulResults.length > 0) {
				await loadSchedules(); // Reload schedules to show successful additions
			}

			if (failedResults.length === 0) {
				toastStore.success(`Schedule added successfully for ${selectedDays.length} day(s)`);
				resetForm();
				showAddForm = false;
			} else {
				// Show success message for partial success
				if (successfulResults.length > 0) {
					toastStore.success(`Schedule added successfully for ${successfulResults.length} day(s)`);
				}

				// Handle different types of errors
				const teacherConflicts = failedResults.filter((r) => r.conflictType === 'teacher_conflict');
				const timeConflicts = failedResults.filter((r) => r.conflictType !== 'teacher_conflict');

				if (teacherConflicts.length > 0) {
					// Show specific teacher conflict messages
					teacherConflicts.forEach((conflict) => {
						toastStore.error(conflict.error, 8000); // Longer duration for detailed message
					});
				}

				if (timeConflicts.length > 0) {
					toastStore.error(
						`Failed to add schedule for ${timeConflicts.length} day(s) due to time conflicts`
					);
				}

				// If there are other types of failures, show generic message
				if (failedResults.length > teacherConflicts.length + timeConflicts.length) {
					toastStore.error(
						`Failed to add schedule for ${failedResults.length - teacherConflicts.length - timeConflicts.length} day(s)`
					);
				}
			}
		} catch (error) {
			console.error('Error submitting schedule:', error);
			toastStore.error('Failed to add schedule. Please try again.');
		} finally {
			isSubmitting = false;
		}
	}

	// Load dropdown data when form is opened
	$: if (showAddForm) {
		loadSubjects();
		loadActivityTypes();
		loadTeachers();
	}

	// Load data on component mount
	onMount(async () => {
		// First fetch the current school year from database
		await fetchCurrentSchoolYear();
		// Then load sections and schedules using the current school year
		loadSections();
		loadSchedules();
	});

	// Dynamic height adjustment for empty day containers
	afterUpdate(() => {
		adjustEmptyDayHeights();
	});

	function adjustEmptyDayHeights() {
		if (!selectedFormYear || !selectedFormSection) return;

		const dayColumns = document.querySelectorAll('.scheduleassign-day-column');
		if (dayColumns.length === 0) return;

		// Calculate the maximum height among all day columns
		let maxHeight = 0;
		dayColumns.forEach((column) => {
			const scheduleContainer = column.querySelector('.scheduleassign-day-schedules');
			if (scheduleContainer) {
				const height = scheduleContainer.scrollHeight;
				maxHeight = Math.max(maxHeight, height);
			}
		});

		// Apply the maximum height to empty day containers
		dayColumns.forEach((column) => {
			const emptyDay = column.querySelector('.scheduleassign-empty-day');
			const scheduleContainer = column.querySelector('.scheduleassign-day-schedules');

			if (emptyDay && scheduleContainer) {
				// Check if this column has schedules
				const hasSchedules =
					scheduleContainer.children.length > 1 ||
					(scheduleContainer.children.length === 1 &&
						!scheduleContainer.querySelector('.scheduleassign-empty-day'));

				if (!hasSchedules) {
					// This is an empty day, set its height to match the tallest column
					emptyDay.style.minHeight = `${maxHeight}px`;
				}
			}
		});
	}
</script>

<svelte:window on:click={handleClickOutside} />

<div class="scheduleassign-form-section">
	<div class="scheduleassign-section-header">
		<h2 class="admin-section-title">Schedule Management</h2>
		<p class="scheduleassign-form-instruction">
			Select year level and section to view all schedule assignments.
		</p>
	</div>

	<form>
		<div class="scheduleassign-hierarchical-form">
			<!-- Year Level and Section Selection Row -->
			<div class="scheduleassign-selection-row">
				<!-- Year Level Selection -->
				<div class="scheduleassign-form-group">
					<label class="scheduleassign-form-label" for="form-year">Year Level *</label>
					<div class="scheduleassign-custom-dropdown" class:open={isFormYearDropdownOpen}>
						<button
							type="button"
							class="scheduleassign-dropdown-button"
							class:selected={selectedFormYear}
							on:click={toggleFormYearDropdown}
							id="form-year"
						>
							{#if selectedFormYearObj}
								<div class="scheduleassign-selected-option">
									<span class="material-symbols-outlined option-icon">school</span>
									<div class="option-content">
										<span class="option-name">{selectedFormYearObj.name}</span>
									</div>
								</div>
							{:else}
								<span class="placeholder">Select year level</span>
							{/if}
							<span class="material-symbols-outlined scheduleassign-dropdown-arrow"
								>expand_more</span
							>
						</button>
						<div class="scheduleassign-dropdown-menu">
							{#each years as year (year.id)}
								<button
									type="button"
									class="scheduleassign-dropdown-item"
									class:selected={selectedFormYear === year.id}
									on:click={() => selectFormYear(year)}
								>
									<span class="material-symbols-outlined option-icon">school</span>
									<div class="option-content">
										<span class="option-name">{year.name}</span>
										<span class="option-description">{year.description}</span>
									</div>
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Section Selection -->
				<div class="scheduleassign-form-group">
					<label class="scheduleassign-form-label" for="form-section">Section *</label>
					<div
						class="scheduleassign-custom-dropdown"
						class:open={isFormSectionDropdownOpen}
						class:disabled={!selectedFormYear}
					>
						<button
							type="button"
							class="scheduleassign-dropdown-button"
							class:selected={selectedFormSection}
							class:disabled={!selectedFormYear}
							on:click={toggleFormSectionDropdown}
							id="form-section"
							disabled={!selectedFormYear}
						>
							{#if selectedFormSectionObj}
								<div class="scheduleassign-selected-option">
									<span class="material-symbols-outlined option-icon">class</span>
									<div class="option-content">
										<span class="option-name"
											>{selectedFormSectionObj.grade} · {selectedFormSectionObj.name}</span
										>
									</div>
								</div>
							{:else}
								<span class="placeholder"
									>{selectedFormYear ? 'Select section' : 'Select year level first'}</span
								>
							{/if}
							<span class="material-symbols-outlined scheduleassign-dropdown-arrow"
								>expand_more</span
							>
						</button>
						<div class="scheduleassign-dropdown-menu">
							<!-- Search Container -->
							<div class="scheduleassign-search-container">
								<input
									type="text"
									class="scheduleassign-search-input"
									placeholder="Search sections..."
									bind:value={sectionSearchTerm}
								/>
								<span class="material-icons scheduleassign-search-icon">search</span>
							</div>
							{#if isLoadingSections}
								<div class="admin-section-loading">
									<span class="system-loader"></span>
									<span>Loading sections...</span>
								</div>
							{:else if filteredSectionsWithSearch.length > 0}
								{#each filteredSectionsWithSearch as section (section.id)}
									<button
										type="button"
										class="scheduleassign-dropdown-item"
										class:selected={selectedFormSection === section.id}
										on:click={() => selectFormSection(section)}
									>
										<span class="material-symbols-outlined option-icon">class</span>
										<div class="option-content">
											<span class="option-name">{section.grade} · {section.name}</span>
											<span class="option-description">{section.grade} Section</span>
										</div>
									</button>
								{/each}
							{:else}
								<div class="scheduleassign-empty-state">
									<span class="material-symbols-outlined empty-icon">inbox</span>
									<span class="empty-text">No sections available</span>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Schedule Display Grid -->
			{#if selectedFormYear && selectedFormSection}
				<div class="scheduleassign-schedule-grid">
					<div class="scheduleassign-schedule-actions">
						<a href="#addScheduleForm" class="scheduleassign-add-schedule-link">
							<button
								type="button"
								class="scheduleassign-add-schedule-card"
								class:cancel-mode={showAddForm}
								on:click={toggleAddForm}
							>
								<span class="material-symbols-outlined">
									{showAddForm ? 'close' : 'add'}
								</span>
								{showAddForm ? 'Cancel Schedule' : 'Add Schedule'}
							</button>
						</a>
					</div>
					<!-- Add Schedule Form -->
					{#if showAddForm}
						<div class="scheduleassign-add-form" id="addScheduleForm">
							<h4 class="scheduleassign-form-title">Add New Schedule</h4>

							<!-- Day Selection with Checkboxes -->

							<div class="scheduleassign-form-inputs">
								<!-- Schedule Type and Subject/Activity Selection Row -->
								<div class="scheduleassign-type-subject-row">
									<!-- Schedule Type Selection -->
									<div class="scheduleassign-input-group">
										<label class="scheduleassign-input-label" for="scheduleassign-schedule-type-dropdown">Schedule Type</label>
										<div class="scheduleassign-custom-dropdown">
											<button
												type="button"
												id="scheduleassign-schedule-type-dropdown"
												class="scheduleassign-dropdown-trigger"
												class:open={isScheduleTypeDropdownOpen}
												class:selected={formData.scheduleType}
												on:click={toggleScheduleTypeDropdown}
											>
												{#if formData.scheduleType}
													<div class="scheduleassign-selected-option">
														<span class="material-symbols-outlined scheduleassign-option-icon">
															{formData.scheduleType === 'subject' ? 'book' : 'sports'}
														</span>
														<div class="scheduleassign-option-content">
															<span class="scheduleassign-option-name">
																{formData.scheduleType === 'subject' ? 'Subject' : 'Activity'}
															</span>
														</div>
													</div>
												{:else}
													<span class="scheduleassign-placeholder">Select Schedule Type</span>
												{/if}
												<span class="material-symbols-outlined scheduleassign-dropdown-arrow"
													>expand_more</span
												>
											</button>
											<div
												class="scheduleassign-dropdown-menu"
												class:open={isScheduleTypeDropdownOpen}
											>
												<button
													type="button"
													class="scheduleassign-dropdown-option"
													class:selected={formData.scheduleType === 'subject'}
													on:click={() => selectScheduleType('subject')}
												>
													<span class="material-symbols-outlined scheduleassign-option-icon"
														>book</span
													>
													<div class="scheduleassign-option-content">
														<span class="scheduleassign-option-name">Subject</span>
													</div>
												</button>
												<button
													type="button"
													class="scheduleassign-dropdown-option"
													class:selected={formData.scheduleType === 'activity'}
													on:click={() => selectScheduleType('activity')}
												>
													<span class="material-symbols-outlined scheduleassign-option-icon"
														>sports</span
													>
													<div class="scheduleassign-option-content">
														<span class="scheduleassign-option-name">Activity</span>
													</div>
												</button>
											</div>
										</div>
									</div>

									<!-- Subject/Activity Selection -->
									{#if formData.scheduleType === 'subject'}
										<div class="scheduleassign-input-group">
											<label class="scheduleassign-input-label" for="scheduleassign-subject-dropdown">Subject</label>
											<div class="scheduleassign-custom-dropdown">
												<button
													type="button"
													id="scheduleassign-subject-dropdown"
													class="scheduleassign-dropdown-trigger"
													class:open={isSubjectDropdownOpen}
													class:selected={formData.subjectId}
													disabled={isLoadingSubjects}
													on:click={toggleSubjectDropdown}
												>
													{#if formData.subjectId}
														{@const selectedSubject = subjects.find(
															(s) => s.id === formData.subjectId
														)}
														<div class="scheduleassign-selected-option">
															<span class="material-symbols-outlined scheduleassign-option-icon"
																>book</span
															>
															<div class="scheduleassign-option-content">
																<span class="scheduleassign-option-name"
																	>{selectedSubject?.name}</span
																>
															</div>
														</div>
													{:else}
														<span class="scheduleassign-placeholder">Select Subject</span>
													{/if}
													<span class="material-symbols-outlined scheduleassign-dropdown-arrow"
														>expand_more</span
													>
												</button>
												<div
													class="scheduleassign-dropdown-menu"
													class:open={isSubjectDropdownOpen}
												>
													<!-- Search Container -->
													<div class="scheduleassign-search-container">
														<input
															type="text"
															class="scheduleassign-search-input"
															placeholder="Search subjects..."
															bind:value={subjectSearchTerm}
														/>
														<span class="material-icons scheduleassign-search-icon">search</span>
													</div>
													{#if isLoadingSubjects}
														<div class="scheduleassign-loading">
															<span class="system-loader"></span>
															<span>Loading subjects...</span>
														</div>
													{:else if filteredSubjects.length > 0}
														{#each filteredSubjects as subject (subject.id)}
															<button
																type="button"
																class="scheduleassign-dropdown-option"
																class:selected={formData.subjectId === subject.id}
																on:click={() => selectSubject(subject)}
															>
																<span class="material-symbols-outlined scheduleassign-option-icon"
																	>book</span
																>
																<div class="scheduleassign-option-content">
																	<span class="scheduleassign-option-name">{subject.name}</span>
																</div>
															</button>
														{/each}
													{:else}
														<div class="scheduleassign-empty-state">
															<span class="material-symbols-outlined scheduleassign-empty-icon"
																>inbox</span
															>
															<span class="scheduleassign-empty-text">
																{subjectSearchTerm ? 'No subjects found' : 'No subjects available'}
															</span>
														</div>
													{/if}
												</div>
											</div>
										</div>
									{:else}
										<div class="scheduleassign-input-group">
											<label class="scheduleassign-input-label" for="scheduleassign-activity-dropdown">Activity Type</label>
											<div class="scheduleassign-custom-dropdown">
												<button
													type="button"
													id="scheduleassign-activity-dropdown"
													class="scheduleassign-dropdown-trigger"
													class:open={isActivityTypeDropdownOpen}
													class:selected={formData.activityTypeId}
													disabled={isLoadingActivityTypes}
													on:click={toggleActivityTypeDropdown}
												>
													{#if formData.activityTypeId}
														{@const selectedActivityType = activityTypes.find(
															(a) => a.id === formData.activityTypeId
														)}
														<div class="scheduleassign-selected-option">
															<span class="material-symbols-outlined scheduleassign-option-icon"
																>sports</span
															>
															<div class="scheduleassign-option-content">
																<span class="scheduleassign-option-name"
																	>{selectedActivityType?.name}</span
																>
															</div>
														</div>
													{:else}
														<span class="scheduleassign-placeholder">Select Activity Type</span>
													{/if}
													<span class="material-symbols-outlined scheduleassign-dropdown-arrow"
														>expand_more</span
													>
												</button>
												<div
													class="scheduleassign-dropdown-menu"
													class:open={isActivityTypeDropdownOpen}
												>
													{#if isLoadingActivityTypes}
														<div class="scheduleassign-loading">
															<span class="system-loader"></span>
															<span>Loading activity types...</span>
														</div>
													{:else if activityTypes.length > 0}
														{#each activityTypes as activityType (activityType.id)}
															<button
																type="button"
																class="scheduleassign-dropdown-option"
																class:selected={formData.activityTypeId === activityType.id}
																on:click={() => selectActivityType(activityType)}
															>
																<span class="material-symbols-outlined scheduleassign-option-icon"
																	>sports</span
																>
																<div class="scheduleassign-option-content">
																	<span class="scheduleassign-option-name">{activityType.name}</span
																	>
																</div>
															</button>
														{/each}
													{:else}
														<div class="scheduleassign-empty-state">
															<span class="material-symbols-outlined scheduleassign-empty-icon"
																>inbox</span
															>
															<span class="scheduleassign-empty-text"
																>No activity types available</span
															>
														</div>
													{/if}
												</div>
											</div>
										</div>
									{/if}
									<!-- Teacher Selection (Only for Subject type) -->
									{#if formData.scheduleType === 'subject'}
										<div class="scheduleassign-input-group">
											<label class="scheduleassign-input-label" for="scheduleassign-teacher-dropdown">Teacher</label>
											<div class="scheduleassign-custom-dropdown">
												<button
													type="button"
													id="scheduleassign-teacher-dropdown"
													class="scheduleassign-dropdown-trigger"
													class:open={isTeacherDropdownOpen}
													class:selected={formData.teacherId}
													disabled={isLoadingTeachers}
													on:click={toggleTeacherDropdown}
												>
													{#if formData.teacherId}
														{@const selectedTeacher = teachers.find(
															(t) => t.id === formData.teacherId
														)}
														<div class="scheduleassign-selected-option">
															<span class="material-symbols-outlined scheduleassign-option-icon"
																>person</span
															>
															<div class="scheduleassign-option-content">
																<span class="scheduleassign-option-name"
																	>{selectedTeacher?.first_name} {selectedTeacher?.last_name}</span
																>
															</div>
														</div>
													{:else}
														<span class="scheduleassign-placeholder">Select Teacher</span>
													{/if}
													<span class="material-symbols-outlined scheduleassign-dropdown-arrow"
														>expand_more</span
													>
												</button>
												<div
													class="scheduleassign-dropdown-menu"
													class:open={isTeacherDropdownOpen}
												>
													<!-- Search Container -->
													<div class="scheduleassign-search-container">
														<input
															type="text"
															class="scheduleassign-search-input"
															placeholder="Search teachers..."
															bind:value={teacherSearchTerm}
														/>
														<span class="material-icons scheduleassign-search-icon">search</span>
													</div>
													{#if isLoadingTeachers}
														<div class="scheduleassign-loading">
															<span class="system-loader"></span>
															<span>Loading teachers...</span>
														</div>
													{:else if filteredTeachers.length > 0}
														{#each filteredTeachers as teacher (teacher.id)}
															<button
																type="button"
																class="scheduleassign-dropdown-option"
																class:selected={formData.teacherId === teacher.id}
																on:click={() => selectTeacher(teacher)}
															>
																<span class="material-symbols-outlined scheduleassign-option-icon"
																	>person</span
																>
																<div class="scheduleassign-option-content">
																	<span class="scheduleassign-option-name"
																		>{teacher.first_name} {teacher.last_name}</span
																	>
																</div>
															</button>
														{/each}
													{:else}
														<div class="scheduleassign-empty-state">
															<span class="material-symbols-outlined scheduleassign-empty-icon"
																>inbox</span
															>
															<span class="scheduleassign-empty-text">
																{teacherSearchTerm ? 'No teachers found' : 'No teachers available'}
															</span>
														</div>
													{/if}
												</div>
											</div>
										</div>
									{/if}
								</div>
								<!-- Time Section -->
								<div class="scheduleassign-time-section">
									<div class="scheduleassign-time-row">
										<div class="scheduleassign-input-group">
											<TimeInput
												label="Start Time"
												bind:value={formData.startTime}
												bind:isOpen={isStartTimeOpen}
												placeholder="Select start time"
												on:change={(e) => (formData.startTime = e.detail.value)}
												on:open={handleStartTimeOpen}
											/>
										</div>
										<div class="scheduleassign-input-group">
											<TimeInput
												label="End Time"
												bind:value={formData.endTime}
												bind:isOpen={isEndTimeOpen}
												placeholder="Select end time"
												on:change={(e) => (formData.endTime = e.detail.value)}
												on:open={handleEndTimeOpen}
											/>
										</div>
									</div>

									<!-- Time Validation and Duration Display Container -->
									<div class="scheduleassign-time-info-container">
										{#if formData.startTime && formData.endTime}
											{#if timeValidationMessage}
												<div class="scheduleassign-time-error">
													<span class="material-symbols-outlined">error</span>
													<span>{timeValidationMessage}</span>
												</div>
											{:else if calculatedDuration}
												<div class="scheduleassign-time-duration">
													<span class="material-symbols-outlined">schedule</span>
													<span>Duration: {calculatedDuration}</span>
												</div>
											{/if}
										{/if}
									</div>
									<div class="scheduleassign-day-selection-section">
										<div class="scheduleassign-day-checkboxes">
											{#each days as day}
												<label class="scheduleassign-day-checkbox">
													<input type="checkbox" bind:group={selectedDays} value={day.id} />
													<span class="scheduleassign-checkbox-label">{day.name}</span>
												</label>
											{/each}
										</div>
									</div>
								</div>
							</div>

							<!-- Form Actions -->
							<div class="scheduleassign-form-actions">
								<button
									type="button"
									class="scheduleassign-save-schedule-btn"
									class:has-conflicts={hasConflicts}
									on:click={handleSubmitSchedule}
									disabled={isSubmitting ||
										selectedDays.length === 0 ||
										hasConflicts ||
										timeValidationMessage}
								>
									<span class="material-symbols-outlined">
										{hasConflicts ? 'block' : 'save'}
									</span>
									{#if hasConflicts}
										Cannot Save - Conflicts Detected
									{:else if isSubmitting}
										Saving...
									{:else}
										Save Schedule
									{/if}
								</button>
							</div>
						</div>
					{/if}

					<div class="scheduleassign-days-grid">
						{#each days as day (day.id)}
							<div class="scheduleassign-day-column">
								<!-- Day Header (Display Only) -->
								<div class="scheduleassign-day-header">
									<span class="day-name">{day.name}</span>
								</div>

								<!-- Schedule Cards for this Day -->
								<div class="scheduleassign-day-schedules">
									{#if schedulesByDay[day.id] && schedulesByDay[day.id].length > 0}
										{#each schedulesByDay[day.id] as assignment (assignment.id)}
											<div class="scheduleassign-assignment-card">
												<div class="scheduleassign-assignment-header">
													<div class="scheduleassign-assignment-info">
														<h4 class="scheduleassign-assignment-title">{assignment.subject}</h4>
														<p class="scheduleassign-assignment-subtitle">
															{assignment.grade} - {assignment.section}
														</p>
													</div>
													<div class="scheduleassign-assignment-actions">
														<button
															type="button"
															class="scheduleassign-delete-button"
															on:click={() => handleDeleteAssignment(assignment)}
															title="Delete assignment"
														>
															<span class="material-symbols-outlined">delete</span>
														</button>
													</div>
												</div>
												<div class="scheduleassign-assignment-details">
													{#if assignment.teacher}
														<div class="scheduleassign-detail-item">
															<span class="material-symbols-outlined scheduleassign-detail-icon"
																>person</span
															>
															<span class="scheduleassign-detail-text">{assignment.teacher}</span>
														</div>
													{/if}
													{#if assignment.startTime && assignment.endTime}
														<div class="scheduleassign-detail-item">
															<span class="material-symbols-outlined scheduleassign-detail-icon"
																>schedule</span
															>
															<span class="scheduleassign-detail-text"
																>{assignment.startTime} - {assignment.endTime}</span
															>
														</div>
													{/if}
													{#if assignment.type === 'subject' && assignment.roomName}
														<div class="scheduleassign-detail-item">
															<span class="material-symbols-outlined scheduleassign-detail-icon"
																>location_on</span
															>
															<span class="scheduleassign-detail-text">
																{assignment.roomName}
																{#if assignment.roomBuilding || assignment.roomFloor}
																	<span class="scheduleassign-room-details">
																		({assignment.roomBuilding}{assignment.roomFloor
																			? `, Floor ${assignment.roomFloor}`
																			: ''})
																	</span>
																{/if}
															</span>
														</div>
													{/if}
												</div>
											</div>
										{/each}
									{:else}
										<div class="scheduleassign-empty-day">
											<span class="material-symbols-outlined empty-icon">event_available</span>
											<span class="empty-text">No schedules</span>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<div class="scheduleassign-empty-state-main">
					<span class="material-symbols-outlined empty-icon">calendar_month</span>
					<h3>Select Year Level and Section</h3>
					<p>Choose a year level and section to view the weekly schedule.</p>
				</div>
			{/if}
		</div>
	</form>
</div>
