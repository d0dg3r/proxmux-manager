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
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(10);
    
    // Verify first node has IP tag and Shell/SSH buttons
    const firstNode = items.first();
    await expect(firstNode.locator('.name')).toContainText('pve-node-01');
    await expect(firstNode.locator('.tag.ip')).toContainText('10.1.1.10');
    await expect(firstNode.locator('.action-btn.shell')).toBeVisible();
    await expect(firstNode.locator('.action-btn.ssh')).toBeVisible();

    const resourceNames = await page.locator('.resource-item .name').allTextContents();
    expect(resourceNames).toEqual(expect.arrayContaining(['pve-node-01', 'docker', 'gitea']));
  });

  test('should allow typing in the search input', async ({ page }) => {
    const searchInput = page.locator('#search-input');
    await searchInput.fill('ubuntu');
    
    await expect(searchInput).toHaveValue('ubuntu');
  });

  test('should show and use search clear button', async ({ page }) => {
    const searchInput = page.locator('#search-input');
    const clearBtn = page.locator('#search-clear-btn');

    await expect(clearBtn).toHaveClass(/hidden/);
    await searchInput.fill('git');
    await expect(clearBtn).not.toHaveClass(/hidden/);

    await clearBtn.click();
    await expect(searchInput).toHaveValue('');
    await expect(clearBtn).toHaveClass(/hidden/);
  });

  test('should reset search with Escape key', async ({ page }) => {
    const searchInput = page.locator('#search-input');
    const clearBtn = page.locator('#search-clear-btn');

    await searchInput.fill('proxmux');
    await expect(clearBtn).not.toHaveClass(/hidden/);
    await searchInput.press('Escape');

    await expect(searchInput).toHaveValue('');
    await expect(clearBtn).toHaveClass(/hidden/);
  });

  test('should have operational filter pills', async ({ page }) => {
    const pills = page.locator('.filter-pill');
    await expect(pills).toHaveCount(6); // All, Node, VM, LXC, Online, Offline
    await expect(pills.first()).toHaveClass(/active/);
  });

  test('should toggle filter panel visibility and active state', async ({ page }) => {
    const filterToggleBtn = page.locator('#filter-toggle-btn');
    const filterPanel = page.locator('#collapsible-filters');

    await expect(filterToggleBtn).toHaveClass(/active/);
    await expect(filterPanel).not.toHaveClass(/collapsed/);

    await filterToggleBtn.click();
    await expect(filterPanel).toHaveClass(/collapsed/);
    await expect(filterToggleBtn).not.toHaveClass(/active/);

    await filterToggleBtn.click();
    await expect(filterPanel).not.toHaveClass(/collapsed/);
    await expect(filterToggleBtn).toHaveClass(/active/);
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
