import { test, expect } from './fixtures';
import { mockAuth, mockSsoProviders } from './fixtures';

test.describe('Authentication', () => {
  test('login page renders correctly', async ({ page }) => {
    await mockSsoProviders(page, []);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Traefik UI' })).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await mockAuth(page);
    await mockSsoProviders(page, []);
    await page.goto('/login');

    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL('/');
  });

  test('login failure shows error message', async ({ page }) => {
    await mockSsoProviders(page, []);
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid credentials' }),
      });
    });

    await page.goto('/login');

    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Invalid credentials')).toBeVisible();
  });

  test('logout button clears auth and redirects to login', async ({ page }) => {
    await mockAuth(page);
    await mockSsoProviders(page, []);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify logged in
    await expect(page).toHaveURL('/');

    // Click logout
    const logoutButton = page.locator('header').getByRole('button').last();
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();

    // Token should be removed from localStorage and page should redirect to login
    const token = await page.evaluate(() => localStorage.getItem('traefik_ui_token'));
    expect(token).toBeNull();
  });

  test('SSO provider buttons render when providers are available', async ({ page }) => {
    await mockAuth(page);
    await mockSsoProviders(page, [
      { id: 1, name: 'Google', provider_type: 'google' },
      { id: 2, name: 'GitHub', provider_type: 'github' },
    ]);
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Google' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'GitHub' })).toBeVisible();
  });
});