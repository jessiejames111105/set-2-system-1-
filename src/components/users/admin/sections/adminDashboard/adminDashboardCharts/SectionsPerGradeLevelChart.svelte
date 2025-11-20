<script>
	import { onMount, onDestroy } from 'svelte';
	import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title } from 'chart.js';
	import { dashboardStore } from '../../../../../../lib/stores/admin/dashboardStore.js';
	import { api } from '../../../../../../routes/api/helper/api-helper.js';

	// Register Chart.js components
	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

	let chartCanvas = $state();
	let chartInstance;
	let aiAnalysis = $state('');
	let displayedText = $state('');
	let aiLoading = $state(false);
	let aiError = $state(null);
	let typingInterval;

	// Subscribe to store for this chart
	let chartState = $derived($dashboardStore.charts.sectionsPerGrade);
	let loading = $derived(chartState.isLoading);
	let error = $derived(chartState.error);
	let chartData = $derived(chartState.data);

	const gradeLevels = ['7', '8', '9', '10'];
	const CACHE_KEY = 'sectionsPerGrade_aiAnalysis';
	const CACHE_DATA_KEY = 'sectionsPerGrade_cachedData';

	// Create chart when data is available (always with animation since no cache)
	$effect(() => {
		if (chartData && !loading && chartCanvas) {
			setTimeout(() => {
				createChart(chartData);
				generateAIAnalysis(chartData);
			}, 0);
		}
	});

	// Generate AI analysis
	async function generateAIAnalysis(data) {
		// Check if data has changed
		const cachedData = localStorage.getItem(CACHE_DATA_KEY);
		const currentData = JSON.stringify(data);
		
		if (cachedData === currentData) {
			// Data hasn't changed, load cached analysis with typing animation
			const cached = localStorage.getItem(CACHE_KEY);
			if (cached) {
				aiAnalysis = cached;
				startTypingAnimation(cached);
				return;
			}
		}

		try {
			aiLoading = true;
			aiError = null;

			// Transform data for analysis
			const transformedData = gradeLevels.map((level) => {
				const sectionData = data.find(d => d.grade_level === level);
				return { grade: level, sections: sectionData ? sectionData.section_count : 0 };
			});

			const response = await api.post('/api/ai-analysis', {
				data: transformedData,
				type: 'sectionsPerGrade'
			});

			if (response.success) {
				const analysis = response.analysis;
				
				// Cache the analysis and data
				localStorage.setItem(CACHE_KEY, analysis);
				localStorage.setItem(CACHE_DATA_KEY, currentData);
				
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

	function createChart(data) {
		// Check if canvas is available
		if (!chartCanvas) {
			console.warn('Canvas not yet available');
			return;
		}

		if (chartInstance) {
			chartInstance.destroy();
		}

		// Transform data into chart format
		const transformedData = gradeLevels.map((level) => {
			const sectionData = data.find(d => d.grade_level === level);
			return sectionData ? sectionData.section_count : 0;
		});

		const ctx = chartCanvas.getContext('2d');
		chartInstance = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: gradeLevels.map(g => `Grade ${g}`),
				datasets: [{
					label: 'Number of Sections',
					data: transformedData,
					backgroundColor: [
						'rgba(54, 162, 235, 0.6)',   // Grade 7 - Blue
						'rgba(75, 192, 192, 0.6)',   // Grade 8 - Teal
						'rgba(153, 102, 255, 0.6)',  // Grade 9 - Purple
						'rgba(255, 159, 64, 0.6)'    // Grade 10 - Orange
					],
					borderColor: [
						'rgb(54, 162, 235)',   // Grade 7 - Blue
						'rgb(75, 192, 192)',   // Grade 8 - Teal
						'rgb(153, 102, 255)',  // Grade 9 - Purple
						'rgb(255, 159, 64)'    // Grade 10 - Orange
					],
					borderWidth: 2,
					borderRadius: 8,
					borderSkipped: false
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					y: {
						beginAtZero: true,
						suggestedMax: Math.max(...transformedData) + 2, // Add some padding above the highest value
						ticks: {
							stepSize: 1,
							callback: function(value) {
								return Math.floor(value);
							},
							color: getComputedStyle(document.documentElement)
								.getPropertyValue('--md-sys-color-on-surface-variant').trim()
						},
						grid: {
							color: getComputedStyle(document.documentElement)
								.getPropertyValue('--md-sys-color-outline-variant').trim()
						},
						title: {
							display: true,
							text: 'Number of Sections',
							color: getComputedStyle(document.documentElement)
								.getPropertyValue('--md-sys-color-on-surface').trim(),
							font: {
								size: 12,
								weight: 'bold'
							}
						}
					},
					x: {
						ticks: {
							color: getComputedStyle(document.documentElement)
								.getPropertyValue('--md-sys-color-on-surface-variant').trim()
						},
						grid: {
							display: false
						}
					}
				},
				plugins: {
					legend: {
						display: false
					},
					title: {
						display: true,
						text: 'Sections per Grade Level',
						font: {
							size: 16,
							weight: 'bold'
						},
						color: getComputedStyle(document.documentElement)
							.getPropertyValue('--md-sys-color-on-surface').trim(),
						padding: {
							top: 10,
							bottom: 20
						}
					},
					tooltip: {
						callbacks: {
							label: function(context) {
								const value = context.parsed.y || 0;
								return `Sections: ${value}`;
							}
						}
					}
				}
			}
		});
	}

	// Listen for theme changes and update chart colors
	function handleThemeChange() {
		if (chartInstance && chartData) {
			createChart(chartData);
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
</script>

<div class="chart-container">
	{#if loading}
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
		align-items: center;
		justify-content: center;
		box-shadow: var(--elevation-1);
	}

	canvas {
		flex: 1;
		max-height: 100%;
		max-width: 50rem;
		margin: 0 auto;
	}

	.chart-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
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

	.ai-insights-container {
		margin-top: var(--spacing-md);
		min-height: 60px;
	}

	.ai-loading,
	.ai-error {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
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
