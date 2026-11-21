import { expect, test } from '@playwright/test';

test('is installable and works offline', async ({ page, context }) => {
	await page.goto('./');

	const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
	expect(manifestHref).toBe('./manifest.webmanifest');
	const manifest = await (await page.request.get(manifestHref!)).json();
	expect(manifest.display).toBe('standalone');
	expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
		expect.arrayContaining(['192x192', '512x512'])
	);

	// Service worker installs and takes control.
	await page.evaluate(() => navigator.serviceWorker.ready);
	await page.reload();
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

	await context.setOffline(true);
	await page.goto('./#/manual');
	await expect(page.locator('#m-keys')).toBeVisible();
	await page.goto('./#/receive');
	await expect(page.locator('#rx-start')).toBeVisible();
	await context.setOffline(false);
});

test('hash routes work as deep links', async ({ page }) => {
	await page.goto('./#/receive');
	await expect(page.locator('[data-tab="/receive"]')).toHaveAttribute('aria-current', 'page');
	await page.getByRole('link', { name: 'Manual' }).click();
	await expect(page).toHaveURL(/#\/manual$/);
});
