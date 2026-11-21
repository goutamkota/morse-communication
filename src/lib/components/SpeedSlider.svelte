<script lang="ts">
	import { settings, saveSettings } from '#lib/settings.svelte.ts';
	import { unitToWpm } from '#lib/morse/morse.ts';

	let { label = 'Speed' }: { label?: string } = $props();
</script>

<label class="slider">
	<span>{label} <output>{settings.unit} ms · {unitToWpm(settings.unit).toFixed(1)} WPM</output></span>
	<input
		type="range"
		class="unit-slider"
		min="80"
		max="400"
		step="10"
		bind:value={settings.unit}
		onchange={saveSettings}
	/>
</label>

<style>
	.slider {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.85rem;
		color: var(--muted);
	}
	output {
		color: var(--text);
	}
	input {
		width: 100%;
		accent-color: var(--accent);
	}
</style>
