import { test, expect } from './fixtures';
import { mockAuth, mockConfigFiles } from './fixtures';

test.describe('Configuration Files', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockConfigFiles(page);
  });

  test('configfile page defaults to dynamic tab', async ({ page }) => {
    await page.goto('/configfile');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Configuration', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Dynamic/i })).toHaveAttribute(
      'data-state',
      'active'
    );
  });

  test('switching to static tab shows static config', async ({ page }) => {
    await page.goto('/configfile');
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: /Static/i }).click();
    await page.waitForTimeout(200);

    await expect(page.getByRole('tab', { name: /Static/i })).toHaveAttribute(
      'data-state',
      'active'
    );
    await expect(page.locator('pre')).toContainText('entryPoints');
  });
});
