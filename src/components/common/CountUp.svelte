<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { CountUp } from 'countup.js';

	// Props
	export let value = 0;
	export let decimals = 1; // Number of decimal places
	export let duration = 2; // Animation duration in seconds
	export let useEasing = true; // Use easing animation
	export let useGrouping = true; // Use thousand separators
	export let separator = ','; // Thousand separator
	export let decimal = '.'; // Decimal separator
	export let prefix = ''; // Prefix string
	export let suffix = ''; // Suffix string
	export let startVal = 0; // Starting value
	export let colorTransition = false; // Enable color transition based on grade thresholds
	export let getGradeColor = null; // Function to get color based on grade value

	let countUpElement;
	let countUpInstance;
	let isInitialized = false;
	let hasAnimated = false;
	let currentColor = '';
	let animationFrameId = null;

	// Helper function to format number and remove .0 decimals
	function formatNumber(num, decimalPlaces) {
		const formatted = num.toFixed(decimalPlaces);
		// Remove .0 if it's a whole number
		return formatted.replace(/\.0+$/, '');
	}

	onMount(() => {
		if (browser && countUpElement) {
			// Initialize with startVal, don't animate yet
			countUpElement.textContent = `${prefix}${formatNumber(startVal, decimals)}${suffix}`;
			
			// Initialize color if color transition is enabled
			if (colorTransition && getGradeColor) {
				// Start with "needs improvement" color (65 is the threshold)
				currentColor = getGradeColor(65);
			}
			
			isInitialized = true;
			
			// If value is already available, start animation
			if (value !== startVal && value > 0) {
				startAnimation();
			}
		}
		
		// Cleanup on component destroy
		return () => {
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
			}
		};
	});

	function updateColorDuringAnimation(startTime) {
		if (!colorTransition || !getGradeColor || !browser) return;
		
		const currentTime = Date.now();
		const elapsed = currentTime - startTime;
		const progress = Math.min(elapsed / (duration * 1000), 1);
		
		// Define grade thresholds in order (from lowest to highest)
		const thresholds = [65, 75, 80, 85];
		
		// Determine which color tier the final value falls into
		let targetTier = 0;
		if (value >= 85) targetTier = 3;
		else if (value >= 80) targetTier = 2;
		else if (value >= 75) targetTier = 1;
		else targetTier = 0;
		
		// Use a faster progression - multiply progress to make transitions happen quicker
		// This makes colors change in the first 60% of the animation
		const colorProgress = Math.min(progress * 1.6, 1);
		
		// Calculate which tier to show based on accelerated time progress
		// This creates faster, more visible color transitions
		const currentTier = Math.min(Math.floor(colorProgress * (targetTier + 1)), targetTier);
		
		// Map tier to representative grade value for color
		const tierToGrade = [65, 75, 80, 85];
		const displayGrade = tierToGrade[currentTier];
		
		// Update color based on current tier
		currentColor = getGradeColor(displayGrade);
		
		// Continue animation if not complete
		if (progress < 1) {
			animationFrameId = requestAnimationFrame(() => updateColorDuringAnimation(startTime));
		} else {
			// Ensure final color is set
			currentColor = getGradeColor(value);
		}
	}

	function startAnimation() {
		if (!browser || !countUpElement || !isInitialized || hasAnimated) return;
		
		try {
			// Create new CountUp instance for animation
			countUpInstance = new CountUp(countUpElement, value, {
				startVal: startVal,
				decimalPlaces: decimals,
				duration: duration,
				useEasing: useEasing,
				useGrouping: useGrouping,
				separator: separator,
				decimal: decimal,
				prefix: prefix,
				suffix: suffix,
				// Custom formatter to remove .0 decimals
				formattingFn: (n) => {
					const formatted = n.toFixed(decimals);
					return formatted.replace(/\.0+$/, '');
				}
			});

			if (!countUpInstance.error) {
				countUpInstance.start();
				hasAnimated = true;
				
				// Start color transition animation if enabled
				if (colorTransition && getGradeColor) {
					updateColorDuringAnimation(Date.now());
				}
			} else {
				console.error('CountUp error:', countUpInstance.error);
				// Fallback to direct display
				countUpElement.textContent = `${prefix}${formatNumber(value, decimals)}${suffix}`;
				if (colorTransition && getGradeColor) {
					currentColor = getGradeColor(value);
				}
			}
		} catch (error) {
			console.error('Failed to initialize CountUp:', error);
			// Fallback to direct display
			countUpElement.textContent = `${prefix}${formatNumber(value, decimals)}${suffix}`;
			if (colorTransition && getGradeColor) {
				currentColor = getGradeColor(value);
			}
		}
	}

	// Watch for value changes and trigger animation
	$: if (isInitialized && value !== startVal && value > 0 && !hasAnimated) {
		startAnimation();
	}

	// Handle subsequent value updates after initial animation
	$: if (countUpInstance && browser && hasAnimated && value !== startVal) {
		try {
			countUpInstance.update(value);
		} catch (error) {
			console.error('CountUp update error:', error);
			// Fallback to direct display
			countUpElement.textContent = `${prefix}${formatNumber(value, decimals)}${suffix}`;
		}
	}
</script>

<span 
	bind:this={countUpElement} 
	class="countup-container"
	style={colorTransition && currentColor ? `color: ${currentColor}` : ''}>
	{#if !browser}
		{prefix}{formatNumber(value, decimals)}{suffix}
	{/if}
</span>

<style>
	.countup-container {
		display: inline-block;
		font-variant-numeric: tabular-nums;
		font-family: inherit;
		font-size: inherit;
		font-weight: inherit;
		color: inherit;
		line-height: inherit;
		transition: color 0.4s ease-in-out;
	}
</style>