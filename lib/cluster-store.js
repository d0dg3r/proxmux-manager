const CLUSTERS_KEY = 'clusters';
const ACTIVE_CLUSTER_ID_KEY = 'activeClusterId';
const LEGACY_KEYS = [
    'proxmoxUrl',
    'apiUser',
    'apiTokenId',
    'apiSecret',
    'apiToken',
    'failoverUrls'
];

export const ALL_CLUSTERS_TAB_ID = '__all__';

function deriveClusterNameFromUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname || 'Cluster';
    } catch (_error) {
        return 'Cluster';
    }
}

function buildClusterId(name, used = new Set()) {
    const base = (name || 'cluster').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cluster';
    if (!used.has(base)) {
        used.add(base);
        return base;
    }
    let idx = 2;
    while (used.has(`${base}-${idx}`)) idx += 1;
    const id = `${base}-${idx}`;
    used.add(id);
    return id;
}

function normalizeCluster(cluster, id) {
    const normalizedId = cluster?.id || id;
    const proxmoxUrl = (cluster?.proxmoxUrl || '').trim();
    const apiUser = (cluster?.apiUser || '').trim();
    const apiTokenId = (cluster?.apiTokenId || '').trim();
    const apiSecret = (cluster?.apiSecret || '').trim();
    const apiToken = (cluster?.apiToken || (apiUser && apiTokenId && apiSecret ? `${apiUser}!${apiTokenId}=${apiSecret}` : '')).trim();
    return {
        id: normalizedId,
        name: (cluster?.name || deriveClusterNameFromUrl(proxmoxUrl) || 'Cluster').trim(),
        proxmoxUrl,
        apiUser,
        apiTokenId,
        apiSecret,
        apiToken,
        failoverUrls: Array.isArray(cluster?.failoverUrls) ? cluster.failoverUrls : [],
        isEnabled: cluster?.isEnabled !== false
    };
}

function normalizeClustersMap(clusters) {
    const result = {};
    Object.entries(clusters || {}).forEach(([id, cluster]) => {
        const normalized = normalizeCluster(cluster, id);
        result[normalized.id] = normalized;
    });
    return result;
}

export async function migrateLegacyClustersIfNeeded() {
    const state = await chrome.storage.local.get([CLUSTERS_KEY, ACTIVE_CLUSTER_ID_KEY, ...LEGACY_KEYS]);
    const existingClusters = normalizeClustersMap(state[CLUSTERS_KEY] || {});
    if (Object.keys(existingClusters).length > 0) {
        const activeClusterId = state[ACTIVE_CLUSTER_ID_KEY] && existingClusters[state[ACTIVE_CLUSTER_ID_KEY]]
            ? state[ACTIVE_CLUSTER_ID_KEY]
            : Object.keys(existingClusters)[0];
        if (state[ACTIVE_CLUSTER_ID_KEY] !== activeClusterId) {
            await chrome.storage.local.set({ [ACTIVE_CLUSTER_ID_KEY]: activeClusterId });
        }
        return { clusters: existingClusters, activeClusterId };
    }

    if (!state.proxmoxUrl || !state.apiToken) {
        return { clusters: {}, activeClusterId: null };
    }

    const baseName = deriveClusterNameFromUrl(state.proxmoxUrl);
    const used = new Set();
    const id = buildClusterId(baseName, used);
    const migratedCluster = normalizeCluster({
        id,
        name: baseName,
        proxmoxUrl: state.proxmoxUrl,
        apiUser: state.apiUser || '',
        apiTokenId: state.apiTokenId || '',
        apiSecret: state.apiSecret || '',
        apiToken: state.apiToken || '',
        failoverUrls: Array.isArray(state.failoverUrls) ? state.failoverUrls : [],
        isEnabled: true
    }, id);

    await chrome.storage.local.set({
        [CLUSTERS_KEY]: { [id]: migratedCluster },
        [ACTIVE_CLUSTER_ID_KEY]: id
    });
    return { clusters: { [id]: migratedCluster }, activeClusterId: id };
}

export async function getClustersState() {
    const migrated = await migrateLegacyClustersIfNeeded();
    return migrated;
}

export async function saveClustersState(clusters, activeClusterId) {
    const normalized = normalizeClustersMap(clusters);
    const resolvedActive = resolveActiveClusterId(normalized, activeClusterId);
    await chrome.storage.local.set({
        [CLUSTERS_KEY]: normalized,
        [ACTIVE_CLUSTER_ID_KEY]: resolvedActive
    });
    return { clusters: normalized, activeClusterId: resolvedActive };
}

export function getClusterList(clusters) {
    return Object.values(normalizeClustersMap(clusters)).filter((cluster) => cluster.isEnabled !== false);
}

export function resolveActiveClusterId(clusters, preferredClusterId = null) {
    const normalized = normalizeClustersMap(clusters);
    const keys = Object.keys(normalized);
    if (!keys.length) return null;
    if (preferredClusterId && normalized[preferredClusterId]) {
        return preferredClusterId;
    }
    return keys[0];
}

export function buildClusterPayload(clusterInput, existingClusters = {}, fallbackName = 'Cluster') {
    const existingIdSet = new Set(Object.keys(existingClusters || {}));
    const requestedName = (clusterInput?.name || fallbackName || 'Cluster').trim();
    const clusterId = clusterInput?.id && !existingIdSet.has(clusterInput.id)
        ? clusterInput.id
        : (clusterInput?.id || buildClusterId(requestedName, existingIdSet));
    return normalizeCluster({
        ...clusterInput,
        id: clusterId,
        name: requestedName
    }, clusterId);
}

export function removeClusterAndResolve(clusters, clusterId, activeClusterId, { ensureOneCluster = false } = {}) {
    const normalized = normalizeClustersMap(clusters);
    const next = { ...normalized };
    if (clusterId && next[clusterId]) {
        delete next[clusterId];
    }
    let resolvedActive = resolveActiveClusterId(next, activeClusterId === clusterId ? null : activeClusterId);
    if (!resolvedActive && ensureOneCluster) {
        const fallback = createClusterSkeleton(next, 'Cluster');
        next[fallback.id] = fallback;
        resolvedActive = fallback.id;
    }
    return { clusters: next, activeClusterId: resolvedActive };
}

export function createClusterSkeleton(existingClusters, baseName = 'Cluster') {
    const used = new Set(Object.keys(existingClusters || {}));
    const id = buildClusterId(baseName, used);
    return normalizeCluster({
        id,
        name: baseName,
        proxmoxUrl: '',
        apiUser: 'api-admin@pve',
        apiTokenId: 'full-access',
        apiSecret: '',
        apiToken: '',
        failoverUrls: [],
        isEnabled: true
    }, id);
}
