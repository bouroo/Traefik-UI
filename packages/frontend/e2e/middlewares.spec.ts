import { test, expect } from './fixtures';
import { mockAuth, mockMiddlewares, mockMiddlewareDetail } from './fixtures';

test.describe('Middlewares', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockMiddlewares(page);
  });

  test('middlewares page renders HTTP cards', async ({ page }) => {
    await page.goto('/middlewares');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Middlewares' })).toBeVisible();
    await expect(page.getByText('strip-prefix')).toBeVisible();
    await expect(page.getByText('rate-limit')).toBeVisible();
  });

  test('switching to TCP tab shows TCP middlewares', async ({ page }) => {
    await page.goto('/middlewares');
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: /TCP/i }).click();
    await page.waitForTimeout(200);

    await expect(page.getByText('in-flight')).toBeVisible();
  });

  test('clicking a middleware card opens detail dialog', async ({ page }) => {
    await mockMiddlewareDetail(page, 'http', 'strip-prefix');
    await page.goto('/middlewares');
    await page.waitForLoadState('networkidle');

    await page.getByText('strip-prefix', { exact: true }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('dialog')).toBeVisible();
    // The dialog heading contains the middleware name; verify that rather than badge text.
    await expect(page.getByRole('heading', { name: 'strip-prefix' })).toBeVisible();
  });
});
