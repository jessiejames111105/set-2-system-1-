<script>
	import { fly, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { tick } from 'svelte';
	import AssessmentTypeChart from './studentGradeCharts/AssessmentTypeChart.svelte';
	import SubjectPerformanceChart from './studentGradeCharts/SubjectPerformanceChart.svelte';

	let { analysisData = null, isLoading = false, error = null, subjects = [] } = $props();

	let visibleSections = $state(0); // Start with no sections visible
	let sectionRefs = $state([]); // Store references to section elements
	let previousVisibleSections = $state(0);
	
	// Reset visibleSections when loading starts
	$effect(() => {
		if (isLoading) {
			visibleSections = 0;
		}
	});
	
	// Show first section when data loads (with delay for animation)
	$effect(() => {
		if (analysisData && !isLoading && visibleSections === 0) {
			tick().then(() => {
				setTimeout(() => {
					visibleSections = 1;
				}, 50);
			});
		}
	});

	// Auto-scroll when a new section becomes visible
	$effect(() => {
		if (visibleSections > previousVisibleSections && visibleSections > 1) {
			// Wait for transition to start
			tick().then(() => {
				setTimeout(() => {
					const newSectionIndex = visibleSections - 1;
					const targetSection = sectionRefs[newSectionIndex];
					
					if (targetSection) {
						targetSection.scrollIntoView({ 
							behavior: 'smooth', 
							block: 'start',
							inline: 'nearest'
						});
					}
				}, 100); // Small delay to let the animation start
			});
		}
		previousVisibleSections = visibleSections;
	});

	function showMoreSection() {
		visibleSections++;
	}

	function showLess() {
		if (visibleSections > 1) {
			visibleSections--;
			
			// Scroll to the section that becomes the last visible one
			tick().then(() => {
				setTimeout(() => {
					const newLastSectionIndex = visibleSections - 1;
					const targetSection = sectionRefs[newLastSectionIndex];
					
					if (targetSection) {
						targetSection.scrollIntoView({ 
							behavior: 'smooth', 
							block: 'start',
							inline: 'nearest'
						});
					}
				}, 100); // Small delay to let the animation start
			});
		}
	}

	function closeAll() {
		visibleSections = 1;
		
		// Scroll up to the "AI Performance Insights" container
		tick().then(() => {
			setTimeout(() => {
				// Find the parent ai-analysis-section container
				const aiSection = document.querySelector('.ai-analysis-section');
				
				if (aiSection) {
					aiSection.scrollIntoView({ 
						behavior: 'smooth', 
						block: 'start',
						inline: 'nearest'
					});
				} else {
					// Fallback: scroll to the first section
					const firstSection = sectionRefs[0];
					if (firstSection) {
						firstSection.scrollIntoView({ 
							behavior: 'smooth', 
							block: 'start',
							inline: 'nearest'
						});
					}
				}
			}, 100); // Small delay to let the animation start
		});
	}

	// Calculate total number of sections
	let totalSections = $derived(analysisData ? 
		1 + // Overview
		(analysisData.quarterComparison ? 1 : 0) + // Quarter Comparison
		1 + // Strengths
		(analysisData.areasForGrowth && analysisData.areasForGrowth.length > 0 ? 1 : 0) +
		1 + // Assessment Breakdown
		(analysisData.actionPlan && analysisData.actionPlan.length > 0 ? 1 : 0)
		: 0);

	let allSectionsVisible = $derived(visibleSections >= totalSections);
</script>

<div class="ai-analysis-display">
	{#if isLoading}
		<div class="analysis-loading">
			<div class="system-loader"></div>
			<p>Generating your personalized analysis...</p>
		</div>
	{:else if error}
		<div class="analysis-error">
			<span class="material-symbols-outlined">error</span>
			<div class="error-content">
				<h4>Unable to Generate Analysis</h4>
				<p>{error}</p>
			</div>
		</div>
	{:else if analysisData}
		<!-- Overview (Section 1) -->
		{#if visibleSections >= 1}
			<div class="analysis-section" bind:this={sectionRefs[0]} in:fly|local="{{ y: -20, duration: 400, easing: quintOut }}" out:fade|local="{{ duration: 200 }}">
				<div class="section-title">
					<span class="material-symbols-outlined">psychology</span>
					<span>Overview</span>
				</div>
				<p class="section-text">{analysisData.overallInsight}</p>
			</div>
		{/if}

		<!-- Quarter Comparison (Section 2, if exists) -->
		{#if analysisData.quarterComparison && visibleSections >= 2}
			<div class="analysis-section quarter-comparison" bind:this={sectionRefs[1]} in:fly|local="{{ y: -20, duration: 400, delay: 50, easing: quintOut }}" out:fade|local="{{ duration: 200 }}">
				<div class="section-title">
					<span class="material-symbols-outlined">
						{#if analysisData.quarterComparison.overallTrend === 'improved'}
							trending_up
						{:else if analysisData.quarterComparison.overallTrend === 'declined'}
							trending_down
						{:else}
							trending_flat
						{/if}
					</span>
					<span>Progress from Last Quarter</span>
					<span class="trend-badge {analysisData.quarterComparison.overallTrend}">
						{analysisData.quarterComparison.changeAmount > 0 ? '+' : ''}{analysisData.quarterComparison.changeAmount}
					</span>
				</div>
				<p class="section-text">{analysisData.quarterComparison.insight}</p>
				
				{#if analysisData.quarterComparison.notableChanges && analysisData.quarterComparison.notableChanges.length > 0}
					<div class="notable-changes">
						<h4 class="subsection-title">Notable Changes:</h4>
						{#each analysisData.quarterComparison.notableChanges as change, index}
							<div class="change-item" in:fly|local="{{ y: -10, duration: 350, delay: 100 + (index * 60), easing: quintOut }}" out:fade|local="{{ duration: 200 }}">
								<div class="change-header">
									<span class="change-subject">{change.subject}</span>
									<span class="change-value {change.change > 0 ? 'positive' : change.change < 0 ? 'negative' : 'neutral'}">
										{change.change > 0 ? '+' : ''}{change.change}
									</span>
								</div>
								<p class="change-observation">{change.observation}</p>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Strengths (Section 3 or 2 if no quarter comparison) -->
		{#if visibleSections >= (analysisData.quarterComparison ? 3 : 2)}
			<div class="analysis-section" bind:this={sectionRefs[analysisData.quarterComparison ? 2 : 1]} in:fly|local="{{ y: -20, duration: 400, delay: 50, easing: quintOut }}" out:fade|local="{{ duration: 200 }}">
				<div class="section-title">
					<span class="material-symbols-outlined">emoji_events</span>
					<span>Strengths</span>
				</div>
				{#each analysisData.strengths as strength, index}
					<div class="item-row" in:fly|local="{{ y: -10, duration: 350, delay: 100 + (index * 80), easing: quintOut }}" out:fade|local="{{ duration: 200 }}">
						<div class="item-top">
							<span class="item-name">{strength.subject}</span>
							<span class="item-value">{strength.score.toFixed(1)}</span>
						</div>
						<p class="item-text">{strength.reason}</p>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Areas for Growth (Section 4 or 3) -->
		{#if analysisData.areasForGrowth && analysisData.areasForGrowth.length > 0}
			{@const sectionIndex = (analysisData.quarterComparison ? 4 : 3)}
			{@const refIndex = (analysisData.quarterComparison ? 3 : 2)}
			{#if visibleSections >= sectionIndex}
				<div class="analysis-section" bind:this={sectionRefs[refIndex]} in:fly|local="{{ y: -20, duration: 400, delay: 100, easing: quintOut }}" out:fade|local="{{ duration: 200 }}">
					<div class="section-title">
						<span class="material-symbols-outlined">trending_up</span>
						<span>Areas for Growth</span>
					</div>
					{#each analysisData.areasForGrowth as area, index}
						<div class="item-row" in:fly|local="{{ y: -10, duration: 350, delay: 100 + (index * 80), easing: quintOut }}" out:fade|local="{{ duration: 200 }}">
							<div class="item-top">
								<span class="item-name">{area.subject}</span>
								<span class="item-value">{area.score.toFixed(1)}</span>
							</div>
							<p class="item-text">{area.currentGap}</p>
							<p class="item-note">{area.potential}</p>
						</div>
					{/each}
				</div>
			{/if}
		{/if}

		<!-- Assessment Breakdown (Section 5/4/3 depending on what came before) -->
		{@const assessmentSectionIndex = 
			(analysisData.quarterComparison ? 1 : 0) + 
			2 + // Overview + Strengths
			(analysisData.areasForGrowth && analysisData.areasForGrowth.length > 0 ? 1 : 0) + 
			1 // This section
		}
		{@const assessmentRefIndex = 
			(analysisData.quarterComparison ? 1 : 0) + 
			1 + // Overview + Strengths (Strengths is always index 1 or 2)
			(analysisData.areasForGrowth && analysisData.areasForGrowth.length > 0 ? 1 : 0) + 
			1 // This section
		}
		{#if visibleSections >= assessmentSectionIndex}
			<div class="analysis-section" bind:this={sectionRefs[assessmentRefIndex]} in:fly|local="{{ y: -20, duration: 400, delay: 150, easing: quintOut }}" out:fade|local="{{ duration: 200 }}">
				<div class="section-title">
					<span class="material-symbols-outlined">analytics</span>
					<span>Assessment Breakdown</span>
				</div>
				<div class="assessment-row">
					{#if analysisData.assessmentInsights.writtenWork}
						<div class="assessment-item" in:fly|local="{{ y: -10, duration: 350, delay: 100, easing: quintOut }}" out:fade|local="{{ duration: 200 }}">
							<div class="assessment-top">
								<span class="assessment-name">Written Work</span>
								<span class="assessment-value">{analysisData.assessmentInsights.writtenWork.average.toFixed(1)}%</span>
							</div>
							<p class="assessment-text">{analysisData.assessmentInsights.writtenWork.insight}</p>
						</div>
					{/if}
					
					{#if analysisData.assessmentInsights.performanceTasks}
						<div class="assessment-item" in:fly|local="{{ y: -10, duration: 350, delay: 180, easing: quintOut }}" out:fade|local="{{ duration: 200 }}">
							<div class="assessment-top">
								<span class="assessment-name">Performance Tasks</span>
								<span class="assessment-value">{analysisData.assessmentInsights.performanceTasks.average.toFixed(1)}%</span>
							</div>
							<p class="assessment-text">{analysisData.assessmentInsights.performanceTasks.insight}</p>
						</div>
					{/if}

					{#if analysisData.assessmentInsights.quarterlyAssessment}
						<div class="assessment-item" in:fly|local="{{ y: -10, duration: 350, delay: 260, easing: quintOut }}" out:fade|local="{{ duration: 200 }}">
							<div class="assessment-top">
								<span class="assessment-name">Quarterly Assessment</span>
								<span class="assessment-value">{analysisData.assessmentInsights.quarterlyAssessment.average.toFixed(1)}%</span>
							</div>
							<p class="assessment-text">{analysisData.assessmentInsights.quarterlyAssessment.insight}</p>
						</div>
					{/if}
				</div>

				<!-- Charts -->
				<div class="charts-section">
					<AssessmentTypeChart {subjects} />
					<SubjectPerformanceChart {subjects} />
				</div>
			</div>
		{/if}

		<!-- Action Plan (dynamic section index) -->
		{#if analysisData.actionPlan && analysisData.actionPlan.length > 0}
			{@const actionPlanIndex = 
				(analysisData.quarterComparison ? 1 : 0) + 
				2 + // Overview + Strengths
				(analysisData.areasForGrowth && analysisData.areasForGrowth.length > 0 ? 1 : 0) + 
				1 + // Assessment Breakdown
				1 // This section
			}
			{@const actionPlanRefIndex = 
				(analysisData.quarterComparison ? 1 : 0) + 
				1 + // Overview + Strengths
				(analysisData.areasForGrowth && analysisData.areasForGrowth.length > 0 ? 1 : 0) + 
				1 + // Assessment Breakdown
				1 // This section
			}
			{#if visibleSections >= actionPlanIndex}
				<div class="analysis-section" bind:this={sectionRefs[actionPlanRefIndex]} in:fly|local="{{ y: -20, duration: 400, delay: 200, easing: quintOut }}" out:fade|local="{{ duration: 200 }}">
					<div class="section-title">
						<span class="material-symbols-outlined">checklist</span>
						<span>Action Plan</span>
					</div>
					{#each analysisData.actionPlan as action, index}
						<div class="item-row action-row" style="--action-index: {index};" in:fly|local="{{ y: -10, duration: 350, delay: 100 + (index * 80), easing: quintOut }}" out:fade|local="{{ duration: 200 }}">
							<h4 class="action-name">{action.title}</h4>
							<p class="item-text">{action.description}</p>
							<p class="item-note">{action.expectedImpact}</p>
						</div>
					{/each}
				</div>
			{/if}
		{/if}

		<!-- Show More / Show Less Buttons -->
		<div class="ai-action-buttons">
			{#if visibleSections > 1}
				{#if allSectionsVisible}
					<button class="show-more-btn" onclick={closeAll} in:fly|local="{{ y: 20, duration: 400, delay: 100, easing: quintOut }}" out:fade|local="{{ duration: 200 }}">
						<span class="material-symbols-outlined">close</span>
						<span>Close All</span>
					</button>
				{:else}
					<button class="show-more-btn" onclick={showLess} in:fly|local="{{ y: 20, duration: 400, delay: 100, easing: quintOut }}" out:fade|local="{{ duration: 200 }}">
						<span class="material-symbols-outlined">expand_less</span>
						<span>Show Less</span>
					</button>
				{/if}
			{/if}
			
			{#if !allSectionsVisible}
				<button class="show-more-btn" onclick={showMoreSection} in:fly|local="{{ y: 20, duration: 400, delay: 100, easing: quintOut }}" out:fade|local="{{ duration: 200 }}">
					<span class="material-symbols-outlined">expand_more</span>
					<span>Show More</span>
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.ai-analysis-display {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-sm);
	}

	/* Loading & Error */
	.analysis-loading,
	.analysis-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-xl);
		text-align: center;
		gap: var(--spacing-md);
		border: 1px solid var(--md-sys-color-outline-variant);
		border-radius: var(--radius-lg);
		background: var(--md-sys-color-surface-variant);
	}

	.analysis-error .material-symbols-outlined {
		font-size: 3rem;
		color: var(--md-sys-color-error);
	}

	.error-content h4 {
		margin: var(--spacing-sm) 0;
		font-size: 1.125rem;
		color: var(--md-sys-color-on-surface);
	}

	.error-content p {
		margin: 0;
		color: var(--md-sys-color-on-surface-variant);
		font-size: 0.9375rem;
	}

	/* Sections */
	.analysis-section {
		border: 1px solid var(--md-sys-color-outline-variant);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
		background: var(--md-sys-color-surface-container);
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-md);
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--md-sys-color-on-surface);
	}

	.section-title .material-symbols-outlined {
		font-size: 1.5rem;
		color: var(--md-sys-color-primary);
	}

	.section-text {
		margin: 0;
		font-size: 1rem;
		line-height: 1.6;
		color: var(--md-sys-color-on-surface-variant);
	}

	/* Item Rows */
	.item-row {
		padding: var(--spacing-md);
		background: var(--md-sys-color-surface-variant);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-sm);
	}

	.item-row:last-child {
		margin-bottom: 0;
	}

	.item-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-xs);
	}

	.item-name {
		font-weight: 600;
		font-size: 1rem;
		color: var(--md-sys-color-on-surface);
	}

	.item-value {
		font-weight: 700;
		font-size: 1rem;
		color: var(--md-sys-color-primary);
	}

	.item-text {
		margin: 0 0 var(--spacing-xs) 0;
		font-size: 0.9375rem;
		line-height: 1.5;
		color: var(--md-sys-color-on-surface-variant);
	}

	.item-note {
		margin: 0;
		font-size: 0.875rem;
		color: var(--md-sys-color-outline);
	}

	/* Assessment Row */
	.assessment-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--spacing-sm);
	}

	.assessment-item {
		padding: var(--spacing-md);
		background: var(--md-sys-color-surface-variant);
		border-radius: var(--radius-md);
	}

	.assessment-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-xs);
	}

	.assessment-name {
		font-weight: 600;
		font-size: 0.9375rem;
		color: var(--md-sys-color-on-surface);
	}

	.assessment-value {
		font-weight: 700;
		font-size: 1rem;
		color: var(--md-sys-color-primary);
	}

	.assessment-text {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--md-sys-color-on-surface-variant);
	}

	/* Action Items */
	.action-row {		
		border: 1px solid;
		border-color: hsl(
			220, 
			calc(40% + (var(--action-index) * 10%)), 
			calc(80% - (var(--action-index) * 8%))
		);
	}

	.action-name {
		margin: 0 0 var(--spacing-xs) 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--md-sys-color-on-surface);
	}

	.trend-badge {
		padding: var(--spacing-xs) var(--spacing-sm);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 700;
		margin-left: auto;
	}

	.trend-badge.improved {
		background: var(--md-sys-color-tertiary-container);
		color: var(--md-sys-color-on-tertiary-container);
	}

	.trend-badge.declined {
		background: var(--md-sys-color-error-container);
		color: var(--md-sys-color-on-error-container);
	}

	.trend-badge.stable {
		background: var(--md-sys-color-surface-variant);
		color: var(--md-sys-color-on-surface-variant);
	}

	.notable-changes {
		margin-top: var(--spacing-md);
	}

	.subsection-title {
		margin: 0 0 var(--spacing-sm) 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--md-sys-color-on-surface);
	}

	.change-item {
		padding: var(--spacing-md);
		background: var(--md-sys-color-surface-variant);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-sm);
	}

	.change-item:last-child {
		margin-bottom: 0;
	}

	.change-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-xs);
	}

	.change-subject {
		font-weight: 600;
		font-size: 0.9375rem;
		color: var(--md-sys-color-on-surface);
	}

	.change-value {
		font-weight: 700;
		font-size: 1rem;
	}

	.change-value.positive {
		color: var(--md-sys-color-primary);
	}

	.change-value.negative {
		color: var(--md-sys-color-error);
	}

	.change-value.neutral {
		color: var(--md-sys-color-on-surface-variant);
	}

	.change-observation {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--md-sys-color-on-surface-variant);
	}

	/* Action Buttons */
	.ai-action-buttons {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
		align-items: center;
	}

	.show-more-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-xs);
		flex: 1;
		padding: var(--spacing-md) var(--spacing-md);
		background: var(--md-sys-color-surface-variant);
		color: var(--md-sys-color-on-surface);
		border: 1px solid var(--md-sys-color-outline-variant);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-normal);
		width: 60%;
	}

	.show-more-btn:hover {
		background: var(--md-sys-color-surface-container-hover);
		border-color: var(--md-sys-color-outline);
	}

	.show-more-btn .material-symbols-outlined {
		font-size: 1.125rem;
	}

	/* Charts Section */
	.charts-section {
		display: flex;
		gap: var(--spacing-lg);
		margin-top: var(--spacing-lg);
	}


	@media (max-width: 1200px) {
		.charts-section {
			flex-direction: column;
		}
	}
	/* Responsive */
	@media (max-width: 768px) {
		.assessment-row {
			grid-template-columns: 1fr;
		}

		.charts-section {
			flex-direction: column;
		}

		.show-more-btn{
			width: 100%;
		}
	}
</style>

