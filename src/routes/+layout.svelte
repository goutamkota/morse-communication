<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import type { LayoutProps } from './$types';
	import TabBar from '#lib/components/TabBar.svelte';
	import Banners from '#lib/components/Banners.svelte';
	import InstallButton from '#lib/components/InstallButton.svelte';
	import { listenForInstall } from '#lib/pwa/install.svelte.ts';
	import { watchForUpdate } from '#lib/pwa/update.svelte.ts';
	import { refreshPermission } from '#lib/state.svelte.ts';
	import { reacquireWake } from '#lib/media/wakeLock.ts';

	let { children }: LayoutProps = $props();

	onMount(() => {
		const stopInstall = listenForInstall();
		const stopUpdate = watchForUpdate();
		refreshPermission();
		let status: PermissionStatus | null = null;
		navigator.permissions
			?.query({ name: 'camera' as PermissionName })
			.then((s) => {
				status = s;
				s.addEventListener('change', refreshPermission);
			})
			.catch(() => {
				// Permissions API without camera support.
			});
		return () => {
			stopInstall();
			stopUpdate();
			status?.removeEventListener('change', refreshPermission);
		};
	});

	// Pages stop their own camera/torch when hidden; the layout only restores the wake lock.
	function onVisibility() {
		if (!document.hidden) reacquireWake();
	}
</script>

<svelte:document onvisibilitychange={onVisibility} />

<header class="topbar">
	<h1><span class="logo" aria-hidden="true">·–</span> Morse Light</h1>
	<InstallButton />
</header>

<Banners />
<TabBar />

<main>
	{@render children()}
</main>

<style>
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px 4px;
	}
	h1 {
		font-size: 1.15rem;
		margin: 0;
		letter-spacing: 0.02em;
	}
	.logo {
		color: var(--accent);
		font-weight: 800;
		margin-right: 4px;
	}
</style>
