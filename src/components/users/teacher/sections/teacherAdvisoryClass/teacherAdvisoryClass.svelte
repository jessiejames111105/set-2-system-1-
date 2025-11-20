<script>
	import { onMount } from 'svelte';
	import { authStore } from '../../../../login/js/auth.js';
	import { api } from '../../../../../routes/api/helper/api-helper.js';
	import { modalStore } from '../../../../common/js/modalStore.js';
	import { toastStore } from '../../../../common/js/toastStore.js';
	import './teacherAdvisoryClass.css';
	import CountUp from '../../../../common/CountUp.svelte';

	// Helper function to format date as MM-DD-YYYY
	function formatDate(dateString) {
		if (!dateString) return null;
		const date = new Date(dateString);
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const year = date.getFullYear();
		return `${month}-${day}-${year}`;
	}

	// State variables
	let loading = $state(true);
	let error = $state(null);
	let advisoryData = $state({ averageGrade: null }); // Initialize with default structure
	let students = $state([]);
	let verifyingGrades = $state(new Set()); // Track which grades are being verified
	let currentQuarter = $state(2); // Current quarter from database (default to 2nd quarter)
	let currentQuarterName = $state('2nd Quarter'); // Current quarter name

	// Fetch advisory data from API
	async function fetchAdvisoryData() {
		try {
			loading = true;
			error = null;

			// Don't pass school_year - let the API use current school year from admin settings
			const result = await api.get(
				`/api/teacher-advisory?teacher_id=${$authStore.userData.id}&quarter=${currentQuarter}`
			);

			if (result.success) {
				advisoryData = { ...advisoryData, ...result.data.advisoryData }; // Merge with existing structure

				if (result.data.students) {
					// Transform the API data to match the component's expected format
					students = result.data.students.map((student) => ({
						id: student.id.toString(),
						name: student.name,
						full_name: student.name, // Add full_name property for verification functions
						studentNumber: student.student_number,
						gradeLevel: student.grade_level,
						gradesVerified: student.grades_verified,
						finalGrades: student.subjects.map((subject) => ({
							id: `${student.id}_${subject.subject_id}`,
							subjectName: subject.subject_name,
							subjectCode: subject.subject_code,
							teacherName: subject.teacher_name,
							finalGrade: subject.averages.final_grade,
							verified: subject.verified,
							verifiedAt: subject.verified_at,
							submittedToAdviser: subject.submitted_to_adviser
						})),
						grades: student.subjects.map((subject) => ({
							subject: subject.subject_name,
							teacher: subject.teacher_name,
							grade: subject.averages.final_grade,
							quarter: currentQuarterName,
							verified: subject.verified,
							submittedDate: subject.submitted_at ? formatDate(subject.submitted_at) : null,
							submittedToAdviser: subject.submitted_to_adviser,
							gradeItems: []
						}))
					}));
				}
			} else {
				error = result.error || 'Failed to fetch advisory data';
			}
		} catch (err) {
			console.error('Error fetching advisory data:', err);
			error = 'Failed to load advisory data. Please try again.';
		} finally {
			loading = false;
		}
	}

	// Fetch current quarter from the database based on system date
	async function fetchCurrentQuarter() {
		try {
			const result = await api.get('/api/current-quarter');

			if (result.success && result.data) {
				currentQuarter = result.data.currentQuarter;
				currentQuarterName = result.data.quarterName;
			} else {
				// Default to 1st quarter if API fails
				currentQuarter = 1;
				currentQuarterName = '1st Quarter';
				console.warn('Failed to fetch current quarter, defaulting to 1st Quarter');
			}
		} catch (error) {
			console.error('Error fetching current quarter:', error);
			// Default to 1st quarter if error occurs
			currentQuarter = 1;
			currentQuarterName = '1st Quarter';
		}
	}

	// Load data when component mounts
	onMount(async () => {
		if ($authStore.userData?.id) {
			// First, fetch the current quarter based on system date
			await fetchCurrentQuarter();
			// Then fetch advisory data using the current quarter
			await fetchAdvisoryData();
		}
	});

	// Calculate student averages (only use final grades, no fallback to regular grades)
	const studentsWithAverages = $derived(
		students.map((student) => {
			if (!student.finalGrades || student.finalGrades.length === 0) {
				return {
					...student,
					average: 0,
					verifiedGradesCount: 0,
					pendingGradesCount: student.grades?.length || 0
				};
			}

			// Only use final grades - no fallback to regular grades
			const total = student.finalGrades.reduce((sum, finalGrade) => {
				return sum + (finalGrade.finalGrade || 0);
			}, 0);
			const average = total / student.finalGrades.length;
			const verifiedFinalGrades =
				student.finalGrades?.filter((finalGrade) => finalGrade.verified) || [];
			return {
				...student,
				average: Math.round(average * 10) / 10,
				verifiedGradesCount: verifiedFinalGrades.length,
				pendingGradesCount: (student.finalGrades?.length || 0) - verifiedFinalGrades.length
			};
		})
	);

	// Update advisory data class average when students change
	$effect(() => {
		if (advisoryData && studentsWithAverages.length > 0) {
			const validAverages = studentsWithAverages
				.map((s) => s.average)
				.filter((avg) => avg !== null && avg > 0);

			if (validAverages.length > 0) {
				advisoryData.averageGrade =
					Math.round(
						(validAverages.reduce((sum, avg) => sum + avg, 0) / validAverages.length) * 10
					) / 10;
			} else {
				advisoryData.averageGrade = null;
			}
		} else if (advisoryData) {
			// Ensure averageGrade is set to null when no students or advisoryData exists
			advisoryData.averageGrade = null;
		}
	});

	// Verification functions for final grades
	async function verifyFinalGrade(gradeId) {
		if (!gradeId || verifyingGrades.has(gradeId)) return;

		// Find the student and subject for confirmation message
		const [studentId, subjectId] = gradeId.split('_');
		const student = students.find((s) => s.id === studentId);
		const finalGrade = student?.finalGrades?.find((fg) => fg.id === gradeId);
		const subjectName = finalGrade?.subjectName || 'Unknown Subject';
		const studentName = student?.full_name || 'Unknown Student';

		// Check if the grade is N/A and prevent verification
		if (
			finalGrade?.finalGrade === null ||
			finalGrade?.finalGrade === 'N/A' ||
			finalGrade?.finalGrade === ''
		) {
			toastStore.error(`Cannot verify ${subjectName} grade for ${studentName} - grade is N/A`);
			return;
		}

		modalStore.confirm(
			'Verify Grade',
			`Are you sure you want to verify the ${subjectName} grade for ${studentName}?`,
			async () => {
				// Add to loading set
				verifyingGrades.add(gradeId);
				verifyingGrades = new Set(verifyingGrades); // Trigger reactivity

				try {
					const result = await api.post('/api/teacher-advisory', {
						action: 'verify_student_grades',
						student_id: studentId,
						section_id: advisoryData.section_id,
						teacher_id: $authStore.userData.id,
						quarter: currentQuarter,
						verified: true
					});

					if (result.success) {
						// Update the local state
						students = students.map((student) => {
							const updatedStudent = {
								...student,
								finalGrades:
									student.finalGrades?.map((fg) =>
										fg.id === gradeId ? { ...fg, verified: true } : fg
									) || []
							};

							// Check if all final grades are now verified
							const allVerified = updatedStudent.finalGrades?.every((fg) => fg.verified) || false;
							updatedStudent.gradesVerified = allVerified;

							return updatedStudent;
						});

						toastStore.success(`${subjectName} grade verified for ${studentName}`);

						// Remove from loading set after successful update
						verifyingGrades.delete(gradeId);
						verifyingGrades = new Set(verifyingGrades); // Trigger reactivity
					} else {
						console.error('Failed to verify grade:', result.error);
						toastStore.error(result.error || 'Failed to verify grade. Please try again.');
						// Remove from loading set on error
						verifyingGrades.delete(gradeId);
						verifyingGrades = new Set(verifyingGrades); // Trigger reactivity
					}
				} catch (error) {
					console.error('Error verifying grade:', error);
					toastStore.error('Failed to verify grade. Please try again.');
					// Remove from loading set on error
					verifyingGrades.delete(gradeId);
					verifyingGrades = new Set(verifyingGrades); // Trigger reactivity
				}
			},
			() => {
				// User cancelled - do nothing
			}
		);
	}

	async function verifyStudentGrades(studentId) {
		// Find the student for confirmation message
		const student = students.find((s) => s.id === studentId);
		const studentName = student?.full_name || 'Unknown Student';

		// Check if any grades are N/A and prevent verification
		const hasNAGrades = student?.finalGrades?.some(
			(fg) => fg.finalGrade === null || fg.finalGrade === 'N/A' || fg.finalGrade === ''
		);

		if (hasNAGrades) {
			toastStore.error(`Cannot verify all grades for ${studentName} - some grades are N/A`);
			return;
		}

		modalStore.confirm(
			'Verify All Grades',
			`Are you sure you want to verify all grades for ${studentName}?`,
			async () => {
				try {
					const result = await api.post('/api/teacher-advisory', {
						action: 'verify_student_grades',
						student_id: studentId,
						section_id: advisoryData.section_id,
						teacher_id: $authStore.userData.id,
						quarter: currentQuarter,
						verified: true
					});

					if (result.success) {
						// Update the local state
						students = students.map((student) => {
							if (student.id === studentId) {
								return {
									...student,
									gradesVerified: true,
									finalGrades: student.finalGrades?.map((fg) => ({ ...fg, verified: true })) || []
								};
							}
							return student;
						});

						toastStore.success(`All grades verified for ${studentName}`);
					} else {
						console.error('Failed to verify student grades:', result.error);
						toastStore.error(result.error || 'Failed to verify student grades. Please try again.');
					}
				} catch (error) {
					console.error('Error verifying student grades:', error);
					toastStore.error('Failed to verify student grades. Please try again.');
				}
			},
			() => {
				// User cancelled - do nothing
			}
		);
	}

	// Bulk verification functions
	async function verifyAllStudents() {
		// Check if any student has N/A grades and prevent verification
		const studentsWithNAGrades = students.filter((student) =>
			student.finalGrades?.some(
				(fg) => fg.finalGrade === null || fg.finalGrade === 'N/A' || fg.finalGrade === ''
			)
		);

		if (studentsWithNAGrades.length > 0) {
			const studentNames = studentsWithNAGrades.map((s) => s.full_name).join(', ');
			toastStore.error(
				`Cannot verify all grades - the following students have N/A grades: ${studentNames}`
			);
			return;
		}

		modalStore.confirm(
			'Verify All Students',
			'Are you sure you want to verify all grades for all students in this class?',
			async () => {
				try {
					const result = await api.post('/api/teacher-advisory', {
						action: 'verify_all_grades',
						section_id: advisoryData.section_id,
						teacher_id: $authStore.userData.id,
						quarter: currentQuarter,
						verified: true
					});

					if (result.success) {
						students = students.map((student) => ({
							...student,
							gradesVerified: true,
							finalGrades: student.finalGrades?.map((fg) => ({ ...fg, verified: true })) || [],
							grades: student.grades.map((grade) => ({ ...grade, verified: true }))
						}));

						toastStore.success('All student grades verified successfully');
					} else {
						console.error('Failed to verify all students:', result.error);
						toastStore.error(result.error || 'Failed to verify all students. Please try again.');
					}
				} catch (error) {
					console.error('Error verifying all students:', error);
					toastStore.error('Failed to verify all students. Please try again.');
				}
			},
			() => {
				// User cancelled - do nothing
			}
		);
	}

	// Array of border color classes for each stat card
	const borderColors = ['border-blue', 'border-green', 'border-orange', 'border-purple'];

	// Function to get border color by index
	function getBorderColorByIndex(index) {
		return borderColors[index % borderColors.length];
	}

	// Calculate pass rate (students with average >= 75)
	const passRate = $derived(() => {
		const studentsWithGrades = studentsWithAverages.filter(s => s.average > 0);
		if (studentsWithGrades.length === 0) return 0;
		const passingStudents = studentsWithGrades.filter(s => s.average >= 75).length;
		const rate = Math.round((passingStudents / studentsWithGrades.length) * 100);
		
		return rate;
	});

	// Stats configuration
	let statsConfig = [
		{
			id: 'students',
			label: 'Total Students',
			getValue: () => advisoryData?.totalStudents || 0,
			icon: 'people',
			color: 'var(--school-primary)',
			showAsNumber: true
		},
		{
			id: 'subjects',
			label: 'Subjects Tracked',
			getValue: () => advisoryData?.subjectsCount || 0,
			icon: 'book',
			color: 'var(--school-secondary)',
			showAsNumber: true
		},
		{
			id: 'average',
			label: 'Class Average',
			getValue: () =>
				advisoryData && advisoryData.averageGrade !== null ? advisoryData.averageGrade : 0,
			icon: 'grade',
			color: 'var(--school-accent)',
			showAsNumber: true
		},
		{
			id: 'passRate',
			label: 'Pass Rate',
			getValue: () => passRate(),
			icon: 'trending_up',
			color: 'var(--success)',
			showAsNumber: true,
			suffix: '%'
		}
	];

	// Selected student for detailed view
	// UI state
	let selectedStudent = $state(null);
	let isQuarterDropdownOpen = $state(false);

	function selectStudent(student) {
		selectedStudent = selectedStudent?.id === student.id ? null : student;
	}

	function getGradeColor(grade) {
		if (grade >= 90) return 'var(--success)';
		if (grade >= 80) return 'var(--school-accent)';
		if (grade >= 75) return 'var(--warning)';
		return 'var(--error)';
	}

	function getGradeStatus(grade) {
		if (grade >= 90) return 'Excellent';
		if (grade >= 80) return 'Good';
		if (grade >= 75) return 'Satisfactory';
		return 'Needs Improvement';
	}

	// Quarter dropdown options
	const quarterOptions = [
		{ id: 1, name: '1st Quarter', icon: 'looks_one' },
		{ id: 2, name: '2nd Quarter', icon: 'looks_two' },
		{ id: 3, name: '3rd Quarter', icon: 'looks_3' },
		{ id: 4, name: '4th Quarter', icon: 'looks_4' }
	];

	// Toggle quarter dropdown
	function toggleQuarterDropdown() {
		isQuarterDropdownOpen = !isQuarterDropdownOpen;
	}

	// Select quarter and close dropdown
	async function selectQuarter(quarter) {
		if (quarter.id !== currentQuarter) {
			currentQuarter = quarter.id;
			currentQuarterName = quarter.name;
			isQuarterDropdownOpen = false;
			// Fetch new data for the selected quarter
			await fetchAdvisoryData();
		} else {
			isQuarterDropdownOpen = false;
		}
	}

	// Close dropdown when clicking outside
	function handleClickOutside(event) {
		if (!event.target.closest('.quarter-dropdown')) {
			isQuarterDropdownOpen = false;
		}
	}

	// Get selected quarter object
	const selectedQuarterObj = $derived(quarterOptions.find((q) => q.id === currentQuarter));
