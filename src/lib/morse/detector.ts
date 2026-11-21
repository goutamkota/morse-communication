// Light detection: pixels → brightness → on/off with an adaptive threshold.
// Pure module — no DOM access.

export const MIN_CONTRAST = 18; // brightness levels (0–255) between dark and lit
export const GOOD_CONTRAST = 45;
const FIRST_ON_DELTA = 25; // before a lit level is known, this much above dark counts as on
const ENVELOPE_DECAY = 0.004; // per frame; how fast the dark/lit levels forget

/**
 * Mean luma of the brightest 10% of pixels in an RGBA buffer, so a small torch
 * spot still dominates the reading.
 */
export function topBrightness(rgba: Uint8ClampedArray | Uint8Array, fraction = 0.1): number {
	const pixels = rgba.length / 4;
	if (!pixels) return 0;
	const hist = new Uint32Array(256);
	for (let i = 0; i < rgba.length; i += 4) {
		hist[(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) | 0]++;
	}
	const want = Math.max(1, Math.round(pixels * fraction));
	let count = 0;
	let total = 0;
	for (let v = 255; v >= 0 && count < want; v--) {
		const take = Math.min(hist[v], want - count);
		count += take;
		total += take * v;
	}
	return total / count;
}

export interface Detection {
	on: boolean;
	contrast: number;
	threshold: number;
}

/**
 * Tracks slowly decaying dark/lit levels and decides on/off with ±10% hysteresis.
 * Until a lit level has been seen, "on" means FIRST_ON_DELTA above dark, so the
 * very first flash is not missed.
 */
export class LightDetector {
	on = false;
	private lo: number | null = null;
	private hi = 0;
	private seenLit = false;

	reset() {
		this.on = false;
		this.lo = null;
		this.hi = 0;
		this.seenLit = false;
	}

	update(v: number): Detection {
		if (this.lo === null) {
			this.lo = this.hi = v;
		}
		this.lo = v < this.lo ? v : this.lo + (v - this.lo) * ENVELOPE_DECAY;
		this.hi = v > this.hi ? v : this.hi - (this.hi - v) * ENVELOPE_DECAY;
		const contrast = this.hi - this.lo;
		if (contrast >= MIN_CONTRAST * 1.5) this.seenLit = true;

		let threshold: number;
		let band: number;
		if (contrast >= MIN_CONTRAST && this.seenLit) {
			threshold = (this.hi + this.lo) / 2;
			band = contrast * 0.1;
		} else {
			threshold = this.lo + FIRST_ON_DELTA;
			band = 2;
		}
		if (!this.on && v > threshold + band) this.on = true;
		else if (this.on && v < threshold - band) this.on = false;
		return { on: this.on, contrast, threshold };
	}
}
