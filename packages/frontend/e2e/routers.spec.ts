import { test, expect } from './fixtures';
import { mockAuth, mockRouters, mockRouterDetail } from './fixtures';

test.describe('Routers', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockRouters(page);
  });

  test('routers page renders with HTTP tab active', async ({ page }) => {
    await page.goto('/routers');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Routers' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /HTTP/i })).toHaveAttribute('data-state', 'active');
    await expect(page.getByText('http-router-1')).toBeVisible();
  });

  test('switching to TCP tab shows TCP routers', async ({ page }) => {
    await page.goto('/routers');
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: /TCP/i }).click();
    await page.waitForTimeout(200);

    await expect(page.getByText('tcp-router-1')).toBeVisible();
  });

  test('switching to UDP tab shows UDP routers', async ({ page }) => {
    await page.goto('/routers');
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: /UDP/i }).click();
    await page.waitForTimeout(200);

    await expect(page.getByText('udp-router-1')).toBeVisible();
  });

  test('clicking a router row opens detail dialog', async ({ page }) => {
    await mockRouterDetail(page, 'http', 'http-router-1');
    await page.goto('/routers');
    await page.waitForLoadState('networkidle');

    await page.getByText('http-router-1', { exact: true }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('[role="dialog"]').getByText('api-service', { exact: true })).toBeVisible();
  });
});
