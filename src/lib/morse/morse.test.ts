import { describe, expect, test } from 'vitest';
import { MORSE, decodeSymbol, encode, prettyCode, toMorseString, unsupported, unitToWpm } from './morse';

describe('morse table', () => {
	test('every table entry round-trips through decodeSymbol', () => {
		for (const [ch, code] of Object.entries(MORSE)) expect(decodeSymbol(code)).toBe(ch);
	});

	test('codes are unique', () => {
		const codes = Object.values(MORSE);
		expect(new Set(codes).size).toBe(codes.length);
	});

	test('decodeSymbol returns null for unknown codes', () => {
		expect(decodeSymbol('........')).toBeNull();
		expect(decodeSymbol('')).toBeNull();
	});
});

describe('formatting', () => {
	test('toMorseString formats letters and words', () => {
		expect(toMorseString('sos')).toBe('... --- ...');
		expect(toMorseString('  hi   there ')).toBe('.... .. / - .... . .-. .');
	});

	test('unsupported lists characters without a mapping', () => {
		expect(unsupported('Hi #there~')).toEqual(['#', '~']);
		expect(unsupported('OK')).toEqual([]);
	});

	test('prettyCode uses display glyphs', () => {
		expect(prettyCode('.-')).toBe('·–');
	});

	test('PARIS timing gives 6 WPM at 200 ms', () => {
		expect(unitToWpm(200)).toBe(6);
	});
});

describe('encode', () => {
	const shape = (text: string) => encode(text).steps.map((s) => [s.on, s.dur]);

	test('produces standard ITU timing', () => {
		expect(shape('E T')).toEqual([
			[true, 1],
			[false, 7],
			[true, 3]
		]);
		expect(encode('E T').totalUnits).toBe(11);
	});

	test('uses symbol and letter gaps', () => {
		expect(shape('AN')).toEqual([
			[true, 1],
			[false, 1],
			[true, 3],
			[false, 3],
			[true, 3],
			[false, 1],
			[true, 1]
		]);
	});

	test('skips unsupported characters and empty words', () => {
		expect(encode('a ## b').letters.map((l) => l.ch)).toEqual(['A', ' ', 'B']);
	});

	test('empty text is empty', () => {
		expect(encode('').steps).toEqual([]);
		expect(encode('###').steps).toEqual([]);
	});
});
