const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

test.describe('PROXMUX Options Page (Mock Environment)', () => {
  const optionsPath = pathToFileURL(
    path.resolve(__dirname, '../options/options.html')
  ).href;

  test.beforeEach(async ({ page }) => {
    // Mock chrome.i18n.getMessage for translations in the options page
    await page.addInitScript(() => {
      window.chrome = {
        runtime: {
          getURL: (path) => path,
        },
        i18n: {
          getMessage: (key) => {
            const messages = {
              'settings': 'Settings',
              'tabManagement': 'Tab Management',
              'tabMode': 'Console Tab Behavior',
              'tabMultiple': 'Open new tab every time',
              'tabSingle': 'Reuse one single console tab',
              'tabDuplicate': 'Focus same machine if already open',
              'tabModeHelp': 'Choose how browser tabs are managed when opening consoles.'
            };
            return messages[key] || key;
          }
        },
        storage: {
          local: {
            get: (keys) => Promise.resolve({}),
            set: (data) => Promise.resolve()
          }
        }
      };
      
      // Prevent actual initialization that might depend on more chrome APIs
      window.chrome.i18n.getUILanguage = () => 'en';
    });

    await page.goto(optionsPath);
  });

  test('should display settings title', async ({ page }) => {
    const title = page.locator('h1.branded-title');
    await expect(title).toContainText('PROXMUX');
    await expect(title).toContainText('Settings');
  });

  test('should show tab management section', async ({ page }) => {
    const tabSection = page.locator('h3:has-text("Tab Management")');
    // Note: This might fail if the i18n isn't processed correctly by the mock
    // Let's check for the ID instead if preferred, but usually data-i18n is used
    await expect(tabSection).toBeVisible();
  });

  test('should have tab mode select with correct options', async ({ page }) => {
    const select = page.locator('#tab-mode-select');
    await expect(select).toBeVisible();
    
    const options = await select.locator('option').allTextContents();
    // These should match the i18n values or the defaults in HTML
    expect(options).toContain('Open new tab every time');
    expect(options).toContain('Reuse one single console tab');
    expect(options).toContain('Focus same machine if already open');
  });

  test('should have duplicate focus as default selected option', async ({ page }) => {
    const select = page.locator('#tab-mode-select');
    await expect(select).toHaveValue('duplicate');
  });
});
