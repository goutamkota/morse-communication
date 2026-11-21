// Reads the light level inside the target box from a playing <video>.

import { topBrightness } from '#lib/morse/detector.ts';

/** Target box size as a fraction of the viewfinder width. */
export const BOX = 0.26;

const CANVAS_W = 96;
const CANVAS_H = 72; // 4:3, matches the viewfinder

export class FrameSampler {
	private c2d: CanvasRenderingContext2D;

	constructor() {
		const canvas = document.createElement('canvas');
		canvas.width = CANVAS_W;
		canvas.height = CANVAS_H;
		this.c2d = canvas.getContext('2d', { willReadFrequently: true })!;
	}

	/**
	 * Draws the visible (object-fit: cover) part of the video into a small canvas, so
	 * coordinates line up with what the user sees, and returns the brightness of the
	 * brightest 10% of pixels in the box centred on `target` (0–1 fractions).
	 */
	sample(video: HTMLVideoElement, target: { x: number; y: number }): number | null {
		const vw = video.videoWidth;
		const vh = video.videoHeight;
		if (!vw || !vh) return null;
		const viewAspect = CANVAS_W / CANVAS_H;
		let sw = vw;
		let sh = vh;
		if (vw / vh > viewAspect) sw = vh * viewAspect;
		else sh = vw / viewAspect;
		this.c2d.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, CANVAS_W, CANVAS_H);

		const size = Math.round(BOX * CANVAS_W);
		const x0 = Math.round(Math.min(CANVAS_W - size, Math.max(0, target.x * CANVAS_W - size / 2)));
		const y0 = Math.round(Math.min(CANVAS_H - size, Math.max(0, target.y * CANVAS_H - size / 2)));
		return topBrightness(this.c2d.getImageData(x0, y0, size, size).data);
	}
}
