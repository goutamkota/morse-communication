<script lang="ts">
	import { install, promptInstall } from '#lib/pwa/install.svelte.ts';
</script>

{#if install.available}
	<button id="install" class="chip" onclick={promptInstall}>Install</button>
{/if}
