import { test, expect } from './fixtures';
import { mockAuth, mockAdminSsoProviders } from './fixtures';

test.describe('Admin — Identity Providers', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page, { permissions: ['system.idp.read', 'system.idp.write'] });
    await mockAdminSsoProviders(page);
  });

  test('idp page renders provider table', async ({ page }) => {
    await page.goto('/admin/idp');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Identity Providers', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Okta' }).first()).toBeVisible();
  });

  test('create provider dialog opens and submits', async ({ page }) => {
    await page.goto('/admin/idp');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Add Provider/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Create Identity Provider')).toBeVisible();

    await page.locator('input[placeholder="My Identity Provider"]').fill('Azure AD');
    await page.locator('input[placeholder="https://idp.example.com"]').fill('https://login.microsoftonline.com/common');
    await page.locator('input[placeholder="client-id-from-idp"]').fill('azure-client-id');
    await page.locator('input[type="password"]').first().fill('azure-secret');

    await page.getByRole('button', { name: /Create$/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('cell', { name: 'Azure AD' }).first()).toBeVisible();
  });

  test('edit provider dialog opens and saves', async ({ page }) => {
    await page.goto('/admin/idp');
    await page.waitForLoadState('networkidle');

    const editButton = page.locator('tr', { hasText: 'Okta' }).getByRole('button').first();
    await editButton.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Edit Identity Provider')).toBeVisible();

    const nameInput = page.locator('input[value="Okta"]');
    await nameInput.fill('Okta Updated');

    await page.getByRole('button', { name: /Save Changes/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('cell', { name: 'Okta Updated' }).first()).toBeVisible();
  });

  test('delete provider dialog opens and confirms', async ({ page }) => {
    await page.goto('/admin/idp');
    await page.waitForLoadState('networkidle');

    const deleteButton = page.locator('tr', { hasText: 'Okta' }).getByRole('button').last();
    await deleteButton.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Delete Identity Provider')).toBeVisible();

    await page.getByRole('button', { name: /Delete$/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('cell', { name: 'Okta' }).first()).not.toBeVisible();
  });
});
