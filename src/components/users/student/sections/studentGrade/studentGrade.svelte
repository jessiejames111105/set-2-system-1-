<script>
  import { onMount } from 'svelte';
  import { authStore } from '../../../../login/js/auth.js';
  import { toastStore } from '../../../../common/js/toastStore.js';
  import './studentGrade.css';
	import CountUp from '../../../../common/CountUp.svelte';
	import AIAnalysisDisplay from './AIAnalysisDisplay.svelte';
	import { studentGradeStore } from '../../../../../lib/stores/student/studentGradeStore.js';
	import { studentGradeModalStore } from './studentGradeModal/studentGradeModalStore.js';
	
	// Local UI state
	let quarters = ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'];
	let isDropdownOpen = $state(false);
	
	// AI Analysis state
	let showAiAnalysis = $state(false);
	let lastStudentId = null;
	
	// Mobile carousel state for grade stats
	let currentStatPage = $state(0); // 0 = Quarter Average, 1 = Total Subjects, 2 = Class Rank
	let touchStartX = $state(0);
	let touchEndX = $state(0);
	
	// Mobile carousel state for subject cards
	let currentSubjectPage = $state(0);
	let subjectTouchStartX = $state(0);
	let subjectTouchEndX = $state(0);
	
	// Reactive AI Analysis from store
	let aiAnalysisData = $derived($studentGradeStore.aiAnalysis);
	let aiAnalysisLoading = $derived($studentGradeStore.aiAnalysisLoading);
	let aiAnalysisError = $derived($studentGradeStore.aiAnalysisError);
	
	// Reset showAiAnalysis when switching accounts and track current student ID
	$effect(() => {
		if ($authStore.userData?.id) {
			if (lastStudentId && lastStudentId !== $authStore.userData.id) {
				showAiAnalysis = false;
			}
			lastStudentId = $authStore.userData.id;
		}
	});
	
	// Progress bar color animation state
	let progressBarColors = $state({}); // Store current color for each subject
	let progressBarAnimations = $state({}); // Store animation frame IDs

	// Reactive store values
	let grades = $derived($studentGradeStore.grades);
	let subjects = $derived(grades); // Alias for template
	let statistics = $derived($studentGradeStore.statistics);
	let overallAverage = $derived(statistics.overallAverage);
	let totalSubjects = $derived(statistics.totalSubjects);
	let sectionInfo = $derived($studentGradeStore.sectionInfo);
	let classRank = $derived($studentGradeStore.classRank);
	let totalStudentsInSection = $derived($studentGradeStore.totalStudentsInSection);
	let currentQuarterNum = $derived($studentGradeStore.currentQuarter);
	let currentQuarter = $derived($studentGradeStore.currentQuarterName);
	let currentSchoolYear = $derived($studentGradeStore.currentSchoolYear);
	let loading = $derived($studentGradeStore.isLoading);
	let error = $derived($studentGradeStore.error);
	let previousQuarterAverage = $derived($studentGradeStore.previousQuarterAverage);
	let averageChange = $derived($studentGradeStore.averageChange);
	let isPreloading = $derived($studentGradeStore.isPreloading);
	let preloadProgress = $derived($studentGradeStore.preloadProgress);

	// Quarter to grading period mapping
	const quarterToGradingPeriod = {
		'1st Quarter': 1,
		'2nd Quarter': 2,
		'3rd Quarter': 3,
		'4th Quarter': 4
	};
	
	// Watch for grade changes and trigger progress bar animations
	$effect(() => {
		if (grades && grades.length > 0) {
			// Initialize progress bar colors with starting color BEFORE animation
			const needsInit = grades.some(subject => 
				subject.numericGrade > 0 && 
				subject.teacher !== "No teacher" && 
				subject.verified && 
				!progressBarColors[subject.id]
			);
			
			if (needsInit) {
				grades.forEach(subject => {
					if (subject.numericGrade > 0 && subject.teacher !== "No teacher" && subject.verified) {
						if (!progressBarColors[subject.id]) {
							progressBarColors[subject.id] = getGradeColor(65); // Start with "needs improvement" color
						}
					}
				});
				progressBarColors = { ...progressBarColors }; // Trigger reactivity
				
				// Start progress bar color animations for each subject
				setTimeout(() => {
					grades.forEach(subject => {
						if (subject.numericGrade > 0 && subject.teacher !== "No teacher" && subject.verified) {
							animateProgressBarColor(subject.id, subject.numericGrade);
						}
					});
				}, 100); // Small delay to ensure DOM is ready
			}
		}
	});

	function toggleDropdown() {
		isDropdownOpen = !isDropdownOpen;
	}

	async function selectQuarter(quarter) {
		isDropdownOpen = false;
		
		// Clear AI analysis from store when quarter changes
		studentGradeStore.clearAiAnalysis();
		showAiAnalysis = false;
		
		// Reset subject carousel
		currentSubjectPage = 0;
		
		// Cancel and reset progress bar animations
		Object.values(progressBarAnimations).forEach(animationId => {
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
		});
		progressBarAnimations = {};
		progressBarColors = {};
		
		// Use store to change quarter
		const quarterNum = quarterToGradingPeriod[quarter];
		if ($authStore.userData?.id) {
			await studentGradeStore.changeQuarter($authStore.userData.id, quarterNum, currentSchoolYear);
		}
	}

	function handleClickOutside(event) {
		if (isDropdownOpen && !event.target.closest('.custom-dropdown')) {
			isDropdownOpen = false;
		}
	}


	// Function to determine grade color based on value using CSS custom properties
	function getGradeColor(grade) {
		if (grade === 0 || grade === null || grade === undefined) return 'var(--grade-no-grade)';
		if (grade >= 85) return 'var(--grade-excellent)';
		if (grade >= 80) return 'var(--grade-good)';
		if (grade >= 75) return 'var(--grade-satisfactory)';
		if (grade >= 65) return 'var(--grade-needs-improvement)';
		if (grade < 65) return 'var(--grade-needs-improvement)';
		return 'var(--grade-needs-improvement)';
	}

	// Animate progress bar color transition
	function animateProgressBarColor(subjectId, finalGrade, duration = 2500) {
		// Cancel any existing animation for this subject
		if (progressBarAnimations[subjectId]) {
			cancelAnimationFrame(progressBarAnimations[subjectId]);
		}
		
		const startTime = Date.now();
		
		function updateColor() {
			const currentTime = Date.now();
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);
			
			// Determine target tier based on final grade
			let targetTier = 0;
			if (finalGrade >= 85) targetTier = 3;
			else if (finalGrade >= 80) targetTier = 2;
			else if (finalGrade >= 75) targetTier = 1;
			else targetTier = 0;
			
			// Use faster progression (1.6x speed)
			const colorProgress = Math.min(progress * 1.6, 1);
			
			// Calculate current tier based on time progress
			const currentTier = Math.min(Math.floor(colorProgress * (targetTier + 1)), targetTier);
			
			// Map tier to grade value for color
			const tierToGrade = [65, 75, 80, 85];
			const displayGrade = tierToGrade[currentTier];
			
			// Update color
			progressBarColors[subjectId] = getGradeColor(displayGrade);
			progressBarColors = { ...progressBarColors }; // Trigger reactivity
			
			// Continue animation if not complete
			if (progress < 1) {
				progressBarAnimations[subjectId] = requestAnimationFrame(updateColor);
			} else {
				// Ensure final color is set
				progressBarColors[subjectId] = getGradeColor(finalGrade);
				progressBarColors = { ...progressBarColors };
				delete progressBarAnimations[subjectId];
			}
		}
		
		updateColor();
	}

	// Function to format grade display
	function formatGrade(grade, hasTeacher, hasGrade, verified) {
		if (!hasTeacher) return 'N/A';
		if (!hasGrade || !verified) return 'N/A';
		return grade > 0 ? formatGradeDisplay(grade) : 'N/A';
	}

	// Function to format grade display with clean decimals (removes .0 for whole numbers)
	function formatGradeDisplay(grade) {
		if (grade === null || grade === undefined || grade === 0) return 'N/A';
		// Check if the grade is a whole number
		if (grade % 1 === 0) {
			return grade.toString();
		}
		return grade.toFixed(1);
	}

	// Function to get progress bar width
	function getProgressWidth(grade, hasTeacher, hasGrade, verified) {
		if (!hasTeacher || !hasGrade || !verified || grade === 0) return 0;
		return Math.min((grade / 100) * 100, 100);
	}

	// Generate randomized card color based on subject index/slot
	function getCardColor(index) {
		const colors = [
			'blue', 'green', 'purple', 'yellow', 'orange', 
			'red', 'teal', 'indigo', 'pink', 'cyan', 
			'lime', 'amber', 'deeporange'
		];
		return colors[index % colors.length];
	}

	// Get card color classes for styling
	function getCardColorClasses(index) {
		const color = getCardColor(index);
		return {
			border: `var(--subject-card-${color}-border)`,
			text: `var(--subject-card-${color}-text)`,
			icon: `var(--subject-card-${color}-icon)`
		};
	}

	// Get grade performance indicator text
	function getGradeIndicator(grade) {
		if (grade >= 85) return 'Excellent';
		if (grade >= 80) return 'Good';
		if (grade >= 75) return 'Satisfactory';
		if (grade >= 65) return 'Needs Improvement';
		return 'No Grade';
	}

	// Get grade performance color class
	function getGradeColorClass(grade) {
		if (grade === null || grade === undefined || grade === 0) return 'grade-no-grade';
		if (grade >= 85) return 'grade-excellent';
		if (grade >= 80) return 'grade-good';
		if (grade >= 75) return 'grade-satisfactory';
		if (grade >= 65) return 'grade-needs-improvement';
		return 'grade-needs-improvement'; // For grades below 65 (like 38)
	}

	// Get first quarter message based on current performance
	function getFirstQuarterMessage(average) {
		if (average >= 90) {
			return 'Keep it up!';
		} else if (average >= 85) {
			return 'Maintain the momentum!';
		} else if (average >= 80) {
			return 'Push for higher!';
		} else if (average >= 75) {
			return 'Aim higher next quarter!';
		} else {
			return 'Work harder next quarter!';
		}
	}

	// Mobile carousel functions for grade stats
	function handleStatTouchStart(e) {
		touchStartX = e.touches[0].clientX;
	}

	function handleStatTouchMove(e) {
		touchEndX = e.touches[0].clientX;
	}

	function handleStatTouchEnd() {
		if (!touchStartX || !touchEndX) return;
		
		const swipeDistance = touchStartX - touchEndX;
		const minSwipeDistance = 50; // Minimum distance for a swipe
		
		if (Math.abs(swipeDistance) > minSwipeDistance) {
			if (swipeDistance > 0) {
				// Swiped left - go to next page (wrap to first if at end)
				currentStatPage = (currentStatPage + 1) % 3;
			} else {
				// Swiped right - go to previous page (wrap to last if at start)
				currentStatPage = (currentStatPage - 1 + 3) % 3;
			}
		}
		
		// Reset
		touchStartX = 0;
		touchEndX = 0;
	}

	function goToStatPage(page) {
		currentStatPage = page;
	}

	// Mobile carousel functions for subject cards
	function handleSubjectTouchStart(e) {
		subjectTouchStartX = e.touches[0].clientX;
	}

	function handleSubjectTouchMove(e) {
		subjectTouchEndX = e.touches[0].clientX;
	}

	function handleSubjectTouchEnd() {
		if (!subjectTouchStartX || !subjectTouchEndX) return;
		
		const swipeDistance = subjectTouchStartX - subjectTouchEndX;
		const minSwipeDistance = 50;
		
		if (Math.abs(swipeDistance) > minSwipeDistance) {
			if (swipeDistance > 0) {
				// Swiped left - go to next subject (wrap to first if at end)
				currentSubjectPage = (currentSubjectPage + 1) % subjects.length;
			} else {
				// Swiped right - go to previous subject (wrap to last if at start)
				currentSubjectPage = (currentSubjectPage - 1 + subjects.length) % subjects.length;
			}
		}
		
		subjectTouchStartX = 0;
		subjectTouchEndX = 0;
	}

	function goToSubjectPage(page) {
		currentSubjectPage = page;
	}

	// Get verified grades count
	function getVerifiedGradesCount(gradesList) {
		if (!gradesList || gradesList.length === 0) return { verified: 0, total: 0 };
		const verifiedCount = gradesList.filter(subject => 
			subject.verified && 
			subject.numericGrade > 0 && 
			subject.teacher !== "No teacher"
		).length;
		return { verified: verifiedCount, total: gradesList.length };
	}

	// Reactive calculation for verified grades - explicitly depend on grades and quarter
	let verifiedGrades = $derived.by(() => {
		// Depend on both grades and currentQuarterNum to force recalculation
		if (currentQuarterNum && grades) {
			return getVerifiedGradesCount(grades);
		}
		return { verified: 0, total: 0 };
	});

	// Animation key to trigger re-render on quarter changes
	let animationKey = $derived(currentQuarterNum || 0);

	// Function to get AI analysis
	async function getAiAnalysis(forceRefresh = false) {
		if (aiAnalysisLoading || !subjects.length || !$authStore.userData?.id) return;
		
		showAiAnalysis = true;
		
		try {
			const quarter = quarterToGradingPeriod[currentQuarter];
			await studentGradeStore.loadAiAnalysis($authStore.userData.id, quarter, currentSchoolYear, forceRefresh);
			
			if (!forceRefresh) {
				toastStore.success('AI Analysis generated successfully');
			}
		} catch (error) {
			// AI Analysis error
			toastStore.error('Failed to generate AI analysis');
		}
	}

	// Function to refresh AI analysis (bypass cache)
	async function refreshAiAnalysis() {
		try {
			await getAiAnalysis(true);
			toastStore.success('Analysis refreshed successfully');
		} catch (error) {
			// Error refreshing analysis
		}
	}

	// Function to toggle AI analysis visibility
	function toggleAiAnalysis() {
		if (!showAiAnalysis && !aiAnalysisData) {
			// Try to init from cache first
			const studentId = $authStore.userData?.id;
			const quarter = quarterToGradingPeriod[currentQuarter];
			
			if (studentId) {
				const hasCache = studentGradeStore.initAiAnalysis(studentId, quarter, currentSchoolYear);
				if (!hasCache) {
					// No cache, fetch new analysis
					getAiAnalysis();
				} else {
					// Had cache, just show it
					showAiAnalysis = true;
				}
			}
		} else {
			showAiAnalysis = !showAiAnalysis;
		}
	}

	// Function to open grade details modal
	function openGradeModal(subject) {
		studentGradeModalStore.open(subject, currentQuarter, currentSchoolYear);
	}

	// Load data when component mounts
	onMount(async () => {
		if ($authStore.userData?.id) {
			// Initialize store (will check cache first)
			const hasCachedData = studentGradeStore.init($authStore.userData.id);
			
			// Load fresh data (silent if we have cached data)
			await studentGradeStore.loadGrades($authStore.userData.id, null, null, hasCachedData);
			
			// Start background preloading of all quarters after a short delay
			setTimeout(async () => {
				try {
					const currentQuarter = $studentGradeStore.currentQuarter;
					const currentYear = $studentGradeStore.currentSchoolYear;
					await studentGradeStore.preloadAllQuarters($authStore.userData.id, currentQuarter, currentYear);					
				} catch (error) {
					// Error during background preload
				}
			}, 1000); // Wait 1 second after initial load before starting background preload
		}
		
		// Cleanup on component destroy
		return () => {
			// Cancel all progress bar animations
			Object.values(progressBarAnimations).forEach(animationId => {
				if (animationId) {
					cancelAnimationFrame(animationId);
				}
			});
		};
	});

