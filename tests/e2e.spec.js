const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { pathToFileURL } = require('url');

test.describe('PROXMUX Popup (Mock Environment)', () => {
  let staticServer;
  let staticBaseUrl;
  const mockPath = pathToFileURL(
    path.resolve(__dirname, '../store/mock/mock.html')
  ).href;
  const installCommandFilePath = path.resolve(__dirname, '../lib/install-command.js');
  const manifestFilePath = path.resolve(__dirname, '../manifest.json');
  const projectRoot = path.resolve(__dirname, '..');

  test.beforeAll(async () => {
    staticServer = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
      let filePath = path.resolve(projectRoot, `.${safePath}`);
      if (!filePath.startsWith(projectRoot)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const mime = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
      }[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': mime });
      res.end(fs.readFileSync(filePath));
    });

    await new Promise((resolve) => {
      staticServer.listen(0, '127.0.0.1', () => resolve());
    });
    staticBaseUrl = `http://127.0.0.1:${staticServer.address().port}`;
  });

  test.afterAll(async () => {
    if (!staticServer) return;
    await new Promise((resolve) => staticServer.close(() => resolve()));
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(mockPath);
  });

  test('should display the branded title', async ({ page }) => {
    const title = page.locator('h1.branded-title');
    await expect(title).toBeVisible();
    await expect(title.locator('.prox')).toHaveText('PROX');
    await expect(title.locator('.mux')).toHaveText('MUX');
  });

  test('buildInstallCommandForScripts should use no title header and double-quoted bash -c', async () => {
    const installCommandSource = fs.readFileSync(installCommandFilePath, 'utf8');
    expect(installCommandSource).not.toContain('`# ${title}\\n${buildInstallCommandForScript(script)}`');
    expect(installCommandSource).not.toContain("bash -c '$(curl -fsSL");
    expect(installCommandSource).toContain('bash -c "$(curl -fsSL');
  });

  test('auto paste logic should use fast best-effort flow and fallback', async () => {
    const manifestSource = fs.readFileSync(manifestFilePath, 'utf8');
    const popupSource = fs.readFileSync(path.resolve(__dirname, '../popup/popup.js'), 'utf8');
    expect(manifestSource).not.toContain('"debugger"');
    expect(popupSource).not.toContain('chrome.debugger.attach');
    expect(popupSource).not.toContain('Input.dispatchKeyEvent');
    expect(popupSource).not.toContain('Input.insertText');
    expect(popupSource).toContain('activePasteFlows');
    expect(popupSource).toContain('AUTO_PASTE_TIMEOUT_MS = 1500');
    expect(popupSource).toContain('NEW_TAB_SETTLE_DELAY_MS = 250');
    expect(popupSource).toContain('timeout_or_no_effect');
    expect(popupSource).toContain('performBestEffortPaste');
    expect(popupSource).toContain('scriptsCopiedPasteFallback');
    expect(popupSource).toContain('waitForTerminalReady');
    expect(popupSource).toContain('Date.now() < deadlineMs');
    expect(popupSource).not.toContain('for (let attempt = 0; attempt < 8; attempt++)');
    expect(popupSource).toContain('consoleOpenResult.wasNewTab');
    expect(popupSource).toContain('if (!wasNewTab && payload.wroteIntoInput)');
    expect(popupSource).toContain("method: 'best_effort_existing_tab_input_injected'");
    expect(popupSource).toContain('if (wasNewTab) {');
    expect(popupSource).toContain('waitForTabComplete(tabId, tabReadyTimeout)');
  });

  test('should keep cluster tabs hidden while settings view is active', async () => {
    const popupSource = fs.readFileSync(path.resolve(__dirname, '../popup/popup.js'), 'utf8');
    const popupHtmlSource = fs.readFileSync(path.resolve(__dirname, '../popup/popup.html'), 'utf8');
    const popupCssSource = fs.readFileSync(path.resolve(__dirname, '../popup/popup.css'), 'utf8');
    const optionsSource = fs.readFileSync(path.resolve(__dirname, '../options/options.js'), 'utf8');

    expect(popupSource).toContain('function updateClusterTabsVisibility()');
    expect(popupSource).toContain("const isSettingsActive = document.body.classList.contains('settings-view-active');");
    expect(popupSource).toContain('const hasConfigured = hasConfiguredCluster();');
    expect(popupSource).toContain("clusterTabs.classList.toggle('hidden', !hasClusters || !hasConfigured || isSettingsActive);");
    expect(popupSource).toContain('setInlineViewMode(true);');
    expect(popupSource).toContain('setInlineViewMode(false);');
    expect(popupHtmlSource).toContain('id="open-token-help-overlay"');
    expect(popupHtmlSource).toContain('id="inline-no-config-quickstart"');
    expect(popupSource).toContain("openInlineSettingsView('overlay_token_help_button', { targetSubtab: 'help', onboardingNoConfigHelp: true });");
    expect(popupCssSource).toContain('body.settings-view-active #cluster-tabs');
    expect(popupCssSource).toContain('flex-wrap: wrap;');
    expect(popupCssSource).toContain('overflow: visible;');
    expect(optionsSource).toContain('async function runImportSettings()');
    expect(optionsSource).toContain("importPasswordInput?.addEventListener('keydown'");
    expect(optionsSource).toContain("if (event.key !== 'Enter') return;");
    expect(optionsSource).toContain('let isImportingSettings = false;');
    expect(popupSource).toContain('async function runInlineImportSettings()');
    expect(popupSource).toContain("inlineImportPasswordInput?.addEventListener('keydown'");
    expect(popupSource).toContain('let isInlineImportingSettings = false;');
  });

  test('should hide cluster tabs when settings opens and show again on close', async ({ page }) => {
    await page.addInitScript(() => {
      const storage = {
        theme: 'dark',
        displaySettings: { uptime: true, ip: true, os: true, vmid: true, tags: true },
        scriptsPanelCollapsed: true,
        activeClusterTabId: '__all__',
        activeClusterId: 'production',
        clusters: {
          production: {
            id: 'production',
            name: 'Production',
            proxmoxUrl: 'https://pve-prod-01.lan:8006',
            apiUser: 'api-admin@pve',
            apiTokenId: 'full-access',
            apiSecret: 'prod-secret',
            apiToken: 'api-admin@pve!full-access=prod-secret',
            failoverUrls: [],
            isEnabled: true
          },
          staging: {
            id: 'staging',
            name: 'Staging',
            proxmoxUrl: 'https://pve-staging-01.lan:8006',
            apiUser: 'api-admin@pve',
            apiTokenId: 'full-access',
            apiSecret: 'staging-secret',
            apiToken: 'api-admin@pve!full-access=staging-secret',
            failoverUrls: [],
            isEnabled: true
          }
        },
        communityScriptsCatalogCacheV1: {
          source: 'fixture',
          updatedAt: Date.now(),
          schemaVersion: 2,
          scripts: []
        }
      };

      const resolveGet = (keys) => {
        if (!keys) return { ...storage };
        if (Array.isArray(keys)) return keys.reduce((acc, key) => ({ ...acc, [key]: storage[key] }), {});
        if (typeof keys === 'string') return { [keys]: storage[keys] };
        return Object.keys(keys).reduce((acc, key) => ({ ...acc, [key]: storage[key] ?? keys[key] }), {});
      };

      const chromeMock = {
        runtime: { lastError: null, getURL: (relative = '') => `${window.location.origin}/${relative.replace(/^\/+/, '')}` },
        i18n: { getMessage: () => '' },
        storage: {
          local: {
            get: async (keys) => resolveGet(keys),
            set: async (values) => Object.assign(storage, values || {}),
            remove: async (keys) => {
              const list = Array.isArray(keys) ? keys : [keys];
              list.forEach((key) => delete storage[key]);
            }
          }
        },
        permissions: {
          contains: (_permissions, cb) => cb(true),
          request: (_permissions, cb) => cb(true)
        },
        windows: {
          getCurrent: async () => ({ id: 1, type: 'normal' }),
          get: async (id) => ({ id, type: 'normal', tabs: [] }),
          update: async (id, info) => ({ id, ...info }),
          create: async () => ({ id: 2, type: 'popup' })
        },
        sidePanel: { open: async () => {} },
        tabs: {
          create: async () => ({ id: 10 }),
          update: async () => ({ id: 10 }),
          query: async () => [],
          get: async () => ({ id: 10, status: 'complete' }),
          onUpdated: { addListener: () => {}, removeListener: () => {} }
        },
        scripting: { executeScript: async () => [{ result: true }] },
        downloads: {
          download: (_options, cb) => cb?.(1),
          open: async () => {},
          onChanged: { addListener: () => {}, removeListener: () => {} }
        },
        cookies: { get: async () => null }
      };

      const realFetch = window.fetch.bind(window);
      window.fetch = async (input, init = {}) => {
        const requestUrl = typeof input === 'string' ? input : input?.url;
        if (!requestUrl) return realFetch(input, init);
        if (requestUrl.includes('/api2/json/cluster/resources')) {
          return new Response(JSON.stringify({
            data: [
              { type: 'node', node: 'pve-prod-01', status: 'online', cpu: 0.12, mem: 1, maxmem: 2, disk: 1, maxdisk: 2 },
              { type: 'qemu', vmid: 201, name: 'prod-web-01', node: 'pve-prod-01', status: 'running', cpu: 0.2, mem: 1, maxmem: 2, disk: 1, maxdisk: 2 }
            ]
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (requestUrl.includes('/api2/json/')) {
          return new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (requestUrl.includes('api.github.com/repos/community-scripts/ProxmoxVE/git/trees/main')) {
          return new Response(JSON.stringify({ tree: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return realFetch(input, init);
      };

      window.chrome = chromeMock;
      globalThis.chrome = chromeMock;
    });

    await page.goto(`${staticBaseUrl}/popup/popup.html`);
    await expect(page.locator('#cluster-tabs')).toBeVisible();

    await page.click('#display-settings-btn');
    await expect(page.locator('body')).toHaveClass(/settings-view-active/);
    await expect(page.locator('#cluster-tabs')).toBeHidden();
    await expect(page.locator('.inline-settings-actions')).toBeVisible();

    await page.click('[data-inline-settings-subtab="backup"]');
    await expect(page.locator('.inline-settings-actions')).toBeHidden();

    await page.click('[data-inline-settings-subtab="help"]');
    await expect(page.locator('.inline-settings-actions')).toBeHidden();

    await page.click('[data-inline-settings-subtab="about"]');
    await expect(page.locator('.inline-settings-actions')).toBeHidden();
    await expect(page.locator('#inline-about-legacy-wrap')).toBeVisible();

    await page.click('[data-inline-settings-subtab="cluster"]');
    await expect(page.locator('.inline-settings-actions')).toBeVisible();

    await page.click('#display-settings-btn');
    await expect(page.locator('body')).not.toHaveClass(/settings-view-active/);
    await expect(page.locator('#cluster-tabs')).toBeVisible();
  });

  test('should expand production VM row and show details drawer', async ({ page }) => {
    await page.addInitScript(() => {
      const storage = {
        theme: 'dark',
        displaySettings: { uptime: true, ip: true, os: true, vmid: true, tags: true },
        scriptsPanelCollapsed: true,
        activeClusterTabId: '__all__',
        activeClusterId: 'production',
        clusters: {
          production: {
            id: 'production',
            name: 'Production',
            proxmoxUrl: 'https://pve-prod-01.lan:8006',
            apiUser: 'api-admin@pve',
            apiTokenId: 'full-access',
            apiSecret: 'prod-secret',
            apiToken: 'api-admin@pve!full-access=prod-secret',
            failoverUrls: [],
            isEnabled: true
          }
        },
        communityScriptsCatalogCacheV1: {
          source: 'fixture',
          updatedAt: Date.now(),
          schemaVersion: 2,
          scripts: []
        }
      };

      const resolveGet = (keys) => {
        if (!keys) return { ...storage };
        if (Array.isArray(keys)) return keys.reduce((acc, key) => ({ ...acc, [key]: storage[key] }), {});
        if (typeof keys === 'string') return { [keys]: storage[keys] };
        return Object.keys(keys).reduce((acc, key) => ({ ...acc, [key]: storage[key] ?? keys[key] }), {});
      };

      const chromeMock = {
        runtime: { lastError: null, getURL: (relative = '') => `${window.location.origin}/${relative.replace(/^\/+/, '')}` },
        i18n: { getMessage: () => '' },
        storage: {
          local: {
            get: async (keys) => resolveGet(keys),
            set: async (values) => Object.assign(storage, values || {}),
            remove: async (keys) => {
              const list = Array.isArray(keys) ? keys : [keys];
              list.forEach((key) => delete storage[key]);
            }
          }
        },
        permissions: {
          contains: (_permissions, cb) => cb(true),
          request: (_permissions, cb) => cb(true)
        },
        windows: {
          getCurrent: async () => ({ id: 1, type: 'normal' }),
          get: async (id) => ({ id, type: 'normal', tabs: [] }),
          update: async (id, info) => ({ id, ...info }),
          create: async () => ({ id: 2, type: 'popup' })
        },
        sidePanel: { open: async () => {} },
        tabs: {
          create: async () => ({ id: 10 }),
          update: async () => ({ id: 10 }),
          query: async () => [],
          get: async () => ({ id: 10, status: 'complete' }),
          onUpdated: { addListener: () => {}, removeListener: () => {} }
        },
        scripting: { executeScript: async () => [{ result: true }] },
        downloads: {
          download: (_options, cb) => cb?.(1),
          open: async () => {},
          onChanged: { addListener: () => {}, removeListener: () => {} }
        },
        cookies: { get: async () => null }
      };

      const realFetch = window.fetch.bind(window);
      window.fetch = async (input, init = {}) => {
        const requestUrl = typeof input === 'string' ? input : input?.url;
        if (!requestUrl) return realFetch(input, init);
        if (requestUrl.includes('/api2/json/cluster/resources')) {
          return new Response(JSON.stringify({
            data: [
              { type: 'node', node: 'pve-prod-01', status: 'online', cpu: 0.12, mem: 1, maxmem: 2, disk: 1, maxdisk: 2 },
              {
                type: 'qemu',
                vmid: 201,
                name: 'prod-web-01',
                node: 'pve-prod-01',
                status: 'running',
                uptime: 842100,
                cpu: 0.2,
                mem: 1,
                maxmem: 2,
                disk: 1,
                maxdisk: 2
              }
            ]
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (requestUrl.includes('/api2/json/')) {
          return new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (requestUrl.includes('api.github.com/repos/community-scripts/ProxmoxVE/git/trees/main')) {
          return new Response(JSON.stringify({ tree: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return realFetch(input, init);
      };

      window.chrome = chromeMock;
      globalThis.chrome = chromeMock;
    });

    await page.goto(`${staticBaseUrl}/popup/popup.html`);

    const targetItem = page.locator('[data-id="vm-production-201"]');
    const targetMain = targetItem.locator('.item-main');
    const detailsDrawer = targetItem.locator('.details-drawer');

    await expect(targetMain).toBeVisible();
    await targetMain.click();
    await expect(targetItem).toHaveClass(/expanded/);
    await expect(detailsDrawer).toBeVisible();
    const drawerHeight = await detailsDrawer.evaluate((el) => el.getBoundingClientRect().height);
    expect(drawerHeight).toBeGreaterThan(24);
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
    await expect(feedback).toContainText('Commands copied and auto-pasted into shell.');
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

  test('should include favorites in backup keys and stale-filter helper', async () => {
    const backupSource = fs.readFileSync(path.resolve(__dirname, '../lib/settings-backup.js'), 'utf8');
    expect(backupSource).toContain("'favoriteResourceIds'");
    expect(backupSource).toContain('filterFavoriteIdsByExistingResources');
    expect(backupSource).toContain('normalizeFavoriteResourceIds');
  });

  test('should render Favorites tab before cluster tabs', async ({ page }) => {
    await page.addInitScript(() => {
      const storage = {
        theme: 'dark',
        displaySettings: { uptime: true, ip: true, os: true, vmid: true, tags: true },
        scriptsPanelCollapsed: true,
        activeClusterTabId: '__favorites__',
        activeClusterId: 'production',
        clusters: {
          production: {
            id: 'production',
            name: 'Production',
            proxmoxUrl: 'https://pve-prod-01.lan:8006',
            apiUser: 'api-admin@pve',
            apiTokenId: 'full-access',
            apiSecret: 'prod-secret',
            apiToken: 'api-admin@pve!full-access=prod-secret',
            failoverUrls: [],
            isEnabled: true
          },
          staging: {
            id: 'staging',
            name: 'Staging',
            proxmoxUrl: 'https://pve-staging-01.lan:8006',
            apiUser: 'api-admin@pve',
            apiTokenId: 'full-access',
            apiSecret: 'staging-secret',
            apiToken: 'api-admin@pve!full-access=staging-secret',
            failoverUrls: [],
            isEnabled: true
          }
        },
        communityScriptsCatalogCacheV1: {
          source: 'fixture',
          updatedAt: Date.now(),
          schemaVersion: 2,
          scripts: []
        }
      };

      const resolveGet = (keys) => {
        if (!keys) return { ...storage };
        if (Array.isArray(keys)) return keys.reduce((acc, key) => ({ ...acc, [key]: storage[key] }), {});
        if (typeof keys === 'string') return { [keys]: storage[keys] };
        return Object.keys(keys).reduce((acc, key) => ({ ...acc, [key]: storage[key] ?? keys[key] }), {});
      };

      const chromeMock = {
        runtime: { lastError: null, getURL: (relative = '') => `${window.location.origin}/${relative.replace(/^\/+/, '')}` },
        i18n: { getMessage: () => '' },
        storage: {
          local: {
            get: async (keys) => resolveGet(keys),
            set: async (values) => Object.assign(storage, values || {}),
            remove: async (keys) => {
              const list = Array.isArray(keys) ? keys : [keys];
              list.forEach((key) => delete storage[key]);
            }
          }
        },
        permissions: {
          contains: (_permissions, cb) => cb(true),
          request: (_permissions, cb) => cb(true)
        },
        windows: {
          getCurrent: async () => ({ id: 1, type: 'normal' }),
          get: async (id) => ({ id, type: 'normal', tabs: [] }),
          update: async (id, info) => ({ id, ...info }),
          create: async () => ({ id: 2, type: 'popup' })
        },
        sidePanel: { open: async () => {} },
        tabs: {
          create: async () => ({ id: 10 }),
          update: async () => ({ id: 10 }),
          query: async () => [],
          get: async () => ({ id: 10, status: 'complete' }),
          onUpdated: { addListener: () => {}, removeListener: () => {} }
        },
        scripting: { executeScript: async () => [{ result: true }] },
        downloads: {
          download: (_options, cb) => cb?.(1),
          open: async () => {},
          onChanged: { addListener: () => {}, removeListener: () => {} }
        },
        cookies: { get: async () => null }
      };

      const realFetch = window.fetch.bind(window);
      window.fetch = async (input, init = {}) => {
        const requestUrl = typeof input === 'string' ? input : input?.url;
        if (!requestUrl) return realFetch(input, init);
        if (requestUrl.includes('/api2/json/cluster/resources')) {
          return new Response(JSON.stringify({
            data: [
              { type: 'qemu', vmid: 201, name: 'prod-web-01', node: 'pve-prod-01', status: 'running', cpu: 0.2, mem: 1, maxmem: 2, disk: 1, maxdisk: 2 }
            ]
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (requestUrl.includes('/api2/json/')) {
          return new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (requestUrl.includes('api.github.com/repos/community-scripts/ProxmoxVE/git/trees/main')) {
          return new Response(JSON.stringify({ tree: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return realFetch(input, init);
      };

      window.chrome = chromeMock;
      globalThis.chrome = chromeMock;
    });

    await page.goto(`${staticBaseUrl}/popup/popup.html`);
    const tabLabels = await page.locator('#cluster-tabs .cluster-tab span:last-child').allTextContents();
    expect(tabLabels.slice(0, 3)).toEqual(['Favorites', 'All Clusters', 'Production']);
  });

  test('should allow favoriting and show item in Favorites tab', async ({ page }) => {
    await page.addInitScript(() => {
      const storage = {
        theme: 'dark',
        displaySettings: { uptime: true, ip: true, os: true, vmid: true, tags: true },
        scriptsPanelCollapsed: true,
        activeClusterTabId: '__all__',
        activeClusterId: 'production',
        favoriteResourceIds: [],
        clusters: {
          production: {
            id: 'production',
            name: 'Production',
            proxmoxUrl: 'https://pve-prod-01.lan:8006',
            apiUser: 'api-admin@pve',
            apiTokenId: 'full-access',
            apiSecret: 'prod-secret',
            apiToken: 'api-admin@pve!full-access=prod-secret',
            failoverUrls: [],
            isEnabled: true
          }
        },
        communityScriptsCatalogCacheV1: {
          source: 'fixture',
          updatedAt: Date.now(),
          schemaVersion: 2,
          scripts: []
        }
      };

      const resolveGet = (keys) => {
        if (!keys) return { ...storage };
        if (Array.isArray(keys)) return keys.reduce((acc, key) => ({ ...acc, [key]: storage[key] }), {});
        if (typeof keys === 'string') return { [keys]: storage[keys] };
        return Object.keys(keys).reduce((acc, key) => ({ ...acc, [key]: storage[key] ?? keys[key] }), {});
      };

      const chromeMock = {
        runtime: { lastError: null, getURL: (relative = '') => `${window.location.origin}/${relative.replace(/^\/+/, '')}` },
        i18n: { getMessage: () => '' },
        storage: {
          local: {
            get: async (keys) => resolveGet(keys),
            set: async (values) => Object.assign(storage, values || {}),
            remove: async (keys) => {
              const list = Array.isArray(keys) ? keys : [keys];
              list.forEach((key) => delete storage[key]);
            }
          }
        },
        permissions: {
          contains: (_permissions, cb) => cb(true),
          request: (_permissions, cb) => cb(true)
        },
        windows: {
          getCurrent: async () => ({ id: 1, type: 'normal' }),
          get: async (id) => ({ id, type: 'normal', tabs: [] }),
          update: async (id, info) => ({ id, ...info }),
          create: async () => ({ id: 2, type: 'popup' })
        },
        sidePanel: { open: async () => {} },
        tabs: {
          create: async () => ({ id: 10 }),
          update: async () => ({ id: 10 }),
          query: async () => [],
          get: async () => ({ id: 10, status: 'complete' }),
          onUpdated: { addListener: () => {}, removeListener: () => {} }
        },
        scripting: { executeScript: async () => [{ result: true }] },
        downloads: {
          download: (_options, cb) => cb?.(1),
          open: async () => {},
          onChanged: { addListener: () => {}, removeListener: () => {} }
        },
        cookies: { get: async () => null }
      };

      const realFetch = window.fetch.bind(window);
      window.fetch = async (input, init = {}) => {
        const requestUrl = typeof input === 'string' ? input : input?.url;
        if (!requestUrl) return realFetch(input, init);
        if (requestUrl.includes('/api2/json/cluster/resources')) {
          return new Response(JSON.stringify({
            data: [
              { type: 'qemu', vmid: 201, name: 'prod-web-01', node: 'pve-prod-01', status: 'running', cpu: 0.2, mem: 1, maxmem: 2, disk: 1, maxdisk: 2 },
              { type: 'qemu', vmid: 202, name: 'prod-web-02', node: 'pve-prod-01', status: 'running', cpu: 0.2, mem: 1, maxmem: 2, disk: 1, maxdisk: 2 }
            ]
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (requestUrl.includes('/api2/json/')) {
          return new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (requestUrl.includes('api.github.com/repos/community-scripts/ProxmoxVE/git/trees/main')) {
          return new Response(JSON.stringify({ tree: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return realFetch(input, init);
      };

      window.chrome = chromeMock;
      globalThis.chrome = chromeMock;
    });

    await page.goto(`${staticBaseUrl}/popup/popup.html`);
    const actionButtons = page.locator('[data-id="vm-production-201"] .actions .action-btn');
    await expect(actionButtons.last()).toHaveClass(/favorite-toggle/);
    const favoriteBtn = page.locator('[data-id="vm-production-201"] .favorite-toggle');
    const favoriteBox = await favoriteBtn.boundingBox();
    expect(favoriteBox).toBeTruthy();
    expect(Math.round(favoriteBox.height)).toBe(28);
    await favoriteBtn.click();
    await page.locator('#cluster-tabs .cluster-tab', { hasText: 'Favorites' }).click();
    await expect(page.locator('[data-id="vm-production-201"]')).toBeVisible();
    await expect(page.locator('[data-id="vm-production-202"]')).toHaveCount(0);
  });

  test('should keep cross-cluster favorites when switching single cluster tabs', async ({ page }) => {
    await page.addInitScript(() => {
      const storage = {
        theme: 'dark',
        displaySettings: { uptime: true, ip: true, os: true, vmid: true, tags: true },
        scriptsPanelCollapsed: true,
        activeClusterTabId: 'production',
        activeClusterId: 'production',
        favoriteResourceIds: [],
        clusters: {
          production: {
            id: 'production',
            name: 'Production',
            proxmoxUrl: 'https://pve-prod-01.lan:8006',
            apiUser: 'api-admin@pve',
            apiTokenId: 'full-access',
            apiSecret: 'prod-secret',
            apiToken: 'api-admin@pve!full-access=prod-secret',
            failoverUrls: [],
            isEnabled: true
          },
          staging: {
            id: 'staging',
            name: 'Staging',
            proxmoxUrl: 'https://pve-staging-01.lan:8006',
            apiUser: 'api-admin@pve',
            apiTokenId: 'full-access',
            apiSecret: 'staging-secret',
            apiToken: 'api-admin@pve!full-access=staging-secret',
            failoverUrls: [],
            isEnabled: true
          }
        },
        communityScriptsCatalogCacheV1: {
          source: 'fixture',
          updatedAt: Date.now(),
          schemaVersion: 2,
          scripts: []
        }
      };

      const resolveGet = (keys) => {
        if (!keys) return { ...storage };
        if (Array.isArray(keys)) return keys.reduce((acc, key) => ({ ...acc, [key]: storage[key] }), {});
        if (typeof keys === 'string') return { [keys]: storage[keys] };
        return Object.keys(keys).reduce((acc, key) => ({ ...acc, [key]: storage[key] ?? keys[key] }), {});
      };

      const chromeMock = {
        runtime: { lastError: null, getURL: (relative = '') => `${window.location.origin}/${relative.replace(/^\/+/, '')}` },
        i18n: { getMessage: () => '' },
        storage: {
          local: {
            get: async (keys) => resolveGet(keys),
            set: async (values) => Object.assign(storage, values || {}),
            remove: async (keys) => {
              const list = Array.isArray(keys) ? keys : [keys];
              list.forEach((key) => delete storage[key]);
            }
          }
        },
        permissions: {
          contains: (_permissions, cb) => cb(true),
          request: (_permissions, cb) => cb(true)
        },
        windows: {
          getCurrent: async () => ({ id: 1, type: 'normal' }),
          get: async (id) => ({ id, type: 'normal', tabs: [] }),
          update: async (id, info) => ({ id, ...info }),
          create: async () => ({ id: 2, type: 'popup' })
        },
        sidePanel: { open: async () => {} },
        tabs: {
          create: async () => ({ id: 10 }),
          update: async () => ({ id: 10 }),
          query: async () => [],
          get: async () => ({ id: 10, status: 'complete' }),
          onUpdated: { addListener: () => {}, removeListener: () => {} }
        },
        scripting: { executeScript: async () => [{ result: true }] },
        downloads: {
          download: (_options, cb) => cb?.(1),
          open: async () => {},
          onChanged: { addListener: () => {}, removeListener: () => {} }
        },
        cookies: { get: async () => null }
      };

      const realFetch = window.fetch.bind(window);
      window.fetch = async (input, init = {}) => {
        const requestUrl = typeof input === 'string' ? input : input?.url;
        if (!requestUrl) return realFetch(input, init);
        if (requestUrl.includes('pve-prod-01') && requestUrl.includes('/api2/json/cluster/resources')) {
          return new Response(JSON.stringify({
            data: [
              { type: 'qemu', vmid: 201, name: 'prod-web-01', node: 'pve-prod-01', status: 'running', cpu: 0.2, mem: 1, maxmem: 2, disk: 1, maxdisk: 2 }
            ]
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (requestUrl.includes('pve-staging-01') && requestUrl.includes('/api2/json/cluster/resources')) {
          return new Response(JSON.stringify({
            data: [
              { type: 'qemu', vmid: 301, name: 'stg-web-01', node: 'pve-stg-01', status: 'running', cpu: 0.2, mem: 1, maxmem: 2, disk: 1, maxdisk: 2 }
            ]
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (requestUrl.includes('/api2/json/')) {
          return new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (requestUrl.includes('api.github.com/repos/community-scripts/ProxmoxVE/git/trees/main')) {
          return new Response(JSON.stringify({ tree: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return realFetch(input, init);
      };

      window.chrome = chromeMock;
      globalThis.chrome = chromeMock;
    });

    await page.goto(`${staticBaseUrl}/popup/popup.html`);
    const prodFav = page.locator('[data-id="vm-production-201"] .favorite-toggle');
    await prodFav.click();
    await expect(prodFav).toHaveClass(/active/);

    await page.locator('#cluster-tabs .cluster-tab', { hasText: 'Staging' }).click();
    await expect(page.locator('[data-id="vm-staging-301"]')).toBeVisible();

    await page.locator('#cluster-tabs .cluster-tab', { hasText: 'Production' }).click();
    await expect(page.locator('[data-id="vm-production-201"] .favorite-toggle')).toHaveClass(/active/);
  });

  test('should auto-expand VM details when default expand setting is enabled', async ({ page }) => {
    await page.addInitScript(() => {
      const storage = {
        theme: 'dark',
        displaySettings: { uptime: true, ip: true, os: true, vmid: true, tags: true },
        expandDetailsByDefault: true,
        scriptsPanelCollapsed: true,
        activeClusterTabId: '__all__',
        activeClusterId: 'production',
        clusters: {
          production: {
            id: 'production',
            name: 'Production',
            proxmoxUrl: 'https://pve-prod-01.lan:8006',
            apiUser: 'api-admin@pve',
            apiTokenId: 'full-access',
            apiSecret: 'prod-secret',
            apiToken: 'api-admin@pve!full-access=prod-secret',
            failoverUrls: [],
            isEnabled: true
          }
        },
        communityScriptsCatalogCacheV1: {
          source: 'fixture',
          updatedAt: Date.now(),
          schemaVersion: 2,
          scripts: []
        }
      };

      const resolveGet = (keys) => {
        if (!keys) return { ...storage };
        if (Array.isArray(keys)) return keys.reduce((acc, key) => ({ ...acc, [key]: storage[key] }), {});
        if (typeof keys === 'string') return { [keys]: storage[keys] };
        return Object.keys(keys).reduce((acc, key) => ({ ...acc, [key]: storage[key] ?? keys[key] }), {});
      };

      const chromeMock = {
        runtime: { lastError: null, getURL: (relative = '') => `${window.location.origin}/${relative.replace(/^\/+/, '')}` },
        i18n: { getMessage: () => '' },
        storage: {
          local: {
            get: async (keys) => resolveGet(keys),
            set: async (values) => Object.assign(storage, values || {}),
            remove: async (keys) => {
              const list = Array.isArray(keys) ? keys : [keys];
              list.forEach((key) => delete storage[key]);
            }
          }
        },
        permissions: {
          contains: (_permissions, cb) => cb(true),
          request: (_permissions, cb) => cb(true)
        },
        windows: {
          getCurrent: async () => ({ id: 1, type: 'normal' }),
          get: async (id) => ({ id, type: 'normal', tabs: [] }),
          update: async (id, info) => ({ id, ...info }),
          create: async () => ({ id: 2, type: 'popup' })
        },
        sidePanel: { open: async () => {} },
        tabs: {
          create: async () => ({ id: 10 }),
          update: async () => ({ id: 10 }),
          query: async () => [],
          get: async () => ({ id: 10, status: 'complete' }),
          onUpdated: { addListener: () => {}, removeListener: () => {} }
        },
        scripting: { executeScript: async () => [{ result: true }] },
        downloads: {
          download: (_options, cb) => cb?.(1),
          open: async () => {},
          onChanged: { addListener: () => {}, removeListener: () => {} }
        },
        cookies: { get: async () => null }
      };

      const realFetch = window.fetch.bind(window);
      window.fetch = async (input, init = {}) => {
        const requestUrl = typeof input === 'string' ? input : input?.url;
        if (!requestUrl) return realFetch(input, init);
        if (requestUrl.includes('/api2/json/cluster/resources')) {
          return new Response(JSON.stringify({
            data: [
              { type: 'qemu', vmid: 201, name: 'prod-web-01', node: 'pve-prod-01', status: 'running', cpu: 0.2, mem: 1, maxmem: 2, disk: 1, maxdisk: 2 }
            ]
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (requestUrl.includes('/api2/json/')) {
          return new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (requestUrl.includes('api.github.com/repos/community-scripts/ProxmoxVE/git/trees/main')) {
          return new Response(JSON.stringify({ tree: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return realFetch(input, init);
      };

      window.chrome = chromeMock;
      globalThis.chrome = chromeMock;
    });

    await page.goto(`${staticBaseUrl}/popup/popup.html`);
    await expect(page.locator('[data-id="vm-production-201"]')).toHaveClass(/expanded/);
  });
});
