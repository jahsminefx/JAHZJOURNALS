import { test, expect } from '@playwright/test';

test.describe('Trade Lifecycle and Dashboard Synchronization', () => {
  // Use a unique email for each test run to isolate environment
  const testEmail = `testuser_${Date.now()}@jahzjournals.com`;
  const testPassword = 'Password123!';

  test('User can register, complete trade lifecycle, and dashboard open-trade count updates perfectly', async ({ page }) => {
    // 1. Register a new account
    await page.goto('/register');
    await page.getByLabel(/Name/i).fill('Test User');
    await page.getByLabel(/Email/i).fill(testEmail);
    await page.getByLabel(/Password/i).fill(testPassword);
    await page.getByRole('button', { name: /Register|Sign Up/i }).click();

    // Ensure we landed on the dashboard
    await expect(page).toHaveURL(/\/dashboard/i, { timeout: 10000 });

    // Step A: Verify Open Trades is initially 0
    // (Assuming there is a metric card with the word 'Open Trades' and a value)
    const openTradesLocator = page.locator('div').filter({ hasText: /^Open Trades$/i }).locator('..').locator('.text-3xl, .text-4xl, .font-bold');
    await expect(openTradesLocator).toContainText('0', { timeout: 10000 });

    // Step B: Create a PLANNED trade
    await page.getByRole('button', { name: /Log Trade|New Trade/i }).click();
    await page.getByLabel(/Pair/i).fill('EURUSD');
    await page.getByLabel(/Direction/i).selectOption('BUY');
    await page.getByLabel(/Status/i).selectOption('PLANNED');
    await page.getByLabel(/Entry Price/i).fill('1.1000');
    // Save trade
    await page.getByRole('button', { name: /Save Trade/i }).click();

    // Verify PLANNED trade does not increment Open Trades count
    await page.goto('/dashboard');
    await expect(openTradesLocator).toContainText('0');

    // Step C: Edit trade -> Move to ACTIVE
    await page.goto('/journal'); // Go to list of trades
    await page.getByText('EURUSD').first().click(); // Click on trade to open editor
    await page.getByLabel(/Status/i).selectOption('ACTIVE');
    await page.getByRole('button', { name: /Save/i }).click();

    // Verify Dashboard Open Trades is now 1
    await page.goto('/dashboard');
    await expect(openTradesLocator).toContainText('1');

    // Step D: Edit trade -> Move to CLOSED with a Realised P/L
    await page.goto('/journal');
    await page.getByText('EURUSD').first().click();
    await page.getByLabel(/Status/i).selectOption('CLOSED');
    await page.getByLabel(/P\/L/i).fill('150'); // Enter profit
    await page.getByRole('button', { name: /Save/i }).click();

    // Verify Dashboard Open Trades is back to 0
    await page.goto('/dashboard');
    await expect(openTradesLocator).toContainText('0');

    // Verify Dashboard Realised P/L reflects the $150
    const profitLocator = page.locator('div').filter({ hasText: /^Net Profit\/Loss|Realised P\/L$/i }).locator('..').locator('.text-3xl, .text-4xl, .font-bold');
    await expect(profitLocator).toContainText('150');
  });
});
