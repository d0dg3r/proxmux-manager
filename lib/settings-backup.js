import { getClustersState } from './cluster-store.js';
import { decryptSettingsPayload, encryptSettingsPayload } from './settings-crypto.js';
import { normalizeUiScale, UI_SCALE_DEFAULT } from './ui-scale.js';

export const BACKUP_STORAGE_KEYS = [
    'clusters',
    'activeClusterId',
    'activeClusterTabId',
    'proxmoxUrl',
    'apiUser',
    'apiTokenId',
    'apiSecret',
    'apiToken',
    'failoverUrls',
    'theme',
    'uiScale',
    'displaySettings',
    'consoleTabMode',
    'communityScriptsCacheTtlHours',
    'defaultScriptNode',
    'sshDefaultUser',
    'sshDefaultKeyPath',
    'sshSelectedDefaultKeyId',
    'sshKeyCatalog',
    'sshUserOverrides',
    'sshHostOverrides',
    'sshHostDefaults',
    'defaultActionClickMode',
    'scriptsPanelCollapsed',
    'expandDetailsByDefault',
    'favoriteResourceIds',
    'lastBrowserWindowId'
];

function normalizeFavoriteResourceIds(value) {
    if (!Array.isArray(value)) return [];
    const unique = new Set();
    value.forEach((item) => {
        if (typeof item !== 'string') return;
        const trimmed = item.trim();
        if (!trimmed) return;
        unique.add(trimmed);
    });
    return Array.from(unique);
}

export function filterFavoriteIdsByExistingResources(favoriteIds, existingResourceIds) {
    const existing = new Set(Array.isArray(existingResourceIds) ? existingResourceIds : []);
    return normalizeFavoriteResourceIds(favoriteIds).filter((favoriteId) => existing.has(favoriteId));
}

function buildDefaultBackupFilename() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `proxmux-settings-${timestamp}.secure.json`;
}

function validateSettingsPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Backup does not contain settings payload.');
    }
}

export async function createEncryptedSettingsBackup(password, confirmPassword) {
    if (!(password || '').trim()) {
        throw new Error('Please enter an export password.');
    }
    if (password !== confirmPassword) {
        throw new Error('Export passwords do not match.');
    }

    const currentSettings = await chrome.storage.local.get(BACKUP_STORAGE_KEYS);
    const encrypted = await encryptSettingsPayload({ settings: currentSettings }, password);
    return {
        encrypted,
        filename: buildDefaultBackupFilename()
    };
}

