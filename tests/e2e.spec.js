const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

test.describe('PROXMUX Popup (Mock Environment)', () => {
  const mockPath = pathToFileURL(
    path.resolve(__dirname, '../store/mock/mock.html')
  ).href;

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

  test('should allow typing in the search input', async ({ page }) => {
    const searchInput = page.locator('#search-input');
    await searchInput.fill('ubuntu');
    
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

    await page.emulateMedia({ colorScheme: 'light' });
    const bgColorLight = await body.evaluate(el => window.getComputedStyle(el).backgroundColor);

    // Assert both values look like rgb(...) colors and that the background actually changes
    expect(bgColor).toMatch(/^rgb/i);
    expect(bgColorLight).toMatch(/^rgb/i);
    expect(bgColorLight).not.toBe(bgColor);
  });
});
