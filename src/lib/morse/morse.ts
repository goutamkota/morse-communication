// ITU Morse table and timeline encoding. Pure module — no DOM access.

export const MORSE: Readonly<Record<string, string>> = {
	A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
	I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
	Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
	Y: '-.--', Z: '--..',
	0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
	5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
	'.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
	'/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
	';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', _: '..--.-',
	'"': '.-..-.', $: '...-..-', '@': '.--.-.'
};

const REVERSE: Record<string, string> = Object.fromEntries(
	Object.entries(MORSE).map(([ch, code]) => [code, ch])
);

export const UNKNOWN = '�';

// Standard timing ratios, in units.
export const DOT = 1;
export const DASH = 3;
export const SYMBOL_GAP = 1;
export const LETTER_GAP = 3;
export const WORD_GAP = 7;

export interface Step {
	on: boolean;
	/** Duration in units. */
	dur: number;
	charIndex: number;
	/** Index of the symbol inside its letter; -1 for gaps. */
	symbolIndex: number;
}

export interface Letter {
	/** ' ' marks a word break. */
	ch: string;
	code: string;
}

export interface Encoded {
	steps: Step[];
	letters: Letter[];
	totalUnits: number;
}

export function decodeSymbol(code: string): string | null {
	return REVERSE[code] ?? null;
}

export function normalize(text: string): string {
	return text.toUpperCase().replace(/\s+/g, ' ').trim();
}

/** Characters in `text` that have no Morse mapping. */
export function unsupported(text: string): string[] {
	const bad = new Set<string>();
	for (const ch of normalize(text)) {
		if (ch !== ' ' && !MORSE[ch]) bad.add(ch);
	}
	return [...bad];
}

/** Text → ".- / -..." (letters split by space, words by " / "). */
export function toMorseString(text: string): string {
	return normalize(text)
		.split(' ')
		.map((word) =>
			[...word]
				.map((ch) => MORSE[ch])
				.filter(Boolean)
				.join(' ')
		)
		.filter(Boolean)
		.join(' / ');
}

/** Builds the flash timeline for `text`. */
export function encode(text: string): Encoded {
	const letters: Letter[] = [];
	for (const word of normalize(text).split(' ')) {
		const chars = [...word].filter((ch) => MORSE[ch]);
		if (!chars.length) continue;
		if (letters.length) letters.push({ ch: ' ', code: '' });
		for (const ch of chars) letters.push({ ch, code: MORSE[ch] });
	}

	const steps: Step[] = [];
	letters.forEach((letter, charIndex) => {
		if (letter.ch === ' ') {
			// Replace the trailing letter gap with a word gap.
			steps[steps.length - 1].dur = WORD_GAP;
			return;
		}
		[...letter.code].forEach((sym, symbolIndex) => {
			steps.push({ on: true, dur: sym === '.' ? DOT : DASH, charIndex, symbolIndex });
			const lastSymbol = symbolIndex === letter.code.length - 1;
			steps.push({
				on: false,
				dur: lastSymbol ? LETTER_GAP : SYMBOL_GAP,
				charIndex,
				symbolIndex: -1
			});
		});
	});
	// Drop the trailing gap; the sender adds its own pause when looping.
	if (steps.length) steps.pop();

	const totalUnits = steps.reduce((sum, s) => sum + s.dur, 0);
	return { steps, letters, totalUnits };
}

/** PARIS standard: 50 units per word. */
export function unitToWpm(unitMs: number): number {
	return 1200 / unitMs;
}

/** '.-' → '·–' for display. */
export function prettyCode(code: string): string {
	return code.replace(/\./g, '·').replace(/-/g, '–');
}
