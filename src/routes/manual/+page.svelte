<script lang="ts">
	// On-screen Morse keyboard. Only buttons — no inputs — so the system keyboard never opens.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { MORSE, UNKNOWN, decodeSymbol, prettyCode } from '#lib/morse/morse.ts';
	import { settings, saveSettings } from '#lib/settings.svelte.ts';
	import { draft, manual } from '#lib/state.svelte.ts';
	import MorseKey from '#lib/components/MorseKey.svelte';

	const VIBRATION: Record<string, number> = { dot: 30, dash: 90 };
	const VIBRATE_OTHER = 15;
	const MAX_BUFFER = 8;
	const LETTERS = Object.entries(MORSE).filter(([ch]) => /^[A-Z0-9]$/.test(ch));

	let showLetters = $state(false);

	const guess = $derived(manual.buffer ? decodeSymbol(manual.buffer) : null);
	const committed = $derived(manual.entries.map((e) => e.ch).join(''));
	const morseLine = $derived(manual.entries.map((e) => (e.ch === ' ' ? '/' : prettyCode(e.code))).join(' '));

	function vibrate(ms: number) {
		if (settings.vibrate && navigator.vibrate) navigator.vibrate(ms);
	}

	function commitLetter() {
		if (!manual.buffer) return;
		manual.entries.push({ ch: decodeSymbol(manual.buffer) ?? UNKNOWN, code: manual.buffer });
		manual.buffer = '';
	}

	const actions = {
		dot() {
			if (manual.buffer.length < MAX_BUFFER) manual.buffer += '.';
		},
		dash() {
			if (manual.buffer.length < MAX_BUFFER) manual.buffer += '-';
		},
		letter: commitLetter,
		space() {
			commitLetter();
			if (manual.entries.length && manual.entries.at(-1)!.ch !== ' ') manual.entries.push({ ch: ' ', code: '' });
		},
		back() {
			if (manual.buffer) manual.buffer = manual.buffer.slice(0, -1);
			else manual.entries.pop();
		},
		clear() {
			manual.entries = [];
			manual.buffer = '';
		}
	};

	function press(key: keyof typeof actions) {
		vibrate(VIBRATION[key] ?? VIBRATE_OTHER);
		actions[key]();
	}

	function addLetter(ch: string, code: string) {
		vibrate(VIBRATE_OTHER);
		commitLetter();
		manual.entries.push({ ch, code });
	}

	function toggleVibrate() {
		settings.vibrate = !settings.vibrate;
		saveSettings();
		vibrate(VIBRATE_OTHER);
	}

	function reply() {
		vibrate(VIBRATE_OTHER);
		commitLetter();
		draft.text = committed.replaceAll(UNKNOWN, '').trim();
		goto(resolve('/'));
	}

	// Make sure nothing focusable (e.g. the Send textarea) keeps the soft keyboard open.
	onMount(() => (document.activeElement as HTMLElement | null)?.blur?.());
</script>

<section class="panel panel-manual">
	<div class="decoded-box">
		<div class="decoded-head">
			<span class="field-label">Decoded</span>
			<span id="m-guess" class="current-code">{manual.buffer ? `${prettyCode(manual.buffer)} ${guess ? `= ${guess}` : ''}` : ''}</span>
		</div>
		<div id="m-text" class="decoded" aria-live="polite">{committed}{#if manual.buffer}<span class="guess">{guess ?? '?'}</span>{/if}</div>
		<div id="m-morse" class="morse-line">{morseLine}{#if manual.buffer}<span class="buf">{manual.entries.length ? ' ' : ''}{prettyCode(manual.buffer)}</span>{/if}</div>
	</div>

	<div class="keyboard" id="m-keys">
		<MorseKey key="dot" class="key key-sym" label="Dot" onpress={() => press('dot')}>·</MorseKey>
		<MorseKey key="dash" class="key key-sym" label="Dash" onpress={() => press('dash')}>–</MorseKey>
		<MorseKey key="letter" class="key" onpress={() => press('letter')}>Next letter</MorseKey>
		<MorseKey key="space" class="key" onpress={() => press('space')}>Space</MorseKey>
		<MorseKey key="back" class="key" label="Backspace" onpress={() => press('back')}>⌫</MorseKey>
		<MorseKey key="clear" class="key key-muted" onpress={() => press('clear')}>Clear</MorseKey>
	</div>

	<div class="row">
		<button
			id="m-letters-toggle"
			class="chip"
			aria-expanded={showLetters}
			onclick={() => {
				showLetters = !showLetters;
				vibrate(VIBRATE_OTHER);
			}}>ABC letters</button
		>
		<button id="m-vibrate" class="toggle" aria-pressed={settings.vibrate} onclick={toggleVibrate}>Vibration</button>
		<button id="m-send" class="chip" onclick={reply}>Reply via torch →</button>
	</div>

	{#if showLetters}
		<div id="m-letters" class="letters">
			{#each LETTERS as [ch, code] (ch)}
				<MorseKey label={ch} onpress={() => addLetter(ch, code)}><b>{ch}</b><small>{prettyCode(code)}</small></MorseKey>
			{/each}
		</div>
	{/if}
</section>

<style>
	.panel-manual,
	.panel-manual :global(*) {
		user-select: none;
		-webkit-user-select: none;
	}
	.guess {
		color: var(--accent);
		opacity: 0.8;
	}
	.morse-line {
		font: 1rem/1.5 var(--mono);
		color: var(--muted);
		word-break: break-all;
		min-height: 1.5em;
	}
	.buf {
		color: var(--accent);
	}
	.keyboard {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.keyboard :global(.key) {
		border: 1px solid var(--line);
		background: var(--surface-2);
		border-radius: var(--radius);
		min-height: 64px;
		font-size: 1.05rem;
		font-weight: 700;
		transition:
			transform 60ms,
			background 60ms;
	}
	.keyboard :global(.key-sym) {
		min-height: 110px;
		font-size: 3.4rem;
		line-height: 1;
		background: var(--surface);
		color: var(--accent);
	}
	.keyboard :global(.key-muted) {
		color: var(--muted);
	}
	.keyboard :global(.key.pressed) {
		transform: scale(0.96);
		background: #2c3540;
	}
	.letters {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 6px;
	}
	.letters :global(button) {
		border: 1px solid var(--line);
		background: var(--surface);
		border-radius: 10px;
		padding: 8px 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}
	.letters :global(button.pressed) {
		background: #2c3540;
	}
	.letters b {
		font-size: 1.05rem;
	}
	.letters small {
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--muted);
	}
	@media (min-width: 560px) {
		.keyboard {
			grid-template-columns: repeat(3, 1fr);
		}
		.letters {
			grid-template-columns: repeat(9, 1fr);
		}
	}
</style>
