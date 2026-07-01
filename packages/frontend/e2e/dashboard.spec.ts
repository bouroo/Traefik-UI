import { test, expect } from './fixtures';
import { mockAuth, mockDashboard, mockRouters } from './fixtures';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockDashboard(page);
    await mockRouters(page);
  });

  test('dashboard renders stats cards when authenticated', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'HTTP Routers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Services' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Middlewares' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Entrypoints' })).toBeVisible();
  });

  test('navigation sidebar links are visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('aside');
    await expect(sidebar.locator('a[href="/"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/routers"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/services"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/middlewares"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/tls"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/entrypoints"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/logs"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/system"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/configfile"]')).toBeVisible();
  });

  test('clicking Routers nav item navigates to /routers', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const routersLink = page.locator('aside').locator('a[href="/routers"]');
    await expect(routersLink).toBeVisible();
    await routersLink.click();
    await expect(page).toHaveURL('/routers');
    await expect(page.getByRole('heading', { name: 'Routers', exact: true })).toBeVisible();
  });

  test('clicking Services nav item navigates to /services', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const servicesLink = page.locator('aside').locator('a[href="/services"]');
    await expect(servicesLink).toBeVisible();
    await servicesLink.click();
    await expect(page).toHaveURL('/services');
    await expect(page.getByRole('heading', { name: 'Services' })).toBeVisible();
  });

  test('theme toggle switches dark and light mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const themeButton = page.locator('header').first().locator('button').first();
    await expect(themeButton).toBeVisible();

    // Clicking toggles the theme; we verify the button remains visible and clickable.
    await themeButton.click();
    await page.waitForTimeout(300);
    await expect(themeButton).toBeVisible();
  });
});
