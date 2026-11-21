import { expect, test } from '@playwright/test';

test('falls back to a screen flash when there is no torch', async ({ page }) => {
	await page.goto('./');
	await page.locator('#send-text').fill('E E');
	await expect(page.locator('#send-preview .mletter')).toHaveCount(2);
	await expect(page.locator('#send-timing')).toContainText('WPM');

	await page.locator('#send-start').click();
	// The fake camera has no torch capability.
	await expect(page.locator('#send-status')).toHaveText('Screen flash');
	await expect(page.locator('#flash')).toBeVisible();
	// The message is short; it finishes and tears everything down on its own.
	await expect(page.locator('#send-status')).toHaveText('Idle', { timeout: 10_000 });
	await expect(page.locator('#flash')).toBeHidden();
});

test('tapping the flash overlay stops sending', async ({ page }) => {
	await page.goto('./');
	await page.locator('#send-text').fill('PARIS PARIS PARIS');
	await page.locator('#send-start').click();
	await expect(page.locator('#flash')).toBeVisible();
	await page.locator('#flash').click();
	await expect(page.locator('#flash')).toBeHidden();
	await expect(page.locator('#send-status')).toHaveText('Idle');
	await expect(page.locator('#send-start')).toHaveText('Start sending');
});

test('the flash overlay takes focus and Escape stops sending', async ({ page }) => {
	await page.goto('./');
	await page.locator('#send-text').fill('PARIS PARIS PARIS');
	await page.locator('#send-start').click();
	await expect(page.locator('#flash')).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(page.locator('#flash')).toBeHidden();
	await expect(page.locator('#send-status')).toHaveText('Idle');
});

test('warns about characters with no Morse code', async ({ page }) => {
	await page.goto('./');
	await page.locator('#send-text').fill('HI 🙂');
	await expect(page.locator('#send-warn')).toContainText('🙂');
});
