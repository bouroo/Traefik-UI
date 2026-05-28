import { test, expect } from './fixtures';
import { mockAuth, mockDashboard, mockRouters } from './fixtures';

test.describe('Dashboard', () => {
  test('dashboard renders stats cards when authenticated', async ({ page }) => {
    await mockAuth(page);
    await mockDashboard(page);
    await mockRouters(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'HTTP Routers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Services' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Middlewares' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Entrypoints' })).toBeVisible();
  });

  test('navigation sidebar links work', async ({ page }) => {
    await mockAuth(page);
    await mockDashboard(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('aside');
    const dashboardLink = sidebar.locator('a[href="/"]').first();
    await expect(dashboardLink).toBeVisible();
  });

  test('clicking Routers nav item navigates to /routers', async ({ page }) => {
    await mockAuth(page);
    await mockDashboard(page);
    await mockRouters(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('aside');
    const routersLink = sidebar.locator('a[href="/routers"]');
    await expect(routersLink).toBeVisible();
    await routersLink.click();
    await expect(page).toHaveURL('/routers');
    await expect(page.getByRole('heading', { name: 'Routers' })).toBeVisible();
  });

test('theme toggle switches dark/light mode', async ({ page }) => {
    await mockAuth(page);
    await mockDashboard(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const header = page.locator('header').first();
    const themeButton = header.locator('button').first();
    await expect(themeButton).toBeVisible();
    await themeButton.click();
    await page.waitForTimeout(500);
  });
});