<script>
	import { onMount, onDestroy } from 'svelte';
	import { Chart, DoughnutController, ArcElement, Tooltip, Legend, Title } from 'chart.js';
	import { dashboardStore } from '../../../../../../lib/stores/admin/dashboardStore.js';
	import { api } from '../../../../../../routes/api/helper/api-helper.js';

	// Register Chart.js components
	Chart.register(DoughnutController, ArcElement, Tooltip, Legend, Title);

	let chartCanvas = $state();
	let chartInstance;
	let currentView = $state('students'); // 'students' or 'teachers'
	let teachersData = $state([]);
	let teachersLoading = $state(false);
	let teachersError = $state(null);
	let aiAnalysis = $state('');
	let displayedText = $state('');
	let aiLoading = $state(false);
	let aiError = $state(null);
	let typingInterval;

	// Subscribe to store for students data
	let chartState = $derived($dashboardStore.charts.studentsPerGrade);
	let studentsLoading = $derived(chartState.isLoading);
	let studentsError = $derived(chartState.error);
	let studentsData = $derived(chartState.data);

	// Cache keys
	const CACHE_STUDENTS_KEY = 'studentsPerGrade_aiAnalysis';
	const CACHE_STUDENTS_DATA_KEY = 'studentsPerGrade_cachedData';
	const CACHE_TEACHERS_KEY = 'teachersPerDept_aiAnalysis';
	const CACHE_TEACHERS_DATA_KEY = 'teachersPerDept_cachedData';

	// Configuration for students view
	const gradeLevels = ['7', '8', '9', '10'];
	const gradeColors = [
		'rgb(0, 114, 178)',
		'rgb(230, 159, 0)',
		'rgb(86, 180, 233)',
		'rgb(102, 102, 102)'
	];

	// Configuration for teachers view (department colors)
	const departmentColors = [
		'rgb(244, 67, 54)', // Red
		'rgb(33, 150, 243)', // Blue
		'rgb(76, 175, 80)', // Green
		'rgb(255, 152, 0)', // Orange
		'rgb(156, 39, 176)', // Purple
		'rgb(0, 188, 212)', // Cyan
		'rgb(255, 235, 59)', // Yellow
		'rgb(121, 85, 72)' // Brown
	];
	const notAssignedColor = 'rgb(158, 158, 158)'; // Gray for "Not Assigned"

	// Fetch teachers data when view changes to teachers
	async function fetchTeachersData() {
		try {
			teachersLoading = true;
			teachersError = null;

			// Fetch both departments and total teachers count
			const [departmentsResponse, teachersResponse] = await Promise.all([
				api.get('/api/departments?action=departments'),
				api.get('/api/departments?action=teachers')
			]);

			if (departmentsResponse.success && teachersResponse.success) {
				// Filter out departments with no teachers
				const departmentsWithTeachers = departmentsResponse.data.filter((dept) => dept.teacher_count > 0);
				
				// Calculate total assigned teachers
				const totalAssignedTeachers = departmentsResponse.data.reduce(
					(sum, dept) => sum + (dept.teacher_count || 0),
					0
				);
				
				// Calculate unassigned teachers
				const totalTeachers = teachersResponse.data.length;
				const unassignedTeachers = totalTeachers - totalAssignedTeachers;
				
				// Build final data array
				teachersData = [...departmentsWithTeachers];
				
				// Add "Not Assigned" category if there are unassigned teachers
				if (unassignedTeachers > 0) {
					teachersData.push({
						name: 'Not Assigned',
						teacher_count: unassignedTeachers,
						isNotAssigned: true
					});
				}
			} else {
				throw new Error(departmentsResponse.error || teachersResponse.error || 'Failed to fetch teachers data');
			}
		} catch (error) {
			console.error('Error fetching teachers data:', error);
			teachersError = error.message;
		} finally {
			teachersLoading = false;
		}
	}

	// Create chart when data is available
	$effect(() => {
		if (chartCanvas) {
			if (currentView === 'students' && studentsData && !studentsLoading) {
				setTimeout(() => {
					createStudentsChart(studentsData);
					generateAIAnalysis(studentsData, 'students');
				}, 0);
			} else if (currentView === 'teachers' && teachersData.length > 0 && !teachersLoading) {
				setTimeout(() => {
					createTeachersChart(teachersData);
					generateAIAnalysis(teachersData, 'teachers');
				}, 0);
			}
		}
	});

	// Generate AI analysis
	async function generateAIAnalysis(data, type) {
		const cacheKey = type === 'students' ? CACHE_STUDENTS_KEY : CACHE_TEACHERS_KEY;
		const cacheDataKey = type === 'students' ? CACHE_STUDENTS_DATA_KEY : CACHE_TEACHERS_DATA_KEY;
		
		// Check if data has changed
		const cachedData = localStorage.getItem(cacheDataKey);
		const currentData = JSON.stringify(data);
		
		if (cachedData === currentData) {
			// Data hasn't changed, load cached analysis with typing animation
			const cached = localStorage.getItem(cacheKey);
			if (cached) {
				aiAnalysis = cached;
				startTypingAnimation(cached);
				return;
			}
		}

		try {
			aiLoading = true;
			aiError = null;

			let transformedData, analysisType;
			
			if (type === 'students') {
				transformedData = gradeLevels.map((level) => {
					const gradeData = data.find((d) => d.grade_level === level);
					return { grade: level, count: gradeData ? gradeData.count : 0 };
				});
				analysisType = 'studentsPerGrade';
			} else {
				transformedData = data.map(dept => ({
					department: dept.name,
					count: dept.teacher_count
				}));
				analysisType = 'teachersPerDepartment';
			}

			const response = await api.post('/api/ai-analysis', {
				data: transformedData,
				type: analysisType
			});

			if (response.success) {
				const analysis = response.analysis;
				
				// Cache the analysis and data
				localStorage.setItem(cacheKey, analysis);
				localStorage.setItem(cacheDataKey, currentData);
				
				aiAnalysis = analysis;
				// Start typing animation
				startTypingAnimation(analysis);
			} else {
				throw new Error(response.error || 'Failed to generate AI analysis');
			}
		} catch (err) {
			console.error('AI Analysis Error:', err);
			aiError = 'Unable to generate insights';
		} finally {
			aiLoading = false;
		}
	}

	// Typing animation function
	function startTypingAnimation(text) {
		if (typingInterval) clearInterval(typingInterval);
		displayedText = '';
		let index = 0;
		const speed = 5; // milliseconds per character
		
		typingInterval = setInterval(() => {
			if (index < text.length) {
				displayedText += text[index];
				index++;
			} else {
				clearInterval(typingInterval);
			}
		}, speed);
	}

	function createStudentsChart(data) {
		if (!chartCanvas) {
			console.warn('Canvas not yet available');
			return;
		}

		if (chartInstance) {
			chartInstance.destroy();
		}

		// Transform data into chart format
		const transformedData = gradeLevels.map((level) => {
			const gradeData = data.find((d) => d.grade_level === level);
			return gradeData ? gradeData.count : 0;
		});

		const ctx = chartCanvas.getContext('2d');
		chartInstance = new Chart(ctx, {
			type: 'doughnut',
			data: {
				labels: gradeLevels.map((g) => `Grade ${g}`),
				datasets: [
					{
						label: 'Students',
						data: transformedData,
						backgroundColor: gradeColors,
						borderWidth: 5,
						borderRadius: 2,
						borderColor: getComputedStyle(document.documentElement)
							.getPropertyValue('--md-sys-color-surface-container')
							.trim(),
						hoverBorderWidth: 1,
						hoverBorderColor: getComputedStyle(document.documentElement)
							.getPropertyValue('--md-sys-color-surface-container')
							.trim()
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: '60%',
				plugins: {
					legend: {
						display: false
					},
					title: {
						display: false
					},
					tooltip: {
						callbacks: {
							label: function (context) {
								const label = context.label || '';
								const value = context.parsed || 0;
								const total = context.dataset.data.reduce((a, b) => a + b, 0);
								const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
								return `${label}: ${value} students (${percentage}%)`;
							}
						}
					}
				}
			},
			plugins: [
				{
					id: 'centerText',
					beforeDraw(chart) {
						const {
							ctx,
							chartArea: { width, height }
						} = chart;

						const data = chart.data.datasets[0].data;
						const total = data.reduce((a, b) => a + b, 0);

						const color = getComputedStyle(document.documentElement)
							.getPropertyValue('--md-sys-color-on-surface')
							.trim();
						const bigFontSize = 32;
						const smallFontSize = 14;
						const verticalOffset = 5;

						ctx.save();
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillStyle = color;

						const centerX = width / 2;
						const centerY = height / 2;

						// Draw the large number (total)
						ctx.font = `bold ${bigFontSize}px sans-serif`;
						ctx.fillText(total, centerX, centerY - smallFontSize / 1.5 + verticalOffset);

						// Draw the smaller text below
						ctx.font = `400 ${smallFontSize}px sans-serif`;
						ctx.fillText('Total Students', centerX, centerY + bigFontSize / 1.8 + verticalOffset);

						ctx.restore();
					}
				}
			]
		});
	}

	function createTeachersChart(data) {
		if (!chartCanvas) {
			console.warn('Canvas not yet available');
			return;
		}

		if (chartInstance) {
			chartInstance.destroy();
		}

		// Transform data into chart format
		const labels = data.map((dept) => dept.name.replace(' Department', ''));
		const counts = data.map((dept) => dept.teacher_count);
		const colors = data.map((dept, index) => 
			dept.isNotAssigned ? notAssignedColor : departmentColors[index % departmentColors.length]
		);

		const ctx = chartCanvas.getContext('2d');
		chartInstance = new Chart(ctx, {
			type: 'doughnut',
			data: {
				labels: labels,
				datasets: [
					{
						label: 'Teachers',
						data: counts,
						backgroundColor: colors,
						borderWidth: 5,
						borderRadius: 2,
						borderColor: getComputedStyle(document.documentElement)
							.getPropertyValue('--md-sys-color-surface-container')
							.trim(),
						hoverBorderWidth: 1,
						hoverBorderColor: getComputedStyle(document.documentElement)
							.getPropertyValue('--md-sys-color-surface-container')
							.trim()
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: '60%',
				plugins: {
					legend: {
						display: false
					},
					title: {
						display: false
					},
					tooltip: {
						callbacks: {
							label: function (context) {
								const label = context.label || '';
								const value = context.parsed || 0;
								const total = context.dataset.data.reduce((a, b) => a + b, 0);
								const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
								return `${label}: ${value} teachers (${percentage}%)`;
							}
						}
					}
				}
			},
			plugins: [
				{
					id: 'centerText',
					beforeDraw(chart) {
						const {
							ctx,
							chartArea: { width, height }
						} = chart;

						const data = chart.data.datasets[0].data;
						const total = data.reduce((a, b) => a + b, 0);

						const color = getComputedStyle(document.documentElement)
							.getPropertyValue('--md-sys-color-on-surface')
							.trim();
						const bigFontSize = 32;
						const smallFontSize = 14;
						const verticalOffset = 5;

						ctx.save();
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillStyle = color;

						const centerX = width / 2;
						const centerY = height / 2;

						// Draw the large number (total)
						ctx.font = `bold ${bigFontSize}px sans-serif`;
						ctx.fillText(total, centerX, centerY - smallFontSize / 1.5 + verticalOffset);

						// Draw the smaller text below
						ctx.font = `400 ${smallFontSize}px sans-serif`;
						ctx.fillText('Total Teachers', centerX, centerY + bigFontSize / 1.8 + verticalOffset);

						ctx.restore();
					}
				}
			]
		});
	}

	// Handle view toggle
	function toggleView(view) {
		currentView = view;
		if (view === 'teachers' && teachersData.length === 0 && !teachersLoading) {
			fetchTeachersData();
		} else {
			// Load cached analysis for the new view if available
			const cacheKey = view === 'students' ? CACHE_STUDENTS_KEY : CACHE_TEACHERS_KEY;
			const cached = localStorage.getItem(cacheKey);
			if (cached) {
				aiAnalysis = cached;
				displayedText = cached; // Show immediately when switching views
			} else {
				aiAnalysis = '';
				displayedText = '';
			}
		}
	}

	// Listen for theme changes and update chart colors
	function handleThemeChange() {
		if (chartInstance) {
			if (currentView === 'students' && studentsData) {
				createStudentsChart(studentsData);
			} else if (currentView === 'teachers' && teachersData.length > 0) {
				createTeachersChart(teachersData);
			}
		}
	}

	onMount(() => {
		// Listen for theme changes
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
					handleThemeChange();
				}
			});
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme']
		});

		return () => {
			observer.disconnect();
		};
	});

	onDestroy(() => {
		if (chartInstance) {
			chartInstance.destroy();
		}
		if (typingInterval) {
			clearInterval(typingInterval);
		}
	});

	// Computed values for current state
	let isLoading = $derived(currentView === 'students' ? studentsLoading : teachersLoading);
	let error = $derived(currentView === 'students' ? studentsError : teachersError);
	let chartTitle = $derived(currentView === 'students' ? 'Students per Grade Level' : 'Teachers per Department');
	let currentData = $derived(
		currentView === 'students'
			? studentsData
			: teachersData
	);
	let legendItems = $derived(
		currentView === 'students'
			? gradeLevels.map((grade, index) => ({ label: `Grade ${grade}`, color: gradeColors[index] }))
			: teachersData.map((dept, index) => ({
					label: dept.name.replace(' Department', ''),
					color: dept.isNotAssigned ? notAssignedColor : departmentColors[index % departmentColors.length]
				}))
	);
