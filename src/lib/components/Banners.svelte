<script lang="ts">
	import { cameraSupported } from '#lib/media/camera.ts';
	import { permission } from '#lib/state.svelte.ts';
	import { applyUpdate, update } from '#lib/pwa/update.svelte.ts';

	const insecure = !window.isSecureContext && !cameraSupported();
</script>

{#if insecure}
	<div id="banner-insecure" class="banner banner-error">
		This page isn’t served over HTTPS, so the camera and torch are blocked. Open it from its
		<strong>https://</strong> address.
	</div>
{:else if permission.denied}
	<div id="banner-perm" class="banner banner-warn">
		Camera access is blocked. Tap the lock icon in the address bar → <strong>Permissions</strong> →
		<strong>Camera</strong> → Allow, then reload.
	</div>
{/if}
{#if update.available}
	<div id="banner-update" class="banner banner-info">
		A new version is ready.
		<button class="chip" onclick={applyUpdate}>Reload</button>
	</div>
{/if}

<style>
	.banner-info {
		background: var(--surface-2);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.banner {
		margin: 8px 16px;
		padding: 10px 12px;
		border-radius: 10px;
		font-size: 0.9rem;
	}
	.banner-error {
		background: #3a1419;
		color: #ffc6cc;
	}
	.banner-warn {
		background: #3a2a12;
		color: #ffd9a8;
	}
</style>
