import { createClusterSkeleton, saveClustersState } from './cluster-store.js';

export const FACTORY_DEFAULT_DISPLAY_SETTINGS = {
    uptime: true,
    ip: true,
    os: true,
    vmid: true,
    tags: true
};

export const FACTORY_DEFAULT_GLOBAL_SETTINGS = {
    theme: 'auto',
    consoleTabMode: 'duplicate',
    communityScriptsCacheTtlHours: 12,
    defaultScriptNode: '',
    defaultActionClickMode: 'sidepanel',
    scriptsPanelCollapsed: true,
    displaySettings: FACTORY_DEFAULT_DISPLAY_SETTINGS
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
        displaySettings: { ...FACTORY_DEFAULT_DISPLAY_SETTINGS },
        consoleTabMode: FACTORY_DEFAULT_GLOBAL_SETTINGS.consoleTabMode,
        communityScriptsCacheTtlHours: FACTORY_DEFAULT_GLOBAL_SETTINGS.communityScriptsCacheTtlHours,
        defaultScriptNode: FACTORY_DEFAULT_GLOBAL_SETTINGS.defaultScriptNode,
        defaultActionClickMode: FACTORY_DEFAULT_GLOBAL_SETTINGS.defaultActionClickMode,
        scriptsPanelCollapsed: FACTORY_DEFAULT_GLOBAL_SETTINGS.scriptsPanelCollapsed
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
