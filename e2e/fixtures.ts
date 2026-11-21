// Fake-camera clips for Chromium's --use-file-for-fake-video-capture.
// A dim, noisy "room" with a torch spot in the middle flashing a Morse message.
import { closeSync, mkdirSync, openSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode } from '../src/lib/morse/morse.ts';

export const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), '.fixtures');
export const FLASH_CLIP = join(FIXTURE_DIR, 'sos-test.y4m');
export const DARK_CLIP = join(FIXTURE_DIR, 'dark.y4m');
export const FLASH_TEXT = 'SOS TEST';

const W = 160;
const H = 120;
const FPS = 30;

/** Writes a 4:2:0 y4m clip; `text` empty → no flashes at all. */
export function writeClip(out: string, text: string, unitMs = 200) {
	const edges: [number, boolean][] = [];
	let t = 1500; // dark lead-in so the receiver can learn the background
	for (const s of encode(text).steps) {
		edges.push([t, s.on]);
		t += s.dur * unitMs;
	}
	edges.push([t, false]);
	const total = t + 2500;

	mkdirSync(dirname(out), { recursive: true });
	const fd = openSync(out, 'w');
	writeSync(fd, `YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420jpeg\n`);
	let seed = 3;
	const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
	const chroma = Buffer.alloc((W * H) / 2, 128);
	const frames = Math.ceil(total / (1000 / FPS));
	for (let f = 0; f < frames; f++) {
		const ft = (f * 1000) / FPS;
		let on = false;
		for (const [et, v] of edges) {
			if (et > ft) break;
			on = v;
		}
		const y = Buffer.alloc(W * H);
		for (let row = 0; row < H; row++) {
			for (let x = 0; x < W; x++) {
				const d = Math.hypot(x - W / 2, row - H / 2);
				let v = 40 + 20 * (x / W) + rnd() * 10; // gradient + sensor noise
				if (on) v = Math.max(v, 255 - Math.max(0, d - 6) * 9); // torch spot with falloff
				else v += Math.max(0, 15 - d); // unlit phone body
				y[row * W + x] = Math.min(255, v);
			}
		}
		writeSync(fd, 'FRAME\n');
		writeSync(fd, y);
		writeSync(fd, chroma);
	}
	closeSync(fd);
}
