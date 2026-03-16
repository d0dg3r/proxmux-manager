const playwright = require('playwright');
const path = require('path');
const fs = require('fs/promises');
const http = require('http');

const VIEWPORT = { width: 640, height: 800 };
const SCENES = [
  { id: 'cluster_multi', output: 'screenshot_01_multi_cluster_1280x800.png' },
  { id: 'resource_expanded', output: 'screenshot_02_resource_expanded_1280x800.png' },
  { id: 'onboarding_no_config', output: 'screenshot_03_onboarding_1280x800.png' },
  { id: 'settings_cluster', output: 'screenshot_04_settings_cluster_1280x800.png' },
  { id: 'settings_backup', output: 'screenshot_05_settings_backup_1280x800.png' }
];

function startStaticServer(rootDir) {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const rawPath = decodeURIComponent(url.pathname);
      const safePath = path.normalize(rawPath).replace(/^(\.\.[/\\])+/, '');
      const resolved = path.resolve(rootDir, `.${safePath}`);
      if (!resolved.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      let targetPath = resolved;
      const stat = await fs.stat(targetPath).catch(() => null);
      if (stat && stat.isDirectory()) {
        targetPath = path.join(targetPath, 'index.html');
      }
      const file = await fs.readFile(targetPath);
      const ext = path.extname(targetPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(file);
    } catch (_error) {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done()))
      });
    });
  });
}

function buildClusterFixtures() {
  return {
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
    },
    homelab: {
      id: 'homelab',
      name: 'Homelab',
      proxmoxUrl: 'https://pve-homelab-01.lan:8006',
      apiUser: 'api-admin@pve',
      apiTokenId: 'full-access',
      apiSecret: 'homelab-secret',
      apiToken: 'api-admin@pve!full-access=homelab-secret',
      failoverUrls: [],
      isEnabled: true
    }
  };
}

function buildResources(clusterId, nodeName, clusterName, baseVmid) {
  const machineMap = {
    production: { vm: 'prod-web-01', lxc: 'prod-monitoring', tags: { vm: 'web;critical', lxc: 'monitoring;ops' } },
    staging: { vm: 'staging-api-01', lxc: 'staging-ci-runner', tags: { vm: 'api;qa', lxc: 'ci;runner' } },
    homelab: { vm: 'homelab-media', lxc: 'homelab-automation', tags: { vm: 'media;personal', lxc: 'automation;iot' } }
  };
  const selected = machineMap[clusterId] || machineMap.homelab;

  return [
    {
      type: 'node',
      node: nodeName,
      status: 'online',
      uptime: 5284000,
      cpu: 0.12,
      mem: 7980566528,
      maxmem: 34359738368,
      disk: 42890129408,
      maxdisk: 137438953472,
      netin: 3120000,
      netout: 1960000,
      diskread: 950000,
      diskwrite: 420000
    },
    {
      type: 'qemu',
      vmid: baseVmid,
      name: selected.vm,
      node: nodeName,
      status: 'running',
      uptime: 842100,
      cpu: 0.36,
      mem: 3422552064,
      maxmem: 8589934592,
      disk: 41022971904,
      maxdisk: 68719476736,
      netin: 782100,
      netout: 340100,
      diskread: 602300,
      diskwrite: 182000,
      tags: selected.tags.vm
    },
    {
      type: 'lxc',
      vmid: baseVmid + 1,
      name: selected.lxc,
      node: nodeName,
      status: 'running',
      uptime: 194700,
      cpu: 0.08,
      mem: 560988160,
      maxmem: 2147483648,
      disk: 5920745472,
      maxdisk: 10737418240,
      netin: 200500,
      netout: 120220,
      diskread: 150000,
      diskwrite: 99000,
      tags: selected.tags.lxc
    }
  ];
}

