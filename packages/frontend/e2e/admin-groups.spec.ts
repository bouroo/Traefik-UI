import { test, expect } from './fixtures';
import { mockAuth, mockAdminGroups, mockAdminRoles } from './fixtures';

test.describe('Admin — Groups', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page, { permissions: ['system.users.read', 'system.users.write'] });
    await mockAdminGroups(page);
    await mockAdminRoles(page);
  });

  test('groups page renders group table', async ({ page }) => {
    await page.goto('/admin/groups');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Groups', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Admins' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Viewers' }).first()).toBeVisible();
  });

  test('create group dialog opens and submits', async ({ page }) => {
    await page.goto('/admin/groups');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Add Group/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Create Group')).toBeVisible();

    const nameInput = page.locator('input[placeholder="Group name"]');
    await nameInput.fill('Operators');

    await page.getByRole('button', { name: /Create$/i }).click();
    await page.waitForTimeout(300);

    await expect(page.getByRole('cell', { name: 'Operators' }).first()).toBeVisible();
  });

  test('edit group dialog opens and saves', async ({ page }) => {
    await page.goto('/admin/groups');
    await page.waitForLoadState('networkidle');

    const editButton = page.locator('tr', { hasText: 'Viewers' }).getByRole('button').first();
    await editButton.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Edit Group')).toBeVisible();

    const nameInput = page.locator('input[placeholder="Group name"]');
    await nameInput.fill('Viewers Updated');

    await page.getByRole('button', { name: /Save Changes/i }).click();
    await page.waitForTimeout(300);

    await expect(page.getByRole('cell', { name: 'Viewers Updated' }).first()).toBeVisible();
  });

  test('delete group dialog opens and confirms', async ({ page }) => {
    await page.goto('/admin/groups');
    await page.waitForLoadState('networkidle');

    const deleteButton = page.locator('tr', { hasText: 'Viewers' }).getByRole('button').last();
    await deleteButton.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Delete Group')).toBeVisible();

    await page.getByRole('button', { name: /Delete$/i }).click();
    await page.waitForTimeout(300);

    await expect(page.getByRole('cell', { name: 'Viewers' }).first()).not.toBeVisible();
  });
});
