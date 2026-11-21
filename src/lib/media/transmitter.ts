// Plays an encoded Morse timeline on the torch, or on a full-screen flash when no torch
// can be controlled. UI-independent: progress is reported through callbacks.

import { encode, type Step } from '#lib/morse/morse.ts';
import { describeError, openTorch, setTorch, stopStream } from './camera';

export type TransmitMode = 'idle' | 'starting' | 'torch' | 'screen';

export interface TransmitterCallbacks {
	/** Light state changed (drives the on-screen lamp and the screen-flash overlay). */
	onLight(on: boolean): void;
	/** A step began; `progress` is 0–1 through the message. */
	onStep(step: Step | null, progress: number): void;
	onMode(mode: TransmitMode): void;
	/** Non-fatal problem worth showing (e.g. camera denied → screen flash used). */
	onWarning(message: string): void;
}

export interface TransmitOptions {
	/** Read at the start of every repeat, so edits apply to the next pass. */
	text: () => string;
	unitMs: () => number;
	loop: () => boolean;
}

/** One transmission. Each start() gets a fresh run, so a stale run can never touch a newer one. */
interface Run {
	cancelled: boolean;
	mode: TransmitMode;
	stream: MediaStream | null;
	track: MediaStreamTrack | null;
}

export class Transmitter {
	private run: Run | null = null;

	constructor(private cb: TransmitterCallbacks) {}

	get active() {
		return this.run !== null;
	}

	async start(opts: TransmitOptions) {
		if (this.run || !encode(opts.text()).steps.length) return;
		const run: Run = { cancelled: false, mode: 'starting', stream: null, track: null };
		this.run = run;
		this.setMode(run, 'starting');

		try {
			const { stream, track } = await openTorch();
			if (run.cancelled) {
				stopStream(stream);
				return;
			}
			run.stream = stream;
			run.track = track;
			this.setMode(run, track ? 'torch' : 'screen');
		} catch (err) {
			if (run.cancelled) return;
			const name = (err as { name?: string })?.name;
			if (name === 'NotAllowedError' || name === 'InsecureContext') {
				this.cb.onWarning(`${describeError(err)} Using a screen flash instead.`);
			}
			this.setMode(run, 'screen');
		}

		try {
			do {
				const { steps, totalUnits } = encode(opts.text());
				if (!steps.length) break;
				await this.play(run, steps, totalUnits, opts.unitMs());
				// Clear gap between repeats so the receiver sees a word break.
				if (!run.cancelled && opts.loop()) await this.until(run, performance.now() + 14 * opts.unitMs());
			} while (!run.cancelled && opts.loop());
		} finally {
			await this.finish(run);
		}
	}

	stop() {
		if (this.run) return this.finish(this.run);
	}

	/** Tears a run down. Shared state is released synchronously, before any await. */
	private async finish(run: Run) {
		const { stream, track, mode } = run;
		run.cancelled = true;
		run.stream = run.track = null;
		if (this.run === run) {
			this.run = null;
			this.cb.onLight(false);
			this.cb.onStep(null, 0);
			this.cb.onMode('idle');
		}
		if (track && mode === 'torch') await setTorch(track, false).catch(() => {});
		stopStream(stream);
	}

	private setMode(run: Run, mode: TransmitMode) {
		run.mode = mode;
		if (this.run === run) this.cb.onMode(mode);
	}

	private async light(run: Run, on: boolean) {
		if (run.cancelled) return;
		if (run.mode === 'torch' && run.track) {
			try {
				await setTorch(run.track, on);
			} catch {
				// Torch control failed mid-message: fall back to the screen.
				this.setMode(run, 'screen');
			}
		}
		if (!run.cancelled) this.cb.onLight(on);
	}

	/**
	 * Every step's deadline is computed from one start time, so torch latency never
	 * accumulates across the message.
	 */
	private async play(run: Run, steps: Step[], totalUnits: number, unit: number) {
		const t0 = performance.now() + 100;
		let elapsed = 0;
		// Start dark so the receiver can measure the background.
		await this.light(run, false);
		await this.until(run, t0);
		for (const step of steps) {
			if (run.cancelled) return;
			this.cb.onStep(step, elapsed / totalUnits);
			await this.light(run, step.on);
			elapsed += step.dur;
			await this.until(run, t0 + elapsed * unit);
		}
		await this.light(run, false);
		if (!run.cancelled) this.cb.onStep(null, 1);
	}

	/** Waits until an absolute performance.now() deadline, waking early if the run is cancelled. */
	private until(run: Run, deadline: number) {
		return new Promise<void>((resolve) => {
			const check = () => {
				if (run.cancelled) return resolve();
				const left = deadline - performance.now();
				if (left <= 1) return resolve();
				// Short slices so a cancelled run lets go quickly even during long gaps.
				setTimeout(check, left > 20 ? Math.min(left - 12, 50) : 0);
			};
			check();
		});
	}
}