function buildProxmoxFixtures(clusters) {
  const definitions = [
    { id: 'production', node: 'pve-prod-01', vmid: 201 },
    { id: 'staging', node: 'pve-staging-01', vmid: 301 },
    { id: 'homelab', node: 'pve-homelab-01', vmid: 401 }
  ];

  const proxmox = {};
  definitions.forEach(({ id, node, vmid }) => {
    const cluster = clusters[id];
    const origin = new URL(cluster.proxmoxUrl).origin;
    const resources = buildResources(id, node, cluster.name, vmid);
    proxmox[origin] = {
      resources,
      nodeStatus: {
        [node]: {
          pveversion: 'pve-manager/8.3.2/abc',
          cpu: 0.14,
          memory: { used: 7980566528, total: 34359738368 },
          netin: 3100000,
          netout: 1900000,
          diskread: 880000,
          diskwrite: 460000
        }
      },
      nodeNetwork: {
        [node]: [{ type: 'bridge', iface: 'vmbr0', address: `10.20.${vmid % 100}.10`, active: 1 }]
      },
      statusCurrent: {
        [`qemu:${vmid}`]: {
          cpu: 0.36,
          mem: 3422552064,
          maxmem: 8589934592,
          uptime: 842100,
          netin: 782100,
          netout: 340100,
          diskread: 602300,
          diskwrite: 182000
        },
        [`lxc:${vmid + 1}`]: {
          cpu: 0.08,
          mem: 560988160,
          maxmem: 2147483648,
          uptime: 194700,
          netin: 200500,
          netout: 120220,
          disk: 5920745472,
          diskread: 150000,
          diskwrite: 99000
        }
      },
      vmConfig: {
        [`qemu:${vmid}`]: {
          ostype: 'l26',
          vga: 'qxl',
          scsi0: `local-lvm:vm-${vmid}-disk-0,size=64G`
        },
        [`lxc:${vmid + 1}`]: {
          ostype: 'debian',
          rootfs: `local-lvm:subvol-${vmid + 1}-disk-0,size=10G`
        }
      },
      lxcInterfaces: {
        [vmid + 1]: [{ name: 'eth0', inet: `10.20.${vmid % 100}.31/24` }]
      },
      qemuAgentNet: {
        [vmid]: {
          result: [
            {
              name: 'eth0',
              'ip-addresses': [{ 'ip-address-type': 'ipv4', 'ip-address': `10.20.${vmid % 100}.21` }]
            }
          ]
        }
      }
    };
  });
  return proxmox;
}

function buildSeedStorage(sceneId, theme) {
  if (sceneId === 'onboarding_no_config') {
    return {
      theme,
      displaySettings: { uptime: true, ip: true, os: true, vmid: true, tags: true },
      consoleTabMode: 'duplicate',
      defaultActionClickMode: 'sidepanel',
      scriptsPanelCollapsed: true,
      activeClusterTabId: '__all__',
      clusters: {},
      activeClusterId: null
    };
  }

  const clusters = buildClusterFixtures();
  return {
    theme,
    displaySettings: { uptime: true, ip: true, os: true, vmid: true, tags: true },
    consoleTabMode: 'duplicate',
    defaultActionClickMode: 'sidepanel',
    scriptsPanelCollapsed: true,
    activeClusterTabId: '__all__',
    clusters,
    activeClusterId: 'production',
    communityScriptsCatalogCacheV1: {
      source: 'fixture',
      updatedAt: Date.now(),
      schemaVersion: 2,
      scripts: [
        {
          slug: 'docker',
          name: 'Docker',
          description: 'Docker script.',
          type: 'ct',
          installUrl: 'https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/docker.sh',
          scriptPath: 'ct/docker.sh'
        }
      ]
    }
  };
}

