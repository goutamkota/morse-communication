import { expect, test } from '@playwright/test';

test('offers manual mode when no flashes are seen', async ({ page }) => {
	await page.goto('./#/receive');
	await page.locator('#rx-start').click();
	await expect(page.locator('#rx-start')).toHaveText('Stop camera');
	await expect(page.locator('#rx-fallback-reason')).toContainText('No flashes detected', {
		timeout: 15_000
	});
	await page.locator('#rx-to-manual').click();
	await expect(page).toHaveURL(/#\/manual$/);
	await expect(page.locator('#m-keys')).toBeVisible();
});
