import { getClustersState } from './cluster-store.js';
import { decryptSettingsPayload, encryptSettingsPayload } from './settings-crypto.js';

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
    'displaySettings',
    'consoleTabMode',
    'communityScriptsCacheTtlHours',
    'defaultScriptNode',
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
    const keysToRemove = BACKUP_STORAGE_KEYS.filter(
        (key) => !Object.prototype.hasOwnProperty.call(importedSettings, key)
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
