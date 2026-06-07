import { test, expect } from './fixtures';
import { mockAuth, mockServices, mockServiceDetail } from './fixtures';

test.describe('Services', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockServices(page);
  });

  test('services page renders with HTTP tab active', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Services' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /HTTP/i })).toHaveAttribute('data-state', 'active');
    await expect(page.getByText('api-service')).toBeVisible();
  });

  test('switching to TCP tab shows TCP services', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: /TCP/i }).click();
    await page.waitForTimeout(200);

    await expect(page.getByText('tcp-service')).toBeVisible();
  });

  test('switching to UDP tab shows UDP services', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: /UDP/i }).click();
    await page.waitForTimeout(200);

    await expect(page.getByText('udp-service')).toBeVisible();
  });

  test('clicking a service row opens detail dialog', async ({ page }) => {
    await mockServiceDetail(page, 'http', 'api-service');
    await page.goto('/services');
    await page.waitForLoadState('networkidle');

    await page.getByText('api-service', { exact: true }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.locator('[role="dialog"]').getByText('loadBalancer', { exact: true })
    ).toBeVisible();
  });
});
