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
    await expect(page.locator('.resource-item .name').first()).toContainText('pve-node-01');
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

  test('should filter community scripts list', async ({ page }) => {
    const search = page.locator('#scripts-search-input');
    const rows = page.locator('#scripts-list .script-row');

    await expect(rows).toHaveCount(6);
    await search.fill('ubuntu');

    await expect(rows.nth(0)).toHaveClass(/hidden/);
    await expect(rows.nth(1)).not.toHaveClass(/hidden/);
    await expect(rows.nth(2)).toHaveClass(/hidden/);
    await expect(rows.nth(3)).toHaveClass(/hidden/);
    await expect(rows.nth(4)).toHaveClass(/hidden/);
    await expect(rows.nth(5)).toHaveClass(/hidden/);
  });

  test('should show script type badges and filter by type', async ({ page }) => {
    const badges = page.locator('#scripts-list .script-type-badge');
    const alpineFilter = page.locator('.scripts-type-pill[data-script-type="alpine"]');
    await expect(badges).toHaveCount(3);
    await expect(badges.nth(0)).toHaveText('CT');
    await expect(badges.nth(1)).toHaveText('VM');
    await expect(badges.nth(2)).toHaveText('CT');

    await expect(page.locator('.scripts-type-pill[data-script-type="other"]')).toHaveCount(0);
    await expect(page.locator('.scripts-type-pill[data-script-type="tools"]')).toHaveCount(0);
    await expect(alpineFilter).toHaveCount(1);

    const vmFilter = page.locator('.scripts-type-pill[data-script-type="vm"]');
    const rows = page.locator('#scripts-list .script-row');
    await vmFilter.click();

    await expect(rows.nth(0)).toHaveClass(/hidden/);
    await expect(rows.nth(1)).not.toHaveClass(/hidden/);
    await expect(rows.nth(2)).toHaveClass(/hidden/);
    await expect(rows.nth(3)).toHaveClass(/hidden/);
    await expect(rows.nth(4)).toHaveClass(/hidden/);
    await expect(rows.nth(5)).toHaveClass(/hidden/);

    await alpineFilter.click();
    await expect(rows.nth(0)).toHaveClass(/hidden/);
    await expect(rows.nth(1)).toHaveClass(/hidden/);
    await expect(rows.nth(2)).not.toHaveClass(/hidden/);
    await expect(rows.nth(3)).toHaveClass(/hidden/);
    await expect(rows.nth(4)).toHaveClass(/hidden/);
    await expect(rows.nth(5)).toHaveClass(/hidden/);
  });

  test('should show Alpine-LXC and only whitelisted tools groups', async ({ page }) => {
    const headers = page.locator('#scripts-list .scripts-group-header');
    await expect(headers).toHaveCount(4);
    await expect(headers.nth(0)).toHaveText('Alpine-LXC');
    await expect(headers.nth(1)).toHaveText('TOOLS / ADDON');
    await expect(headers.nth(2)).toHaveText('TOOLS / PVE');
    await expect(headers.nth(3)).toHaveText('TOOLS / COPY-DATA');
    await expect(page.locator('#scripts-list .scripts-group-header', { hasText: 'TOOLS / MEDIA' })).toHaveCount(0);
  });

  test('should render script rows with title only', async ({ page }) => {
    const metaRows = page.locator('#scripts-list .script-meta');
    await expect(metaRows).toHaveCount(0);
  });

  test('should open script guide modal from list row', async ({ page }) => {
    const guideButton = page.locator('.script-guide-btn').first();
    const guideModal = page.locator('#scripts-guide-modal');
    const guideBody = page.locator('#scripts-guide-body');

    await guideButton.click();
    await expect(guideModal).not.toHaveClass(/hidden/);
    await expect(guideBody).toContainText('About');
    await expect(guideBody).toContainText('Install');
    await expect(guideBody).toContainText('Details');
    await expect(guideBody).toContainText('Install Methods');
    await expect(guideBody).toContainText('Version');
    await expect(guideBody).toContainText('default');

    await page.locator('#scripts-guide-close').click();
    await expect(guideModal).toHaveClass(/hidden/);
  });

  test('should keep selection feedback hidden and show install feedback', async ({ page }) => {
    const firstCheckbox = page.locator('.mock-script-checkbox').first();
    const secondCheckbox = page.locator('.mock-script-checkbox').nth(1);
    const feedback = page.locator('#scripts-feedback');
    const installBtn = page.locator('#scripts-install-btn');

    await firstCheckbox.check();
    await expect(feedback).toHaveText('');
    await expect(firstCheckbox).toBeChecked();

    await secondCheckbox.check();
    await expect(firstCheckbox).not.toBeChecked();
    await expect(secondCheckbox).toBeChecked();
    await expect(feedback).toHaveText('');

    await installBtn.click();
    await expect(feedback).toContainText('Commands copied. Opening shell...');
  });

  test('should clear scripts search with clear button', async ({ page }) => {
    const searchInput = page.locator('#scripts-search-input');
    const clearBtn = page.locator('#scripts-search-clear-btn');
    const rows = page.locator('#scripts-list .script-row');

    await expect(clearBtn).toHaveClass(/hidden/);
    await searchInput.fill('ubuntu');
    await expect(clearBtn).not.toHaveClass(/hidden/);
    await expect(rows.nth(1)).not.toHaveClass(/hidden/);

    await clearBtn.click();
    await expect(searchInput).toHaveValue('');
    await expect(clearBtn).toHaveClass(/hidden/);
    await expect(rows.nth(0)).not.toHaveClass(/hidden/);
    await expect(rows.nth(1)).not.toHaveClass(/hidden/);
  });

  test('should keep scripts clear button positioned inside input', async ({ page }) => {
    const searchInput = page.locator('#scripts-search-input');
    const clearBtn = page.locator('#scripts-search-clear-btn');

    await searchInput.fill('alp');
    await expect(clearBtn).not.toHaveClass(/hidden/);

    const inputBox = await searchInput.boundingBox();
    const clearBox = await clearBtn.boundingBox();
    expect(inputBox).toBeTruthy();
    expect(clearBox).toBeTruthy();
    expect(clearBox.y).toBeGreaterThanOrEqual(inputBox.y);
    expect(clearBox.y + clearBox.height).toBeLessThanOrEqual(inputBox.y + inputBox.height);
  });
});
