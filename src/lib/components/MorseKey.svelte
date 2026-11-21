<script lang="ts">
	// A keyboard key that fires on pointerdown (instant, never moves focus, so no system
	// keyboard), while still working for keyboard/assistive activation.
	import type { Snippet } from 'svelte';

	let {
		onpress,
		class: cls = '',
		label,
		key,
		children
	}: { onpress: () => void; class?: string; label?: string; key?: string; children: Snippet } = $props();

	let pressed = $state(false);

	function fire() {
		pressed = true;
		setTimeout(() => (pressed = false), 90);
		onpress();
	}
</script>

<button
	class={cls}
	class:pressed
	data-key={key}
	aria-label={label}
	onpointerdown={(e) => {
		e.preventDefault();
		fire();
	}}
	onclick={(e) => {
		// detail === 0: activated by Enter/Space or assistive tech (no pointerdown happened).
		if (e.detail === 0) fire();
	}}>{@render children()}</button
>
