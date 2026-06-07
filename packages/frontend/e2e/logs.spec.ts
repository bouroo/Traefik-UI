import { test, expect } from './fixtures';
import { mockAuth, mockAccessLogs } from './fixtures';

test.describe('Access Logs', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockAccessLogs(page);
  });

  test('logs page renders table with entries', async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Access Logs' })).toBeVisible();
    await expect(page.getByText('192.168.1.1')).toBeVisible();
    await expect(page.getByText('GET')).toBeVisible();
    await expect(page.getByText('/api/health')).toBeVisible();
  });

  test('filter form updates query and shows results', async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');

    const filterInput = page.getByPlaceholder(/Filter by client IP/i);
    await filterInput.fill('192.168');
    await page.getByRole('button', { name: /Filter/i }).click();

    await page.waitForTimeout(300);
    await expect(page.getByText('192.168.1.1')).toBeVisible();
  });

  test('refresh button is clickable', async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');

    const refreshButton = page.getByRole('button', { name: /Refresh/i });
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    await page.waitForTimeout(300);
    await expect(page.getByText('192.168.1.1')).toBeVisible();
  });
});
