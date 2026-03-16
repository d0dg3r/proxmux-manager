import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { Buffer } from 'buffer';

const modulePath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../lib/ssh-config-export.js'
);
const moduleSource = fs.readFileSync(modulePath, 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleSource, 'utf8').toString('base64')}`;
const mod = await import(moduleUrl);

const {
  buildSshAlias,
  buildSshConfigText,
  collectSshExportTargets,
  parseSshHostDefaultsText,
  parseSshUserOverridesText,
  stringifySshHostDefaults,
  stringifySshUserOverrides
} = mod;

test('parses and stringifies SSH override mappings', async () => {
  const parsed = parseSshUserOverridesText(`
    # comment
    prod-a-qemu-101: ubuntu
    prod-a-node-pve01=root
  `);
  expect(parsed).toEqual({
    'prod-a-qemu-101': 'ubuntu',
    'prod-a-node-pve01': 'root'
  });

  const text = stringifySshUserOverrides(parsed);
  expect(text).toContain('prod-a-node-pve01: root');
  expect(text).toContain('prod-a-qemu-101: ubuntu');
});

test('builds deterministic alias segments', async () => {
  const alias = buildSshAlias(
    { id: 'a1b2c3d4ef', name: 'Production Cluster' },
    { type: 'qemu', vmid: 101, node: 'pve01', name: 'docker-vm' }
  );
  expect(alias).toBe('docker-vm');
});

test('applies user override precedence over default user', async () => {
  const config = buildSshConfigText(
    [{ alias: 'web-01', ip: '10.0.0.10' }, { alias: 'pve01', ip: '10.0.0.11' }],
    {
      defaultUser: 'root',
      userOverrides: {
        'web-01': 'ubuntu'
      }
    }
  );

  expect(config).toContain('Host web-01');
  expect(config).toContain('HostName 10.0.0.10');
  expect(config).toContain('User ubuntu');
  expect(config).toContain('Host pve01');
  expect(config).toContain('HostName 10.0.0.11');
  expect(config).toContain('Host *');
  expect(config).toContain('  User root');
  expect(config).not.toContain('Host pve01\n  HostName 10.0.0.11\n  User root');
});

test('parses and stringifies OpenSSH SSH host defaults', async () => {
  const parsed = parseSshHostDefaultsText(`
    # comment
    Port 2222
    IdentityFile ~/.ssh/id_ed25519
  `);
  expect(parsed).toEqual({
    Port: '2222',
    IdentityFile: '~/.ssh/id_ed25519'
  });
  const text = stringifySshHostDefaults(parsed);
  expect(text).toContain('Port 2222');
  expect(text).toContain('IdentityFile ~/.ssh/id_ed25519');
});

test('rejects key=value syntax for SSH host defaults', async () => {
  expect(() => parseSshHostDefaultsText('Port=2222')).toThrow(/OpenSSH syntax/);
});

test('emits host defaults in Host * block and keeps host blocks minimal', async () => {
  const config = buildSshConfigText(
    [{ alias: 'web-01', ip: '10.0.0.10' }],
    {
      defaultUser: 'ubuntu',
      hostDefaults: {
        Port: '2222',
        IdentityFile: '~/.ssh/id_ed25519'
      }
    }
  );

  expect(config).toContain('Host *');
  expect(config).toContain('  User ubuntu');
  expect(config).toContain('  Port 2222');
  expect(config).toContain('  IdentityFile ~/.ssh/id_ed25519');
  expect(config).toContain('Host web-01');
  expect(config).toContain('  HostName 10.0.0.10');
  expect(config).not.toContain('Host web-01\n  HostName 10.0.0.10\n  User ubuntu');
  expect(config).not.toContain('Host web-01\n  HostName 10.0.0.10\n  Port 2222');
});

test('collects only Linux-capable resources with IP addresses', async () => {
  const clusters = {
    clusterA: {
      id: 'clusterA',
      name: 'Cluster A',
      proxmoxUrl: 'https://pve-a.example:8006',
      apiToken: 'token-a',
      isEnabled: true
    }
  };

  const fakeApi = {
    async getResources() {
      return [
        { type: 'node', node: 'pve01', status: 'online' },
        { type: 'lxc', node: 'pve01', vmid: 101, status: 'running' },
        { type: 'qemu', node: 'pve01', vmid: 102, status: 'running' },
        { type: 'qemu', node: 'pve01', vmid: 103, status: 'running' }
      ];
    },
    async getResourceDetails(resource) {
      if (resource.type === 'node') return { ip: '10.0.1.10', os: 'PVE 8.2' };
      if (resource.type === 'lxc') return { ip: '10.0.1.11', os: 'alpine' };
      if (resource.vmid === 102) return { ip: '10.0.1.12', os: 'linux' };
      return { ip: null, os: 'windows' };
    }
  };

  const result = await collectSshExportTargets(clusters, () => fakeApi);
  expect(result.errors).toHaveLength(0);
  expect(result.targets).toHaveLength(3);
  expect(result.targets.map((t) => t.ip).sort()).toEqual(['10.0.1.10', '10.0.1.11', '10.0.1.12']);
});

test('adds cluster suffix only when aliases collide', async () => {
  const clusters = {
    clusterA: {
      id: 'clusterA',
      name: 'Prod',
      proxmoxUrl: 'https://pve-a.example:8006',
      apiToken: 'token-a',
      isEnabled: true
    },
    clusterB: {
      id: 'clusterB',
      name: 'Lab',
      proxmoxUrl: 'https://pve-b.example:8006',
      apiToken: 'token-b',
      isEnabled: true
    }
  };

  const fakeApiFor = (cluster) => ({
    async getResources() {
      return [{ type: 'qemu', node: 'pve01', vmid: cluster.id === 'clusterA' ? 101 : 201, name: 'Web-01', status: 'running' }];
    },
    async getResourceDetails() {
      return { ip: cluster.id === 'clusterA' ? '10.0.2.10' : '10.0.2.20', os: 'linux' };
    }
  });

  const result = await collectSshExportTargets(clusters, (cluster) => fakeApiFor(cluster));
  const aliases = result.targets.map((t) => t.alias).sort();
  expect(aliases).toEqual(['web-01-lab', 'web-01-prod']);
});
