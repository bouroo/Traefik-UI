import { test, expect } from './fixtures';
import { mockAuth, mockTlsCertificates } from './fixtures';

test.describe('TLS Certificates', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockTlsCertificates(page);
  });

  test('TLS page renders certificate table', async ({ page }) => {
    await page.goto('/tls');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: 'TLS Certificates', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'example.com', exact: true }).first()
    ).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Valid' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Expired' }).first()).toBeVisible();
  });

  test('expired certificate shows destructive badge', async ({ page }) => {
    await page.goto('/tls');
    await page.waitForLoadState('networkidle');

    const expiredRow = page.locator('tr', { hasText: 'expired.example.com' });
    await expect(expiredRow.getByRole('cell', { name: 'Expired' }).first()).toBeVisible();
  });
});
