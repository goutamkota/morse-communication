import { describe, expect, test } from 'vitest';
import { LightDetector, MIN_CONTRAST, topBrightness } from './detector';

function gray(values: number[]) {
	const buf = new Uint8ClampedArray(values.length * 4);
	values.forEach((v, i) => buf.set([v, v, v, 255], i * 4));
	return buf;
}

describe('topBrightness', () => {
	test('a small bright spot dominates a dark frame', () => {
		const px = new Array(100).fill(30);
		for (let i = 0; i < 10; i++) px[i] = 250;
		expect(topBrightness(gray(px))).toBe(250);
	});

	test('uniform frames read their level', () => {
		expect(topBrightness(gray(new Array(50).fill(80)))).toBe(80);
	});

	test('uses luma weights', () => {
		const green = new Uint8ClampedArray([0, 255, 0, 255]);
		expect(topBrightness(green)).toBe(Math.floor(0.587 * 255));
	});
});

describe('LightDetector', () => {
	test('catches the very first flash before a lit level is known', () => {
		const d = new LightDetector();
		for (let i = 0; i < 30; i++) expect(d.update(40).on).toBe(false);
		expect(d.update(200).on).toBe(true);
	});

	test('tracks on/off with a midpoint threshold once calibrated', () => {
		const d = new LightDetector();
		const seq = [40, 40, 200, 200, 40, 40, 200, 40];
		const states = seq.map((v) => d.update(v).on);
		expect(states).toEqual([false, false, true, true, false, false, true, false]);
		expect(d.update(40).contrast).toBeGreaterThan(MIN_CONTRAST);
	});

	test('hysteresis ignores small wobble near the threshold', () => {
		const d = new LightDetector();
		d.update(40);
		d.update(200);
		d.update(40);
		// Midpoint ≈ 120, band ≈ 16: values in 110–130 must not flip the state.
		const states = [125, 115, 128, 112].map((v) => d.update(v).on);
		expect(new Set(states).size).toBe(1);
	});

	test('sensor noise alone never turns on', () => {
		const d = new LightDetector();
		let s = 7;
		for (let i = 0; i < 300; i++) {
			s = (s * 1664525 + 1013904223) >>> 0;
			expect(d.update(50 + (s / 2 ** 32) * 10).on).toBe(false);
		}
	});

	test('reset forgets calibration', () => {
		const d = new LightDetector();
		d.update(40);
		d.update(200);
		d.reset();
		expect(d.on).toBe(false);
		expect(d.update(60).contrast).toBe(0);
	});
});
