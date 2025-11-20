<script>
	import { onMount, onDestroy } from 'svelte';
	import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title } from 'chart.js';
	import { api } from '../../../../../../routes/api/helper/api-helper.js';

	// Register Chart.js components
	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

	let chartCanvas;
	let chartInstance;
	let loading = true;
	let error = null;
	let chartData = null;

	const statusLabels = {
		on_hold: 'On Hold',
		verifying: 'Verifying',
		processing: 'Processing',
		for_pickup: 'For Pickup',
		released: 'Released'
	};

	const statusColors = [
		'rgba(253, 216, 53, 0.6)',    // On Hold - #fdd835
		'rgba(92, 107, 192, 0.6)',    // Verifying - #5c6bc0
		'rgba(255, 152, 0, 0.6)',     // Processing - #ff9800
		'rgba(0, 188, 212, 0.6)',     // For Pickup - #00bcd4
		'rgba(76, 175, 80, 0.6)'      // Released - #4caf50
	];

	const statusBorderColors = [
		'rgb(253, 216, 53)',    // On Hold - #fdd835
		'rgb(92, 107, 192)',    // Verifying - #5c6bc0
		'rgb(255, 152, 0)',     // Processing - #ff9800
		'rgb(0, 188, 212)',     // For Pickup - #00bcd4
		'rgb(76, 175, 80)'      // Released - #4caf50
	];

	async function fetchDocumentRequestsData() {
		try {
			loading = true;
			error = null;

			// Fetch document requests stats from API
			const response = await api.get('/api/document-requests?action=stats');
			
			if (response.success) {
				chartData = response.data;
				loading = false;
				// Create chart after loading is set to false, so canvas is rendered
				setTimeout(() => {
					if (chartCanvas) {
						createChart(response.data);
					}
				}, 0);
			} else {
				throw new Error(response.error || 'Failed to fetch document requests data');
			}
		} catch (err) {
			console.error('Error fetching document requests data:', err);
			error = err.message;
			loading = false;
		}
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
		const transformedData = Object.keys(statusLabels).map((status) => {
			return data[status] || 0;
		});

		const ctx = chartCanvas.getContext('2d');
		chartInstance = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: Object.values(statusLabels),
				datasets: [{
					label: 'Number of Requests',
					data: transformedData,
					backgroundColor: statusColors,
					borderColor: statusBorderColors,
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
							text: 'Number of Requests',
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
						text: 'Document Requests by Status',
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
								return `Requests: ${value}`;
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
		fetchDocumentRequestsData();

		// Refresh every 60 seconds
		const refreshInterval = setInterval(() => {
			fetchDocumentRequestsData();
		}, 60000);

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
			clearInterval(refreshInterval);
			observer.disconnect();
		};
	});

	onDestroy(() => {
		if (chartInstance) {
			chartInstance.destroy();
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
			<button class="retry-button" on:click={fetchDocumentRequestsData}>
				<span class="material-symbols-outlined">refresh</span>
				Retry
			</button>
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
		height: 400px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: var(--elevation-1);
	}

	canvas {
		max-height: 100%;
		max-width: 100%;
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

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.chart-error .material-symbols-outlined {
		font-size: 48px;
		color: var(--md-sys-color-error);
	}

	.retry-button {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-sm) var(--spacing-md);
		background-color: var(--md-sys-color-primary);
		color: var(--md-sys-color-on-primary);
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-family: var(--md-sys-typescale-label-large-font);
		font-size: var(--md-sys-typescale-label-large-size);
		font-weight: var(--md-sys-typescale-label-large-weight);
		transition: all var(--transition-normal);
	}

	.retry-button:hover {
		background-color: var(--md-sys-color-primary-container);
		color: var(--md-sys-color-on-primary-container);
	}

	.retry-button .material-symbols-outlined {
		font-size: 18px;
	}
</style>

