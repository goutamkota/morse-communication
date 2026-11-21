import { expect, test } from '@playwright/test';
import { FLASH_TEXT } from './fixtures.ts';

test('decodes torch flashes from the camera', async ({ page }) => {
	await page.goto('./#/receive');
	await page.locator('#rx-start').click();
	await expect(page.locator('#rx-start')).toHaveText('Stop camera');
	await expect(page.locator('#rx-text')).toContainText(FLASH_TEXT, { timeout: 40_000 });
	await expect(page.locator('#rx-quality')).toHaveText(/Good|Weak/);
	await expect(page.locator('#rx-fallback')).toBeHidden();

	await page.locator('#rx-start').click();
	await expect(page.locator('#rx-start')).toHaveText('Start camera');
	await expect(page.locator('#rx-placeholder')).toBeVisible();
});

test('stops the camera when leaving the page', async ({ page }) => {
	await page.goto('./#/receive');
	await page.locator('#rx-start').click();
	await expect(page.locator('#rx-start')).toHaveText('Stop camera');
	await page.getByRole('link', { name: 'Send' }).click();
	await expect(page).toHaveURL(/#\/$/);
	const live = await page.evaluate(() =>
		[...document.querySelectorAll('video')].some((v) => v.srcObject !== null)
	);
	expect(live).toBe(false);
});
