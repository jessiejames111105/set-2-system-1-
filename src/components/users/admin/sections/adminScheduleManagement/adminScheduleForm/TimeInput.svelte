<script>
	import { createEventDispatcher } from 'svelte';

	export let value = '';
	export let placeholder = 'Select time';
	export let disabled = false;
	export let label = '';
	export let isOpen = false; // Changed from internal state to exported prop

	const dispatch = createEventDispatcher();
	
	// Generate unique ID for accessibility
	const uniqueId = `time-input-${Math.random().toString(36).substr(2, 9)}`;

	let hours = '';
	let minutes = '';
	let period = 'AM';

	// Generate hour options (1-12)
	const hourOptions = Array.from({ length: 12 }, (_, i) => {
		const hour = i + 1;
		return { value: hour.toString().padStart(2, '0'), label: hour.toString() };
	});

	// Generate minute options (00, 15, 30, 45)
	const minuteOptions = [
		{ value: '00', label: '00' },
		{ value: '15', label: '15' },
		{ value: '30', label: '30' },
		{ value: '45', label: '45' }
	];

	const periodOptions = [
		{ value: 'AM', label: 'AM' },
		{ value: 'PM', label: 'PM' }
	];

	// Parse incoming value (24-hour format) to 12-hour components
	$: if (value && value !== formatTo24Hour()) {
		parseValue(value);
	}

	function parseValue(timeValue) {
		if (!timeValue) {
			hours = '';
			minutes = '';
			period = 'AM';
			return;
		}

		// Handle both HH:MM and HH:MM:SS formats
		const timeParts = timeValue.split(':');
		let hour24 = parseInt(timeParts[0]);
		const minute = timeParts[1] || '00';

		// Convert to 12-hour format
		if (hour24 === 0) {
			hours = '12';
			period = 'AM';
		} else if (hour24 < 12) {
			hours = hour24.toString().padStart(2, '0');
			period = 'AM';
		} else if (hour24 === 12) {
			hours = '12';
			period = 'PM';
		} else {
			hours = (hour24 - 12).toString().padStart(2, '0');
			period = 'PM';
		}

		minutes = minute;
	}

	function formatTo24Hour() {
		if (!hours || !minutes) return '';

		let hour24 = parseInt(hours);

		if (period === 'AM' && hour24 === 12) {
			hour24 = 0;
		} else if (period === 'PM' && hour24 !== 12) {
			hour24 += 12;
		}

		return `${hour24.toString().padStart(2, '0')}:${minutes}`;
	}

	function updateValue() {
		const newValue = formatTo24Hour();
		if (newValue !== value) {
			dispatch('change', { value: newValue });
		}
	}

	function selectHour(hour) {
		hours = hour;
		updateValue();
	}

	function selectMinute(minute) {
		minutes = minute;
		updateValue();
	}

	function selectPeriod(newPeriod) {
		period = newPeriod;
		updateValue();
	}

	function toggleDropdown() {
		if (!disabled) {
			isOpen = !isOpen;
			if (isOpen) {
				dispatch('open'); // Dispatch event when opening
			}
		}
	}

	function handleClickOutside(event) {
		if (!event.target.closest('.time-input-container')) {
			isOpen = false;
		}
	}

	// Format display value
	$: displayValue = hours && minutes ? `${hours}:${minutes} ${period}` : '';
</script>

<svelte:window on:click={handleClickOutside} />

