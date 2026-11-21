<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { MorseDecoder } from '#lib/morse/decoder.ts';
	import { GOOD_CONTRAST, LightDetector, MIN_CONTRAST } from '#lib/morse/detector.ts';
	import { prettyCode } from '#lib/morse/morse.ts';
	import { describeError, openRearCamera, stopStream, tameExposure } from '#lib/media/camera.ts';
	import { FrameSampler } from '#lib/media/frameSampler.ts';
	import { acquireWake, releaseWake } from '#lib/media/wakeLock.ts';
	import { settings } from '#lib/settings.svelte.ts';
	import { received, refreshPermission } from '#lib/state.svelte.ts';
	import Viewfinder from '#lib/components/Viewfinder.svelte';
	import SignalGraph from '#lib/components/SignalGraph.svelte';
	import SpeedSlider from '#lib/components/SpeedSlider.svelte';

	const SETTLE_MS = 700; // ignore frames while auto exposure settles
	const UI_EVERY_MS = 250; // stats/fallback refresh rate; the frame loop itself is not reactive

	type Quality = 'good' | 'weak' | 'bad';
	const QUALITY_LABEL: Record<Quality, string> = { good: 'Good', weak: 'Weak', bad: 'None' };

	// ---- UI state (reactive) ----
	let video = $state<HTMLVideoElement>();
	let graph = $state<SignalGraph>();
	let phase = $state<'off' | 'starting' | 'on'>('off');
	let lit = $state(false);
	let target = $state({ x: 0.5, y: 0.5 });
	let current = $state('');
	let wpm = $state('');
	let fps = $state<number | null>(null);
	let quality = $state<Quality | null>(null);
	let error = $state('');
	let fallbackReason = $state<string | null>(null);
	let copied = $state(false);

	// ---- Frame-loop state (plain variables, touched ~30×/s) ----
	let stream: MediaStream | null = null;
	let frameHandle: number | null = null;
	let running = false;
	let generation = 0; // bumps on every start/stop; stale async starts bail out
	let aim = { x: 0.5, y: 0.5 };
	let recent: boolean[] = []; // last 10 letters: true = decoded ok
	let startedAt = 0;
	let lastContrastOk = 0;
	let lowFpsSince: number | null = null;
	let frameTimes: number[] = [];
	let lastUi = 0;
	let lastContrast = 0;

	const sampler = new FrameSampler();
	const detector = new LightDetector();
	const decoder = new MorseDecoder({
		unitMs: settings.unit,
		onEvent(e) {
			if (e.type === 'symbol') current = prettyCode(e.buffer);
			else if (e.type === 'letter') {
				received.text += e.ch;
				recent.push(e.ok);
				if (recent.length > 10) recent.shift();
				current = '';
			} else if (e.type === 'space' && received.text && !received.text.endsWith(' ')) received.text += ' ';
			else if (e.type === 'unit') wpm = `${decoder.wpm.toFixed(1)} WPM`;
		}
	});
	wpm = `${decoder.wpm.toFixed(1)} WPM`;

	// The slider sets the expected speed; the decoder then adapts on its own.
	$effect(() => {
		decoder.setUnit(settings.unit);
		wpm = `${decoder.wpm.toFixed(1)} WPM`;
	});

	function resetDetector() {
		const now = performance.now();
		detector.reset();
		decoder.setUnit(settings.unit);
		decoder.reset();
		startedAt = lastContrastOk = now;
		lowFpsSince = null;
		frameTimes = [];
		graph?.clear();
		wpm = `${decoder.wpm.toFixed(1)} WPM`;
	}

	function onFrame(now: number, meta: VideoFrameCallbackMetadata | null) {
		if (!running || !video) return;
		const t = meta?.captureTime ?? meta?.expectedDisplayTime ?? now;
		const v = sampler.sample(video, aim);
		if (v !== null) {
			const { on, contrast, threshold } = detector.update(v);
			if (now - startedAt > SETTLE_MS) decoder.feed(on, t);
			graph?.push({ v, threshold, on });
			if (on !== lit) lit = on;
			lastContrast = contrast;
			trackHealth(now, contrast);
		}
		schedule();
	}

	function schedule() {
		if (!running || !video) return;
		if ('requestVideoFrameCallback' in video) frameHandle = video.requestVideoFrameCallback(onFrame);
		else frameHandle = requestAnimationFrame((now) => onFrame(now, null));
	}

	function trackHealth(now: number, contrast: number) {
		frameTimes.push(now);
		while (frameTimes.length && now - frameTimes[0] > 1000) frameTimes.shift();
		const rate = frameTimes.length;
		if (contrast >= MIN_CONTRAST) lastContrastOk = now;
		if (now - startedAt > 1500 && rate < 10) lowFpsSince ??= now;
		else lowFpsSince = null;

		if (now - lastUi < UI_EVERY_MS) return;
		lastUi = now;
		fps = rate;
		quality = lastContrast >= GOOD_CONTRAST ? 'good' : lastContrast >= MIN_CONTRAST ? 'weak' : 'bad';

		const errors = recent.filter((ok) => !ok).length;
		let reason: string | null = null;
		if (lowFpsSince !== null && now - lowFpsSince > 3000) {
			reason = `The camera is only delivering ${rate} frames per second — too slow to time flashes.`;
		} else if (now - lastContrastOk > 6000) {
			reason = 'No flashes detected. Aim the target box at the sender’s light, or reduce room light.';
		} else if (recent.length >= 5 && errors / recent.length > 0.4) {
			reason = 'Many letters could not be decoded — the feed may be unclear or the speed mismatched.';
		}
		fallbackReason = reason;
	}

	async function start() {
		if (phase !== 'off') return;
		// Every await below re-checks this, so a stop() (or a newer start) wins over a stale one.
		const gen = ++generation;
		const stale = () => gen !== generation || !video;
		error = '';
		fallbackReason = null;
		phase = 'starting';
		let s: MediaStream;
		try {
			s = await openRearCamera({ width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } });
		} catch (err) {
			if (gen !== generation) return;
			phase = 'off';
			error = describeError(err);
			fallbackReason = 'The camera is unavailable. You can still decode by eye with the manual keyboard.';
			refreshPermission();
			return;
		}
		// The user may have left the page while the permission prompt was open.
		if (stale()) {
			stopStream(s);
			return;
		}
		stream = s;
		const track = s.getVideoTracks()[0];
		await tameExposure(track);
		if (stale()) return; // stop() already released `stream`
		track.addEventListener('ended', stop);
		video!.srcObject = s;
		await video!.play().catch(() => {});
		if (stale()) return;

		running = true;
		phase = 'on';
		resetDetector();
		acquireWake('receiver');
		refreshPermission();
		schedule();
	}

	function stop() {
		if (phase === 'off') return;
		generation++;
		running = false;
		phase = 'off';
		if (frameHandle !== null && video) {
			if ('cancelVideoFrameCallback' in video) video.cancelVideoFrameCallback(frameHandle);
			cancelAnimationFrame(frameHandle);
		}
		frameHandle = null;
		// Flush any letter still in progress.
		decoder.tick(performance.now() + 10 * decoder.unit);
		stopStream(stream);
		stream = null;
		if (video) video.srcObject = null;
		lit = false;
		fps = null;
		quality = null;
		releaseWake('receiver');
	}

	function onAim(x: number, y: number) {
		aim = { x, y };
		target = aim;
		if (running) resetDetector();
	}

	function toManual() {
		stop();
		goto(resolve('/manual'));
	}

	function clearText() {
		received.text = '';
		current = '';
		recent = [];
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(received.text.trim());
			copied = true;
			setTimeout(() => (copied = false), 1200);
		} catch {
			// Clipboard blocked; nothing else to do.
		}
	}

	function onHidden() {
		if (document.hidden) stop();
	}
	onDestroy(stop);
