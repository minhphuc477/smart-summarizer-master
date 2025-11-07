import { test, expect } from '@playwright/test';

// Simplified smoke tests covering UI presence and basic interactions
// Note: Requires a production build and 'npm run start:ci' to be running.

test.describe('Canvas Editor - basic UX', () => {
  test('Theme toggle and add nodes updates counts', async ({ page }) => {
    await page.goto('/canvas');

    // Open Theme menu and pick Mind Map
    await page.getByRole('button', { name: /^theme$/i }).click();
    await page.getByRole('menuitem', { name: /mind map/i }).click();

    // Add two nodes
    await page.getByRole('button', { name: /add node/i }).click();
    await page.getByRole('menuitem', { name: /sticky note/i }).click();

    await page.getByRole('button', { name: /add node/i }).click();
    await page.getByRole('menuitem', { name: /image/i }).click();

    await expect(page.getByText(/2 nodes/i)).toBeVisible();
  });

  test('Context menu exposes group/ungroup actions', async ({ page }) => {
    await page.goto('/canvas');

    // Right-click anywhere on canvas to open context menu
    const canvas = page.locator('.react-flow');
    await canvas.click({ button: 'right' });

    await expect(page.getByRole('menuitem', { name: 'Group Selection', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Ungroup Selection', exact: true })).toBeVisible();
  });

  test('Edge style menu items are available', async ({ page }) => {
    await page.goto('/canvas');

    // Open Theme menu
    await page.getByRole('button', { name: /theme/i }).click();
    
    // Check edge style items are present
    await expect(page.getByRole('menuitem', { name: /straight/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /step/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /smooth/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /animation/i })).toBeVisible();
  });

  test('Command palette opens and shows canvas commands', async ({ page }) => {
    await page.goto('/canvas');

    // Trigger command palette with Ctrl+K
    await page.keyboard.press('Control+k');

    // Command palette dialog should be visible
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByPlaceholder(/type a command/i)).toBeVisible();
  });

  test('Code snippet node can be added', async ({ page }) => {
    await page.goto('/canvas');

    // Add Code Snippet node
    await page.getByRole('button', { name: /add node/i }).click();
    await page.getByRole('menuitem', { name: /code snippet/i }).click();

    // Should see 1 node
    await expect(page.getByText(/1 nodes/i)).toBeVisible();
  });
});
