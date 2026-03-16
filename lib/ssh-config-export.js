const LINUX_HINTS = ['linux', 'debian', 'ubuntu', 'alpine', 'centos', 'fedora', 'arch', 'suse', 'proxmox'];

function toSegment(value, fallback = 'host') {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || fallback;
}

export function normalizeSshUser(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return normalized.replace(/\s+/g, '');
}

export function normalizeSshHostDefaults(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    const normalized = {};
    Object.entries(value).forEach(([rawKey, rawVal]) => {
        const key = String(rawKey || '').trim();
        const val = String(rawVal || '').trim();
        if (!key || !val) return;
        normalized[key] = val;
    });
    return normalized;
}

export function parseSshHostDefaultsText(text) {
    const defaults = {};
    const lines = String(text || '').split(/\r?\n/);
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        if (trimmed.includes('=')) {
            throw new Error(`Invalid SSH defaults format on line ${index + 1}. Use OpenSSH syntax like "Port 22".`);
        }
        const match = trimmed.match(/^(\S+)\s+(.+)$/);
        if (!match) {
            throw new Error(`Invalid SSH defaults format on line ${index + 1}. Use OpenSSH syntax like "Port 22".`);
        }
        const key = match[1].trim();
        const value = match[2].trim();
        if (!key || !value) {
            throw new Error(`Invalid SSH defaults format on line ${index + 1}. Use OpenSSH syntax like "Port 22".`);
        }
        defaults[key] = value;
    });
    return defaults;
}

export function stringifySshHostDefaults(defaults) {
    const normalized = normalizeSshHostDefaults(defaults);
    return Object.entries(normalized)
        .map(([key, value]) => `${key} ${value}`)
        .join('\n');
}

export function normalizeSshUserOverrides(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    const normalized = {};
    Object.entries(value).forEach(([alias, user]) => {
        const aliasKey = String(alias || '').trim();
        const username = normalizeSshUser(user);
        if (!aliasKey || !username) return;
        normalized[aliasKey] = username;
    });
    return normalized;
}

export function parseSshUserOverridesText(text) {
    const overrides = {};
    const lines = String(text || '').split(/\r?\n/);
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const separatorIndex = trimmed.includes(':') ? trimmed.indexOf(':') : trimmed.indexOf('=');
        if (separatorIndex <= 0) {
            throw new Error(`Invalid SSH override format on line ${index + 1}. Use "alias: username".`);
        }
        const alias = trimmed.slice(0, separatorIndex).trim();
        const username = normalizeSshUser(trimmed.slice(separatorIndex + 1));
        if (!alias || !username) {
            throw new Error(`Invalid SSH override format on line ${index + 1}. Use "alias: username".`);
        }
        overrides[alias] = username;
    });
    return overrides;
}

export function stringifySshUserOverrides(overrides) {
    const normalized = normalizeSshUserOverrides(overrides);
    return Object.entries(normalized)
        .sort(([aliasA], [aliasB]) => aliasA.localeCompare(aliasB))
        .map(([alias, user]) => `${alias}: ${user}`)
        .join('\n');
}

export function isLinuxResource(resourceType, osText) {
    if (resourceType === 'node' || resourceType === 'lxc') return true;
    const os = String(osText || '').toLowerCase();
    return LINUX_HINTS.some((hint) => os.includes(hint)) || os.startsWith('l');
}

export function buildSshAlias(cluster, resource) {
    const listName = resource.type === 'node'
        ? (resource.node || resource.name || 'node')
        : (resource.name || resource.node || String(resource.vmid || 'host'));
    return toSegment(listName, 'host');
}

export function dedupeAliases(targets) {
    const groupedByAlias = new Map();
    (Array.isArray(targets) ? targets : []).forEach((target) => {
        const key = target.alias;
        const list = groupedByAlias.get(key) || [];
        list.push(target);
        groupedByAlias.set(key, list);
    });

    const withClusterSuffixOnCollision = [];
    groupedByAlias.forEach((list, alias) => {
        if (list.length === 1) {
            withClusterSuffixOnCollision.push(list[0]);
            return;
        }
        list.forEach((target) => {
            const clusterSuffix = toSegment(target.clusterName || target.clusterId, 'cluster');
            withClusterSuffixOnCollision.push({
                ...target,
                alias: `${alias}-${clusterSuffix}`
            });
        });
    });

    // Final safety dedupe if same alias still collides (e.g. same cluster names).
    const seen = new Map();
    return withClusterSuffixOnCollision.map((target) => {
        const count = (seen.get(target.alias) || 0) + 1;
        seen.set(target.alias, count);
        if (count === 1) return target;
        return { ...target, alias: `${target.alias}-${count}` };
    });
}

export async function collectSshExportTargets(clusters, createApiClient) {
    const clusterList = Object.values(clusters || {})
        .filter((cluster) => cluster?.isEnabled !== false)
        .filter((cluster) => cluster?.proxmoxUrl && cluster?.apiToken);
    const targets = [];
    const errors = [];

    for (const cluster of clusterList) {
        const api = createApiClient(cluster);
        if (!api) continue;
        try {
            const resources = await api.getResources();
            const candidates = (Array.isArray(resources) ? resources : [])
                .filter((resource) => resource && ['node', 'qemu', 'lxc'].includes(resource.type));
            for (const resource of candidates) {
                const details = await api.getResourceDetails({ ...resource });
                if (!details?.ip) continue;
                if (!isLinuxResource(resource.type, details.os)) continue;
                targets.push({
                    alias: buildSshAlias(cluster, resource),
                    ip: details.ip,
                    clusterId: cluster.id,
                    clusterName: cluster.name || cluster.id || 'Cluster',
                    type: resource.type,
                    node: resource.node || '',
                    vmid: resource.vmid || null,
                    name: resource.name || resource.node || String(resource.vmid || '')
                });
            }
        } catch (error) {
            errors.push({
                clusterId: cluster.id,
                clusterName: cluster.name || cluster.id || 'Cluster',
                message: error?.message || 'Unknown error'
            });
        }
    }

    const deduped = dedupeAliases(targets)
        .sort((a, b) => a.alias.localeCompare(b.alias));
    return { targets: deduped, errors };
}

export function buildSshConfigText(targets, options = {}) {
    const defaultUser = normalizeSshUser(options.defaultUser);
    const userOverrides = normalizeSshUserOverrides(options.userOverrides);
    const hostDefaults = normalizeSshHostDefaults(options.hostDefaults);
    const hostDefaultEntries = Object.entries(hostDefaults);
    const lines = [
        '# Generated by PROXMUX Manager',
        '# Add this content to ~/.ssh/config',
        ''
    ];

    if (defaultUser || hostDefaultEntries.length > 0) {
        lines.push('Host *');
        if (defaultUser) {
            lines.push(`  User ${defaultUser}`);
        }
        hostDefaultEntries.forEach(([key, value]) => {
            lines.push(`  ${key} ${value}`);
        });
        lines.push('');
    }

    (Array.isArray(targets) ? targets : []).forEach((target) => {
        const selectedUser = userOverrides[target.alias] || '';
        lines.push(`Host ${target.alias}`);
        lines.push(`  HostName ${target.ip}`);
        if (selectedUser && selectedUser !== defaultUser) {
            lines.push(`  User ${selectedUser}`);
        }
        lines.push('');
    });

    return lines.join('\n').trimEnd() + '\n';
}

export function buildSshConfigFilename() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `proxmux-ssh-config-${timestamp}.txt`;
}
