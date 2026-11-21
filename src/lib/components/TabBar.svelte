<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	const tabs = [
		{ id: '/', label: 'Send', href: resolve('/') },
		{ id: '/receive', label: 'Receive', href: resolve('/receive') },
		{ id: '/manual', label: 'Manual', href: resolve('/manual') }
	] as const;
</script>

<nav class="tabs" aria-label="Mode">
	{#each tabs as tab (tab.id)}
		<a
			href={tab.href}
			data-tab={tab.id}
			aria-current={page.route.id === tab.id ? 'page' : undefined}>{tab.label}</a
		>
	{/each}
</nav>

<style>
	.tabs {
		position: sticky;
		top: 0;
		z-index: 5;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
		margin: 8px 16px;
		padding: 4px;
		background: var(--surface);
		border-radius: 12px;
	}
	a {
		text-align: center;
		text-decoration: none;
		padding: 10px 0;
		border-radius: 9px;
		color: var(--muted);
		font-weight: 600;
		touch-action: manipulation;
	}
	a[aria-current='page'] {
		background: var(--surface-2);
		color: var(--text);
	}
</style>
