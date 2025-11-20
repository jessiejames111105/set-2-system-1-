<script>
	import { fly, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	// Props passed from modal store
	let {
		subject = {},
		quarterName = '',
		schoolYear = '',
		onClose = () => {}
	} = $props();

	// Helper functions
	function getGradeColor(grade) {
		if (grade === 0 || grade === null || grade === undefined) return 'var(--grade-no-grade)';
		if (grade >= 85) return 'var(--grade-excellent)';
		if (grade >= 80) return 'var(--grade-good)';
		if (grade >= 75) return 'var(--grade-satisfactory)';
		if (grade >= 65) return 'var(--grade-needs-improvement)';
		return 'var(--grade-needs-improvement)';
	}

	function getGradeIndicator(grade) {
		if (grade >= 85) return 'Excellent';
		if (grade >= 80) return 'Good';
		if (grade >= 75) return 'Satisfactory';
		if (grade >= 65) return 'Needs Improvement';
		return 'No Grade';
	}

	function formatGradeDisplay(grade) {
		if (grade === null || grade === undefined || grade === 0) return 'N/A';
		if (grade % 1 === 0) {
			return grade.toString();
		}
		return grade.toFixed(1);
	}

	function formatScoreLabel(index, type) {
		const types = {
			written: 'Quiz',
			performance: 'Project',
			quarterly: 'Exam'
		};
		return `${types[type] || 'Task'} ${index + 1}`;
	}

	function getProgressWidth(grade) {
		if (!grade || grade === 0) return 0;
		return Math.min((grade / 100) * 100, 100);
	}

	// Check if subject has detailed scores
	function hasDetailedScores() {
		if (!subject) return false;
		return (
			(subject.writtenWorkScores && subject.writtenWorkScores.length > 0) ||
			(subject.performanceTasksScores && subject.performanceTasksScores.length > 0) ||
			(subject.quarterlyAssessmentScores && subject.quarterlyAssessmentScores.length > 0)
		);
	}
</script>

<div class="grade-modal-content" transition:fly="{{ y: 20, duration: 300, easing: quintOut }}">
	{#if subject}
	<!-- Header -->
	<div class="modal-header">
		<div class="header-info">
			<h2 class="subject-title">{subject.name || 'Subject'}</h2>
			<div class="header-meta">
				<span class="meta-item">
					<span class="material-symbols-outlined">person</span>
					{subject.teacher || 'No teacher assigned'}
				</span>
				<span class="meta-item">
					<span class="material-symbols-outlined">calendar_today</span>
					{quarterName} • {schoolYear}
				</span>
			</div>
		</div>
		<button class="close-btn" onclick={onClose} aria-label="Close modal">
			<span class="material-symbols-outlined">close</span>
		</button>
	</div>

	<!-- Grade Overview Card -->
	<div class="grade-overview-card">
		<div class="grade-display">
			<div class="grade-label">Final Grade</div>
			<div class="grade-value" style="color: {getGradeColor(subject.numericGrade)}">
				{formatGradeDisplay(subject.numericGrade)}
			</div>
			<div class="grade-status" style="color: {getGradeColor(subject.numericGrade)}">
				{getGradeIndicator(subject.numericGrade)}
			</div>
		</div>
		<div class="grade-progress">
			<div class="progress-bar-container">
				<div 
					class="progress-bar-fill" 
					style="width: {getProgressWidth(subject.numericGrade)}%; background-color: {getGradeColor(subject.numericGrade)}">
				</div>
			</div>
		</div>
	</div>

	<!-- Breakdown Content -->
	<div class="tab-content">
		<div class="breakdown-tab">
			{#if hasDetailedScores()}
					<!-- Written Work -->
					{#if subject.writtenWorkScores && subject.writtenWorkScores.length > 0}
						<div class="breakdown-section">
							<div class="breakdown-header">
								<div class="breakdown-title">
									<span class="material-symbols-outlined">edit</span>
									<span>Written Work</span>
								</div>
								<div class="breakdown-average" style="color: {getGradeColor(subject.writtenWork)}">
									Avg: {formatGradeDisplay(subject.writtenWork)}
								</div>
							</div>
							<div class="scores-grid">
								{#each subject.writtenWorkScores as score, i}
									<div class="score-card">
										<div class="score-label">{formatScoreLabel(i, 'written')}</div>
										<div class="score-value" style="color: {getGradeColor(score)}">
											{formatGradeDisplay(score)}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Performance Tasks -->
					{#if subject.performanceTasksScores && subject.performanceTasksScores.length > 0}
						<div class="breakdown-section">
							<div class="breakdown-header">
								<div class="breakdown-title">
									<span class="material-symbols-outlined">assignment</span>
									<span>Performance Tasks</span>
								</div>
								<div class="breakdown-average" style="color: {getGradeColor(subject.performanceTasks)}">
									Avg: {formatGradeDisplay(subject.performanceTasks)}
								</div>
							</div>
							<div class="scores-grid">
								{#each subject.performanceTasksScores as score, i}
									<div class="score-card">
										<div class="score-label">{formatScoreLabel(i, 'performance')}</div>
										<div class="score-value" style="color: {getGradeColor(score)}">
											{formatGradeDisplay(score)}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Quarterly Assessment -->
					{#if subject.quarterlyAssessmentScores && subject.quarterlyAssessmentScores.length > 0}
						<div class="breakdown-section">
							<div class="breakdown-header">
								<div class="breakdown-title">
									<span class="material-symbols-outlined">quiz</span>
									<span>Quarterly Assessment</span>
								</div>
								<div class="breakdown-average" style="color: {getGradeColor(subject.quarterlyAssessment)}">
									Avg: {formatGradeDisplay(subject.quarterlyAssessment)}
								</div>
							</div>
							<div class="scores-grid">
								{#each subject.quarterlyAssessmentScores as score, i}
									<div class="score-card">
										<div class="score-label">{formatScoreLabel(i, 'quarterly')}</div>
										<div class="score-value" style="color: {getGradeColor(score)}">
											{formatGradeDisplay(score)}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{:else}
					<div class="empty-state">
						<span class="material-symbols-outlined">pending</span>
						<p>No detailed scores available yet</p>
						<small>Scores will appear here once your teacher uploads them</small>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.grade-modal-content {
		width: 100%;
		max-width: 900px;
		background-color: var(--md-sys-color-surface-container-high);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-xl);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	/* Header */
	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: var(--spacing-lg);
		border-bottom: 2px solid var(--md-sys-color-outline-variant);
		background: var(--md-sys-color-surface-container);
		gap: var(--spacing-md);
	}

	.header-info {
		flex: 1;
		min-width: 0;
	}

	.subject-title {
		margin: 0 0 var(--spacing-xs) 0;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--md-sys-color-on-surface);
		word-wrap: break-word;
	}

	.header-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-md);
		color: var(--md-sys-color-on-surface-variant);
		font-size: 0.875rem;
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
	}

	.meta-item .material-symbols-outlined {
		font-size: 1rem;
	}

	.close-btn {
		background: transparent;
		border: none;
		padding: 8px;
		border-radius: 50%;
		cursor: pointer;
		color: var(--md-sys-color-on-surface);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--transition-fast);
		width: 40px;
		height: 40px;
		flex-shrink: 0;
	}

	.close-btn:hover {
		transform: scale(1.05);
	}

	.close-btn .material-symbols-outlined {
		font-size: 24px;
	}

	/* Grade Overview Card */
	.grade-overview-card {
		padding: var(--spacing-lg);
		background: var(--md-sys-color-surface-container);
		border-bottom: 2px solid var(--md-sys-color-outline-variant);
	}

	.grade-display {
		text-align: center;
		margin-bottom: var(--spacing-md);
	}

	.grade-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--md-sys-color-on-surface-variant);
		margin-bottom: var(--spacing-xs);
	}

	.grade-value {
		font-size: 3rem;
		font-weight: 700;
		line-height: 1;
		margin-bottom: var(--spacing-xs);
	}

	.grade-status {
		font-size: 1.125rem;
		font-weight: 600;
	}

	.grade-progress {
		margin-top: var(--spacing-md);
	}

	.progress-bar-container {
		width: 100%;
		height: 12px;
		background: var(--md-sys-color-surface-container-highest);
		border-radius: 6px;
		overflow: hidden;
		box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.progress-bar-fill {
		height: 100%;
		transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
		border-radius: 6px;
	}

	/* Tab Content */
	.tab-content {
		flex: 1;
		overflow-y: auto;
		padding: var(--spacing-lg);
		background: var(--md-sys-color-surface-container);
	}

	/* Breakdown Tab */
	.breakdown-section {
		margin-bottom: var(--spacing-xl);
	}

	.breakdown-section:last-child {
		margin-bottom: 0;
	}

	.breakdown-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-md);
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.breakdown-title {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--md-sys-color-on-surface);
	}

	.breakdown-title .material-symbols-outlined {
		font-size: 1.5rem;
		color: var(--md-sys-color-primary);
	}

	.breakdown-average {
		font-size: 1.01rem;
		font-weight: 700;
	}

	.scores-grid {
		display: flex;
		gap: var(--spacing-md);
	}

	.score-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
    flex: 1;
		background: var(--md-sys-color-surface-container-highest);
		border: 1px solid var(--md-sys-color-outline-variant);
		border-radius: var(--radius-md);
		padding: var(--spacing-sm) var(--spacing-md);
		transition: all var(--transition-fast);
	}

	.score-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-sm);
	}

	.score-label {
		font-size: 1rem;
		color: var(--md-sys-color-on-surface-variant);
	}

	.score-value {
		font-size: 1.5rem;
		font-weight: 700;
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: var(--spacing-xl);
		color: var(--md-sys-color-on-surface-variant);
	}

	.empty-state .material-symbols-outlined {
		font-size: 4rem;
		opacity: 0.5;
		margin-bottom: var(--spacing-md);
	}

	.empty-state p {
		margin: var(--spacing-sm) 0;
		font-size: 1.125rem;
		font-weight: 500;
	}

	.empty-state small {
		font-size: 0.875rem;
		opacity: 0.8;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.grade-modal-content {
			max-height: 95vh;
		}

		.modal-header {
			padding: var(--spacing-md);
		}

		.subject-title {
			font-size: 1.25rem;
		}

		.header-meta {
			flex-direction: column;
			gap: var(--spacing-xs);
		}

		.grade-value {
			font-size: 2.5rem;
		}

		.tab-content {
			padding: var(--spacing-md);
		}

		.scores-grid {
			flex-direction: column;
		}
	}
</style>
