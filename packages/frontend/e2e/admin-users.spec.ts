import { test, expect } from './fixtures';
import { mockAuth, mockAdminUsers, mockAdminRoles } from './fixtures';

test.describe('Admin — Users', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page, { permissions: ['system.users.read', 'system.users.write'] });
    await mockAdminUsers(page);
    await mockAdminRoles(page);
  });

  test('users page renders user table', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'admin' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'viewer' }).first()).toBeVisible();
  });

  test('edit user dialog opens and saves', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const editButton = page.locator('tr', { hasText: 'viewer' }).getByRole('button').first();
    await editButton.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Edit User')).toBeVisible();

    const emailInput = page.locator('input[placeholder="user@example.com"]');
    await emailInput.fill('viewer@example.com');

    await page.getByRole('button', { name: /Save Changes/i }).click();
    await page.waitForTimeout(300);

    // The table row for viewer should now show the updated email.
    const viewerRow = page.locator('tr', { hasText: 'viewer' });
    await expect(viewerRow.getByText('viewer@example.com')).toBeVisible();
  });

  test('delete user dialog opens and confirms', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const deleteButton = page.locator('tr', { hasText: 'viewer' }).getByRole('button').last();
    await deleteButton.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Delete User')).toBeVisible();

    await page.getByRole('button', { name: /Delete$/i }).click();
    await page.waitForTimeout(300);

    // The specific 'viewer' table row should be removed.
    await expect(page.locator('tr', { hasText: 'viewer' })).not.toBeVisible();
  });
});
