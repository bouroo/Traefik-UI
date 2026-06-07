import { test, expect } from './fixtures';
import { mockAuth, mockAdminRoles, mockAdminPermissions } from './fixtures';

test.describe('Admin — Roles', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page, { permissions: ['system.roles.read', 'system.roles.write'] });
    await mockAdminRoles(page);
    await mockAdminPermissions(page);
  });

  test('roles page renders role table', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Roles', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'super_admin' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'operator' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'viewer' }).first()).toBeVisible();
  });

  test('create role dialog opens and submits', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Add Role/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Create Role')).toBeVisible();

    const nameInput = page.locator('input[placeholder="role-name"]');
    await nameInput.fill('custom-role');

    await page.getByRole('button', { name: /Create$/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('cell', { name: 'custom-role' }).first()).toBeVisible();
  });

  test('built-in role cannot be deleted', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    const deleteButton = page.locator('tr', { hasText: 'super_admin' }).getByRole('button').last();
    await deleteButton.click();

    // Built-in role deletion is blocked before opening the dialog; verify dialog never appears.
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('cell', { name: 'super_admin' }).first()).toBeVisible();
  });

  test('delete custom role dialog opens and confirms', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    // Create a custom role first so we can delete it.
    await page.getByRole('button', { name: /Add Role/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('input[placeholder="role-name"]').fill('deletable-role');
    await page.getByRole('button', { name: /Create$/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('cell', { name: 'deletable-role' }).first()).toBeVisible();

    const deleteButton = page.locator('tr', { hasText: 'deletable-role' }).getByRole('button').last();
    await deleteButton.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Delete Role')).toBeVisible();

    await page.getByRole('button', { name: /Delete$/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('cell', { name: 'deletable-role' }).first()).not.toBeVisible();
  });
});
