<script lang="ts">
	let { on, onstop }: { on: boolean; onstop: () => void } = $props();

	// Keyboard users land on the overlay, so Enter/Space/Escape all stop sending.
	const focus = (node: HTMLElement) => node.focus();
	const onkeydown = (e: KeyboardEvent) => e.key === 'Escape' && onstop();
</script>

<svelte:window {onkeydown} />

<!-- Full-screen light for phones without a controllable torch. Tap anywhere to stop. -->
<button id="flash" class="flash" class:on onclick={onstop} aria-label="Stop sending" {@attach focus}>
	<span class="flash-hint">Tap to stop</span>
</button>

<style>
	.flash {
		position: fixed;
		inset: 0;
		z-index: 50;
		border: 0;
		padding: 0;
		width: 100%;
		background: #000;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}
	.flash.on {
		background: #fff;
	}
	.flash-hint {
		margin-bottom: 40px;
		color: #555;
		font-size: 0.85rem;
	}
</style>