async function installHarness(page, sceneId, theme) {
  const clusters = buildClusterFixtures();
  const seedStorage = buildSeedStorage(sceneId, theme);
  const proxmoxFixtures = buildProxmoxFixtures(clusters);

  await page.addInitScript(({ seedStorageData, proxmoxData }) => {
    const deepCopy = (value) => JSON.parse(JSON.stringify(value));
    const storage = deepCopy(seedStorageData || {});
    const proxmox = deepCopy(proxmoxData || {});
    const listeners = {
      tabsOnUpdated: new Set(),
      downloadsOnChanged: new Set()
    };

    const runtime = {
      lastError: null,
      getURL: (relativePath = '') => `chrome-extension://proxmux/${relativePath.replace(/^\/+/, '')}`
    };

    const resolveGet = (keys) => {
      if (!keys) return deepCopy(storage);
      if (Array.isArray(keys)) {
        return keys.reduce((acc, key) => {
          acc[key] = storage[key];
          return acc;
        }, {});
      }
      if (typeof keys === 'string') {
        return { [keys]: storage[keys] };
      }
      if (typeof keys === 'object') {
        const result = {};
        Object.entries(keys).forEach(([key, fallback]) => {
          result[key] = typeof storage[key] === 'undefined' ? fallback : storage[key];
        });
        return result;
      }
      return {};
    };

    const createJsonResponse = (payload, status = 200) => new Response(
      JSON.stringify({ data: payload }),
      { status, headers: { 'content-type': 'application/json' } }
    );

    const parseProxmoxRequest = (requestUrl) => {
      const url = new URL(requestUrl);
      const origin = `${url.protocol}//${url.host}`;
      const fixture = proxmox[origin];
      if (!fixture) return null;
      const endpoint = url.pathname.replace('/api2/json', '');
      return { fixture, endpoint };
    };

    const getVmKey = (type, vmid) => `${type}:${Number(vmid)}`;

    const realFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const requestUrl = typeof input === 'string' ? input : input?.url;
      if (!requestUrl) return realFetch(input, init);

      if (requestUrl.startsWith('https://api.github.com/repos/community-scripts/ProxmoxVE/git/trees/main')) {
        return new Response(
          JSON.stringify({ tree: [{ path: 'ct/docker.sh', type: 'blob' }] }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (requestUrl.startsWith('https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/')) {
        return new Response('#!/usr/bin/env bash\necho "fixture script"\n', { status: 200 });
      }

      if (requestUrl.startsWith('https://community-scripts.org/scripts/')) {
        return new Response('<h2>About</h2><p>Fixture guide.</p>', {
          status: 200,
          headers: { 'content-type': 'text/html' }
        });
      }

      if (requestUrl.includes('/api2/json/')) {
        const parsed = parseProxmoxRequest(requestUrl);
        if (!parsed) return createJsonResponse({});
        const { fixture, endpoint } = parsed;

        if (endpoint === '/cluster/resources') {
          return createJsonResponse(fixture.resources || []);
        }

        let match = endpoint.match(/^\/nodes\/([^/]+)\/status$/);
        if (match) {
          const node = decodeURIComponent(match[1]);
          return createJsonResponse(fixture.nodeStatus[node] || {
            pveversion: 'pve-manager/8.3.2/fixture',
            cpu: 0.1,
            memory: { used: 1, total: 1 }
          });
        }

        match = endpoint.match(/^\/nodes\/([^/]+)\/network$/);
        if (match) {
          const node = decodeURIComponent(match[1]);
          return createJsonResponse(fixture.nodeNetwork[node] || []);
        }

        match = endpoint.match(/^\/nodes\/([^/]+)\/rrddata/);
        if (match) {
          return createJsonResponse([{ netin: 1200, netout: 900, diskread: 500, diskwrite: 200 }]);
        }

        match = endpoint.match(/^\/nodes\/([^/]+)\/(qemu|lxc)\/(\d+)\/config$/);
        if (match) {
          const [, , type, vmid] = match;
          return createJsonResponse(fixture.vmConfig[getVmKey(type, vmid)] || {});
        }

        match = endpoint.match(/^\/nodes\/([^/]+)\/(qemu|lxc)\/(\d+)\/status\/current$/);
        if (match) {
          const [, , type, vmid] = match;
          return createJsonResponse(fixture.statusCurrent[getVmKey(type, vmid)] || {});
        }

        match = endpoint.match(/^\/nodes\/([^/]+)\/lxc\/(\d+)\/interfaces$/);
        if (match) {
          const [, , vmid] = match;
          return createJsonResponse(fixture.lxcInterfaces[Number(vmid)] || []);
        }

        match = endpoint.match(/^\/nodes\/([^/]+)\/qemu\/(\d+)\/agent\/network-get-interfaces$/);
        if (match) {
          const [, , vmid] = match;
          return createJsonResponse(fixture.qemuAgentNet[Number(vmid)] || { result: [] });
        }

        return createJsonResponse({});
      }

      return realFetch(input, init);
    };

    let tabCounter = 500;
    let windowCounter = 50;
    const makeTab = (url = 'about:blank', extras = {}) => ({
      id: ++tabCounter,
      windowId: 1,
      url,
      status: 'complete',
      active: true,
      ...extras
    });

    const callbackify = (result, cb) => {
      if (typeof cb === 'function') setTimeout(() => cb(result), 0);
      return Promise.resolve(result);
    };

    const chromeObject = {
      runtime,
      i18n: {
        getMessage: (_key) => ''
      },
      storage: {
        local: {
          get: (keys, cb) => callbackify(resolveGet(keys), cb),
          set: (values, cb) => {
            Object.assign(storage, deepCopy(values || {}));
            return callbackify(undefined, cb);
          },
          remove: (keys, cb) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            keyList.forEach((key) => delete storage[key]);
            return callbackify(undefined, cb);
          }
        }
      },
      permissions: {
        contains: (_permissions, cb) => setTimeout(() => cb(true), 0),
        request: (_permissions, cb) => setTimeout(() => cb(true), 0)
      },
      cookies: {
        get: async () => null
      },
      sidePanel: {
        open: async () => {}
      },
      windows: {
        getCurrent: async () => ({ id: 1, type: 'normal' }),
        get: async (id) => ({ id, type: 'popup', tabs: [makeTab('chrome-extension://proxmux/popup/popup.html?view=floating')] }),
        update: async (id, updateInfo = {}) => ({ id, ...updateInfo }),
        create: async (createInfo = {}) => ({ id: ++windowCounter, type: createInfo.type || 'popup', tabs: [makeTab(createInfo.url || 'about:blank')] })
      },
      tabs: {
        create: async (createInfo = {}) => makeTab(createInfo.url || 'about:blank'),
        update: async (tabId, updateInfo = {}) => ({ id: tabId, url: updateInfo.url || 'about:blank', active: updateInfo.active !== false, status: 'complete' }),
        query: async () => [],
        get: async (tabId) => ({ id: tabId, status: 'complete' }),
        onUpdated: {
          addListener: (listener) => listeners.tabsOnUpdated.add(listener),
          removeListener: (listener) => listeners.tabsOnUpdated.delete(listener)
        }
      },
      scripting: {
        executeScript: async () => [{ result: true }]
      },
      downloads: {
        download: (options, cb) => callbackify(1001, cb),
        open: async () => {},
        onChanged: {
          addListener: (listener) => listeners.downloadsOnChanged.add(listener),
          removeListener: (listener) => listeners.downloadsOnChanged.delete(listener)
        }
      }
    };

    window.chrome = chromeObject;
    globalThis.chrome = chromeObject;
  }, {
    seedStorageData: seedStorage,
    proxmoxData: proxmoxFixtures
  });
}

async function applyBaseState(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `
  });

  await page.evaluate(() => {
    const panel = document.getElementById('collapsible-filters');
    const toggle = document.getElementById('filter-toggle-btn');
    if (panel && !panel.classList.contains('collapsed')) panel.classList.add('collapsed');
    if (toggle) toggle.classList.remove('active');
    const main = document.getElementById('main-view-content');
    if (main) main.scrollTop = 0;
  });
}

async function applySceneState(page, sceneId) {
  if (sceneId === 'cluster_multi') {
    await page.waitForSelector('.resource-item');
    await page.waitForSelector('#cluster-tabs:not(.hidden)');
    return;
  }

  if (sceneId === 'resource_expanded') {
    const targetItemSelector = '[data-id="vm-production-201"]';
    const targetMainSelector = `${targetItemSelector} .item-main`;
    await page.waitForSelector(targetMainSelector, { state: 'visible' });
    await page.waitForFunction((selector) => {
      const list = document.getElementById('resource-list');
      const items = Array.from((list || document).querySelectorAll('.resource-item'));
      return items.length >= 3 && items.some((item) => item.matches(selector));
    }, targetItemSelector);
    await page.evaluate((selector) => {
      const target = document.querySelector(selector);
      target?.scrollIntoView({ block: 'center', inline: 'nearest' });
    }, targetItemSelector);
    await page.click(targetMainSelector);
    await page.waitForSelector(`${targetItemSelector}.expanded`);
    await page.waitForFunction((selector) => {
      const item = document.querySelector(selector);
      if (!item || !item.classList.contains('expanded')) return false;
      const drawer = item.querySelector('.details-drawer');
      if (!drawer) return false;
      const styles = window.getComputedStyle(drawer);
      const rect = drawer.getBoundingClientRect();
      return styles.visibility !== 'hidden' && Number(styles.opacity) > 0.95 && rect.height > 24;
    }, targetItemSelector);
    await page.evaluate(() => {
      const list = document.getElementById('main-view-content');
      if (list) list.scrollTop = Math.max(list.scrollTop - 20, 0);
      const scripts = document.querySelector('.scripts-panel');
      scripts?.classList.add('hidden');
    });
    return;
  }

  if (sceneId === 'onboarding_no_config') {
    await page.waitForSelector('#no-auth:not(.hidden)');
    return;
  }

  await page.waitForSelector('#display-settings-btn');
  await page.click('#display-settings-btn');
  await page.waitForSelector('body.settings-view-active');
  await page.waitForSelector('#inline-settings-view:not(.hidden)');

  if (sceneId === 'settings_backup') {
    await page.click('[data-inline-settings-subtab="backup"]');
    await page.waitForSelector('[data-inline-settings-panel="backup"].active');
  } else {
    await page.waitForSelector('[data-inline-settings-panel="cluster"].active');
  }
}

async function renderThemeSceneBuffer(browser, popupPath, colorScheme, sceneId) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => {
    console.error(`[${sceneId}/${colorScheme}] pageerror: ${error.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`[${sceneId}/${colorScheme}] console: ${msg.text()}`);
    }
  });
  await installHarness(page, sceneId, colorScheme === 'dark' ? 'dark' : 'light');
  await page.goto(popupPath);
  await page.waitForTimeout(250);
  await applyBaseState(page);
  await applySceneState(page, sceneId);
  await page.waitForTimeout(220);
  const buffer = await page.screenshot();
  await context.close();
  return buffer;
}

