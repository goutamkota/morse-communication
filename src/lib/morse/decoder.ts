// Timing-based Morse decoder. Pure module — no DOM access.
//
// Feed it the light state on every frame: decoder.feed(isOn, timeMs).
// Thresholds (u = current unit estimate):
//   on  < 2u → dot, otherwise dash (pulses > 10u are noise)
//   off < 2u → gap inside a letter; ≥ 2u → letter ends; ≥ 5u → word space
//   on/off shorter than the glitch limit (≈ max(0.3u, 1.5 frames)) is treated as a
//   dropped/extra frame and merged away.

import { decodeSymbol, UNKNOWN } from './morse';

export type DecoderEvent =
	| { type: 'symbol'; symbol: '.' | '-'; buffer: string }
	| { type: 'letter'; ch: string; code: string; ok: boolean }
	| { type: 'space' }
	| { type: 'noise'; dur: number }
	| { type: 'unit'; unit: number };

export interface DecoderOptions {
	unitMs?: number;
	onEvent?: (e: DecoderEvent) => void;
	adaptive?: boolean;
}

const GLITCH = 0.3;
const HISTORY = 12;
const MIN_UNIT = 40;
const MAX_UNIT = 1000;

export class MorseDecoder {
	unit = 200;
	buffer = '';
	private onEvent: (e: DecoderEvent) => void;
	private adaptive: boolean;
	private lastReportedUnit = 200;
	private state = false;
	private lastChange: number | null = null;
	private offStart = 0;
	private lastFeed: number | null = null;
	private frameDt = 33;
	/** On-pulse awaiting confirmation that the following off is not a glitch. */
	private pending: { dur: number; start: number } | null = null;
	private letterFlushed = true;
	private wordFlushed = true;
	private history: number[] = [];

	constructor({ unitMs = 200, onEvent = () => {}, adaptive = true }: DecoderOptions = {}) {
		this.onEvent = onEvent;
		this.adaptive = adaptive;
		this.setUnit(unitMs);
		this.reset();
	}

	setUnit(unitMs: number) {
		this.unit = clamp(unitMs, MIN_UNIT, MAX_UNIT);
		this.lastReportedUnit = this.unit;
	}

	reset() {
		this.state = false;
		this.lastChange = null;
		this.offStart = 0;
		this.lastFeed = null;
		this.frameDt = 33;
		this.pending = null;
		this.buffer = '';
		this.letterFlushed = true;
		this.wordFlushed = true;
		this.history = [];
	}

	get wpm() {
		return 1200 / this.unit;
	}

	/** Shortest pulse/gap accepted as real; anything shorter is a single bad frame. */
	get glitchMs() {
		return Math.min(0.6 * this.unit, Math.max(GLITCH * this.unit, 1.5 * this.frameDt));
	}

	feed(isOn: boolean, t: number) {
		if (this.lastFeed !== null) {
			const dt = t - this.lastFeed;
			if (dt > 0 && dt < 500) this.frameDt = 0.9 * this.frameDt + 0.1 * dt;
		}
		this.lastFeed = t;
		if (this.lastChange === null) {
			this.lastChange = t;
			this.offStart = t;
			this.state = isOn;
			return;
		}
		if (isOn !== this.state) {
			const dur = t - this.lastChange;
			if (this.state) this.onEnded(dur, t);
			else this.offEnded(dur, t);
		}
		this.tick(t);
	}

	/** Flushes letters/spaces based on how long the light has been off. Safe to call any time. */
	tick(t: number) {
		if (this.state || this.lastChange === null) return;
		const off = t - this.lastChange;
		if (this.pending && off >= this.glitchMs) this.commitPending();
		if (!this.letterFlushed && off >= 2 * this.unit) this.flushLetter();
		if (!this.wordFlushed && off >= 5 * this.unit) {
			this.wordFlushed = true;
			this.onEvent({ type: 'space' });
		}
	}

