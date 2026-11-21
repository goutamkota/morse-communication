<script lang="ts">
	import { onDestroy } from 'svelte';
	import { encode, unsupported, unitToWpm, type Step } from '#lib/morse/morse.ts';
	import { Transmitter, type TransmitMode } from '#lib/media/transmitter.ts';
	import { acquireWake, releaseWake } from '#lib/media/wakeLock.ts';
	import { settings, saveSettings } from '#lib/settings.svelte.ts';
	import { draft, refreshPermission } from '#lib/state.svelte.ts';
	import MorsePreview from '#lib/components/MorsePreview.svelte';
	import FlashOverlay from '#lib/components/FlashOverlay.svelte';
	import SpeedSlider from '#lib/components/SpeedSlider.svelte';

	const encoded = $derived(encode(draft.text));
	const skipped = $derived(unsupported(draft.text));
	const timing = $derived(
		encoded.steps.length
			? `${((encoded.totalUnits * settings.unit) / 1000).toFixed(1)} s at ${unitToWpm(settings.unit).toFixed(1)} WPM`
			: ''
	);

	let mode = $state<TransmitMode>('idle');
	let lit = $state(false);
	let step = $state<Step | null>(null);
	let progress = $state(0);
	let error = $state('');

	const tx = new Transmitter({
		onLight: (on) => (lit = on),
		onStep: (s, p) => {
			step = s;
			progress = p;
		},
		onMode: (m) => {
			mode = m;
			if (m === 'idle') releaseWake('sender');
		},
		onWarning: (msg) => {
			error = msg;
			refreshPermission();
		}
	});

	const running = $derived(mode !== 'idle');
	const status = $derived(
		mode === 'torch' ? 'Torch' : mode === 'screen' ? 'Screen flash' : mode === 'starting' ? 'Starting' : 'Idle'
	);

	function toggle() {
		if (running) {
			tx.stop();
			return;
		}
		error = '';
		acquireWake('sender');
		tx.start({ text: () => draft.text, unitMs: () => settings.unit, loop: () => settings.loop });
	}

	function toggleLoop() {
		settings.loop = !settings.loop;
		saveSettings();
	}

	// Never leave the torch on in the background or after leaving the page.
	function onHidden() {
		if (document.hidden) tx.stop();
	}
	onDestroy(() => tx.stop());
</script>

<svelte:document onvisibilitychange={onHidden} />
<svelte:window onpagehide={() => tx.stop()} />

<section class="panel">
	<label class="field-label" for="send-text">Message</label>
	<textarea
		id="send-text"
		rows="3"
		maxlength="200"
		placeholder="Type a message…"
		autocapitalize="characters"
		spellcheck="false"
		readonly={running}
		bind:value={draft.text}
	></textarea>
	{#if skipped.length}
		<p id="send-warn" class="hint hint-warn">Skipped (no Morse code): {skipped.join(' ')}</p>
	{/if}

	<div class="lamp-row">
		<div id="send-lamp" class="lamp" class:on={lit} aria-hidden="true"></div>
		<div>
			<span id="send-status" class="pill" class:live={running}>{status}</span>
			<p id="send-timing" class="hint">{timing}</p>
		</div>
	</div>

	<MorsePreview letters={encoded.letters} {step} />
	<div class="progress"><div id="send-progress" style:width="{progress * 100}%"></div></div>

	<div class="settings-row">
		<SpeedSlider />
		<button id="send-loop" class="toggle" aria-pressed={settings.loop} onclick={toggleLoop}>Repeat</button>
	</div>

	<button
		id="send-start"
		class="btn btn-primary btn-big"
		class:running
		disabled={!running && !encoded.steps.length}
		onclick={toggle}
	>
		{mode === 'starting' ? 'Starting…' : running ? 'Stop' : 'Start sending'}
	</button>
	{#if error}
		<p id="send-error" class="hint hint-error">{error}</p>
	{/if}
	<p class="hint">
		Uses the rear flashlight. If the torch can’t be controlled, the screen flashes instead — point the
		screen at the receiver.
	</p>
</section>

{#if mode === 'screen'}
	<FlashOverlay on={lit} onstop={() => tx.stop()} />
{/if}

<style>
	textarea {
		width: 100%;
		resize: none;
		padding: 12px;
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		font: 1.1rem/1.4 var(--mono);
		text-transform: uppercase;
	}
	textarea:focus {
		outline: 2px solid var(--accent);
		border-color: transparent;
	}
	.lamp-row {
		display: flex;
		gap: 14px;
		align-items: center;
	}
	.lamp {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		flex: none;
		background: #22272e;
		border: 2px solid var(--line);
		transition:
			background 30ms,
			box-shadow 30ms;
	}
	.lamp.on {
		background: var(--accent);
		box-shadow: 0 0 28px 6px rgba(255, 201, 64, 0.55);
		border-color: var(--accent);
	}
	.progress {
		height: 4px;
		background: var(--surface);
		border-radius: 4px;
		overflow: hidden;
	}
	.progress div {
		height: 100%;
		background: var(--accent);
		transition: width 80ms linear;
	}
</style>