</script>

<svelte:window on:click={handleClickOutside} />

<div class="advisory-class-container">
	<!-- Header Section -->
	<div class="advisory-page-header fade-in">
		<div class="header-content">
			<h1 class="advisory-page-title">Advisory Class Dashboard</h1>
			<div class="header-controls">
				<div class="advisory-class-info">
					<div class="class-detail">
						<span class="material-symbols-outlined">school</span>
						<span>{advisoryData?.sectionName || 'Loading...'}</span>
					</div>
					<div class="class-detail">
						<span class="material-symbols-outlined">meeting_room</span>
						<span>{advisoryData?.roomName || 'Loading...'}</span>
					</div>
				</div>
				<div class="quarter-selector-container">
					<div class="quarter-dropdown" class:open={isQuarterDropdownOpen}>
						<button
							type="button"
							class="quarter-select-button"
							class:selected={currentQuarter}
							onclick={toggleQuarterDropdown}
							id="quarter-select"
						>
							{#if selectedQuarterObj}
								<div class="quarter-selected-option">
									<span class="material-symbols-outlined quarter-option-icon">{selectedQuarterObj.icon}</span>
									<div class="quarter-option-content">
										<span class="quarter-option-name">{selectedQuarterObj.name}</span>
									</div>
								</div>
							{:else}
								<span class="quarter-placeholder">Select quarter</span>
							{/if}
							<span class="material-symbols-outlined quarter-dropdown-arrow">expand_more</span>
						</button>
						<div class="quarter-dropdown-menu">
							{#each quarterOptions as quarter (quarter.id)}
								<button
									type="button"
									class="quarter-dropdown-option"
									class:selected={currentQuarter === quarter.id}
									onclick={() => selectQuarter(quarter)}
								>
									<span class="material-symbols-outlined quarter-option-icon">{quarter.icon}</span>
									<div class="quarter-option-content">
										<span class="quarter-option-name">{quarter.name}</span>
									</div>
								</button>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Stats Cards Section -->
	<div class="advisory-stats-section">
		<div class="advisory-stats-grid">
			{#each statsConfig as stat, index (stat.id)}
				<div class="advisory-stat-card {getBorderColorByIndex(index)} stagger-item" style="--stagger-index: {index}">
					<div class="stat-card-header">
						<p class="advisory-stat-label">{stat.label}</p>
						<div class="advisory-stat-icon">
							<span class="material-symbols-outlined">{stat.icon}</span>
						</div>
					</div>
					<div class="stat-card-content">
						<h3 class="advisory-stat-value">
							{#key stat.getValue()}
								<CountUp 
									value={stat.getValue()} 
									decimals={stat.id === 'average' ? 1 : 0} 
									duration={2}
								/>
							{/key}
							{#if stat.suffix}
								<span class="stat-suffix">{stat.suffix}</span>
							{/if}
						</h3>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Students Section -->
	<div class="students-section">
		<div class="section-header">
			<button class="refresh-btn" onclick={fetchAdvisoryData}>
				<span class="material-symbols-outlined">refresh</span>
				Refresh
			</button>
			<!-- Bulk verification controls -->
			<div class="bulk-controls">
				<button class="verify-all-btn" onclick={verifyAllStudents}>
					<span class="material-symbols-outlined">verified</span>
					Verify All Grades
				</button>
			</div>
		</div>
		<div class="advisory-students-grid">
			{#if loading}
				<div class="students-loading">
					<div class="system-loader"></div>
					<p>Loading students and grades...</p>
				</div>
			{:else if error}
				<div class="students-error">
					<span class="material-symbols-outlined error-icon">error</span>
					<p>Error loading students: {error}</p>
				</div>
			{:else if studentsWithAverages.length === 0}
				<div class="students-empty">
					<span class="material-symbols-outlined">school</span>
					<p>No students found in this advisory class</p>
				</div>
			{:else}
				{#each studentsWithAverages as student, index (student.id)}
					<div
						class="advisory-student-card {student.gradesVerified ? 'verified' : 'pending'} stagger-item"
						class:selected={selectedStudent?.id === student.id}
						style="--stagger-index: {index}"
					>
						<button class="student-header" onclick={() => selectStudent(student)}>
							<div class="student-header-content">
								<div class="student-title-section">
									<h3 class="student-title">{student.name} · Grade {student.gradeLevel || '7'}</h3>
								</div>
								<div class="student-info-row">
									<div class="student-info-item">
										<span class="material-symbols-outlined">person</span>
										<span>{student.studentNumber}</span>
									</div>
									<div class="student-info-item">
										<span class="material-symbols-outlined"
											>{student.gradesVerified ? 'verified' : 'pending'}</span
										>
										<span>{student.gradesVerified ? 'Verified' : 'Pending'}</span>
									</div>
									<div class="student-info-item">
										<span class="material-symbols-outlined">assignment</span>
										<span
											>{student.verifiedGradesCount} Verified, {student.pendingGradesCount} Pending</span
										>
									</div>
								</div>
							</div>
							<div class="student-average">
								<div
									class="average-score"
									style="color: {student.average !== null
										? getGradeColor(student.average)
										: '#666'}"
								>
									{student.average !== null ? student.average : 'N/A'}
								</div>
							</div>
							<div class="expand-icon">
								<span class="material-symbols-outlined">
									{selectedStudent?.id === student.id ? 'expand_less' : 'expand_more'}
								</span>
							</div>
						</button>

						{#if selectedStudent?.id === student.id}
							<div class="student-grades">
								<!-- Regular Grades Section -->
								<div class="grades-header">
									<h4 class="grades-title">Subject Grades ({currentQuarterName})</h4>
									<div class="student-verification-controls">
										<button
											class="verify-btn"
											onclick={(e) => { e.stopPropagation(); verifyStudentGrades(student.id); }}
										>
											<span class="material-symbols-outlined">verified</span>
											Verify All
										</button>
									</div>
								</div>
								<div class="grades-grid">
									{#each student.grades as grade, gradeIndex (grade.subject)}
										{@const finalGrade = student.finalGrades?.find(
											(fg) => fg.subjectName === grade.subject
										)}
										<button
											class="grade-item {finalGrade?.verified ? 'verified' : 'unverified'} stagger-grade-item"
											class:loading={verifyingGrades.has(finalGrade?.id)}
											disabled={verifyingGrades.has(finalGrade?.id) || finalGrade?.verified}
											onclick={() => !finalGrade?.verified && verifyFinalGrade(finalGrade.id)}
											style="--stagger-index: {gradeIndex}"
										>
											<div class="grade-overlay">
												<div class="overlay-content">
													{#if verifyingGrades.has(finalGrade?.id)}
														<div class="loading-spinner"></div>
														<div class="overlay-text">Processing...</div>
													{:else}
														<span class="material-symbols-outlined">verified</span>
														<div class="overlay-text">Verify</div>
													{/if}
												</div>
											</div>
											<div class="grade-item-header">
												<div class="grade-info">
													<div class="subject-name">{grade.subject}</div>
													<div class="subject-teacher">by {grade.teacher}</div>
													{#if finalGrade && finalGrade.submittedToAdviser && finalGrade.finalGrade !== null}
														<small class="submitted-date"
															>Submitted: {grade.submittedDate || 'N/A'}</small
														>
													{:else}
														<small class="submitted-date not-submitted"
															>Grades not submitted yet</small
														>
													{/if}
												</div>
												<div class="grade-controls">
													{#if finalGrade && finalGrade.submittedToAdviser && finalGrade.finalGrade !== null}
														<div
															class="grade-score-display"
															style="color: {getGradeColor(finalGrade.finalGrade)}"
														>
															{Math.round(finalGrade.finalGrade * 10) / 10}
														</div>
													{:else}
														<div class="grade-score-display" style="color: #666;">N/A</div>
													{/if}
												</div>
											</div>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>
