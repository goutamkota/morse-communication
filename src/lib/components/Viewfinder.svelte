<script lang="ts">
	import { BOX } from '#lib/media/frameSampler.ts';

	let {
		video = $bindable(),
		active,
		lit,
		target,
		onaim
	}: {
		video?: HTMLVideoElement;
		active: boolean;
		lit: boolean;
		target: { x: number; y: number };
		onaim: (x: number, y: number) => void;
	} = $props();

	let width = $state(0);
	let height = $state(0);
	const size = $derived(BOX * width);

	function aim(e: MouseEvent) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		onaim((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
	}
</script>

<!-- Tapping moves the target box; this is a pointer convenience, the default centred box works without it. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div id="rx-view" class="viewfinder" bind:clientWidth={width} bind:clientHeight={height} onclick={aim}>
	<video id="rx-video" bind:this={video} playsinline muted autoplay></video>
	{#if active}
		<div
			id="rx-target"
			class="target"
			class:lit
			style:width="{size}px"
			style:height="{size}px"
			style:left="{target.x * width - size / 2}px"
			style:top="{target.y * height - size / 2}px"
		></div>
		<span id="rx-state" class="rx-state" class:on={lit}>{lit ? 'LIGHT' : 'DARK'}</span>
	{:else}
		<div id="rx-placeholder" class="viewfinder-msg">Camera is off</div>
	{/if}
</div>

<style>
	.viewfinder {
		position: relative;
		aspect-ratio: 4 / 3;
		border-radius: var(--radius);
		overflow: hidden;
		background: #000;
		touch-action: manipulation;
	}
	video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.viewfinder-msg {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: var(--muted);
		text-align: center;
		padding: 16px;
	}
	.target {
		position: absolute;
		border: 2px solid var(--accent);
		border-radius: 8px;
		box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
		pointer-events: none;
	}
	.target::before,
	.target::after {
		content: '';
		position: absolute;
		background: var(--accent);
		opacity: 0.5;
	}
	.target::before {
		left: 50%;
		top: -8px;
		bottom: -8px;
		width: 2px;
		transform: translateX(-50%);
	}
	.target::after {
		top: 50%;
		left: -8px;
		right: -8px;
		height: 2px;
		transform: translateY(-50%);
	}
	.target.lit {
		border-color: #fff;
		box-shadow:
			0 0 0 9999px rgba(0, 0, 0, 0.35),
			0 0 18px 4px rgba(255, 255, 255, 0.6);
	}
	.rx-state {
		position: absolute;
		top: 10px;
		left: 10px;
		padding: 3px 8px;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.6);
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.08em;
	}
	.rx-state.on {
		background: var(--accent);
		color: var(--accent-ink);
	}
</style>
