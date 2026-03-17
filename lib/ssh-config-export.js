const LINUX_HINTS = ['linux', 'debian', 'ubuntu', 'alpine', 'centos', 'fedora', 'arch', 'suse', 'proxmox'];
const SSH_EXPORT_FORMATS = {
    OPENSSH: 'openssh',
    PUTTY: 'putty',
    CSV: 'csv'
};

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

export function normalizeSshKeyPath(value) {
    return String(value || '').trim();
}

function buildSshKeyId(seed, fallbackIndex = 0) {
    const normalized = String(seed || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized ? `key-${normalized}` : `key-generated-${fallbackIndex}`;
}

export function normalizeSshKeyCatalog(value) {
    if (!Array.isArray(value)) return [];
    const byPath = new Map();
    value.forEach((entry, index) => {
        if (!entry || typeof entry !== 'object') return;
        const path = normalizeSshKeyPath(entry.path);
        if (!path) return;
        const label = String(entry.label || path).trim() || path;
        const source = String(entry.source || 'manual').trim() || 'manual';
        const id = String(entry.id || buildSshKeyId(`${label}-${path}`, index)).trim();
        if (!id) return;
        if (!byPath.has(path)) {
            byPath.set(path, { id, label, path, source });
        } else {
            const existing = byPath.get(path);
            // Prefer manual label when both sources provide same path.
            if (existing.source !== 'manual' && source === 'manual') {
                byPath.set(path, { id, label, path, source });
            }
        }
    });
    const usedIds = new Set();
    return Array.from(byPath.values()).map((entry, index) => {
        let id = entry.id || buildSshKeyId(entry.path, index);
        while (usedIds.has(id)) {
            id = `${id}-${index + 1}`;
        }
        usedIds.add(id);
        return { ...entry, id };
    });
}

export function detectCommonSshKeys() {
    const home = '~/.ssh';
    const defaults = [
        { label: 'Auto: id_ed25519', path: `${home}/id_ed25519`, source: 'detected' },
        { label: 'Auto: id_rsa', path: `${home}/id_rsa`, source: 'detected' },
        { label: 'Auto: id_ecdsa', path: `${home}/id_ecdsa`, source: 'detected' },
        { label: 'Auto: id_ed25519_sk', path: `${home}/id_ed25519_sk`, source: 'detected' },
        { label: 'Auto: id_rsa_sk', path: `${home}/id_rsa_sk`, source: 'detected' }
    ];
    return normalizeSshKeyCatalog(defaults);
}

export function buildMergedSshKeyCatalog(manualCatalog = [], extraPaths = []) {
    const detected = detectCommonSshKeys();
    const manual = normalizeSshKeyCatalog(manualCatalog).map((entry) => ({ ...entry, source: 'manual' }));
    const migrated = normalizeSshKeyCatalog(
        (Array.isArray(extraPaths) ? extraPaths : [])
            .map((path, index) => {
                const normalizedPath = normalizeSshKeyPath(path);
                if (!normalizedPath) return null;
                const basename = normalizedPath.split('/').pop() || normalizedPath;
                return {
                    id: buildSshKeyId(`migrated-${basename}-${index}`, index),
                    label: `Imported: ${basename}`,
                    path: normalizedPath,
                    source: 'migrated'
                };
            })
            .filter(Boolean)
    );
    return normalizeSshKeyCatalog([...detected, ...manual, ...migrated]);
}

export function findSshKeyById(catalog, keyId) {
    const normalizedId = String(keyId || '').trim();
    if (!normalizedId) return null;
    const keys = normalizeSshKeyCatalog(catalog);
    return keys.find((entry) => entry.id === normalizedId) || null;
}

export function findSshKeyIdByPath(catalog, keyPath) {
    const normalizedPath = normalizeSshKeyPath(keyPath);
    if (!normalizedPath) return '';
    const keys = normalizeSshKeyCatalog(catalog);
    const match = keys.find((entry) => normalizeSshKeyPath(entry.path) === normalizedPath);
    return match?.id || '';
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

export function normalizeSshHostOverrides(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    const normalized = {};
    Object.entries(value).forEach(([alias, rawOverride]) => {
        const aliasKey = String(alias || '').trim();
        if (!aliasKey) return;
        let user = '';
        let keyPath = '';
        let keyId = '';
        if (rawOverride && typeof rawOverride === 'object' && !Array.isArray(rawOverride)) {
            user = normalizeSshUser(rawOverride.user);
            keyPath = normalizeSshKeyPath(rawOverride.keyPath || rawOverride.identityFile);
            keyId = String(rawOverride.keyId || '').trim();
        } else {
            // Backward compatibility with legacy alias -> user map.
            user = normalizeSshUser(rawOverride);
        }
        if (!user && !keyPath && !keyId) return;
        const next = {};
        if (user) next.user = user;
        if (keyId) next.keyId = keyId;
        if (keyPath) next.keyPath = keyPath;
        normalized[aliasKey] = next;
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
    const context = buildResolvedSshExportContext(options);
    const lines = [
        '# Generated by PROXMUX Manager',
        '# Add this content to ~/.ssh/config',
        ''
    ];

    if (context.defaultUser || context.hostDefaultEntries.length > 0 || context.shouldWriteGlobalKeyPath) {
        lines.push('Host *');
        if (context.defaultUser) {
            lines.push(`  User ${context.defaultUser}`);
        }
        context.hostDefaultEntries.forEach(([key, value]) => {
            lines.push(`  ${key} ${value}`);
        });
        if (context.shouldWriteGlobalKeyPath) {
            lines.push(`  IdentityFile ${context.defaultKeyPath}`);
        }
        lines.push('');
    }

    (Array.isArray(targets) ? targets : []).forEach((target) => {
        const selectedUser = resolveSelectedUser(target, context);
        const selectedKeyPath = resolveSelectedKeyPath(target, context);
        lines.push(`Host ${target.alias}`);
        lines.push(`  HostName ${target.ip}`);
        if (selectedUser && selectedUser !== context.defaultUser) {
            lines.push(`  User ${selectedUser}`);
        }
        if (selectedKeyPath) {
            if (context.hasIdentityFileDefault || !context.shouldWriteGlobalKeyPath || selectedKeyPath !== context.defaultKeyPath) {
                lines.push(`  IdentityFile ${selectedKeyPath}`);
            }
        }
        lines.push('');
    });

    return lines.join('\n').trimEnd() + '\n';
}

function buildResolvedSshExportContext(options = {}) {
    const hostOverridesInput = normalizeSshHostOverrides(options.hostOverrides);
    const selectedDefaultKeyId = String(options.selectedDefaultKeyId || '').trim();
    const extraPaths = [];
    if (options.defaultKeyPath) extraPaths.push(options.defaultKeyPath);
    Object.values(hostOverridesInput).forEach((override) => {
        if (override?.keyPath) extraPaths.push(override.keyPath);
    });
    const keyCatalog = buildMergedSshKeyCatalog(options.keyCatalog || [], extraPaths);
    const selectedDefaultKeyEntry = findSshKeyById(keyCatalog, selectedDefaultKeyId);
    const defaultUser = normalizeSshUser(options.defaultUser);
    const defaultKeyPath = normalizeSshKeyPath(selectedDefaultKeyEntry?.path || options.defaultKeyPath);
    const userOverrides = normalizeSshUserOverrides(options.userOverrides);
    const hostOverrides = Object.fromEntries(
        Object.entries(hostOverridesInput).map(([alias, override]) => {
            const resolved = { ...(override || {}) };
            const keyIdEntry = findSshKeyById(keyCatalog, override?.keyId);
            if (keyIdEntry?.path) {
                resolved.keyPath = keyIdEntry.path;
            }
            return [alias, resolved];
        })
    );
    const hostDefaults = normalizeSshHostDefaults(options.hostDefaults);
    const hostDefaultEntries = Object.entries(hostDefaults);
    const hasIdentityFileDefault = hostDefaultEntries.some(([key]) => key.toLowerCase() === 'identityfile');
    const shouldWriteGlobalKeyPath = !hasIdentityFileDefault && Boolean(defaultKeyPath);
    return {
        defaultUser,
        defaultKeyPath,
        userOverrides,
        hostOverrides,
        hostDefaults,
        hostDefaultEntries,
        hasIdentityFileDefault,
        shouldWriteGlobalKeyPath
    };
}

function resolveSelectedUser(target, context, includeDefault = false) {
    const hostOverride = context.hostOverrides[target.alias] || {};
    const selected = hostOverride.user || context.userOverrides[target.alias] || '';
    if (selected) return selected;
    return includeDefault ? context.defaultUser : '';
}

function resolveSelectedKeyPath(target, context, includeDefault = false) {
    const hostOverride = context.hostOverrides[target.alias] || {};
    const selectedOverridePath = normalizeSshKeyPath(hostOverride.keyPath);
    if (selectedOverridePath) return selectedOverridePath;
    return includeDefault ? normalizeSshKeyPath(context.defaultKeyPath) : '';
}

function findPortFromHostDefaults(hostDefaults) {
    const entries = Object.entries(hostDefaults || {});
    const portEntry = entries.find(([key]) => String(key).toLowerCase() === 'port');
    if (!portEntry) return 22;
    const parsed = Number.parseInt(String(portEntry[1] || '').trim(), 10);
    if (!Number.isFinite(parsed)) return 22;
    if (parsed < 1 || parsed > 65535) return 22;
    return parsed;
}

function toRegistryDword(value) {
    return Number(value).toString(16).padStart(8, '0');
}

function escapeRegString(value) {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
}

function escapeCsvValue(value) {
    const raw = String(value ?? '');
    if (/[",\r\n]/.test(raw)) {
        return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
}

function normalizeTargetsForExport(targets) {
    return (Array.isArray(targets) ? targets : [])
        .filter((target) => target?.alias && target?.ip)
        .slice()
        .sort((a, b) => String(a.alias || '').localeCompare(String(b.alias || '')));
}

export function buildPuttyRegText(targets, options = {}) {
    const context = buildResolvedSshExportContext(options);
    const port = findPortFromHostDefaults(context.hostDefaults);
    const lines = [
        'Windows Registry Editor Version 5.00',
        ''
    ];
    normalizeTargetsForExport(targets).forEach((target) => {
        const selectedUser = resolveSelectedUser(target, context, true);
        const selectedKeyPath = resolveSelectedKeyPath(target, context, true);
        lines.push(`[HKEY_CURRENT_USER\\Software\\SimonTatham\\PuTTY\\Sessions\\${target.alias}]`);
        lines.push(`"HostName"="${escapeRegString(target.ip)}"`);
        lines.push('"Protocol"="ssh"');
        lines.push(`"PortNumber"=dword:${toRegistryDword(port)}`);
        if (selectedUser) {
            lines.push(`"UserName"="${escapeRegString(selectedUser)}"`);
        }
        if (selectedKeyPath) {
            lines.push(`"PublicKeyFile"="${escapeRegString(selectedKeyPath)}"`);
        }
        lines.push('');
    });
    return lines.join('\r\n').trimEnd() + '\r\n';
}

export function buildSshCsvText(targets, options = {}) {
    const context = buildResolvedSshExportContext(options);
    const headers = ['alias', 'hostName', 'user', 'identityFile', 'type', 'node', 'vmid', 'clusterName', 'clusterId'];
    const rows = [headers.join(',')];
    normalizeTargetsForExport(targets).forEach((target) => {
        const selectedUser = resolveSelectedUser(target, context, true);
        const selectedKeyPath = resolveSelectedKeyPath(target, context, true);
        const fields = [
            target.alias,
            target.ip,
            selectedUser,
            selectedKeyPath,
            target.type || '',
            target.node || '',
            target.vmid ?? '',
            target.clusterName || '',
            target.clusterId || ''
        ];
        rows.push(fields.map(escapeCsvValue).join(','));
    });
    return rows.join('\n').trimEnd() + '\n';
}

export function normalizeSshExportFormat(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (Object.values(SSH_EXPORT_FORMATS).includes(normalized)) {
        return normalized;
    }
    return SSH_EXPORT_FORMATS.OPENSSH;
}

export function buildSshExportText(targets, format, options = {}) {
    const normalizedFormat = normalizeSshExportFormat(format);
    if (normalizedFormat === SSH_EXPORT_FORMATS.PUTTY) {
        return buildPuttyRegText(targets, options);
    }
    if (normalizedFormat === SSH_EXPORT_FORMATS.CSV) {
        return buildSshCsvText(targets, options);
    }
    return buildSshConfigText(targets, options);
}

export function buildSshExportFilename(format = SSH_EXPORT_FORMATS.OPENSSH) {
    const normalizedFormat = normalizeSshExportFormat(format);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (normalizedFormat === SSH_EXPORT_FORMATS.PUTTY) {
        return `proxmux-ssh-putty-${timestamp}.reg`;
    }
    if (normalizedFormat === SSH_EXPORT_FORMATS.CSV) {
        return `proxmux-ssh-hosts-${timestamp}.csv`;
    }
    return `proxmux-ssh-config-${timestamp}.txt`;
}

export function buildSshConfigFilename() {
    return buildSshExportFilename(SSH_EXPORT_FORMATS.OPENSSH);
}