async function writeCombinedScreenshot(browser, storeDir, outputFile, darkBuffer, lightBuffer) {
  const composeContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'dark'
  });
  const composePage = await composeContext.newPage();
  const darkBase64 = darkBuffer.toString('base64');
  const lightBase64 = lightBuffer.toString('base64');
  await composePage.setContent(`
    <!DOCTYPE html>
    <html>
    <body style="margin:0;background:#0f111a;">
      <div style="display:flex;width:1280px;height:800px;">
        <img src="data:image/png;base64,${lightBase64}" width="640" height="800" style="display:block" />
        <img src="data:image/png;base64,${darkBase64}" width="640" height="800" style="display:block" />
      </div>
    </body>
    </html>
  `);
  await composePage.screenshot({ path: path.join(storeDir, outputFile) });
  await composeContext.close();
}

(async () => {
  const browser = await playwright.chromium.launch();
  const projectRoot = path.resolve(__dirname, '..');
  const server = await startStaticServer(projectRoot);
  const popupPath = `${server.baseUrl}/popup/popup.html`;
  const storeDir = path.resolve(__dirname);

  try {
    for (const scene of SCENES) {
      const darkBuffer = await renderThemeSceneBuffer(browser, popupPath, 'dark', scene.id);
      const lightBuffer = await renderThemeSceneBuffer(browser, popupPath, 'light', scene.id);
      await writeCombinedScreenshot(browser, storeDir, scene.output, darkBuffer, lightBuffer);
      console.log(`Saved ${scene.output} (1280x800, PNG, Light+Dark combined)`);
    }

    const staleFiles = [
      'screenshot_cluster_1280x800.png',
      'screenshot_connection_1280x800.png',
      'screenshot_settings_1280x800.png',
      'screenshot_dark.png',
      'screenshot_light.png',
      'screenshot_dark_640x400.png',
      'screenshot_light_640x400.png'
    ];
    await Promise.all(
      staleFiles.map(async (file) => {
        try {
          await fs.unlink(path.join(storeDir, file));
        } catch (_error) {
          // ignore missing files
        }
      })
    );
  } finally {
    await browser.close();
    await server.close();
  }
})();