export async function downloadEncryptedBackupFile(encrypted, filename) {
    const blob = new Blob([JSON.stringify(encrypted, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    try {
        await new Promise((resolve, reject) => {
            chrome.downloads.download(
                { url, filename, saveAs: true, conflictAction: 'uniquify' },
                (downloadId) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (!downloadId) {
                        reject(new Error('Download failed.'));
                        return;
                    }
                    resolve(downloadId);
                }
            );
        });
    } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
}

export async function importEncryptedSettingsFromText(rawText, password) {
    if (!(password || '').trim()) {
        throw new Error('Please enter the import password.');
    }
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    } catch (_error) {
        throw new Error('Backup file is not valid JSON.');
    }

    const decrypted = await decryptSettingsPayload(parsed, password);
    const importedSettings = decrypted?.settings;
    validateSettingsPayload(importedSettings);

    const setPayload = {};
    BACKUP_STORAGE_KEYS.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(importedSettings, key)) {
            setPayload[key] = importedSettings[key];
        }
    });
    if (Object.prototype.hasOwnProperty.call(setPayload, 'favoriteResourceIds')) {
        setPayload.favoriteResourceIds = normalizeFavoriteResourceIds(setPayload.favoriteResourceIds);
    }
    if (Object.prototype.hasOwnProperty.call(setPayload, 'expandDetailsByDefault')) {
        setPayload.expandDetailsByDefault = Boolean(setPayload.expandDetailsByDefault);
    }
    if (Object.prototype.hasOwnProperty.call(setPayload, 'uiScale')) {
        setPayload.uiScale = normalizeUiScale(setPayload.uiScale, UI_SCALE_DEFAULT);
    }
    if (Object.prototype.hasOwnProperty.call(setPayload, 'sshDefaultUser')) {
        setPayload.sshDefaultUser = String(setPayload.sshDefaultUser || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(setPayload, 'sshDefaultKeyPath')) {
        setPayload.sshDefaultKeyPath = String(setPayload.sshDefaultKeyPath || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(setPayload, 'sshSelectedDefaultKeyId')) {
        setPayload.sshSelectedDefaultKeyId = String(setPayload.sshSelectedDefaultKeyId || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(setPayload, 'sshKeyCatalog')) {
        const rawCatalog = setPayload.sshKeyCatalog;
        const normalizedCatalog = [];
        if (Array.isArray(rawCatalog)) {
            rawCatalog.forEach((entry, index) => {
                if (!entry || typeof entry !== 'object') return;
                const id = String(entry.id || `key-imported-${index + 1}`).trim();
                const label = String(entry.label || '').trim();
                const path = String(entry.path || '').trim();
                if (!id || !path) return;
                normalizedCatalog.push({ id, label: label || path, path });
            });
        }
        setPayload.sshKeyCatalog = normalizedCatalog;
    }
    if (Object.prototype.hasOwnProperty.call(setPayload, 'sshUserOverrides')) {
        const rawOverrides = setPayload.sshUserOverrides;
        const normalizedOverrides = {};
        if (rawOverrides && typeof rawOverrides === 'object' && !Array.isArray(rawOverrides)) {
            Object.entries(rawOverrides).forEach(([alias, username]) => {
                const aliasKey = String(alias || '').trim();
                const user = String(username || '').trim();
                if (!aliasKey || !user) return;
                normalizedOverrides[aliasKey] = user;
            });
        }
        setPayload.sshUserOverrides = normalizedOverrides;
    }
    if (Object.prototype.hasOwnProperty.call(setPayload, 'sshHostOverrides')) {
        const rawOverrides = setPayload.sshHostOverrides;
        const normalizedOverrides = {};
        if (rawOverrides && typeof rawOverrides === 'object' && !Array.isArray(rawOverrides)) {
            Object.entries(rawOverrides).forEach(([alias, rawOverride]) => {
                const aliasKey = String(alias || '').trim();
                if (!aliasKey) return;
                let user = '';
                let keyPath = '';
                let keyId = '';
                if (rawOverride && typeof rawOverride === 'object' && !Array.isArray(rawOverride)) {
                    user = String(rawOverride.user || '').trim();
                    keyId = String(rawOverride.keyId || '').trim();
                    keyPath = String(rawOverride.keyPath || rawOverride.identityFile || '').trim();
                } else {
                    // Legacy compatibility alias -> username.
                    user = String(rawOverride || '').trim();
                }
                if (!user && !keyPath && !keyId) return;
                const next = {};
                if (user) next.user = user;
                if (keyId) next.keyId = keyId;
                if (keyPath) next.keyPath = keyPath;
                normalizedOverrides[aliasKey] = next;
            });
        }
        setPayload.sshHostOverrides = normalizedOverrides;
    }
    if (
        !Object.prototype.hasOwnProperty.call(setPayload, 'sshHostOverrides') &&
        Object.prototype.hasOwnProperty.call(setPayload, 'sshUserOverrides')
    ) {
        const migrated = {};
        Object.entries(setPayload.sshUserOverrides || {}).forEach(([alias, user]) => {
            const aliasKey = String(alias || '').trim();
            const username = String(user || '').trim();
            if (!aliasKey || !username) return;
            migrated[aliasKey] = { user: username };
        });
        setPayload.sshHostOverrides = migrated;
    }
    if (
        !Object.prototype.hasOwnProperty.call(setPayload, 'sshUserOverrides') &&
        Object.prototype.hasOwnProperty.call(setPayload, 'sshHostOverrides')
    ) {
        const migratedUsers = {};
        Object.entries(setPayload.sshHostOverrides || {}).forEach(([alias, override]) => {
            const username = String(override?.user || '').trim();
            if (!username) return;
            migratedUsers[alias] = username;
        });
        setPayload.sshUserOverrides = migratedUsers;
    }
    if (Object.prototype.hasOwnProperty.call(setPayload, 'sshHostDefaults')) {
        const rawDefaults = setPayload.sshHostDefaults;
        const normalizedDefaults = {};
        if (rawDefaults && typeof rawDefaults === 'object' && !Array.isArray(rawDefaults)) {
            Object.entries(rawDefaults).forEach(([key, value]) => {
                const normalizedKey = String(key || '').trim();
                const normalizedValue = String(value || '').trim();
                if (!normalizedKey || !normalizedValue) return;
                normalizedDefaults[normalizedKey] = normalizedValue;
            });
        }
        setPayload.sshHostDefaults = normalizedDefaults;
    }
    const keysToRemove = BACKUP_STORAGE_KEYS.filter(
        (key) => (
            !Object.prototype.hasOwnProperty.call(importedSettings, key) &&
            !Object.prototype.hasOwnProperty.call(setPayload, key)
        )
    );

    await chrome.storage.local.set(setPayload);
    if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
    }

    const clusterState = await getClustersState();
    const syncedActiveClusterId = clusterState.activeClusterId || null;
    const importedTabId = typeof importedSettings.activeClusterTabId === 'string'
        ? importedSettings.activeClusterTabId
        : syncedActiveClusterId;
    await chrome.storage.local.set({
        activeClusterId: syncedActiveClusterId,
        activeClusterTabId: importedTabId || syncedActiveClusterId
    });

    return { activeClusterId: syncedActiveClusterId };
}
