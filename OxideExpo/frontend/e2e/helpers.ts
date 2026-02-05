import { Page, expect } from '@playwright/test';

/**
 * Wait for the countdown timer to complete before proceeding.
 * In development mode, the countdown is 5 seconds.
 * This helper waits for either:
 * 1. The countdown to finish (job listings appear)
 * 2. The page to already be showing job listings (countdown skipped)
 */
export async function waitForCountdownToComplete(page: Page) {
  // Check if countdown is showing
  const countdownVisible = await page.locator('text=Próximamente').isVisible().catch(() => false);

  if (countdownVisible) {
    // Wait for countdown to disappear and job listings to appear
    // Development countdown is 5 seconds, add buffer for safety
    await expect(page.locator('h1:has-text("Ofertas Laborales")')).toBeVisible({ timeout: 10000 });
  }

  // Ensure job listings header is visible
  await expect(page.locator('h1')).toContainText('Ofertas Laborales');
}

/**
 * Navigate to home page and wait for countdown to complete
 */
export async function goToHomeAndWaitForCountdown(page: Page) {
  await page.goto('/');
  await waitForCountdownToComplete(page);
}