</script>

<div class="chart-container">
	<div class="chart-header">
		<h3 class="chart-title">{chartTitle}</h3>
		<div class="toggle-buttons">
			<button
				class="toggle-btn"
				class:active={currentView === 'students'}
				onclick={() => toggleView('students')}
			>
				<span class="material-symbols-outlined">school</span>
				Students
			</button>
			<button
				class="toggle-btn"
				class:active={currentView === 'teachers'}
				onclick={() => toggleView('teachers')}
			>
				<span class="material-symbols-outlined">person</span>
				Teachers
			</button>
		</div>
	</div>

	{#if isLoading}
		<div class="chart-loading">
			<div class="system-loader"></div>
			<p>Loading chart data...</p>
		</div>
	{:else if error}
		<div class="chart-error">
			<span class="material-symbols-outlined">error</span>
			<p>{error}</p>
		</div>
	{:else}
		<canvas bind:this={chartCanvas}></canvas>
		<div class="graph-label">
			{#each legendItems as item}
				<div class="legend-item">
					<div class="legend-circle" style="background-color: {item.color};"></div>
					<span class="legend-text">{item.label}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- AI Insights Section -->
<div class="ai-insights-container">
	{#if aiLoading}
		<div class="ai-loading">
			<div class="system-loader"></div>
			<p>Generating insights...</p>
		</div>
	{:else if aiError}
		<div class="ai-error">
			<p>{aiError}</p>
		</div>
	{:else if aiAnalysis}
		<div class="ai-content">
			<div class="ai-header">
			</div>
			<p class="ai-text">{displayedText}</p>
		</div>
	{/if}
</div>

<style>
	.chart-container {
		background-color: var(--md-sys-color-surface-container);
		border: 1px solid var(--md-sys-color-outline-variant);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
		height: 400px;
		display: flex;
		flex-direction: column;
		box-shadow: var(--elevation-1);
	}

	.chart-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-sm);
		gap: var(--spacing-md);
	}

	.chart-title {
		font-family: var(--md-sys-typescale-title-medium-font);
		font-size: var(--md-sys-typescale-title-medium-size);
		font-weight: var(--md-sys-typescale-title-medium-weight);
		color: var(--md-sys-color-on-surface);
		margin: 0;
	}

	.toggle-buttons {
		display: flex;
		gap: var(--spacing-xs);
		background-color: var(--md-sys-color-surface-container-highest);
		border-radius: var(--radius-md);
		padding: 4px;
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-sm) var(--spacing-md);
		background-color: transparent;
		color: var(--md-sys-color-on-surface-variant);
		border: none;
		border-radius: var(--radius-sm);
		font-family: var(--md-sys-typescale-label-medium-font);
		font-size: var(--md-sys-typescale-label-medium-size);
		font-weight: var(--md-sys-typescale-label-medium-weight);
		cursor: pointer;
		transition: background-color var(--transition-normal);
	}

	.toggle-btn .material-symbols-outlined {
		font-size: 18px;
	}

	.toggle-btn:hover {
		background-color: var(--md-sys-color-surface-container-high);
	}

	.toggle-btn.active {
		background-color: var(--md-sys-color-primary-container);
		color: var(--md-sys-color-on-primary-container);
		font-weight: 600;
	}

	canvas {
		flex: 1;
		max-height: 270px;
		max-width: 270px;
		margin: 0 auto;
	}

	.graph-label {
		display: flex;
		gap: var(--spacing-md);
		margin-top: var(--spacing-md);
		justify-content: center;
		flex-wrap: wrap;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
	}

	.legend-circle {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.legend-text {
		font-family: var(--md-sys-typescale-body-small-font);
		font-size: var(--md-sys-typescale-body-small-size);
		color: var(--md-sys-color-on-surface);
		font-weight: 500;
	}

	.chart-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		gap: var(--spacing-md);
		color: var(--md-sys-color-on-surface-variant);
	}

	.chart-loading p {
		color: var(--md-sys-color-on-surface-variant);
	}

	.chart-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		gap: var(--spacing-md);
		color: var(--md-sys-color-error);
	}

	.chart-error p {
		color: var(--md-sys-color-on-surface);
	}

	.chart-error .material-symbols-outlined {
		font-size: 48px;
		color: var(--md-sys-color-error);
	}

	@media (max-width: 768px) {
		.chart-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.toggle-buttons {
			width: 100%;
			justify-content: center;
		}

		.toggle-btn {
			flex: 1;
		}
	}

	.ai-insights-container {
		margin-top: var(--spacing-md);
		min-height: 60px;
	}

	.ai-loading,
	.ai-error {
		display: flex;
		align-items: center;
		flex-direction: column;
		justify-content: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
		background-color: var(--md-sys-color-surface-container-high);
		border-radius: var(--radius-md);
		color: var(--md-sys-color-on-surface-variant);
		border: 2px solid var(--md-sys-color-outline-variant);
		min-height: 180px;
		max-height: 180px;
	}

	.ai-error {
		color: var(--md-sys-color-error);
	}

	.ai-content {
		padding: var(--spacing-md);
		background-color: var(--md-sys-color-surface-container);
		border-radius: var(--radius-md);
		border: 1px solid var(--md-sys-color-outline-variant);
		box-shadow: var(--elevation-1);
		min-height: 180px;
		max-height: 180px;
	}

	.ai-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		margin-bottom: var(--spacing-sm);
	}

	.ai-text {
		margin: 0;
		font-family: var(--md-sys-typescale-body-medium-font);
		font-size: var(--md-sys-typescale-body-medium-size);
		color: var(--md-sys-color-on-surface);
		line-height: 1.5;
	}

	.system-loader {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--md-sys-color-primary);
  box-shadow: 32px 0 var(--md-sys-color-primary), -32px 0 var(--md-sys-color-primary);
  position: relative;
  animation: system-load 0.5s ease-out infinite alternate;
  margin: var(--spacing-md);
}

@keyframes system-load {
  0% {
    background-color: var(--md-sys-color-primary-container);
    box-shadow: 32px 0 var(--md-sys-color-primary-container), -32px 0 var(--md-sys-color-primary);
  }
  50% {
    background-color: var(--md-sys-color-primary);
    box-shadow: 32px 0 var(--md-sys-color-primary-container), -32px 0 var(--md-sys-color-primary-container);
  }
  100% {
    background-color: var(--md-sys-color-primary-container);
    box-shadow: 32px 0 var(--md-sys-color-primary), -32px 0 var(--md-sys-color-primary-container);
  }
}
</style>

