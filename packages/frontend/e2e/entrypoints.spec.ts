import { test, expect } from './fixtures';
import { mockAuth, mockEntrypoints } from './fixtures';

test.describe('Entrypoints', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockEntrypoints(page);
  });

  test('entrypoints page renders cards', async ({ page }) => {
    await page.goto('/entrypoints');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Entrypoints', exact: true })).toBeVisible();
    await expect(page.getByText('web', { exact: true })).toBeVisible();
    await expect(page.getByText('websecure')).toBeVisible();
    await expect(page.getByText(':80')).toBeVisible();
    await expect(page.getByText(':443')).toBeVisible();
  });

  test('entrypoint card shows HTTP/3 badge when configured', async ({ page }) => {
    await page.goto('/entrypoints');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Port 443')).toBeVisible();
  });
});
