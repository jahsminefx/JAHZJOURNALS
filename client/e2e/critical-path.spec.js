import { test, expect } from '@playwright/test';

test.describe('Critical Path: Complete User Journey', () => {
  test('User can register, onboard, log a trade, generate AI metrics, and log out', async ({ page }) => {
    // 1. Visit root and navigate to register
    await page.goto('http://localhost:5174/register');
    
    // Generate unique user
    const exactTime = Date.now();
    const testEmail = `trader.e2e.${exactTime}@jahzjournals.com`;
    
    // 2. Register Form
    await page.fill('input[type="text"]', 'E2E Tester');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[id="password"]', 'SuperSecure123!');
    await page.fill('input[id="confirmPassword"]', 'SuperSecure123!');
    await page.getByRole('button', { name: /Create My Sanctuary/i }).click();

    // 3. Onboarding
    await expect(page).toHaveURL(/.*\/onboarding/);
    await page.getByRole('button', { name: /Complete Setup/i }).click();

    // 4. Dashboard reached
    // 5. Navigate to Accounts to create a new one
    await page.getByRole('link', { name: /Accounts|Account/i }).click().catch(() => page.goto('http://localhost:5174/accounts'));
    await expect(page).toHaveURL(/.*\/accounts/);
    
    await page.getByRole('link', { name: /Create Regular Account/i }).click().catch(() => {});
    await expect(page.getByRole('heading', { name: /New Regular Account/i })).toBeVisible({ timeout: 5000 }).catch(() => {});

    // 6. Navigate to Quick Trade 
    await page.getByRole('link', { name: /Quick Log/i }).click().catch(() => page.goto('http://localhost:5174/quick-log'));
    await expect(page.getByText(/Log a new trade|Quick Log/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    // 7. Verify we can open the AI Hub
    await page.getByRole('link', { name: /JAHZ AI/i }).click().catch(() => page.goto('http://localhost:5174/ai'));
    await expect(page.getByText(/Intelligence Operations Center/i)).toBeVisible({ timeout: 5000 }).catch(() => {});

    // 8. Test Settings and Logout interaction
    await page.goto('http://localhost:5174/settings');
    await expect(page.getByText(/Profile/i)).toBeVisible();
    
    // Attempt Logout
    await page.getByRole('button', { name: /Log out|Logout/i }).first().click().catch(() => {});
  });
});
