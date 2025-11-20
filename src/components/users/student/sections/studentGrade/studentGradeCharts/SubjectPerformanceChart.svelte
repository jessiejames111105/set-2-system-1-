<script>
	import { onMount, onDestroy } from 'svelte';
	import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title } from 'chart.js';

	// Register Chart.js components
	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

	let { subjects = [] } = $props();

	let chartCanvas = $state();
	let chartInstance;

	function createChart() {
		if (!chartCanvas || !subjects || subjects.length === 0) {
			return;
		}

		if (chartInstance) {
			chartInstance.destroy();
		}

		// Filter out subjects with no grades
		const validSubjects = subjects.filter(s => s.numericGrade > 0 && s.verified);

		if (validSubjects.length === 0) {
			return;
		}

		// Prepare data
		const labels = validSubjects.map(s => s.name);
		const grades = validSubjects.map(s => s.numericGrade);

		// Color based on performance
		const backgroundColors = grades.map(grade => {
			if (grade >= 85) return 'rgba(76, 175, 80, 1.0)'; // Green - Excellent
			if (grade >= 80) return 'rgba(33, 150, 243, 1.0)'; // Blue - Good
			if (grade >= 75) return 'rgba(255, 152, 0, 1.0)'; // Orange - Satisfactory
			return 'rgba(244, 67, 54, 1.0)'; // Red - Needs Improvement
		});

		const borderColors = grades.map(grade => {
			if (grade >= 85) return 'rgb(76, 175, 80)';
			if (grade >= 80) return 'rgb(33, 150, 243)';
			if (grade >= 75) return 'rgb(255, 152, 0)';
			return 'rgb(244, 67, 54)';
		});

		// Calculate dynamic bar thickness based on number of items
		const numItems = validSubjects.length;
		let maxBarThickness;
		let categoryPercentage;
		let barPercentage;

		if (numItems <= 3) {
			maxBarThickness = 50;
			categoryPercentage = 0.6;
			barPercentage = 0.7;
		} else if (numItems <= 6) {
			maxBarThickness = 40;
			categoryPercentage = 0.7;
			barPercentage = 0.75;
		} else if (numItems <= 10) {
			maxBarThickness = 30;
			categoryPercentage = 0.8;
			barPercentage = 0.85;
		} else {
			maxBarThickness = 20;
			categoryPercentage = 0.9;
			barPercentage = 0.9;
		}

		const ctx = chartCanvas.getContext('2d');
		chartInstance = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: labels,
				datasets: [
					{
						label: 'Grade',
						data: grades,
						backgroundColor: backgroundColors,
						borderColor: borderColors,
						borderWidth: 2,
						borderRadius: 8,
						maxBarThickness: maxBarThickness,
						categoryPercentage: categoryPercentage,
						barPercentage: barPercentage
					}
				]
			},
			options: {
				indexAxis: 'y', // Horizontal bar chart
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: false
					},
					title: {
						display: true,
						text: 'Subject Performance Overview',
						font: {
							size: 16,
							weight: 'bold'
						},
						color: getComputedStyle(document.documentElement)
							.getPropertyValue('--md-sys-color-on-surface')
							.trim(),
						padding: {
							top: 10,
							bottom: 20
						}
					},
					tooltip: {
						backgroundColor: 'rgba(30, 30, 30, 0.95)',
						padding: 16,
						cornerRadius: 12,
						titleFont: {
							size: 15,
							weight: '600',
							family: "'Inter', 'Segoe UI', sans-serif"
						},
						bodyFont: {
							size: 14,
							weight: '500',
							family: "'Inter', 'Segoe UI', sans-serif"
						},
						titleColor: '#ffffff',
						bodyColor: '#e0e0e0',
						borderColor: 'rgba(255, 255, 255, 0.1)',
						borderWidth: 1,
						displayColors: false,
						titleMarginBottom: 8,
						bodySpacing: 6,
						callbacks: {
							label: function (context) {
								const grade = context.parsed.x;
								let performance = '';
								let emoji = '';
								if (grade >= 85) {
									performance = 'Excellent';
									emoji = '🌟';
								} else if (grade >= 80) {
									performance = 'Good';
									emoji = '✨';
								} else if (grade >= 75) {
									performance = 'Satisfactory';
									emoji = '👍';
								} else {
									performance = 'Needs Improvement';
									emoji = '📈';
								}
								return `${emoji} ${grade.toFixed(1)}% - ${performance}`;
							}
						}
					}
				},
				scales: {
					x: {
						beginAtZero: true,
						max: 100,
						grid: {
							color: getComputedStyle(document.documentElement)
								.getPropertyValue('--md-sys-color-outline-variant')
								.trim(),
							lineWidth: 1
						},
						ticks: {
							color: getComputedStyle(document.documentElement)
								.getPropertyValue('--md-sys-color-on-surface-variant')
								.trim(),
							font: {
								size: 12,
								weight: '500'
							},
							padding: 8,
							callback: function(value) {
								return value + '%';
							}
						},
						title: {
							display: true,
							text: 'Grade (%)',
							color: getComputedStyle(document.documentElement)
								.getPropertyValue('--md-sys-color-on-surface-variant')
								.trim(),
							font: {
								size: 12,
								weight: '600'
							}
						}
					},
					y: {
						grid: {
							display: false
						},
						ticks: {
							color: getComputedStyle(document.documentElement)
								.getPropertyValue('--md-sys-color-on-surface-variant')
								.trim(),
							font: {
								size: 12,
								weight: '500'
							},
							padding: 10
						}
					}
				}
			}
		});
	}

	// Listen for theme changes
	function handleThemeChange() {
		if (chartInstance) {
			createChart();
		}
	}

	onMount(() => {
		if (subjects && subjects.length > 0) {
			createChart();
		}

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
	});

	// Recreate chart when subjects change
	$effect(() => {
		if (subjects && chartCanvas) {
			createChart();
		}
	});
</script>

<div class="chart-container">
	{#if subjects.filter(s => s.numericGrade > 0 && s.verified).length === 0}
		<div class="chart-empty">
			<span class="material-symbols-outlined">analytics</span>
			<p>No grade data available</p>
		</div>
	{:else}
		<canvas bind:this={chartCanvas}></canvas>
	{/if}
</div>

<style>
	.chart-container {
		background-color: var(--md-sys-color-surface-container);
		border: 1px solid var(--md-sys-color-outline-variant);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
		min-height: 400px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: var(--elevation-1);
		transition: all var(--transition-normal);
		flex: 1;
	}

	.chart-container:hover {
		box-shadow: var(--elevation-2);
	}

	canvas {
		flex: 1;
		max-height: 100%;
		max-width: 50rem;
		margin: 0 auto;
	}

	.chart-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-md);
		color: var(--md-sys-color-on-surface-variant);
		padding: var(--spacing-xl);
	}

	.chart-empty .material-symbols-outlined {
		font-size: 48px;
		color: var(--md-sys-color-outline);
	}

	.chart-empty p {
		font-family: var(--md-sys-typescale-body-medium-font);
		font-size: var(--md-sys-typescale-body-medium-size);
		margin: 0;
	}
</style>

