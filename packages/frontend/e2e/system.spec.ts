import { test, expect } from './fixtures';
import { mockAuth, mockSystemStats } from './fixtures';

test.describe('System', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockSystemStats(page);
  });

  test('system page renders stats cards', async ({ page }) => {
    await page.goto('/system');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'System', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'CPU Usage' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Memory', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Uptime' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Platform' })).toBeVisible();
  });

  test('memory chart section is visible', async ({ page }) => {
    await page.goto('/system');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Memory Usage')).toBeVisible();
    await expect(page.getByText('Memory Distribution')).toBeVisible();
  });
});
