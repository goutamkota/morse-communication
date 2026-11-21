import { describe, expect, test } from 'vitest';
import { encode } from './morse';
import { MorseDecoder, type DecoderEvent } from './decoder';

/** Deterministic PRNG so failures are reproducible. */
function rng(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
}

interface SimOptions {
	unit: number;
	decoderUnit?: number;
	jitter?: number;
	frameMs?: number;
	seed?: number;
	dropEvery?: number;
	adaptive?: boolean;
}

/**
 * Simulates a camera sampling a flashing torch. Each on/off edge is shifted by up to
 * ±jitter ms, frames arrive every `frameMs`, and `dropEvery` flips one frame occasionally.
 */
function simulate(text: string, opts: SimOptions) {
	const { unit, decoderUnit = unit, jitter = 0, frameMs = 33, seed = 1, dropEvery = 0, adaptive = true } = opts;
	const rand = rng(seed);
	const { steps } = encode(text);

	const edges: { on: boolean; at: number }[] = [];
	let t = 500;
	for (const step of steps) {
		const start = t + (rand() * 2 - 1) * jitter;
		edges.push({ on: step.on, at: Math.max(edges.at(-1)?.at ?? 0, start) });
		t += step.dur * unit;
	}
	// The sender always switches off after the final symbol.
	edges.push({ on: false, at: t + (rand() * 2 - 1) * jitter });
	const end = t + 12 * unit;

	let out = '';
	const decoder = new MorseDecoder({
		unitMs: decoderUnit,
		adaptive,
		onEvent: (e) => {
			if (e.type === 'letter') out += e.ch;
			if (e.type === 'space') out += ' ';
		}
	});

	let frame = 0;
	for (let ft = 0; ft <= end; ft += frameMs + (rand() * 2 - 1) * 4) {
		let on = false;
		for (const e of edges) {
			if (e.at <= ft) on = e.on;
			else break;
		}
		frame++;
		if (dropEvery && frame % dropEvery === 0) on = !on;
		decoder.feed(on, ft);
	}
	return { text: out.trim(), decoder };
}

const MESSAGE = 'SOS THE QUICK BROWN FOX 123';

// At 100 ms a dot is only ~3 camera frames, so edge jitter must stay well under a unit.
describe.each([
	[100, 20],
	[200, 40],
	[300, 40]
])('at %i ms', (unit, jitter) => {
	test('decodes a clean signal', () => {
		expect(simulate(MESSAGE, { unit }).text).toBe(MESSAGE);
	});

	test(`decodes a jittery signal (±${jitter} ms)`, () => {
		for (let seed = 1; seed <= 5; seed++) {
			expect(simulate(MESSAGE, { unit, jitter, seed }).text, `seed ${seed}`).toBe(MESSAGE);
		}
	});
});

// One flipped frame is ~33 ms; that is only distinguishable from a real symbol at ≥ 200 ms.
test.each([200, 300])('survives occasional flipped frames at %i ms', (unit) => {
	expect(simulate(MESSAGE, { unit, dropEvery: 37 }).text).toBe(MESSAGE);
});

test('works without adaptation when unit is right', () => {
	expect(simulate(MESSAGE, { unit: 200, jitter: 30, adaptive: false }).text).toBe(MESSAGE);
});

test('adapts when configured unit is 2x too slow', () => {
	const { text, decoder } = simulate(`EEEE ${MESSAGE}`, { unit: 100, decoderUnit: 200, jitter: 20 });
	// The first letters are lost while the decoder locks on; the tail must be clean.
	expect(text.endsWith('BROWN FOX 123'), text).toBe(true);
	expect(Math.abs(decoder.unit - 100)).toBeLessThan(20);
});

test('adapts when configured unit is 2x too fast', () => {
	const { text, decoder } = simulate(`TTTT ${MESSAGE}`, { unit: 200, decoderUnit: 100, jitter: 20 });
	expect(text.endsWith('BROWN FOX 123'), text).toBe(true);
	expect(Math.abs(decoder.unit - 200)).toBeLessThan(40);
});

test('all-dot and all-dash messages decode', () => {
	expect(simulate('EEE ISH', { unit: 200, jitter: 30 }).text).toBe('EEE ISH');
	expect(simulate('TTT MOM', { unit: 200, jitter: 30 }).text).toBe('TTT MOM');
});

test('unknown patterns emit the replacement character', () => {
	const letters: DecoderEvent[] = [];
	const d = new MorseDecoder({ unitMs: 100, adaptive: false, onEvent: (e) => e.type === 'letter' && letters.push(e) });
	let t = 0;
	d.feed(false, t);
	for (let i = 0; i < 8; i++) {
		d.feed(true, (t += 100));
		d.feed(false, (t += 100));
	}
	d.tick((t += 400));
	expect(letters).toHaveLength(1);
	expect(letters[0]).toMatchObject({ type: 'letter', ok: false });
});

test('a long steady light is reported as noise, not a dash', () => {
	const events: string[] = [];
	const d = new MorseDecoder({ unitMs: 100, adaptive: false, onEvent: (e) => events.push(e.type) });
	d.feed(false, 0);
	d.feed(true, 100);
	d.feed(false, 3000);
	d.tick(3500);
	expect(events).toEqual(['noise']);
});
