<script module lang="ts">
	export interface Sample {
		v: number;
		threshold: number;
		on: boolean;
	}
</script>

<script lang="ts">
	// Brightness-over-time strip. Drawn imperatively from the receiver's frame loop,
	// so per-frame samples never go through Svelte reactivity.
	import { onMount } from 'svelte';

	const POINTS = 240;

	let canvas: HTMLCanvasElement;
	let g: CanvasRenderingContext2D | null = null;
	let samples: Sample[] = [];

	onMount(() => {
		g = canvas.getContext('2d');
	});

	export function clear() {
		samples = [];
		g?.clearRect(0, 0, canvas.width, canvas.height);
	}

	export function push(s: Sample) {
		samples.push(s);
		if (samples.length > POINTS) samples.shift();
		draw();
	}

	function draw() {
		if (!g) return;
		const { width: w, height: h } = canvas;
		g.clearRect(0, 0, w, h);
		const step = w / POINTS;
		const y = (v: number) => h - 4 - (v / 255) * (h - 8);

		g.fillStyle = 'rgba(255, 201, 64, 0.15)';
		samples.forEach((s, i) => s.on && g!.fillRect(i * step, 0, step + 0.5, h));

		g.strokeStyle = 'rgba(255, 255, 255, 0.35)';
		g.lineWidth = 1;
		g.setLineDash([4, 4]);
		g.beginPath();
		samples.forEach((s, i) => (i ? g!.lineTo(i * step, y(s.threshold)) : g!.moveTo(0, y(s.threshold))));
		g.stroke();
		g.setLineDash([]);

		g.strokeStyle = '#ffc940';
		g.lineWidth = 2;
		g.beginPath();
		samples.forEach((s, i) => (i ? g!.lineTo(i * step, y(s.v)) : g!.moveTo(0, y(s.v))));
		g.stroke();
	}
</script>

<canvas id="rx-graph" class="graph" width="600" height="90" aria-label="Brightness graph" bind:this={canvas}
></canvas>

<style>
	.graph {
		width: 100%;
		height: 90px;
		background: var(--surface);
		border-radius: 10px;
		display: block;
	}
</style>
