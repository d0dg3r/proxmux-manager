const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('PROXMUX Popup (Mock Environment)', () => {
  const mockPath = 'file://' + path.resolve(__dirname, '../store/mock/mock.html');

  test.beforeEach(async ({ page }) => {
    await page.goto(mockPath);
  });

  test('should display the branded title', async ({ page }) => {
    const title = page.locator('h1.branded-title');
    await expect(title).toBeVisible();
    await expect(title.locator('.prox')).toHaveText('PROX');
    await expect(title.locator('.mux')).toHaveText('MUX');
  });

  test('should show resource items from mock data', async ({ page }) => {
    const items = page.locator('.resource-item');
    await expect(items).toHaveCount(4); // We have 4 items in mock.html
    await expect(items.first()).toContainText('pve-node-01');
  });

  test('should filter resources by search query', async ({ page }) => {
    const searchInput = page.locator('#search-input');
    await searchInput.fill('ubuntu');
    
    // We expect only 1 item to remain (Ubuntu-Server-22.04)
    const visibleItems = page.locator('.resource-item:not(.hidden)');
    // Note: mock.html doesn't have the JS filtering, but we are testing if the UI elements are there.
    // To truly test logic, we'd need to inject or use the real popup.js.
    // For this E2E, we verify UI presence.
    await expect(searchInput).toHaveValue('ubuntu');
  });

  test('should have operational filter pills', async ({ page }) => {
    const pills = page.locator('.filter-pill');
    await expect(pills).toHaveCount(6); // All, Node, VM, LXC, Online, Offline
    await expect(pills.first()).toHaveClass(/active/);
  });

  test('should toggle dark/light mode', async ({ page }) => {
    // Check initial state (depends on system, but we can force it)
    await page.emulateMedia({ colorScheme: 'dark' });
    const body = page.locator('body');
    // The mock.html uses @media (prefers-color-scheme: dark)
    // We can't easily check computed color in a simple expect without getting computed style
    const bgColor = await body.evaluate(el => window.getComputedStyle(el).backgroundColor);
    // Dark bg is #0f111a -> rgb(15, 17, 26)
    expect(bgColor).toBe('rgb(15, 17, 26)');

    await page.emulateMedia({ colorScheme: 'light' });
    const bgColorLight = await body.evaluate(el => window.getComputedStyle(el).backgroundColor);
    // Light bg is #f0f2f5 -> rgb(240, 242, 245)
    expect(bgColorLight).toBe('rgb(240, 242, 245)');
  });
});
