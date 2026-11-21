<script lang="ts">
	import type { Letter, Step } from '#lib/morse/morse.ts';

	let { letters, step }: { letters: Letter[]; step: Step | null } = $props();

	function symClass(i: number, j: number) {
		if (!step) return '';
		if (i < step.charIndex || (i === step.charIndex && j < step.symbolIndex)) return 'done';
		if (i === step.charIndex && j === step.symbolIndex && step.on) return 'active';
		return '';
	}
</script>

<div id="send-preview" class="morse-preview" aria-live="off">
	{#each letters as letter, i (i)}
		{#if letter.ch === ' '}
			<span class="mword"></span>
		{:else}
			<span class="mletter" class:current={step?.charIndex === i}>
				<span class="code">
					{#each letter.code as s, j (j)}
						<span class="sym {symClass(i, j)}">{s === '.' ? '·' : '–'}</span>
					{/each}
				</span>
				<span class="ch">{letter.ch}</span>
			</span>
		{/if}
	{/each}
</div>

<style>
	.morse-preview {
		min-height: 64px;
		padding: 12px;
		border-radius: var(--radius);
		background: var(--surface);
		display: flex;
		flex-wrap: wrap;
		gap: 10px 14px;
		align-items: flex-end;
		font-family: var(--mono);
	}
	.morse-preview:empty::before {
		content: 'Morse preview appears here';
		color: var(--muted);
		font-family: system-ui, sans-serif;
		font-size: 0.9rem;
	}
	.mletter {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		opacity: 0.85;
	}
	.ch {
		font-size: 0.75rem;
		color: var(--muted);
	}
	.code {
		font-size: 1.3rem;
		letter-spacing: 2px;
		font-weight: 700;
	}
	.sym.done {
		color: var(--muted);
	}
	.sym.active {
		color: var(--accent);
		text-shadow: 0 0 10px var(--accent);
	}
	.mletter.current {
		opacity: 1;
	}
	.mletter.current .ch {
		color: var(--accent);
	}
	.mword {
		width: 100%;
		height: 0;
	}
</style>
