import { expect, test, type Page } from '@playwright/test';

const key = (page: Page, name: string) => page.locator(`#m-keys [data-key="${name}"]`);

test('keys Morse without opening the system keyboard', async ({ page }) => {
	await page.goto('./#/manual');
	await expect(page.locator('main input, main textarea, main [contenteditable]')).toHaveCount(0);

	// S O S
	for (const code of ['...', '---', '...']) {
		for (const s of code) await key(page, s === '.' ? 'dot' : 'dash').click();
		await key(page, 'letter').click();
	}
	await expect(page.locator('#m-text')).toHaveText('SOS');
	await expect(page.locator('#m-morse')).toHaveText('··· ––– ···');

	// Live guess while a letter is in progress, then backspace removes it.
	await key(page, 'dot').click();
	await key(page, 'dash').click();
	await expect(page.locator('#m-guess')).toHaveText('·– = A');
	await key(page, 'back').click();
	await key(page, 'back').click();
	await expect(page.locator('#m-guess')).toHaveText('');

	// Letter grid adds whole letters.
	await key(page, 'space').click();
	await page.locator('#m-letters-toggle').click();
	await page.locator('#m-letters').getByRole('button', { name: 'K', exact: true }).click();
	await expect(page.locator('#m-text')).toHaveText('SOS K');

	await page.locator('#m-send').click();
	await expect(page).toHaveURL(/#\/$/);
	await expect(page.locator('#send-text')).toHaveValue('SOS K');
});

test('keyed text survives switching tabs', async ({ page }) => {
	await page.goto('./#/manual');
	await key(page, 'dot').click();
	await key(page, 'letter').click();
	await page.locator('[data-tab="/receive"]').click();
	await page.locator('[data-tab="/manual"]').click();
	await expect(page.locator('#m-text')).toHaveText('E');
});

test('vibrates on each key press', async ({ page }) => {
	await page.addInitScript(() => {
		const calls: number[] = [];
		(window as unknown as { vibrations: number[] }).vibrations = calls;
		navigator.vibrate = ((p: VibratePattern) => (calls.push(Number(p)), true)) as Navigator["vibrate"];
	});
	await page.goto('./#/manual');
	await key(page, 'dot').click();
	await key(page, 'dash').click();
	await key(page, 'letter').click();
	expect(await page.evaluate(() => (window as unknown as { vibrations: number[] }).vibrations)).toEqual([
		30, 90, 15
	]);
});