	private onEnded(dur: number, t: number) {
		if (dur < this.glitchMs) {
			// A flicker of light: pretend it never happened and keep the off period running.
			this.state = false;
			this.lastChange = this.offStart;
			return;
		}
		this.pending = { dur, start: this.lastChange! };
		this.state = false;
		this.offStart = t;
		this.lastChange = t;
	}

	private offEnded(dur: number, t: number) {
		if (this.pending && dur < this.glitchMs) {
			// A dropped frame inside a pulse: join it back onto the pulse.
			this.state = true;
			this.lastChange = this.pending.start;
			this.pending = null;
			return;
		}
		this.tick(t);
		if (this.pending) this.commitPending();
		this.state = true;
		this.lastChange = t;
	}

	private commitPending() {
		const { dur } = this.pending!;
		this.pending = null;
		if (dur > 10 * this.unit) {
			this.onEvent({ type: 'noise', dur });
			return;
		}
		if (this.adaptive) this.adapt(dur);
		const symbol = dur < 2 * this.unit ? '.' : '-';
		this.buffer += symbol;
		this.letterFlushed = false;
		this.wordFlushed = false;
		this.onEvent({ type: 'symbol', symbol, buffer: this.buffer });
	}

	private flushLetter() {
		this.letterFlushed = true;
		if (!this.buffer) return;
		const code = this.buffer;
		this.buffer = '';
		const ch = decodeSymbol(code);
		this.onEvent({ type: 'letter', ch: ch ?? UNKNOWN, code, ok: ch !== null });
	}

	/**
	 * Re-estimates the unit from recent on-pulse durations by splitting them into
	 * a short (dot) and long (dash) cluster.
	 */
	private adapt(dur: number) {
		this.history.push(dur);
		if (this.history.length > HISTORY) this.history.shift();
		if (this.history.length < 3) return;

		const sorted = [...this.history].sort((a, b) => a - b);
		let best: { cost: number; short: number[]; long: number[] } | null = null;
		for (let k = 1; k < sorted.length; k++) {
			const short = sorted.slice(0, k);
			const long = sorted.slice(k);
			const cost = variance(short) * short.length + variance(long) * long.length;
			if (!best || cost < best.cost) best = { cost, short, long };
		}
		if (!best) return;

		// Medians so a couple of merged/split pulses can't drag the estimate.
		const shortMed = median(best.short);
		const longMed = median(best.long);
		let estimate: number | null = null;
		if (longMed / shortMed > 2) {
			estimate = (shortMed * best.short.length + (longMed / 3) * best.long.length) / sorted.length;
		} else {
			// Only one kind of symbol seen. Trust it only if it sits clearly on one side.
			const m = mean(sorted);
			if (m >= 0.6 * this.unit && m <= 1.6 * this.unit) estimate = m;
			else if (m >= 2.2 * this.unit && m <= 4.5 * this.unit) estimate = m / 3;
		}
		if (estimate === null) return;

		// Move at most 25% per pulse toward the estimate.
		const next = 0.6 * this.unit + 0.4 * estimate;
		this.unit = clamp(clamp(next, this.unit * 0.75, this.unit * 1.25), MIN_UNIT, MAX_UNIT);
		if (Math.abs(this.unit - this.lastReportedUnit) / this.lastReportedUnit > 0.05) {
			this.lastReportedUnit = this.unit;
			this.onEvent({ type: 'unit', unit: this.unit });
		}
	}
}

function clamp(v: number, lo: number, hi: number) {
	return Math.min(hi, Math.max(lo, v));
}

function sum(a: number[]) {
	return a.reduce((s, v) => s + v, 0);
}

function mean(a: number[]) {
	return sum(a) / a.length;
}

function median(a: number[]) {
	const s = [...a].sort((x, y) => x - y);
	const mid = s.length >> 1;
	return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function variance(a: number[]) {
	const m = mean(a);
	return mean(a.map((v) => (v - m) ** 2));
}
