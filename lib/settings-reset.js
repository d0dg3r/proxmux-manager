import { createClusterSkeleton, saveClustersState } from './cluster-store.js';
import { UI_SCALE_DEFAULT } from './ui-scale.js';

export const FACTORY_DEFAULT_DISPLAY_SETTINGS = {
    uptime: true,
    ip: true,
    os: true,
    vmid: true,
    tags: true
};

export const FACTORY_DEFAULT_GLOBAL_SETTINGS = {
    theme: 'auto',
    uiScale: UI_SCALE_DEFAULT,
    consoleTabMode: 'duplicate',
    communityScriptsCacheTtlHours: 12,
    defaultScriptNode: '',
    sshDefaultUser: '',
    sshDefaultKeyPath: '',
    sshSelectedDefaultKeyId: '',
    sshKeyCatalog: [],
    sshUserOverrides: {},
    sshHostOverrides: {},
    sshHostDefaults: {
        ServerAliveInterval: '30',
        ServerAliveCountMax: '3'
    },
    defaultActionClickMode: 'sidepanel',
    scriptsPanelCollapsed: true,
    displaySettings: FACTORY_DEFAULT_DISPLAY_SETTINGS,
    expandDetailsByDefault: false,
    favoriteResourceIds: []
};

export async function resetToFactoryDefaults() {
    const defaultCluster = createClusterSkeleton({}, 'Cluster');
    const nextClusters = { [defaultCluster.id]: defaultCluster };
    const persistedClusters = await saveClustersState(nextClusters, defaultCluster.id);
    const activeClusterId = persistedClusters.activeClusterId;
    const activeClusterTabId = activeClusterId;

    const storagePayload = {
        activeClusterId,
        activeClusterTabId,
        proxmoxUrl: '',
        apiUser: defaultCluster.apiUser,
        apiTokenId: defaultCluster.apiTokenId,
        apiSecret: '',
        apiToken: '',
        failoverUrls: [],
        theme: FACTORY_DEFAULT_GLOBAL_SETTINGS.theme,
        uiScale: FACTORY_DEFAULT_GLOBAL_SETTINGS.uiScale,
        displaySettings: { ...FACTORY_DEFAULT_DISPLAY_SETTINGS },
        consoleTabMode: FACTORY_DEFAULT_GLOBAL_SETTINGS.consoleTabMode,
        communityScriptsCacheTtlHours: FACTORY_DEFAULT_GLOBAL_SETTINGS.communityScriptsCacheTtlHours,
        defaultScriptNode: FACTORY_DEFAULT_GLOBAL_SETTINGS.defaultScriptNode,
        sshDefaultUser: FACTORY_DEFAULT_GLOBAL_SETTINGS.sshDefaultUser,
        sshDefaultKeyPath: FACTORY_DEFAULT_GLOBAL_SETTINGS.sshDefaultKeyPath,
        sshSelectedDefaultKeyId: FACTORY_DEFAULT_GLOBAL_SETTINGS.sshSelectedDefaultKeyId,
        sshKeyCatalog: [...FACTORY_DEFAULT_GLOBAL_SETTINGS.sshKeyCatalog],
        sshUserOverrides: { ...FACTORY_DEFAULT_GLOBAL_SETTINGS.sshUserOverrides },
        sshHostOverrides: { ...FACTORY_DEFAULT_GLOBAL_SETTINGS.sshHostOverrides },
        sshHostDefaults: { ...FACTORY_DEFAULT_GLOBAL_SETTINGS.sshHostDefaults },
        defaultActionClickMode: FACTORY_DEFAULT_GLOBAL_SETTINGS.defaultActionClickMode,
        scriptsPanelCollapsed: FACTORY_DEFAULT_GLOBAL_SETTINGS.scriptsPanelCollapsed,
        expandDetailsByDefault: FACTORY_DEFAULT_GLOBAL_SETTINGS.expandDetailsByDefault,
        favoriteResourceIds: [...FACTORY_DEFAULT_GLOBAL_SETTINGS.favoriteResourceIds]
    };

    await chrome.storage.local.set(storagePayload);
    await chrome.storage.local.remove(['lastBrowserWindowId']);

    return {
        clusters: persistedClusters.clusters,
        activeClusterId,
        activeClusterTabId,
        cluster: defaultCluster,
        storagePayload
    };
}
