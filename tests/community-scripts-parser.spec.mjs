import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { Buffer } from 'buffer';

const modulePath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../lib/community-scripts.js'
);
const moduleSource = fs.readFileSync(modulePath, 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleSource, 'utf8').toString('base64')}`;
const mod = await import(moduleUrl);
const {
  normalizeGitHubTree,
  parseJsonCatalog,
  __testFetchGitHubCatalog,
  getCommunityScriptsCatalog,
  __testParseGuideFromHtml
} = mod;

test('normalizes GitHub tree into deterministic catalog records', async () => {
  const tree = [
    { type: 'blob', path: 'ct/docker.sh' },
    { type: 'blob', path: 'ct/alpine-adguard.sh' },
    { type: 'blob', path: 'tools/addon/usb-mount-helper.sh' },
    { type: 'blob', path: 'tools/media/jellyfin-tools.sh' },
    { type: 'blob', path: 'vm/ubuntu-vm.sh' },
    { type: 'blob', path: 'docs/readme.md' }
  ];
  const parsed = normalizeGitHubTree(tree);

  expect(parsed.map(item => item.slug)).toContain('docker');
  expect(parsed.map(item => item.slug)).toContain('usb-mount-helper');
  expect(parsed.map(item => item.slug)).not.toContain('jellyfin-tools');
  const addon = parsed.find(item => item.slug === 'usb-mount-helper');
  expect(addon).toBeTruthy();
  expect(addon.toolsGroup).toBe('addon');
  const vm = parsed.find(item => item.slug === 'ubuntu-vm');
  expect(vm).toBeTruthy();
  expect(vm.type).toBe('vm');
  expect(vm.installUrl).toBe('https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/vm/ubuntu-vm.sh');
  expect(vm.scriptPath).toBe('vm/ubuntu-vm.sh');
  const alpine = parsed.find(item => item.slug === 'alpine-adguard');
  expect(alpine).toBeTruthy();
  expect(alpine.scriptPath).toBe('ct/alpine-adguard.sh');
  expect(alpine.uiGroup).toBe('lxc-alpine');
});

test('parses nested json payload shapes', async () => {
  const payload = {
    result: {
      groups: [
        {
          items: [
            { slug: 'docker', name: 'Docker', type: 'ct', description: 'Container runtime' }
          ]
        }
      ]
    }
  };
  const parsed = parseJsonCatalog(payload);
  expect(parsed).toHaveLength(1);
  expect(parsed[0].slug).toBe('docker');
});

test('builds catalog from GitHub API tree payload', async () => {
  const fetchImpl = async (url) => {
    expect(url).toContain('api.github.com/repos/community-scripts/ProxmoxVE/git/trees/main');
    return {
      tree: [
        { type: 'blob', path: 'ct/grafana.sh' },
        { type: 'blob', path: 'vm/homeassistant-vm.sh' }
      ]
    };
  };

  const result = await __testFetchGitHubCatalog(fetchImpl);
  expect(result.source).toBe('github');
  expect(result.scripts).toHaveLength(2);
  expect(result.scripts.every(item => item.installUrl.startsWith('https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/'))).toBeTruthy();
});

test('falls back to stale cache when GitHub fetch fails', async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  try {
    globalThis.chrome = {
      storage: {
        local: {
          get: async () => ({
            communityScriptsCatalogCacheV1: {
              source: 'github',
              updatedAt: Date.now() - 99999999,
              scripts: [
                {
                  slug: 'grafana',
                  name: 'Grafana',
                  description: 'Grafana (CT) script from community-scripts repository.',
                  type: 'ct',
                  installUrl: 'https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/grafana.sh',
                  scriptPath: 'ct/grafana.sh'
                }
              ]
            }
          }),
          set: async () => {}
        }
      }
    };
    globalThis.fetch = async () => {
      throw new Error('network-down');
    };

    const result = await getCommunityScriptsCatalog({ forceRefresh: true, ttlHours: 12 });
    expect(result.source).toBe('cache-fallback');
    expect(result.stale).toBeTruthy();
    expect(result.scripts[0].slug).toBe('grafana');
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});

test('parses guide sections from script page html', async () => {
  const html = `
    <h2>About</h2>
    <p>High performance self-hosted photo and video management solution.</p>
    <h2>Notes</h2>
    <p>During first install, dependencies are compiled.</p>
    <h2>Install</h2>
    <code>bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/immich.sh)"</code>
  `;
  const guide = __testParseGuideFromHtml(html, 'immich');
  expect(guide.slug).toBe('immich');
  expect(guide.about).toContain('High performance');
  expect(guide.notes).toContain('dependencies');
  expect(guide.installCommand).toContain('/ct/immich.sh');
});

test('parses guide details and install methods from script page html', async () => {
  const html = `
    <h2>About</h2>
    <p>Immich helper script.</p>
    <h3>Details</h3>
    <dl>
      <dt>Version</dt><dd>1.1.1</dd>
      <dt>Category</dt><dd>Media &amp; Streaming</dd>
      <dt>Runs in</dt><dd>pve</dd>
      <dt>Updated</dt><dd>Mar 13, 2026</dd>
    </dl>
    <h3>Install methods</h3>
    <div>
      <h4>default</h4>
      <p>Debian 13</p>
      <p>4 CPU</p>
      <p>6144 RAM</p>
      <p>20 HDD</p>
    </div>
    <div>
      <h4>advanced</h4>
      <p>Debian 13</p>
      <p>2 CPU</p>
      <p>4096 RAM</p>
      <p>32 HDD</p>
    </div>
  `;
  const guide = __testParseGuideFromHtml(html, 'immich');
  expect(guide.details?.version).toBe('1.1.1');
  expect(guide.details?.category).toContain('Media & Streaming');
  expect(guide.details?.runsIn).toBe('pve');
  expect(guide.details?.updated).toContain('Mar 13, 2026');
  expect(Array.isArray(guide.installMethods)).toBeTruthy();
  expect(guide.installMethods).toHaveLength(2);
  expect(guide.installMethods[0]?.name).toBe('default');
  expect(guide.installMethods[0]?.cpu).toBe('4');
  expect(guide.installMethods[0]?.ram).toBe('6144');
  expect(guide.installMethods[0]?.hdd).toBe('20');
});