</script>

<svelte:window on:click={handleClickOutside} />

<div class="grades-container">
	<!-- Header Section -->
	<div class="grades-header">
		<div class="header-content">
			<h1 class="page-title">My Grades</h1>
			<p class="page-subtitle">Performance Overview</p>
		</div>
		<div class="quarter-selector">
			<div class="custom-dropdown">
				<button class="dropdown-button" onclick={toggleDropdown}>
					<span class="material-symbols-outlined">calendar_today</span>
					<span class="dropdown-text">{currentQuarter}</span>
					<span class="material-symbols-outlined dropdown-arrow" class:rotated={isDropdownOpen}>expand_more</span>
				</button>
				{#if isDropdownOpen}
					<div class="dropdown-menu-quarter">
						{#each quarters as quarter}
							<button class="dropdown-item-quarter" class:active={quarter === currentQuarter} onclick={() => selectQuarter(quarter)}>
								{quarter}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Loading State -->
	{#if error}
		<!-- Error State -->
		<div class="error-container">
			<span class="material-symbols-outlined error-icon">error</span>
			<p>Error: {error}</p>
			<button class="retry-btn" onclick={() => studentGradeStore.loadGrades($authStore.userData.id)}>
				<span class="material-symbols-outlined">refresh</span>
				Try Again
			</button>
		</div>
	{:else}
		<!-- Overall Performance Card -->
		<div class="performance-card">
		<div class="performance-header">
			<div class="performance-title-section">
				<div class="performance-title-content">
					<h2 class="performance-title">Academic Performance</h2>
					{#if sectionInfo}
						<div class="performance-subtitle">Grade {sectionInfo.gradeLevel} • {sectionInfo.name} </div>
					{/if}
				</div>
				<button 
					class="refresh-data-btn" 
					onclick={() => studentGradeStore.forceRefresh($authStore.userData.id, currentQuarterNum, currentSchoolYear)}
					title="Refresh data from database"
					disabled={loading}>
					<span class="material-symbols-outlined">refresh</span>
				</button>
			</div>
		</div>
			
			{#key `stats-${currentQuarterNum}-${currentSchoolYear}`}
				<div 
					class="performance-stats"
					style="--current-page: {currentStatPage};"
					ontouchstart={handleStatTouchStart}
					ontouchmove={handleStatTouchMove}
					ontouchend={handleStatTouchEnd}>
				<div class="grade-stat-item primary" style="--stat-index: 0;" class:mobile-active={currentStatPage === 0}>
					<div class="stat-header">
						<div class="stat-label">Quarter Average</div>
						<div class="stat-icon">
							<span class="material-symbols-outlined">star</span>
						</div>
					</div>
			<div class="grade-stat-value">
				{#key `${currentQuarterNum}-${currentSchoolYear}`}
					<CountUp 
						value={overallAverage} 
						decimals={1} 
						duration={2.5} 
						colorTransition={true}
						getGradeColor={getGradeColor} />
				{/key}
			</div>
			{#key `${currentQuarterNum}-${currentSchoolYear}`}
				{#if overallAverage === 0}
					<div class="grade-comparison no-grades">
						<span class="material-symbols-outlined comparison-icon">
							pending
						</span>
						<span class="comparison-text">
							No Grades Yet
						</span>
					</div>
				{:else if averageChange !== null}
					<div class="grade-comparison" class:positive={averageChange > 0} class:negative={averageChange < 0} class:neutral={averageChange === 0}>
						<span class="material-symbols-outlined comparison-icon">
							{#if averageChange > 0}
								trending_up
							{:else if averageChange < 0}
								trending_down
							{:else}
								trending_flat
							{/if}
						</span>
						<span class="comparison-text">
							{#if averageChange > 0}
								+{averageChange.toFixed(1)}
							{:else if averageChange < 0}
								{averageChange.toFixed(1)}
							{:else}
								No change
							{/if}
							from last quarter
						</span>
					</div>
				{:else if currentQuarterNum === 1 && overallAverage > 0}
					<div class="grade-comparison first-quarter">
						<span class="material-symbols-outlined comparison-icon">
							rocket_launch
						</span>
						<span class="comparison-text">
							{getFirstQuarterMessage(overallAverage)}
						</span>
					</div>
				{/if}
			{/key}
		</div>
			
			<div class="grade-stat-item secondary" style="--stat-index: 1;" class:mobile-active={currentStatPage === 1}>
				<div class="stat-header">
					<div class="stat-label">Total Subjects</div>
					<div class="stat-icon">
						<span class="material-symbols-outlined">school</span>
					</div>
				</div>
			<div class="grade-stat-value">
				{#key `${currentQuarterNum}-${currentSchoolYear}`}
					<CountUp value={totalSubjects} decimals={0} duration={2} />
				{/key}
			</div>
			<div class="grade-info-badge">
				<span class="material-symbols-outlined badge-icon">
					verified
				</span>
				{#key `${currentQuarterNum}-${currentSchoolYear}`}
					<span class="badge-text">
						{verifiedGrades.verified}/{verifiedGrades.total} Verified Grades
					</span>
				{/key}
			</div>
			</div>

			<div class="grade-stat-item tertiary" style="--stat-index: 2;" class:mobile-active={currentStatPage === 2}>
				<div class="stat-header">
					<div class="stat-label">Class Rank</div>
					<div class="stat-icon">
						<span class="material-symbols-outlined">crown</span>
					</div>
				</div>
			<div class="grade-stat-value">
				Rank {#key `${currentQuarterNum}-${currentSchoolYear}`}<CountUp value={classRank} decimals={0} duration={2} />{/key}
			</div>
			<div class="grade-info-badge">
				<span class="material-symbols-outlined badge-icon">
					groups
				</span>
				{#key `${currentQuarterNum}-${currentSchoolYear}`}
					<span class="badge-text">
						Out of {totalStudentsInSection} Students
					</span>
				{/key}
			</div>
			</div>
			</div>
			{/key}
			
			<!-- Mobile Pagination Dots -->
			<div class="mobile-stat-pagination">
				<button 
					class="stat-pagination-dot" 
					class:active={currentStatPage === 0}
					onclick={() => goToStatPage(0)}
					aria-label="Go to quarter average">
				</button>
				<button 
					class="stat-pagination-dot" 
					class:active={currentStatPage === 1}
					onclick={() => goToStatPage(1)}
					aria-label="Go to total subjects">
				</button>
				<button 
					class="stat-pagination-dot" 
					class:active={currentStatPage === 2}
					onclick={() => goToStatPage(2)}
					aria-label="Go to class rank">
				</button>
			</div>

		</div>

		<!-- AI Analysis Section -->
		<div class="ai-analysis-section">
			<div class="analysis-section-header">
				<div class="analysis-title-group">
					<span class="material-symbols-outlined">psychology</span>
					<h2 class="section-title">AI Performance Insights</h2>
				</div>
				<div class="analysis-controls">
					{#if aiAnalysisData && !aiAnalysisLoading}
						<button 
							class="ai-refresh-btn" 
							onclick={refreshAiAnalysis}
							title="Refresh analysis">
							<span class="material-symbols-outlined">refresh</span>
						</button>
					{/if}
					<button 
						class="toggle-analysis-btn" 
						onclick={toggleAiAnalysis}
						class:active={showAiAnalysis}
						title={showAiAnalysis ? 'Hide Analysis' : 'Get AI Analysis'}>
						{#if showAiAnalysis}
							<span class="material-symbols-outlined">expand_less</span>
							<span>Hide Analysis</span>
						{:else}
							<span class="material-symbols-outlined">auto_awesome</span>
							<span>Get AI Analysis</span>
						{/if}
					</button>
				</div>
			</div>
			
				{#if showAiAnalysis}
					<div class="analysis-display-container">
						<AIAnalysisDisplay 
							analysisData={aiAnalysisData}
							isLoading={aiAnalysisLoading}
							error={aiAnalysisError}
							subjects={grades} />
					</div>
				{/if}
		</div>

		<!-- Subjects Grid -->
		<div class="subjects-section">
			<h2 class="section-title">Subject Performance</h2>
			{#if loading}
				<div class="loading-container">
					<div class="system-loader"></div>
					<p>Loading your grades...</p>
				</div>
			{:else if subjects.length === 0}
				<div class="no-subjects">
					<span class="material-symbols-outlined">school</span>
					<p>No subjects found for {currentQuarter}</p>
					<small>Grades will appear here once they are verified by your teachers</small>
				</div>
			{:else}
				{#key animationKey}
					<div 
						class="subjects-grid"
						style="--current-subject-page: {currentSubjectPage};"
						ontouchstart={handleSubjectTouchStart}
						ontouchmove={handleSubjectTouchMove}
						ontouchend={handleSubjectTouchEnd}>
						{#each subjects as subject, index (subject.subject_id || subject.id)}
							{@const cardColors = getCardColorClasses(index)}
						
						<div class="subject-accordion" style="--card-index: {index};" class:mobile-active={currentSubjectPage === index}>
							<!-- Main Subject Card (clickable to open modal) -->
							<div 
								class="subject-card clickable" 
								style="border: 2px solid {cardColors.border};"
								onclick={() => openGradeModal(subject)}
								role="button"
								tabindex="0"
								onkeydown={(e) => e.key === 'Enter' && openGradeModal(subject)}>
								
								<!-- Column 1: Icon -->
								<div class="subject-icon-column">
									<div class="subject-icon" style="color: {cardColors.icon};">
										<span class="material-symbols-outlined">book</span>
									</div>
								</div>
								
								<!-- Column 2: Subject Details -->
								<div class="subject-details-column">
									<h3 class="subject-name" style="color: {cardColors.text};">{subject.name}</h3>
									<p class="teacher-name" class:no-teacher={subject.teacher === "No teacher"}>{subject.teacher}</p>
									<div class="progress-bar">
										{#key `${subject.id}-${currentQuarterNum}-${currentSchoolYear}`}
											{#if getProgressWidth(subject.numericGrade, subject.teacher !== "No teacher", subject.numericGrade > 0, subject.verified) > 0}
												<div 
													class="progress-fill progress-fill-animated" 
													style="width: {getProgressWidth(subject.numericGrade, subject.teacher !== "No teacher", subject.numericGrade > 0, subject.verified)}%; background-color: {progressBarColors[subject.id] || getGradeColor(subject.numericGrade)}">
												</div>
											{/if}
										{/key}
									</div>
								</div>
								
							<!-- Column 3: Grade Display -->
							<div class="grade-column">
								<div class="grade-large">
									{#key `${subject.id}-${currentQuarterNum}`}
										{#if subject.numericGrade > 0 && subject.teacher !== "No teacher" && subject.verified}
											<CountUp 
												value={subject.numericGrade} 
												decimals={1} 
												duration={2.5}
												colorTransition={true}
												getGradeColor={getGradeColor} />
										{:else}
											<span style="color: {getGradeColor(subject.numericGrade)}">
												{formatGrade(subject.numericGrade, subject.teacher !== "No teacher", subject.numericGrade > 0, subject.verified)}
											</span>
										{/if}
										{#if subject.numericGrade > 0 && !subject.verified}
											<span class="unverified-indicator" title="Grade not yet verified">*</span>
										{/if}
									{/key}
								</div>
								<div class="grade-indicator {getGradeIndicator(subject.numericGrade).color}">
									{getGradeIndicator(subject.numericGrade).text}
								</div>
							</div>
							</div>
						</div>
					{/each}
				</div>
			{/key}
			
			<!-- Mobile Pagination Dots for Subjects -->
			{#if subjects.length > 0}
				<div class="mobile-subject-pagination">
					{#each subjects as _, index}
						<button 
							class="subject-pagination-dot" 
							class:active={currentSubjectPage === index}
							onclick={() => goToSubjectPage(index)}
							aria-label="Go to subject {index + 1}">
						</button>
					{/each}
				</div>
			{/if}
			{/if}
		</div>
	{/if}
</div>