<div class="time-input-container">
	{#if label}
		<label class="time-input-label" for={uniqueId}>{label}</label>
	{/if}

	<button
		type="button"
		id={uniqueId}
		class="time-input-trigger"
		class:open={isOpen}
		class:selected={displayValue}
		class:disabled
		on:click={toggleDropdown}
		{disabled}
	>
		{#if displayValue}
			<span class="time-display">{displayValue}</span>
		{:else}
			<span class="time-placeholder">{placeholder}</span>
		{/if}
		<span class="material-symbols-outlined time-dropdown-arrow">expand_more</span>
	</button>

	{#if isOpen}
		<div class="time-dropdown-menu">
			<div class="time-section">
				<div class="time-section-header">Hour</div>
				<div class="time-options">
					{#each hourOptions as hour}
						<button
							type="button"
							class="time-option"
							class:selected={hours === hour.value}
							on:click={() => selectHour(hour.value)}
						>
							{hour.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="time-section">
				<div class="time-section-header">Minute</div>
				<div class="time-options">
					{#each minuteOptions as minute}
						<button
							type="button"
							class="time-option"
							class:selected={minutes === minute.value}
							on:click={() => selectMinute(minute.value)}
						>
							{minute.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="time-section">
				<div class="time-section-header">Period</div>
				<div class="time-options">
					{#each periodOptions as periodOption}
						<button
							type="button"
							class="time-option"
							class:selected={period === periodOption.value}
							on:click={() => selectPeriod(periodOption.value)}
						>
							{periodOption.label}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.time-input-container {
		position: relative;
		width: 100%;
	}

	.time-input-label {
		display: block;
		font-size: 14px;
		font-weight: 500;
		color: var(--md-sys-color-on-surface);
		margin-bottom: 8px;
	}

	.time-input-trigger {
		width: 100%;
		height: 48px;
		padding: 12px 16px;
		border: 1px solid var(--md-sys-color-outline);
		border-radius: 8px;
		background: var(--md-sys-color-surface);
		color: var(--md-sys-color-on-surface);
		font-size: 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.time-input-trigger:hover:not(.disabled) {
		border-color: var(--md-sys-color-primary);
		background: var(--md-sys-color-surface-variant);
	}

	.time-input-trigger.open {
		border-color: var(--md-sys-color-primary);
		border-width: 2px;
	}

	.time-input-trigger.disabled {
		opacity: 0.6;
		cursor: not-allowed;
		background: var(--md-sys-color-surface-variant);
	}

	.time-display {
		font-family: monospace;
		font-size: 16px;
		color: var(--md-sys-color-on-surface);
	}

	.time-placeholder {
		color: var(--md-sys-color-on-surface-variant);
	}

	.time-dropdown-arrow {
		font-size: 20px;
		color: var(--md-sys-color-on-surface-variant);
		transition: transform 0.2s ease;
	}

	.time-input-trigger.open .time-dropdown-arrow {
		transform: rotate(180deg);
	}

	.time-dropdown-menu {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 1000;
		background: var(--md-sys-color-surface);
		border: 1px solid var(--md-sys-color-outline);
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		margin-top: 4px;
		display: flex;
		gap: 1px;
		overflow: hidden;
	}

	.time-section {
		flex: 1;
		background: var(--md-sys-color-surface);
	}

	.time-section-header {
		padding: 12px 8px 8px;
		font-size: 12px;
		font-weight: 600;
		color: var(--md-sys-color-primary);
		text-align: center;
		background: var(--md-sys-color-surface-variant);
		border-bottom: 1px solid var(--md-sys-color-outline-variant);
	}

	.time-options {
		max-height: 200px;
		overflow-y: auto;
	}

	.time-option {
		width: 100%;
		padding: 8px 12px;
		border: none;
		background: transparent;
		color: var(--md-sys-color-on-surface);
		font-size: 14px;
		cursor: pointer;
		transition: background-color 0.2s ease;
		text-align: center;
	}

	.time-option:hover {
		background: var(--md-sys-color-surface-variant);
	}

	.time-option.selected {
		background: var(--md-sys-color-primary-container);
		color: var(--md-sys-color-on-primary-container);
		font-weight: 600;
	}

	/* Scrollbar styling */
	.time-options::-webkit-scrollbar {
		width: 4px;
	}

	.time-options::-webkit-scrollbar-track {
		background: var(--md-sys-color-surface-variant);
	}

	.time-options::-webkit-scrollbar-thumb {
		background: var(--md-sys-color-outline);
		border-radius: 2px;
	}

	.time-options::-webkit-scrollbar-thumb:hover {
		background: var(--md-sys-color-outline-variant);
	}
</style>