</script>

<svelte:document onvisibilitychange={onHidden} />
<svelte:window onpagehide={stop} />

<section class="panel">
	<Viewfinder bind:video active={phase === 'on'} {lit} {target} onaim={onAim} />
	<p class="hint">Tap the image to move the target box onto the other phone’s light.</p>

	<SignalGraph bind:this={graph} />
	<div class="stats">
		<span>Signal <b id="rx-quality" class={quality ? `q-${quality}` : ''}>{quality ? QUALITY_LABEL[quality] : '–'}</b></span>
		<span>FPS <b id="rx-fps">{fps ?? '–'}</b></span>
		<span>Speed <b id="rx-wpm">{wpm}</b></span>
	</div>

	<div class="decoded-box">
		<div class="decoded-head">
			<span class="field-label">Decoded</span>
			<span id="rx-current" class="current-code">{current}</span>
		</div>
		<div id="rx-text" class="decoded" aria-live="polite">{received.text}</div>
		<div class="row">
			<button id="rx-copy" class="chip" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
			<button id="rx-clear" class="chip" onclick={clearText}>Clear</button>
		</div>
	</div>

	<div class="settings-row">
		<SpeedSlider label="Expected speed" />
	</div>

	<button
		id="rx-start"
		class="btn btn-primary btn-big"
		class:running={phase === 'on'}
		disabled={phase === 'starting'}
		onclick={() => (phase === 'on' ? stop() : start())}
	>
		{phase === 'starting' ? 'Starting…' : phase === 'on' ? 'Stop camera' : 'Start camera'}
	</button>
	{#if error}
		<p id="rx-error" class="hint hint-error">{error}</p>
	{/if}

	{#if fallbackReason}
		<div id="rx-fallback" class="fallback">
			<p id="rx-fallback-reason">{fallbackReason}</p>
			<button id="rx-to-manual" class="btn btn-warn btn-big" onclick={toManual}>Switch to Manual</button>
		</div>
	{/if}
	<p class="hint center">
		<button id="rx-manual-link" class="link" onclick={toManual}>Prefer to key it in by eye? Open manual mode</button>
	</p>
</section>

<style>
	.stats {
		display: flex;
		justify-content: space-between;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.stats b {
		color: var(--text);
	}
	.stats b.q-good {
		color: var(--ok);
	}
	.stats b.q-weak {
		color: var(--warn);
	}
	.stats b.q-bad {
		color: var(--error);
	}
	.fallback {
		background: #2b1f10;
		border: 1px solid var(--warn);
		border-radius: var(--radius);
		padding: 12px;
	}
	.fallback p {
		margin: 0 0 10px;
		color: #ffd9a8;
		font-size: 0.9rem;
	}
</style>
