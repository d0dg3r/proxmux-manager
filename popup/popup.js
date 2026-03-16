import { ProxmoxAPI } from '../lib/proxmox-api.js';
import { getCommunityScriptsCatalog, getCommunityScriptDetails, getCommunityScriptGuide } from '../lib/community-scripts.js';
import { buildInstallCommandForScripts } from '../lib/install-command.js';
import {
    createEncryptedSettingsBackup,
    downloadEncryptedBackupFile,
    importEncryptedSettingsFromText
} from '../lib/settings-backup.js';
import { openOrFocusFloatingWindow } from '../lib/window-launcher.js';
import {
    ALL_CLUSTERS_TAB_ID,
    buildClusterPayload,
    createClusterSkeleton,
    getClusterList,
    getClustersState,
    removeClusterAndResolve,
    resolveActiveClusterId,
    saveClustersState
} from '../lib/cluster-store.js';
import { FACTORY_DEFAULT_DISPLAY_SETTINGS, resetToFactoryDefaults } from '../lib/settings-reset.js';

const LAST_BROWSER_WINDOW_ID_KEY = 'lastBrowserWindowId';

// Safely escape text for insertion into innerHTML to prevent XSS.
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', async () => {
    const resourceList = document.getElementById('resource-list');
    const loadingOverlay = document.getElementById('loading');
    const noAuthOverlay = document.getElementById('no-auth');
    const sidepanelBtn = document.getElementById('sidepanel-btn');
    const floatingBtn = document.getElementById('floating-btn');
    const closeWindowBtn = document.getElementById('close-window-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = document.getElementById('theme-icon');
    const openSettingsOverlayBtn = document.getElementById('open-settings-overlay');
    const openImportOverlayBtn = document.getElementById('open-import-overlay');
    const mainViewContent = document.getElementById('main-view-content');
    const inlineSettingsView = document.getElementById('inline-settings-view');
    const searchContainer = document.querySelector('.search-container');
    const clusterTabs = document.getElementById('cluster-tabs');
    const inlineProxmoxUrlInput = document.getElementById('inline-proxmox-url');
    const inlineClusterSelect = document.getElementById('inline-cluster-select');
    const inlineClusterNameInput = document.getElementById('inline-cluster-name');
    const inlineAddClusterBtn = document.getElementById('inline-add-cluster-btn');
    const inlineRemoveClusterBtn = document.getElementById('inline-remove-cluster-btn');
    const inlineApiUserInput = document.getElementById('inline-api-user');
    const inlineApiTokenIdInput = document.getElementById('inline-api-tokenid');
    const inlineApiSecretInput = document.getElementById('inline-api-secret');
    const inlineThemeSelect = document.getElementById('inline-theme-select');
    const inlineTabModeSelect = document.getElementById('inline-tab-mode-select');
    const inlineDefaultActionClickModeSelect = document.getElementById('inline-default-action-click-mode');
    const inlineToggleSecretBtn = document.getElementById('inline-toggle-secret');
    const inlineEyeIcon = document.getElementById('inline-eye-icon');
    const inlineSaveSettingsBtn = document.getElementById('inline-save-settings-btn');
    const inlineTestConnectionBtn = document.getElementById('inline-test-connection-btn');
    const inlineResetSettingsBtn = document.getElementById('inline-reset-settings-btn');
    const inlineExportPasswordInput = document.getElementById('inline-export-password');
    const inlineExportPasswordConfirmInput = document.getElementById('inline-export-password-confirm');
    const inlineExportSettingsBtn = document.getElementById('inline-export-settings-btn');
    const inlineImportFileInput = document.getElementById('inline-import-file');
    const inlineImportPasswordInput = document.getElementById('inline-import-password');
    const inlineImportSettingsBtn = document.getElementById('inline-import-settings-btn');
    const inlineBackupExportBlock = document.getElementById('inline-backup-export-block');
    const inlineSettingsSubtabButtons = document.querySelectorAll('[data-inline-settings-subtab]');
    const inlineSettingsSubtabPanels = document.querySelectorAll('[data-inline-settings-panel]');
    const inlineSettingsActions = document.querySelector('.inline-settings-actions');
    const inlineSettingsStatus = document.getElementById('inline-settings-status');
    const inlineAboutEasterEggBtn = document.getElementById('inline-about-easter-egg-btn');
    const inlineAboutLegacyWrap = document.getElementById('inline-about-legacy-wrap');
    const template = document.getElementById('resource-item-template');
    const currentView = new URLSearchParams(window.location.search).get('view') || 'none';
    let startupWindowType = 'unknown';
    let startupWindowId = null;
    try {
        const startupWindow = await chrome.windows.getCurrent();
        startupWindowType = startupWindow?.type || 'unknown';
        startupWindowId = startupWindow?.id ?? null;
    } catch (_error) {
        // Keep defaults for debug logging.
    }
    if (startupWindowType === 'popup' && closeWindowBtn) {
        closeWindowBtn.classList.remove('hidden');
    }
    closeWindowBtn?.addEventListener('click', () => {
        window.close();
    });

    // i18n Initialization
    function initI18n() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = chrome.i18n.getMessage(key);
            if (translation) el.textContent = translation;
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translation = chrome.i18n.getMessage(key);
            if (translation) el.title = translation;
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = chrome.i18n.getMessage(key);
            if (translation) el.placeholder = translation;
        });
    }

    initI18n();

    // Theme Management
    function applyTheme(theme) {
        document.body.classList.remove('light-theme', 'dark-theme');
        if (theme === 'light') {
            document.body.classList.add('light-theme');
            updateThemeIcon('light');
        } else if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            updateThemeIcon('dark');
        } else {
            // Auto: check system preference
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            updateThemeIcon(isDark ? 'dark' : 'light');
        }
    }

    function updateThemeIcon(theme) {
        if (!themeIcon) return;
        // Icon represents the TARGET theme (Action)
        if (theme === 'dark') {
            // In dark theme, show Sun to switch to light
            themeIcon.innerHTML = '<path fill="currentColor" d="M12,7c-2.76,0-5,2.24-5,5s2.24,5,5,5s5-2.24,5-5S14.76,7,12,7L12,7z M2,13l2,0c0.55,0,1-0.45,1-1s-0.45-1-1-1l-2,0 c-0.55,0-1,0.45-1,1S1.45,13,2,13z M20,13l2,0c0.55,0,1-0.45,1-1s-0.45-1-1-1l-2,0c-0.55,0-1,0.45-1,1S19.45,13,20,13z M11,2l0,2 c0,0.55,0.45,1,1,1s1-0.45,1-1l0-2c0-0.55-0.45-1-1-1S11,1.45,11,2z M11,20l0,2c0,0.55,0.45,1,1,1s1-0.45,1-1l0-2 c0-0.55-0.45-1-1-1S11,19.45,11,20z M5.99,4.58c-0.39-0.39-1.03-0.39-1.41,0c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06 c0.39,0.39,1.03,0.39,1.41,0s0.39-1.03,0-1.41L5.99,4.58z M18.36,16.95c-0.39-0.39-1.03-0.39-1.41,0c-0.39,0.39-0.39,1.03,0,1.41 l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0c0.39-0.39,0.39-1.03,0-1.41L18.36,16.95z M5.99,19.42c0.39,0.39,1.03,0.39,1.41,0 c0.39-0.39,0.39-1.03,0-1.41l-1.06-1.06c-0.39-0.39-1.03-0.39-1.41,0s-0.39,1.03,0,1.41L5.99,19.42z M18.36,7.05 c0.39,0.39,1.03,0.39,1.41,0c0.39-0.39,0.39-1.03,0-1.41l-1.06-1.06c-0.39-0.39-1.03-0.39-1.41,0s-0.39,1.03,0,1.41L18.36,7.05z"/>';
        } else {
            // In light theme, show Moon to switch to dark
            themeIcon.innerHTML = '<path fill="currentColor" d="M9,2c-1.05,0-2.05,0.16-3,0.46c4.06,1.27,7,5.06,7,9.54s-2.94,8.27-7,9.54C6.95,21.84,7.95,22,9,22c5.52,0,10-4.48,10-10S14.52,2,9,2z"/>';
        }
    }

    let allResources = [];
    let settings = {};
    let api = null;
    let clusters = {};
    let activeClusterId = null;
    let activeClusterTabId = ALL_CLUSTERS_TAB_ID;
    const apiClients = new Map();
    const resourcesByClusterId = new Map();
    const pendingStatusOverrides = new Map();
    const tagFiltersContainer = document.getElementById('tag-filters');
    const tagFiltersSection = tagFiltersContainer?.closest('.filter-section-tags');
    let activeFilters = {
        type: 'all', // 'all', 'node', 'qemu', 'lxc'
        status: 'all', // 'all', 'running', 'stopped'
        tag: null // 'null' or string
    };
    const searchInput = document.getElementById('search-input');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const filterPills = document.querySelectorAll('.filter-pill');
    const filterToggleBtn = document.getElementById('filter-toggle-btn');
    const displaySettingsBtn = document.getElementById('display-settings-btn');
    const collapsibleFilters = document.getElementById('collapsible-filters');
    const displaySettingsMenu = document.getElementById('display-settings-menu');
    const scriptsPanel = document.querySelector('.scripts-panel');
    const scriptsBody = document.getElementById('scripts-body');
    const scriptsToggleBtn = document.getElementById('scripts-toggle-btn');
    const scriptsRefreshBtn = document.getElementById('scripts-refresh-btn');
    const scriptsSearchInput = document.getElementById('scripts-search-input');
    const scriptsSearchClearBtn = document.getElementById('scripts-search-clear-btn');
    const scriptsNodeSelect = document.getElementById('scripts-node-select');
    const scriptsTypeFilters = document.getElementById('scripts-type-filters');
    const scriptsList = document.getElementById('scripts-list');
    const scriptsInstallBtn = document.getElementById('scripts-install-btn');
    const scriptsFeedback = document.getElementById('scripts-feedback');
    const scriptsGuideModal = document.getElementById('scripts-guide-modal');
    const scriptsGuideTitle = document.getElementById('scripts-guide-title');
    const scriptsGuideBody = document.getElementById('scripts-guide-body');
    const scriptsGuideClose = document.getElementById('scripts-guide-close');
    const scriptsGuideOpenPage = document.getElementById('scripts-guide-open-page');
    const debugStatus = document.getElementById('debug-status');

    let displaySettings = {
        uptime: true,
        ip: true,
        os: true,
        vmid: true,
        tags: true
    };
    const DEFAULT_DISPLAY_SETTINGS = {
        uptime: true,
        ip: true,
        os: true,
        vmid: true,
        tags: true
    };
    const DEFAULT_SETTINGS = {
        apiUser: 'api-admin@pve',
        apiTokenId: 'full-access',
        theme: 'auto',
        consoleTabMode: 'duplicate',
        defaultActionClickMode: 'sidepanel'
    };
    
    let currentExpandedId = null;
    let scriptsCatalog = [];
    let selectedScriptSlugs = new Set();
    let scriptDetailsCache = new Map();
    let pendingInlineClusterRemovalId = null;
    let pendingInlineResetConfirmation = false;
    let selectedScriptType = 'all';
    let currentGuidePageUrl = '';
    const activePasteFlows = new Set();
    let inlineImportOnlyNoConfigMode = false;
    const AUTO_PASTE_TIMEOUT_MS = 1500;
    const NEW_TAB_READY_TIMEOUT_MS = 650;
    const NEW_TAB_SETTLE_DELAY_MS = 250;

    function setInlineSettingsStatus(message, level = 'info') {
        inlineSettingsStatus.textContent = message || '';
        if (level === 'error') {
            inlineSettingsStatus.style.color = 'var(--error)';
        } else if (level === 'success') {
            inlineSettingsStatus.style.color = 'var(--success)';
        } else {
            inlineSettingsStatus.style.color = 'var(--text-secondary)';
        }
    }

    function attachClearButtonsToInputs(inputIds) {
        const updateCallbacks = [];
        inputIds.forEach((id) => {
            const input = document.getElementById(id);
            if (!input) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'input-with-clear';
            input.parentNode.insertBefore(wrapper, input);
            wrapper.appendChild(input);

            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'input-clear-btn hidden';
            clearBtn.title = 'Clear field';
            clearBtn.setAttribute('aria-label', 'Clear field');
            clearBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M18.3,5.71L12,12L5.71,5.71L4.29,7.12L10.59,13.41L4.29,19.71L5.71,21.12L12,14.83L18.3,21.12L19.71,19.71L13.41,13.41L19.71,7.12L18.3,5.71Z"/></svg>';
            wrapper.appendChild(clearBtn);
            input.classList.add('has-clear-control');

            const updateClearState = () => {
                clearBtn.classList.toggle('hidden', !input.value);
            };
            updateClearState();
            input.addEventListener('input', updateClearState);
            clearBtn.addEventListener('click', () => {
                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.focus();
            });
            updateCallbacks.push(updateClearState);
        });
        return () => updateCallbacks.forEach((fn) => fn());
    }
    const updateInlineInputClearButtons = attachClearButtonsToInputs([
        'inline-cluster-name',
        'inline-proxmox-url',
        'inline-api-user',
        'inline-api-tokenid',
        'inline-export-password',
        'inline-export-password-confirm',
        'inline-import-password'
    ]);

    function setInlineViewMode(isSettingsView) {
        document.body.classList.toggle('settings-view-active', isSettingsView);
        inlineSettingsView.classList.toggle('hidden', !isSettingsView);
        mainViewContent.classList.toggle('hidden', isSettingsView);
        updateClusterTabsVisibility();
        if (!isSettingsView) {
            setInlineSettingsStatus('');
        }
    }

    function updateClusterTabsVisibility() {
        if (!clusterTabs) return;
        const hasClusters = getEnabledClusters().length > 0;
        const isSettingsActive = document.body.classList.contains('settings-view-active');
        clusterTabs.classList.toggle('hidden', !hasClusters || isSettingsActive);
    }

    function setActiveInlineSettingsSubtab(tab) {
        const targetTab = ['cluster', 'backup', 'help', 'about'].includes(tab) ? tab : 'cluster';
        inlineSettingsSubtabButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.inlineSettingsSubtab === targetTab);
        });
        inlineSettingsSubtabPanels.forEach((panel) => {
            panel.classList.toggle('active', panel.dataset.inlineSettingsPanel === targetTab);
        });
        inlineSettingsActions?.classList.toggle('hidden', targetTab !== 'cluster');
    }

    function resetAboutEasterEgg() {
        inlineAboutLegacyWrap?.classList.remove('hidden');
        if (inlineAboutEasterEggBtn) {
            inlineAboutEasterEggBtn.textContent = chrome.i18n.getMessage('aboutHideEasterEgg') || 'Hide classic UI';
        }
    }

    function normalizeAndValidateHttpsUrl(input) {
        const raw = (input || '').trim();
        if (!raw) {
            return { ok: false, error: 'Please enter a Proxmox URL.' };
        }

        const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw) ? raw : `https://${raw}`;
        let parsed;
        try {
            parsed = new URL(withScheme);
        } catch (_error) {
            return { ok: false, error: 'Invalid URL. Example: https://proxmox.example.com:8006' };
        }

        if (parsed.protocol !== 'https:') {
            return { ok: false, error: 'Please use an HTTPS URL (Proxmox default).' };
        }

        return { ok: true, url: parsed.href.replace(/\/$/, ''), originPattern: `${parsed.origin}/*` };
    }

    function containsPermission(permissions) {
        return new Promise((resolve, reject) => {
            chrome.permissions.contains(permissions, (granted) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                resolve(granted);
            });
        });
    }

    function requestPermission(permissions) {
        return new Promise((resolve, reject) => {
            chrome.permissions.request(permissions, (granted) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                resolve(granted);
            });
        });
    }

    async function ensureHostPermission(originPattern) {
        const permissions = { origins: [originPattern] };
        const alreadyGranted = await containsPermission(permissions);
        if (alreadyGranted) return true;
        return requestPermission(permissions);
    }

    function describeConnectionError(error) {
        const message = error?.message || 'Unknown error';
        const lower = message.toLowerCase();

        if (lower.includes('permission denied')) {
            return `${message}. Please allow site access when prompted.`;
        }
        if (lower.includes('https url')) {
            return message;
        }
        if (
            lower.includes('failed to fetch') ||
            lower.includes('networkerror') ||
            lower.includes('network request')
        ) {
            return 'Network request blocked or unreachable. Open the Proxmox URL in Chrome once, trust/accept the certificate, then retry.';
        }
        if (lower.includes('timeout')) {
            return `${message}. Check VPN/LAN reachability and firewall rules.`;
        }
        return message;
    }

    function getEnabledClusters() {
        return getClusterList(clusters);
    }

    function hasConfiguredCluster() {
        return getEnabledClusters().some((cluster) => Boolean(cluster.proxmoxUrl && cluster.apiToken));
    }

    function updateInlineImportOnlyVisibility() {
        const shouldShowImportOnly = inlineImportOnlyNoConfigMode && !hasConfiguredCluster();
        inlineBackupExportBlock?.classList.toggle('hidden', shouldShowImportOnly);
        inlineSaveSettingsBtn?.classList.toggle('hidden', shouldShowImportOnly);
        inlineTestConnectionBtn?.classList.toggle('hidden', shouldShowImportOnly);
        inlineResetSettingsBtn?.classList.remove('hidden');
        inlineSettingsActions?.classList.toggle('import-only-mode', shouldShowImportOnly);
    }

    function getCurrentScopeId() {
        if (activeClusterTabId === ALL_CLUSTERS_TAB_ID) return ALL_CLUSTERS_TAB_ID;
        return activeClusterTabId || activeClusterId || 'none';
    }

    function getScopedUiKey(baseKey) {
        return `${baseKey}:${getCurrentScopeId()}`;
    }

    function readScopedUiValue(baseKey, fallback = '') {
        const value = localStorage.getItem(getScopedUiKey(baseKey));
        return value ?? fallback;
    }

    function writeScopedUiValue(baseKey, value) {
        localStorage.setItem(getScopedUiKey(baseKey), value);
    }

    function removeScopedUiValue(baseKey) {
        localStorage.removeItem(getScopedUiKey(baseKey));
    }

    function clearAllScopedUiValues() {
        ['lastSearchQuery', 'lastFilters', 'lastActiveResource'].forEach((baseKey) => {
            const scopedPrefix = `${baseKey}:`;
            const keysToRemove = [];
            for (let index = 0; index < localStorage.length; index += 1) {
                const key = localStorage.key(index);
                if (!key) continue;
                if (key === baseKey || key.startsWith(scopedPrefix)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach((key) => localStorage.removeItem(key));
        });
    }

    function getClusterForEditing() {
        if (activeClusterTabId !== ALL_CLUSTERS_TAB_ID && clusters[activeClusterTabId]) {
            return clusters[activeClusterTabId];
        }
        return clusters[activeClusterId] || null;
    }

    function renderInlineClusterSelect() {
        if (!inlineClusterSelect) return;
        const enabledClusters = getEnabledClusters();
        inlineClusterSelect.innerHTML = '';
        enabledClusters.forEach((cluster) => {
            const option = document.createElement('option');
            option.value = cluster.id;
            option.textContent = cluster.name;
            option.title = cluster.name;
            inlineClusterSelect.appendChild(option);
        });
        const editableCluster = getClusterForEditing();
        if (editableCluster?.id) {
            inlineClusterSelect.value = editableCluster.id;
        }
        if (inlineRemoveClusterBtn) {
            inlineRemoveClusterBtn.disabled = enabledClusters.length <= 1;
        }
    }

    function resetInlineRemoveClusterConfirmation() {
        pendingInlineClusterRemovalId = null;
        if (inlineRemoveClusterBtn) {
            inlineRemoveClusterBtn.textContent = 'Remove Cluster';
        }
    }

    function resetInlineResetConfirmation() {
        pendingInlineResetConfirmation = false;
        if (inlineResetSettingsBtn) {
            inlineResetSettingsBtn.textContent = chrome.i18n.getMessage('resetSettings') || 'Reset Settings';
        }
    }

    function populateInlineSettingsFields() {
        const editableCluster = getClusterForEditing();
        inlineClusterNameInput.value = editableCluster?.name || '';
        inlineProxmoxUrlInput.value = editableCluster?.proxmoxUrl || '';
        inlineApiUserInput.value = editableCluster?.apiUser || DEFAULT_SETTINGS.apiUser;
        inlineApiTokenIdInput.value = editableCluster?.apiTokenId || DEFAULT_SETTINGS.apiTokenId;
        inlineApiSecretInput.value = editableCluster?.apiSecret || '';
        inlineThemeSelect.value = settings.theme || 'auto';
        inlineTabModeSelect.value = settings.consoleTabMode || 'duplicate';
        inlineDefaultActionClickModeSelect.value = ['sidepanel', 'floating'].includes(settings.defaultActionClickMode)
            ? settings.defaultActionClickMode
            : 'sidepanel';
        renderInlineClusterSelect();
        updateInlineInputClearButtons();
        updateInlineImportOnlyVisibility();
    }

    function openInlineSettingsView(trigger, options = {}) {
        const scriptsPanel = document.querySelector('.scripts-panel');
        const scriptsInsideMain = Boolean(scriptsPanel && mainViewContent && mainViewContent.contains(scriptsPanel));
        inlineImportOnlyNoConfigMode = Boolean(options.importOnlyWhenNoConfig && options.targetSubtab === 'backup');
        resetAboutEasterEgg();
        populateInlineSettingsFields();
        setActiveInlineSettingsSubtab(
            options.targetSubtab === 'backup' || options.targetSubtab === 'help' || options.targetSubtab === 'about'
                ? options.targetSubtab
                : 'cluster'
        );
        updateInlineImportOnlyVisibility();
        setInlineViewMode(true);
    }

    function closeInlineSettingsView() {
        inlineImportOnlyNoConfigMode = false;
        updateInlineImportOnlyVisibility();
        resetAboutEasterEgg();
        resetInlineResetConfirmation();
        setInlineViewMode(false);
    }

    const updateSearchClearState = () => {
        searchClearBtn.classList.toggle('hidden', !searchInput.value.trim());
    };

    const resetSearch = () => {
        if (!searchInput.value) return;
        searchInput.value = '';
        writeScopedUiValue('lastSearchQuery', '');
        updateSearchClearState();
        filterAndRender();
        searchInput.focus();
    };

    searchInput.addEventListener('input', () => {
        writeScopedUiValue('lastSearchQuery', searchInput.value);
        updateSearchClearState();
        filterAndRender();
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            resetSearch();
        }
    });

    searchClearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetSearch();
    });

    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const type = pill.getAttribute('data-filter-type');
            const status = pill.getAttribute('data-filter-status');

            if (type) {
                // If clicking type, clear existing type indicators
                filterPills.forEach(p => {
                    if (p.hasAttribute('data-filter-type')) p.classList.remove('active');
                });
                activeFilters.type = type;
            } else if (status) {
                // Toggle status filter if clicking same status, otherwise switch
                if (activeFilters.status === status) {
                    activeFilters.status = 'all';
                    pill.classList.remove('active');
                } else {
                    filterPills.forEach(p => {
                        if (p.hasAttribute('data-filter-status')) p.classList.remove('active');
                    });
                    activeFilters.status = status;
                }
            }

            // Always ensure the correct type pill is active
            if (type) pill.classList.add('active');
            else {
                // If toggled status, ensure status pill is active if not 'all'
                if (activeFilters.status !== 'all') pill.classList.add('active');
            }

            writeScopedUiValue('lastFilters', JSON.stringify(activeFilters));
            filterAndRender();
        });
    });
    
    sidepanelBtn.addEventListener('click', async () => {
        const currentView = new URLSearchParams(window.location.search).get('view');
        const currentWindow = await chrome.windows.getCurrent();
        let targetWindowId = currentWindow?.id ?? null;
        if (currentWindow?.type === 'popup') {
            const storedWindow = await chrome.storage.local.get([LAST_BROWSER_WINDOW_ID_KEY]);
            const candidateId = storedWindow[LAST_BROWSER_WINDOW_ID_KEY];
            if (Number.isInteger(candidateId)) {
                targetWindowId = candidateId;
            }
        } else if (Number.isInteger(currentWindow?.id)) {
            await chrome.storage.local.set({ [LAST_BROWSER_WINDOW_ID_KEY]: currentWindow.id });
        }
        try {
            await chrome.sidePanel.open({ windowId: targetWindowId });
        } catch (error) {
        }
        window.close(); // Close the popup
    });
    floatingBtn.addEventListener('click', async () => {
        const currentView = new URLSearchParams(window.location.search).get('view');
        const currentWindow = await chrome.windows.getCurrent();
        if (currentWindow?.type === 'normal' && Number.isInteger(currentWindow?.id)) {
            await chrome.storage.local.set({ [LAST_BROWSER_WINDOW_ID_KEY]: currentWindow.id });
        }
        await openOrFocusFloatingWindow();
        if (currentView === 'popup') {
            window.close();
            return;
        }
        window.close();
    });
    openSettingsOverlayBtn.addEventListener('click', () => {
        resetInlineResetConfirmation();
        openInlineSettingsView('overlay_settings_button', { targetSubtab: 'cluster' });
    });
    openImportOverlayBtn?.addEventListener('click', () => {
        resetInlineResetConfirmation();
        openInlineSettingsView('overlay_import_button', { targetSubtab: 'backup', importOnlyWhenNoConfig: true });
    });
    refreshBtn.addEventListener('click', () => {
        removeScopedUiValue('lastActiveResource');
        currentExpandedId = null;
        fetchAndRender();
    });

    themeToggleBtn.addEventListener('click', async () => {
        const result = await chrome.storage.local.get(['theme']);
        const currentTheme = result.theme || 'auto';
        let newTheme;
        
        if (currentTheme === 'dark') {
            newTheme = 'light';
        } else if (currentTheme === 'light') {
            newTheme = 'dark';
        } else {
            // If currently auto, switch to dark unless system is already dark
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            newTheme = isDark ? 'light' : 'dark';
        }
        
        applyTheme(newTheme);
        await chrome.storage.local.set({ theme: newTheme });
    });

    filterToggleBtn.addEventListener('click', () => {
        collapsibleFilters.classList.toggle('collapsed');
        filterToggleBtn.classList.toggle('active', !collapsibleFilters.classList.contains('collapsed'));
    });
    filterToggleBtn.classList.toggle('active', !collapsibleFilters.classList.contains('collapsed'));

    displaySettingsBtn.addEventListener('click', () => {
        const isSettingsViewOpen = !inlineSettingsView.classList.contains('hidden');
        if (isSettingsViewOpen) {
            closeInlineSettingsView();
            return;
        }
        openInlineSettingsView('display_settings_gear');
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const isSettingsViewOpen = !inlineSettingsView.classList.contains('hidden');
        if (!isSettingsViewOpen) return;
        event.preventDefault();
        closeInlineSettingsView();
    });

    inlineToggleSecretBtn.addEventListener('click', () => {
        const isPassword = inlineApiSecretInput.type === 'password';
        inlineApiSecretInput.type = isPassword ? 'text' : 'password';
        inlineEyeIcon.innerHTML = isPassword
            ? '<path fill="currentColor" d="M12,17.5C14.33,17.5 16.31,16.04 17.11,14H1.5L9,14H15.11C14.31,16.04 12.33,17.5 12,17.5M12,5C7,5 2.73,8.11 1,12.5C2.73,16.89 7,20 12,20C17,20 21.27,16.89 23,12.5C21.27,8.11 17,5 12,5M12,18.5C9.67,18.5 7.69,17.04 6.89,15H17.11C16.31,17.04 14.33,18.5 12,18.5Z"/>'
            : '<path fill="currentColor" d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>';
    });

    inlineThemeSelect.addEventListener('change', () => {
        applyTheme(inlineThemeSelect.value);
    });

    inlineSettingsSubtabButtons.forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.inlineSettingsSubtab !== 'backup') {
                inlineImportOnlyNoConfigMode = false;
            }
            if (button.dataset.inlineSettingsSubtab !== 'about') {
                resetAboutEasterEgg();
            }
            resetInlineResetConfirmation();
            setActiveInlineSettingsSubtab(button.dataset.inlineSettingsSubtab);
            updateInlineImportOnlyVisibility();
        });
    });

    inlineAboutEasterEggBtn?.addEventListener('click', () => {
        const willReveal = inlineAboutLegacyWrap?.classList.contains('hidden');
        inlineAboutLegacyWrap?.classList.toggle('hidden', !willReveal);
        inlineAboutEasterEggBtn.textContent = willReveal
            ? (chrome.i18n.getMessage('aboutHideEasterEgg') || 'Hide classic UI')
            : (chrome.i18n.getMessage('aboutRevealEasterEgg') || 'Reveal classic UI');
    });

    inlineExportSettingsBtn?.addEventListener('click', async () => {
        resetInlineResetConfirmation();
        try {
            const result = await createEncryptedSettingsBackup(
                inlineExportPasswordInput.value || '',
                inlineExportPasswordConfirmInput.value || ''
            );
            await downloadEncryptedBackupFile(result.encrypted, result.filename);
            inlineExportPasswordInput.value = '';
            inlineExportPasswordConfirmInput.value = '';
            updateInlineInputClearButtons();
            setInlineSettingsStatus('Encrypted settings exported successfully.', 'success');
        } catch (error) {
            setInlineSettingsStatus(`Export failed: ${error.message || 'Unknown error.'}`, 'error');
        }
    });

    inlineImportSettingsBtn?.addEventListener('click', async () => {
        resetInlineResetConfirmation();
        const selectedFile = inlineImportFileInput.files?.[0];
        if (!selectedFile) {
            setInlineSettingsStatus('Please choose a backup file to import.', 'error');
            return;
        }

        try {
            const rawText = await selectedFile.text();
            await importEncryptedSettingsFromText(rawText, inlineImportPasswordInput.value || '');
            inlineImportPasswordInput.value = '';
            inlineImportFileInput.value = '';
            inlineImportOnlyNoConfigMode = false;
            updateInlineInputClearButtons();
            updateInlineImportOnlyVisibility();
            setInlineSettingsStatus('Encrypted settings imported successfully. Reloading...', 'success');
            window.location.reload();
        } catch (error) {
            setInlineSettingsStatus(`Import failed: ${error.message || 'Unknown error.'}`, 'error');
        }
    });

    inlineClusterSelect?.addEventListener('change', async () => {
        resetInlineResetConfirmation();
        const selectedId = inlineClusterSelect.value;
        if (!selectedId || !clusters[selectedId]) return;
        activeClusterId = selectedId;
        activeClusterTabId = selectedId;
        setActiveClusterContext(activeClusterId);
        await persistClusterContext();
        resetInlineRemoveClusterConfirmation();
        populateInlineSettingsFields();
    });

    inlineClusterNameInput?.addEventListener('change', async () => {
        resetInlineResetConfirmation();
        const current = getClusterForEditing();
        if (!current?.id) return;
        const nextName = inlineClusterNameInput.value.trim() || current.name || 'Cluster';
        clusters = {
            ...clusters,
            [current.id]: buildClusterPayload({ ...current, name: nextName }, clusters, 'Cluster')
        };
        activeClusterId = resolveActiveClusterId(clusters, current.id);
        if (activeClusterTabId !== ALL_CLUSTERS_TAB_ID) {
            activeClusterTabId = activeClusterId || ALL_CLUSTERS_TAB_ID;
        }
        await saveClustersState(clusters, activeClusterId);
        await persistClusterContext();
        renderClusterTabs();
        renderInlineClusterSelect();
    });

    inlineAddClusterBtn?.addEventListener('click', async () => {
        resetInlineResetConfirmation();
        const baseName = `Cluster ${getEnabledClusters().length + 1}`;
        const cluster = createClusterSkeleton(clusters, baseName);
        clusters = { ...clusters, [cluster.id]: cluster };
        activeClusterId = resolveActiveClusterId(clusters, cluster.id);
        activeClusterTabId = activeClusterId || ALL_CLUSTERS_TAB_ID;
        await saveClustersState(clusters, activeClusterId);
        setActiveClusterContext(activeClusterId);
        syncClusterApiClients();
        await persistClusterContext();
        renderClusterTabs();
        resetInlineRemoveClusterConfirmation();
        populateInlineSettingsFields();
        inlineClusterNameInput?.focus();
        setInlineSettingsStatus('Cluster added.', 'success');
    });

    inlineRemoveClusterBtn?.addEventListener('click', async () => {
        resetInlineResetConfirmation();
        const current = getClusterForEditing();
        if (!current?.id) return;
        const enabledClusters = getEnabledClusters();
        if (enabledClusters.length <= 1) {
            setInlineSettingsStatus('At least one cluster is required.', 'error');
            return;
        }
        if (pendingInlineClusterRemovalId !== current.id) {
            pendingInlineClusterRemovalId = current.id;
            if (inlineRemoveClusterBtn) {
                inlineRemoveClusterBtn.textContent = 'Click again to remove';
            }
            setInlineSettingsStatus(`Click "Remove Cluster" again to delete "${current.name}".`, 'info');
            return;
        }
        const removed = removeClusterAndResolve(clusters, current.id, activeClusterId);
        clusters = removed.clusters;
        activeClusterId = removed.activeClusterId;
        activeClusterTabId = activeClusterId || ALL_CLUSTERS_TAB_ID;
        await saveClustersState(clusters, activeClusterId);
        const refreshedState = await getClustersState();
        clusters = refreshedState.clusters;
        activeClusterId = refreshedState.activeClusterId;
        activeClusterTabId = activeClusterId || ALL_CLUSTERS_TAB_ID;
        setActiveClusterContext(activeClusterId);
        syncClusterApiClients();
        await persistClusterContext();
        await setActiveClusterTab(activeClusterTabId);
        resetInlineRemoveClusterConfirmation();
        populateInlineSettingsFields();
        setInlineSettingsStatus('Cluster removed.', 'success');
    });

    async function persistActiveClusterPayload(payload) {
        const editingCluster = getClusterForEditing();
        const updatedCluster = buildClusterPayload({
            ...(editingCluster || {}),
            name: inlineClusterNameInput.value.trim() || editingCluster?.name || 'Cluster',
            proxmoxUrl: payload.proxmoxUrl,
            apiUser: payload.apiUser,
            apiTokenId: payload.apiTokenId,
            apiSecret: payload.apiSecret,
            apiToken: payload.apiToken,
            isEnabled: true
        }, clusters, 'Cluster');
        clusters = {
            ...clusters,
            [updatedCluster.id]: updatedCluster
        };
        activeClusterId = resolveActiveClusterId(clusters, updatedCluster.id);
        if (activeClusterTabId !== ALL_CLUSTERS_TAB_ID || !activeClusterTabId) {
            activeClusterTabId = activeClusterId || ALL_CLUSTERS_TAB_ID;
        }
        await saveClustersState(clusters, activeClusterId);
        await chrome.storage.local.set({
            activeClusterId,
            proxmoxUrl: payload.proxmoxUrl,
            apiUser: payload.apiUser,
            apiTokenId: payload.apiTokenId,
            apiSecret: payload.apiSecret,
            apiToken: payload.apiToken,
            theme: payload.theme,
            consoleTabMode: payload.consoleTabMode,
            defaultActionClickMode: payload.defaultActionClickMode
        });
        syncClusterApiClients();
        setActiveClusterContext(activeClusterId);
        renderClusterTabs();
        renderInlineClusterSelect();
    }

    inlineSaveSettingsBtn.addEventListener('click', async () => {
        resetInlineResetConfirmation();
        const normalized = normalizeAndValidateHttpsUrl(inlineProxmoxUrlInput.value);
        const user = inlineApiUserInput.value.trim();
        const tokenId = inlineApiTokenIdInput.value.trim();
        const secret = inlineApiSecretInput.value.trim();
        const previousUrl = settings?.proxmoxUrl || null;
        const previousToken = settings?.apiToken || null;

        if (!normalized.ok || !user || !tokenId || !secret) {
            setInlineSettingsStatus(normalized.ok ? 'Please fill in all fields.' : normalized.error, 'error');
            return;
        }

        const payload = {
            proxmoxUrl: normalized.url,
            apiUser: user,
            apiTokenId: tokenId,
            apiSecret: secret,
            apiToken: `${user}!${tokenId}=${secret}`,
            theme: inlineThemeSelect.value,
            consoleTabMode: inlineTabModeSelect.value,
            defaultActionClickMode: inlineDefaultActionClickModeSelect.value === 'floating' ? 'floating' : 'sidepanel'
        };

        await persistActiveClusterPayload(payload);
        settings = { ...settings, ...payload };
        applyTheme(payload.theme);
        inlineImportOnlyNoConfigMode = false;
        updateInlineImportOnlyVisibility();
        setInlineSettingsStatus('Settings saved successfully!', 'success');
        noAuthOverlay.classList.add('hidden');
        scriptsPanel?.classList.remove('hidden');
        const connectionChanged = previousUrl !== payload.proxmoxUrl || previousToken !== payload.apiToken;
        if (connectionChanged) {
            window.location.reload();
            return;
        }
        try {
            await ensureHostPermission(normalized.originPattern);
        } catch (_error) {
            // Permission prompt may be dismissed; save still succeeded.
        }
    });

    inlineTestConnectionBtn.addEventListener('click', async () => {
        resetInlineResetConfirmation();
        const normalized = normalizeAndValidateHttpsUrl(inlineProxmoxUrlInput.value);
        const user = inlineApiUserInput.value.trim();
        const tokenId = inlineApiTokenIdInput.value.trim();
        const secret = inlineApiSecretInput.value.trim();

        if (!normalized.ok || !user || !tokenId || !secret) {
            setInlineSettingsStatus(normalized.ok ? 'Please fill in all fields to test.' : normalized.error, 'error');
            return;
        }

        setInlineSettingsStatus('Testing connection...', 'info');
        try {
            const permissionGranted = await ensureHostPermission(normalized.originPattern);
            if (!permissionGranted) {
                throw new Error(`Host permission denied for ${normalized.originPattern}`);
            }
            const api = new ProxmoxAPI(normalized.url, `${user}!${tokenId}=${secret}`);
            const version = await api.fetch('/version');
            const payload = {
                proxmoxUrl: normalized.url,
                apiUser: user,
                apiTokenId: tokenId,
                apiSecret: secret,
                apiToken: `${user}!${tokenId}=${secret}`,
                theme: inlineThemeSelect.value,
                consoleTabMode: inlineTabModeSelect.value,
                defaultActionClickMode: inlineDefaultActionClickModeSelect.value === 'floating' ? 'floating' : 'sidepanel'
            };
            await persistActiveClusterPayload(payload);
            settings = { ...settings, ...payload };
            applyTheme(payload.theme);
            inlineImportOnlyNoConfigMode = false;
            updateInlineImportOnlyVisibility();
            noAuthOverlay.classList.add('hidden');
            scriptsPanel?.classList.remove('hidden');
            setInlineSettingsStatus(`Connection successful! Proxmox Version: ${version.version}`, 'success');
            window.location.reload();
        } catch (error) {
            setInlineSettingsStatus(`Connection failed: ${describeConnectionError(error)}`, 'error');
        }
    });

    inlineResetSettingsBtn.addEventListener('click', async () => {
        if (!pendingInlineResetConfirmation) {
            pendingInlineResetConfirmation = true;
            inlineResetSettingsBtn.textContent = chrome.i18n.getMessage('resetSettingsConfirmAgainLabel') || 'Click again to reset';
            setInlineSettingsStatus(
                chrome.i18n.getMessage('resetSettingsConfirmAgainHint') || 'Click "Reset Settings" again to reset all settings.',
                'info'
            );
            return;
        }
        resetInlineResetConfirmation();

        const resetResult = await resetToFactoryDefaults();
        clusters = resetResult.clusters;
        activeClusterId = resetResult.activeClusterId;
        activeClusterTabId = resetResult.activeClusterTabId || ALL_CLUSTERS_TAB_ID;
        syncClusterApiClients();
        setActiveClusterContext(activeClusterId);
        await persistClusterContext();
        clearAllScopedUiValues();

        settings = {
            ...settings,
            theme: resetResult.storagePayload.theme,
            consoleTabMode: resetResult.storagePayload.consoleTabMode,
            defaultActionClickMode: resetResult.storagePayload.defaultActionClickMode,
            communityScriptsCacheTtlHours: resetResult.storagePayload.communityScriptsCacheTtlHours,
            defaultScriptNode: resetResult.storagePayload.defaultScriptNode,
            scriptsPanelCollapsed: resetResult.storagePayload.scriptsPanelCollapsed
        };
        displaySettings = { ...FACTORY_DEFAULT_DISPLAY_SETTINGS };
        activeFilters = { type: 'all', status: 'all', tag: null };
        currentExpandedId = null;
        allResources = [];
        resourcesByClusterId.clear();
        pendingStatusOverrides.clear();

        populateInlineSettingsFields();

        searchInput.value = '';
        updateSearchClearState();
        filterPills.forEach((pill) => {
            const filterType = pill.getAttribute('data-filter-type');
            const filterStatus = pill.getAttribute('data-filter-status');
            if (!filterType && !filterStatus) return;
            pill.classList.remove('active');
            if (filterType === 'all') {
                pill.classList.add('active');
            }
        });

        syncDisplaySettingsCheckboxes();
        applyDisplaySettings();
        resourceList.innerHTML = '';
        searchContainer?.classList.add('hidden');
        scriptsPanel?.classList.add('hidden');
        clusterTabs?.classList.add('hidden');
        tagFiltersContainer?.classList.add('hidden');
        tagFiltersSection?.classList.add('hidden');
        noAuthOverlay.classList.remove('hidden');
        loadingOverlay.classList.add('hidden');
        renderClusterTabs();
        setInlineSettingsStatus(chrome.i18n.getMessage('resetSettingsSuccess') || 'Settings reset to defaults.', 'success');
        closeInlineSettingsView();
    });

    const DISPLAY_SETTING_KEYS = ['uptime', 'ip', 'os', 'vmid', 'tags'];
    const displaySettingCheckboxes = DISPLAY_SETTING_KEYS.reduce((acc, key) => {
        const element = document.getElementById(`show-${key}`);
        if (element) acc[key] = element;
        return acc;
    }, {});

    async function persistDisplaySettings() {
        await chrome.storage.local.set({ displaySettings });
    }

    function syncDisplaySettingsCheckboxes() {
        DISPLAY_SETTING_KEYS.forEach((setting) => {
            const checkbox = displaySettingCheckboxes[setting];
            if (checkbox) {
                checkbox.checked = Boolean(displaySettings[setting]);
            }
        });
    }

    // Handle Display Settings Changes
    DISPLAY_SETTING_KEYS.forEach(setting => {
        const checkbox = displaySettingCheckboxes[setting];
        if (!checkbox) return;
        checkbox.addEventListener('change', async () => {
            displaySettings[setting] = checkbox.checked;
            applyDisplaySettings();
            await persistDisplaySettings();
        });
    });

    function applyDisplaySettings() {
        resourceList.classList.toggle('hide-uptime', !displaySettings.uptime);
        resourceList.classList.toggle('hide-ip', !displaySettings.ip);
        resourceList.classList.toggle('hide-os', !displaySettings.os);
        resourceList.classList.toggle('hide-vmid', !displaySettings.vmid);
        resourceList.classList.toggle('hide-tags', !displaySettings.tags);
    }

    function setScriptsFeedback(message, level = 'info') {
        scriptsFeedback.textContent = message || '';
        if (level === 'error') {
            scriptsFeedback.style.color = 'var(--error)';
        } else if (level === 'success') {
            scriptsFeedback.style.color = 'var(--success)';
        } else {
            scriptsFeedback.style.color = 'var(--text-secondary)';
        }
    }

    function renderScriptNodeOptions(resources) {
        const nodes = resources
            .filter(resource => resource.type === 'node')
            .map(resource => resource.node)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

        scriptsNodeSelect.innerHTML = '';
        const autoOption = document.createElement('option');
        autoOption.value = '';
        autoOption.textContent = chrome.i18n.getMessage('scriptsNodeAuto') || 'Auto node';
        scriptsNodeSelect.appendChild(autoOption);

        nodes.forEach(nodeName => {
            const option = document.createElement('option');
            option.value = nodeName;
            option.textContent = nodeName;
            scriptsNodeSelect.appendChild(option);
        });

        if (settings.defaultScriptNode && nodes.includes(settings.defaultScriptNode)) {
            scriptsNodeSelect.value = settings.defaultScriptNode;
        } else {
            scriptsNodeSelect.value = '';
        }
    }

    function getFilteredCatalog() {
        const query = scriptsSearchInput.value.toLowerCase().trim();
        return scriptsCatalog.filter(script => {
            const typeMatch = selectedScriptType === 'all'
                ? true
                : selectedScriptType === 'alpine'
                    ? script.uiGroup === 'lxc-alpine'
                    : (script.uiType !== 'tools-group' && script.uiType === selectedScriptType);
            if (!typeMatch) return false;
            if (!query) return true;
            return script.name.toLowerCase().includes(query) ||
                script.slug.toLowerCase().includes(query) ||
                (script.description || '').toLowerCase().includes(query);
        });
    }

    function normalizeScriptTypeForUi(rawType, toolsGroup) {
        if (toolsGroup) return 'tools-group';
        const value = (rawType || '').toString().trim().toLowerCase();
        if (value === 'ct' || value === 'lxc' || value === 'container') return 'ct';
        if (value === 'vm' || value === 'qemu') return 'vm';
        if (value === 'turnkey') return 'turnkey';
        return 'ct';
    }

    function scriptTypeLabel(type) {
        const keyByType = {
            ct: 'scriptsTypeCt',
            vm: 'scriptsTypeVm',
            turnkey: 'scriptsTypeTurnkey'
        };
        const message = chrome.i18n.getMessage(keyByType[type] || 'scriptsTypeCt');
        return message || (type || 'ct').toUpperCase();
    }

    function toolsGroupLabel(group) {
        return `TOOLS / ${(group || 'misc').toUpperCase()}`;
    }

    function scriptsGroupLabel(groupKey) {
        if (groupKey === 'lxc-alpine') return 'Alpine-LXC';
        return toolsGroupLabel(groupKey);
    }

    function updateScriptsSearchClearState() {
        if (!scriptsSearchClearBtn) return;
        scriptsSearchClearBtn.classList.toggle('hidden', !scriptsSearchInput.value.trim());
    }

    function resetScriptsSearch() {
        if (!scriptsSearchInput.value) return;
        scriptsSearchInput.value = '';
        updateScriptsSearchClearState();
        renderScriptsList();
        scriptsSearchInput.focus();
    }

    function updateScriptsTypeFilterButtons() {
        if (!scriptsTypeFilters) return;
        scriptsTypeFilters.querySelectorAll('.scripts-type-pill').forEach(button => {
            button.classList.toggle('active', button.dataset.scriptType === selectedScriptType);
        });
    }

    function escapeHtml(text) {
        return (text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderGuideSection(title, content) {
        if (!content) return '';
        return `<section class="scripts-guide-section"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(content)}</p></section>`;
    }

    function renderGuideDetailsSection(title, details) {
        const labelByKey = {
            version: 'Version',
            category: 'Category',
            website: 'Website',
            docs: 'Docs',
            config: 'Config',
            port: 'Port',
            runsIn: 'Runs in',
            updated: 'Updated'
        };
        const entries = Object.entries(details || {}).filter(([, value]) => value);
        if (!entries.length) return '';
        const items = entries
            .map(([key, value]) => {
                const label = labelByKey[key] || key;
                return `<li class="guide-details-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`;
            })
            .join('');
        return `<section class="scripts-guide-section"><h4>${escapeHtml(title)}</h4><ul class="guide-details-list">${items}</ul></section>`;
    }

    function renderGuideInstallMethodsSection(title, methods) {
        const rows = Array.isArray(methods) ? methods.filter(method => method && method.name) : [];
        if (!rows.length) return '';
        const cards = rows.map(method => {
            const chips = [
                method.os ? `<span>${escapeHtml(method.os)}</span>` : '',
                method.cpu ? `<span>CPU ${escapeHtml(method.cpu)}</span>` : '',
                method.ram ? `<span>RAM ${escapeHtml(method.ram)}</span>` : '',
                method.hdd ? `<span>HDD ${escapeHtml(method.hdd)}</span>` : ''
            ].filter(Boolean).join('');
            return `<article class="guide-method-card"><h5>${escapeHtml(method.name)}</h5><div class="guide-method-meta">${chips}</div></article>`;
        }).join('');
        return `<section class="scripts-guide-section"><h4>${escapeHtml(title)}</h4><div class="guide-methods">${cards}</div></section>`;
    }

    function closeGuideModal() {
        scriptsGuideModal.classList.add('hidden');
    }

    function openGuideModal() {
        scriptsGuideModal.classList.remove('hidden');
    }

    async function showScriptGuide(script) {
        if (!script) return;
        openGuideModal();
        const fallbackTitle = script.name || script.slug || (chrome.i18n.getMessage('scriptsGuideTitleFallback') || 'Script Guide');
        scriptsGuideTitle.textContent = fallbackTitle;
        scriptsGuideBody.innerHTML = `<p>${chrome.i18n.getMessage('scriptsGuideLoading') || 'Loading guide...'}</p>`;
        currentGuidePageUrl = `https://community-scripts.org/scripts/${encodeURIComponent(script.slug)}`;
        scriptsGuideOpenPage.disabled = false;

        try {
            const guide = await getCommunityScriptGuide(script.slug, { ttlHours: settings.communityScriptsCacheTtlHours || 12 });
            scriptsGuideTitle.textContent = script.name || guide.slug || fallbackTitle;
            currentGuidePageUrl = guide.pageUrl || currentGuidePageUrl;
            const parts = [
                renderGuideSection(chrome.i18n.getMessage('scriptsGuideAboutLabel') || 'About', guide.about),
                renderGuideSection(chrome.i18n.getMessage('scriptsGuideNotesLabel') || 'Notes', guide.notes),
                renderGuideSection(chrome.i18n.getMessage('scriptsGuideInstallLabel') || 'Install', guide.installCommand),
                renderGuideDetailsSection(chrome.i18n.getMessage('scriptsGuideDetailsLabel') || 'Details', guide.details),
                renderGuideInstallMethodsSection(chrome.i18n.getMessage('scriptsGuideInstallMethodsLabel') || 'Install Methods', guide.installMethods)
            ].filter(Boolean);
            if (!parts.length) {
                scriptsGuideBody.innerHTML = `<p>${chrome.i18n.getMessage('scriptsGuideFailed') || 'Guide content is currently unavailable. You can open the full page.'}</p>`;
            } else {
                scriptsGuideBody.innerHTML = parts.join('');
            }
        } catch (_error) {
            scriptsGuideBody.innerHTML = `<p>${chrome.i18n.getMessage('scriptsGuideFailed') || 'Guide content is currently unavailable. You can open the full page.'}</p>`;
        }
    }

    function renderScriptsList() {
        const filtered = getFilteredCatalog();
        scriptsList.innerHTML = '';
        if (!filtered.length) {
            const empty = document.createElement('div');
            empty.className = 'script-row';
            empty.textContent = chrome.i18n.getMessage('scriptsNoResults') || 'No matching scripts.';
            scriptsList.appendChild(empty);
            return;
        }

        const limited = filtered.slice(0, 180);
        const nonTools = limited.filter(script => script.uiType !== 'tools-group');
        const tools = limited.filter(script => script.uiType === 'tools-group');
        const alpine = nonTools.filter(script => script.uiGroup === 'lxc-alpine');
        const regularNonTools = nonTools.filter(script => script.uiGroup !== 'lxc-alpine');
        const toolsByGroup = new Map();
        tools.forEach(script => {
            const group = script.toolsGroup || 'misc';
            if (!toolsByGroup.has(group)) toolsByGroup.set(group, []);
            toolsByGroup.get(group).push(script);
        });

        const orderedGroups = ['addon', 'pve', 'copy-data'].filter(group => toolsByGroup.has(group));
        const renderOrder = [
            ...regularNonTools,
            ...(alpine.length ? [{ __groupHeader: true, group: 'lxc-alpine' }] : []),
            ...alpine,
            ...orderedGroups.flatMap(group => {
                const marker = { __groupHeader: true, group };
                return [marker, ...(toolsByGroup.get(group) || [])];
            })
        ];

        renderOrder.forEach(script => {
            if (script.__groupHeader) {
                const header = document.createElement('div');
                header.className = 'scripts-group-header';
                header.textContent = scriptsGroupLabel(script.group);
                scriptsList.appendChild(header);
                return;
            }

            const row = document.createElement('label');
            row.className = 'script-row';
            row.setAttribute('for', `script-${script.slug}`);

            const rowMain = document.createElement('div');
            rowMain.className = 'script-row-main';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `script-${script.slug}`;
            checkbox.checked = selectedScriptSlugs.has(script.slug);
            checkbox.addEventListener('change', async () => {
                if (checkbox.checked) {
                    selectedScriptSlugs = new Set([script.slug]);
                    try {
                        if (!scriptDetailsCache.has(script.slug)) {
                            const details = await getCommunityScriptDetails(script.slug, { ttlHours: settings.communityScriptsCacheTtlHours || 12 });
                            scriptDetailsCache.set(script.slug, { ...script, ...details });
                        }
                    } catch (_error) {
                        // Keep base item in selection even if details fetch fails.
                    }
                } else {
                    selectedScriptSlugs.delete(script.slug);
                }
                renderScriptsList();
            });

            const info = document.createElement('div');
            info.className = 'script-info';

            const titleRow = document.createElement('div');
            titleRow.className = 'script-title-row';

            const title = document.createElement('div');
            title.className = 'script-title';
            title.textContent = script.name;

            titleRow.appendChild(title);
            if (script.uiType !== 'tools-group') {
                const badge = document.createElement('span');
                badge.className = `script-type-badge type-${script.uiType}`;
                badge.textContent = scriptTypeLabel(script.uiType);
                titleRow.appendChild(badge);
            }
            info.appendChild(titleRow);

            rowMain.appendChild(checkbox);
            rowMain.appendChild(info);
            row.appendChild(rowMain);

            const guideButton = document.createElement('button');
            guideButton.type = 'button';
            guideButton.className = 'scripts-btn ghost script-guide-btn';
            guideButton.textContent = chrome.i18n.getMessage('scriptsGuideOpen') || 'Guide';
            guideButton.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await showScriptGuide(script);
            });
            row.appendChild(guideButton);
            scriptsList.appendChild(row);
        });
    }

    async function loadScriptsCatalog(forceRefresh = false) {
        setScriptsFeedback(chrome.i18n.getMessage('scriptsLoading') || 'Loading script catalog...');
        try {
            const ttlHours = Number(settings.communityScriptsCacheTtlHours || 12);
            const result = await getCommunityScriptsCatalog({ forceRefresh, ttlHours });
            scriptsCatalog = result.scripts
                .map(script => ({
                    ...script,
                    description: (script.description || '').trim(),
                    toolsGroup: (script.toolsGroup || '').toString().toLowerCase(),
                    uiGroup: (script.uiGroup || '').toString().toLowerCase(),
                    uiType: normalizeScriptTypeForUi(script.type, script.toolsGroup)
                }))
                .sort((a, b) => a.name.localeCompare(b.name));

            renderScriptsList();
            if (result.source === 'github') {
                const suffix = chrome.i18n.getMessage('scriptsLoadedGithubSuffix') || 'scripts loaded from GitHub';
                setScriptsFeedback(`${scriptsCatalog.length} ${suffix}`, 'success');
            } else if (result.source === 'cache-fallback') {
                const suffix = chrome.i18n.getMessage('scriptsLoadedCacheFallbackSuffix') || 'scripts loaded from cache (GitHub currently unreachable)';
                setScriptsFeedback(`${scriptsCatalog.length} ${suffix}`, 'info');
            } else {
                const suffix = chrome.i18n.getMessage('scriptsLoadedCacheSuffix') || 'scripts loaded from cache';
                setScriptsFeedback(`${scriptsCatalog.length} ${suffix}`, 'success');
            }
        } catch (error) {
            console.error('Community scripts catalog load failed:', error);
            scriptsCatalog = [];
            renderScriptsList();
            const fallbackText = chrome.i18n.getMessage('scriptsLoadActionHint') ||
                'Could not load scripts catalog. Check internet access to api.github.com/raw.githubusercontent.com and click Refresh.';
            const detail = error?.message ? ` (${error.message})` : '';
            setScriptsFeedback(`${fallbackText}${detail}`, 'error');
        }
    }

    async function getSelectedScriptRecords() {
        const selected = [];
        for (const slug of selectedScriptSlugs) {
            const fromCatalog = scriptsCatalog.find(script => script.slug === slug);
            let details = scriptDetailsCache.get(slug);
            if (!details) {
                try {
                    details = await getCommunityScriptDetails(slug, { ttlHours: settings.communityScriptsCacheTtlHours || 12 });
                    scriptDetailsCache.set(slug, details);
                } catch (error) {
                    console.error(`Failed to load details for ${slug}:`, error);
                }
            }
            selected.push({
                ...fromCatalog,
                ...details
            });
        }
        return selected;
    }

    function getTargetNodeName() {
        if (scriptsNodeSelect.value) return scriptsNodeSelect.value;
        if (settings.defaultScriptNode) return settings.defaultScriptNode;
        const firstNode = allResources.find(resource => resource.type === 'node');
        return firstNode ? firstNode.node : '';
    }

    function syncClusterApiClients() {
        apiClients.clear();
        getEnabledClusters().forEach((cluster) => {
            if (!cluster.proxmoxUrl || !cluster.apiToken) return;
            apiClients.set(cluster.id, new ProxmoxAPI(cluster.proxmoxUrl, cluster.apiToken, cluster.failoverUrls || []));
        });
    }

    function setGlobalSettingsFromStore(stored) {
        settings = {
            ...stored,
            theme: stored.theme || DEFAULT_SETTINGS.theme,
            consoleTabMode: stored.consoleTabMode || DEFAULT_SETTINGS.consoleTabMode,
            defaultActionClickMode: stored.defaultActionClickMode || DEFAULT_SETTINGS.defaultActionClickMode
        };
    }

    function setActiveClusterContext(clusterId) {
        if (clusterId && clusters[clusterId]) {
            activeClusterId = clusterId;
        } else if (!activeClusterId || !clusters[activeClusterId]) {
            activeClusterId = getEnabledClusters()[0]?.id || null;
        }
        const cluster = activeClusterId ? clusters[activeClusterId] : null;
        settings = {
            ...settings,
            proxmoxUrl: cluster?.proxmoxUrl || '',
            apiUser: cluster?.apiUser || DEFAULT_SETTINGS.apiUser,
            apiTokenId: cluster?.apiTokenId || DEFAULT_SETTINGS.apiTokenId,
            apiSecret: cluster?.apiSecret || '',
            apiToken: cluster?.apiToken || '',
            failoverUrls: cluster?.failoverUrls || []
        };
    }

    async function persistClusterContext() {
        await chrome.storage.local.set({
            activeClusterId,
            activeClusterTabId
        });
    }

    function renderClusterTabs() {
        if (!clusterTabs) return;
        const enabledClusters = getEnabledClusters();
        clusterTabs.innerHTML = '';
        if (!enabledClusters.length) {
            updateClusterTabsVisibility();
            return;
        }

        const allTab = document.createElement('button');
        allTab.type = 'button';
        allTab.className = `cluster-tab ${activeClusterTabId === ALL_CLUSTERS_TAB_ID ? 'active' : ''} all-clusters`;
        allTab.dataset.clusterTab = ALL_CLUSTERS_TAB_ID;
        allTab.innerHTML = '<span class="cluster-tab-icon">stack</span><span>All Clusters</span>';
        clusterTabs.appendChild(allTab);

        enabledClusters.forEach((cluster) => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = `cluster-tab ${activeClusterTabId === cluster.id ? 'active' : ''}`;
            tab.dataset.clusterTab = cluster.id;
            tab.title = cluster.name;
            tab.innerHTML = `<span class="cluster-status-dot"></span><span>${cluster.name}</span>`;
            clusterTabs.appendChild(tab);
        });
        updateClusterTabsVisibility();
    }

    async function setActiveClusterTab(nextTabId) {
        const enabledClusterIds = new Set(getEnabledClusters().map((cluster) => cluster.id));
        if (nextTabId !== ALL_CLUSTERS_TAB_ID && !enabledClusterIds.has(nextTabId)) {
            nextTabId = activeClusterId || ALL_CLUSTERS_TAB_ID;
        }
        activeClusterTabId = nextTabId || ALL_CLUSTERS_TAB_ID;
        if (activeClusterTabId !== ALL_CLUSTERS_TAB_ID) {
            activeClusterId = activeClusterTabId;
        }
        setActiveClusterContext(activeClusterId);
        api = activeClusterId ? apiClients.get(activeClusterId) || null : null;
        currentExpandedId = readScopedUiValue('lastActiveResource', '') || null;
        const savedSearch = readScopedUiValue('lastSearchQuery', '');
        searchInput.value = savedSearch;
        updateSearchClearState();
        const savedFilters = readScopedUiValue('lastFilters', '');
        if (savedFilters) {
            try {
                activeFilters = JSON.parse(savedFilters);
            } catch (_error) {
                activeFilters = { type: 'all', status: 'all', tag: null };
            }
        } else {
            activeFilters = { type: 'all', status: 'all', tag: null };
        }
        filterPills.forEach((pill) => pill.classList.remove('active'));
        document.querySelector('.filter-pill[data-filter-type="all"]')?.classList.add('active');
        document.querySelector(`.filter-pill[data-filter-type="${activeFilters.type}"]`)?.classList.add('active');
        if (activeFilters.status && activeFilters.status !== 'all') {
            document.querySelector(`.filter-pill[data-filter-status="${activeFilters.status}"]`)?.classList.add('active');
        }
        renderClusterTabs();
        await persistClusterContext();
        await fetchAndRender(true);
        searchInput.focus();
    }

    clusterTabs?.addEventListener('click', async (event) => {
        const tab = event.target.closest('[data-cluster-tab]');
        if (!tab) return;
        const nextTabId = tab.dataset.clusterTab;
        if (!nextTabId || nextTabId === activeClusterTabId) return;
        await setActiveClusterTab(nextTabId);
    });

    // Load saved settings
    const stored = await chrome.storage.local.get([
        'theme',
        'displaySettings',
        'consoleTabMode',
        'communityScriptsCacheTtlHours',
        'defaultScriptNode',
        'defaultActionClickMode',
        'scriptsPanelCollapsed',
        'activeClusterTabId'
    ]);
    setGlobalSettingsFromStore(stored);
    const clusterState = await getClustersState();
    clusters = clusterState.clusters;
    activeClusterId = clusterState.activeClusterId;
    activeClusterTabId = stored.activeClusterTabId || activeClusterId || ALL_CLUSTERS_TAB_ID;
    syncClusterApiClients();
    setActiveClusterContext(activeClusterId);
    populateInlineSettingsFields();
    
    if (settings.displaySettings) {
        displaySettings = settings.displaySettings;
    }
    syncDisplaySettingsCheckboxes();
    applyDisplaySettings();
    
    if (settings.theme) {
        applyTheme(settings.theme);
    }

    const scriptsPanelCollapsedOnStartup = typeof settings.scriptsPanelCollapsed === 'undefined'
        ? true
        : Boolean(settings.scriptsPanelCollapsed);
    if (typeof settings.scriptsPanelCollapsed === 'undefined') {
        chrome.storage.local.set({ scriptsPanelCollapsed: true }).catch(() => {});
    }
    if (scriptsPanelCollapsedOnStartup) {
        scriptsBody.classList.add('hidden');
        scriptsToggleBtn.textContent = chrome.i18n.getMessage('scriptsShow') || 'Show';
    } else {
        scriptsToggleBtn.textContent = chrome.i18n.getMessage('scriptsToggle') || 'Hide';
    }
    if (!getEnabledClusters().length) {
        searchContainer?.classList.add('hidden');
        scriptsPanel?.classList.add('hidden');
        clusterTabs?.classList.add('hidden');
        loadingOverlay.classList.add('hidden');
        noAuthOverlay.classList.remove('hidden');
        return;
    }

    searchContainer?.classList.remove('hidden');
    scriptsPanel?.classList.remove('hidden');
    renderClusterTabs();
    await persistClusterContext();
    api = activeClusterId ? apiClients.get(activeClusterId) || null : null;

    const getResourceKey = (res) => {
        const clusterKey = res.__clusterId || activeClusterId || 'single';
        return res.vmid ? `${clusterKey}/${res.node}/${res.type}/${res.vmid}` : `${clusterKey}/node/${res.node}`;
    };

    scriptsSearchInput.addEventListener('input', () => {
        updateScriptsSearchClearState();
        renderScriptsList();
    });

    scriptsSearchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            resetScriptsSearch();
        }
    });

    scriptsSearchClearBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        resetScriptsSearch();
    });

    scriptsTypeFilters?.addEventListener('click', (event) => {
        const button = event.target.closest('.scripts-type-pill');
        if (!button) return;
        selectedScriptType = button.dataset.scriptType || 'all';
        updateScriptsTypeFilterButtons();
        renderScriptsList();
    });

    scriptsGuideClose?.addEventListener('click', () => {
        closeGuideModal();
    });

    scriptsGuideOpenPage?.addEventListener('click', () => {
        if (!currentGuidePageUrl) return;
        chrome.tabs.create({ url: currentGuidePageUrl });
    });

    scriptsGuideModal?.addEventListener('click', (event) => {
        if (event.target === scriptsGuideModal) {
            closeGuideModal();
        }
    });

    scriptsRefreshBtn.addEventListener('click', () => {
        loadScriptsCatalog(true);
    });

    scriptsToggleBtn.addEventListener('click', async () => {
        const hidden = scriptsBody.classList.toggle('hidden');
        scriptsToggleBtn.textContent = hidden
            ? (chrome.i18n.getMessage('scriptsShow') || 'Show')
            : (chrome.i18n.getMessage('scriptsToggle') || 'Hide');
        await chrome.storage.local.set({ scriptsPanelCollapsed: hidden });
    });

    scriptsInstallBtn.addEventListener('click', async () => {
        if (!selectedScriptSlugs.size) {
            setScriptsFeedback(chrome.i18n.getMessage('scriptsSelectFirst') || 'Please select at least one script.', 'error');
            return;
        }

        try {
            const selectedScripts = await getSelectedScriptRecords();
            const installable = selectedScripts.filter(script => script && script.installUrl);
            if (!installable.length) {
                setScriptsFeedback(chrome.i18n.getMessage('scriptsNoInstallUrl') || 'No install URLs found for selected scripts.', 'error');
                return;
            }

            const command = buildInstallCommandForScripts(installable);
            await navigator.clipboard.writeText(command);

            const targetNode = getTargetNodeName();
            if (!targetNode) {
                setScriptsFeedback(chrome.i18n.getMessage('scriptsNoNode') || 'No node available for shell opening.', 'error');
                return;
            }

            setScriptsFeedback(chrome.i18n.getMessage('scriptsCopiedOpening') || 'Commands copied. Opening shell...', 'success');
            const consoleOpenResult = await openConsole(targetNode, 'node', null, targetNode, api, activeClusterId);
            if (!consoleOpenResult?.tabId) {
                setScriptsFeedback(
                    chrome.i18n.getMessage('scriptsCopiedOpenFailed') || 'Commands copied. Could not detect shell tab. Paste manually.',
                    'info'
                );
                return;
            }

            const autoPasteResult = await tryAutoPasteIntoConsoleTab(consoleOpenResult.tabId, command, {
                wasNewTab: Boolean(consoleOpenResult.wasNewTab)
            });
            if (autoPasteResult.ok) {
                setScriptsFeedback(
                    chrome.i18n.getMessage('scriptsCopiedAutoPasted') || 'Commands copied and auto-pasted into shell.',
                    'success'
                );
            } else {
                setScriptsFeedback(
                    chrome.i18n.getMessage('scriptsCopiedPasteFallback') || 'Commands copied. Shell opened. Paste manually if needed.',
                    'info'
                );
            }
        } catch (error) {
            console.error('Script install action failed:', error);
            setScriptsFeedback(error.message || (chrome.i18n.getMessage('scriptsActionFailed') || 'Script action failed.'), 'error');
        }
    });

    const fetchAndRender = async (showLoading = false) => {
        if (showLoading) loadingOverlay.classList.remove('hidden');
        try {
            const enabledClusters = getEnabledClusters();
            resourcesByClusterId.clear();
            if (activeClusterTabId === ALL_CLUSTERS_TAB_ID) {
                const results = await Promise.all(enabledClusters.map(async (cluster) => {
                    const client = apiClients.get(cluster.id);
                    if (!client) return [];
                    const resources = await client.getResources();
                    const tagged = resources.map((resource) => ({
                        ...resource,
                        __clusterId: cluster.id,
                        __clusterName: cluster.name
                    }));
                    resourcesByClusterId.set(cluster.id, tagged);
                    return tagged;
                }));
                allResources = results.flat();
            } else {
                const cluster = clusters[activeClusterTabId] || clusters[activeClusterId];
                const clusterId = cluster?.id;
                const client = clusterId ? apiClients.get(clusterId) : null;
                if (!client || !clusterId) {
                    allResources = [];
                } else {
                    const resources = await client.getResources();
                    allResources = resources.map((resource) => ({
                        ...resource,
                        __clusterId: clusterId,
                        __clusterName: cluster.name
                    }));
                    resourcesByClusterId.set(clusterId, allResources);
                    api = client;
                }
            }

            // Keep optimistic status changes until cluster/resources catches up.
            allResources.forEach(resource => {
                const key = getResourceKey(resource);
                if (!pendingStatusOverrides.has(key)) return;
                const expectedStatus = pendingStatusOverrides.get(key);
                if (resource.status === expectedStatus) {
                    pendingStatusOverrides.delete(key);
                } else {
                    resource.status = expectedStatus;
                }
            });

            renderTagFilters(allResources);
            filterAndRender();
            renderScriptNodeOptions(allResources);
        } catch (error) {
            console.error('Proxmox API Error:', error);
            if (showLoading) {
                const safeMessage = escapeHtml(error && typeof error.message === 'string' ? error.message : error);
                loadingOverlay.innerHTML = `
                    <div style="color:var(--error); padding: 20px;">
                        <p><strong>Connection Failed</strong></p>
                        <p style="font-size: 0.8rem; margin: 10px 0;">${safeMessage}</p>
                        <button id="retry-btn" class="action-btn" style="margin-top: 15px;">Retry</button>
                    </div>
                `;
                document.getElementById('retry-btn').addEventListener('click', () => fetchAndRender(true));
            }
        } finally {
            if (showLoading) loadingOverlay.classList.add('hidden');
        }
    };

    const refreshUntilSynced = (attempt = 0) => {
        const delays = [3000, 6000, 12000];
        if (attempt >= delays.length || pendingStatusOverrides.size === 0) return;

        setTimeout(async () => {
            await fetchAndRender();
            if (pendingStatusOverrides.size > 0) {
                refreshUntilSynced(attempt + 1);
            }
        }, delays[attempt]);
    };

    loadScriptsCatalog(false);
    updateScriptsSearchClearState();
    updateScriptsTypeFilterButtons();

    // Initial load
    await setActiveClusterTab(activeClusterTabId || activeClusterId || ALL_CLUSTERS_TAB_ID);
    renderTagFilters(allResources);
    updateFailoverNodes(allResources, settings.proxmoxUrl);

    async function renderResources(resources) {
        resourceList.innerHTML = '';
        
        // Sort: Nodes first, then Running VMs, then Stopped VMs
        const sorted = resources.filter(r => ['node', 'qemu', 'lxc'].includes(r.type)).sort((a, b) => {
            if (a.type === 'node' && b.type !== 'node') return -1;
            if (a.type !== 'node' && b.type === 'node') return 1;
            if (a.status === 'running' && b.status !== 'running') return -1;
            if (a.status !== 'running' && b.status === 'running') return 1;
            const nameA = a.name || a.vmid || a.node || '';
            const nameB = b.name || b.vmid || b.node || '';
            return nameA.toString().localeCompare(nameB.toString());
        });

        for (const res of sorted) {
            const resourceApi = apiClients.get(res.__clusterId) || api;
            const clone = template.content.cloneNode(true);
            const item = clone.querySelector('.resource-item');
            
            // Set unique ID for persistence
            const clusterSegment = res.__clusterId || activeClusterId || 'cluster';
            const resId = res.vmid ? `vm-${clusterSegment}-${res.vmid}` : `node-${clusterSegment}-${res.node}`;
            item.setAttribute('data-id', resId);

            const itemMain = clone.querySelector('.item-main');
            const indicator = clone.querySelector('.status-indicator');
            const nameEl = clone.querySelector('.name');
            const typeNodeEl = clone.querySelector('.type-node');
            const nodeIdEl = clone.querySelector('.node-id');
            const uptimeEl = clone.querySelector('.uptime');
            const osTag = clone.querySelector('.tag.os');
            const ipTag = clone.querySelector('.tag.ip');
            const novncBtn = clone.querySelector('.novnc');
            const spiceBtn = clone.querySelector('.spice');
            const sshBtn = clone.querySelector('.ssh');
            const shellBtn = clone.querySelector('.shell');
            const userTags = clone.querySelector('.user-tags');

            // Resource Details Elements
            const cpuBar = clone.querySelector('.cpu-bar');
            const cpuValue = clone.querySelector('.cpu-value');
            const memBar = clone.querySelector('.mem-bar');
            const memValue = clone.querySelector('.mem-value');
            const diskBar = clone.querySelector('.disk-bar');
            const diskValue = clone.querySelector('.disk-value');
            const diskRow = clone.querySelector('#disk-row');

            nameEl.textContent = res.name || res.vmid || res.node;
            typeNodeEl.textContent = `${res.type.toUpperCase()} @ ${res.node}`;
            if (activeClusterTabId === ALL_CLUSTERS_TAB_ID && res.__clusterName) {
                const clusterBadge = document.createElement('span');
                clusterBadge.className = 'cluster-resource-badge';
                clusterBadge.textContent = res.__clusterName;
                typeNodeEl.appendChild(clusterBadge);
            }
            if (res.vmid) {
                nodeIdEl.textContent = `(ID ${res.vmid})`;
            }

            if (res.uptime && (res.status === 'running' || res.status === 'online')) {
                uptimeEl.textContent = formatUptime(res.uptime);
                uptimeEl.classList.remove('hidden');
            }
            
            indicator.classList.add((res.status === 'running' || res.status === 'online') ? 'status-running' : (res.status === 'stopped' ? 'status-stopped' : 'status-unknown'));

            if (currentExpandedId === resId) {
                item.classList.add('expanded');
            }
            itemMain.addEventListener('click', () => {
                const isExpanded = item.classList.contains('expanded');
                // Close others
                document.querySelectorAll('.resource-item.expanded').forEach(el => {
                    if (el !== item) el.classList.remove('expanded');
                });
                item.classList.toggle('expanded');
                currentExpandedId = item.classList.contains('expanded') ? resId : null;
                if (currentExpandedId) {
                    writeScopedUiValue('lastActiveResource', currentExpandedId);
                } else {
                    removeScopedUiValue('lastActiveResource');
                }
            });

            // Usage Stats (Initial from cluster/resources)
            updateUsageStats(clone, res);

            // Fetch details (IP, OS, Disks) for all types if status allows
            if (resourceApi && (res.status === 'running' || res.status === 'online' || res.type === 'node')) {
                resourceApi.getResourceDetails(res).then(details => {
                    // Update stats with potentially more accurate data from status/current
                    updateUsageStats(item, res);

                    if (details.os) {
                        osTag.textContent = details.os;
                        osTag.classList.remove('hidden');
                    }
                    if (details.ip) {
                        ipTag.textContent = details.ip;
                        ipTag.classList.remove('hidden');

                        // Handle SSH visibility
                        const os = (details.os || '').toLowerCase();
                        const linuxDistros = ['linux', 'debian', 'ubuntu', 'alpine', 'centos', 'fedora', 'arch', 'suse', 'proxmox'];
                        const isLinux = linuxDistros.some(d => os.includes(d)) || os.startsWith('l');
                        
                        if (res.type === 'node' || res.type === 'lxc' || isLinux) {
                            sshBtn.classList.remove('hidden');
                            sshBtn.onclick = (e) => {
                                e.stopPropagation();
                                chrome.tabs.create({ url: `ssh://${details.ip}` });
                            };
                        }
                    }

                    // Render Disks
                    const disksContainer = item.querySelector('#disks-container');
                    if (disksContainer) {
                        disksContainer.innerHTML = '';
                        if (details.disks && details.disks.length > 0) {
                            details.disks.forEach(disk => {
                                const diskRow = document.createElement('div');
                                diskRow.className = 'stat-row';
                                const isVM = res.type === 'qemu';
                                const perc = isVM ? 100 : ((disk.used !== null) ? (disk.used / disk.max * 100).toFixed(1) : 0);
                                const usedText = (disk.used !== null && !isVM) ? `${formatBytes(disk.used)} / ` : '';
                                
                                diskRow.innerHTML = `
                                    <span class="stat-label">
                                        <svg class="stat-icon" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6,2H18A2,2 0 0,1 20,4V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2M12,4A1,1 0 0,0 11,5A1,1 0 0,0 12,6A1,1 0 0,0 13,5A1,1 0 0,0 12,4M18,20V4H6V20H18M12,18A3,3 0 0,1 9,15A3,3 0 0,1 12,12A3,3 0 0,1 15,15A3,3 0 0,1 12,18M12,14A1,1 0 0,0 11,15A1,1 0 0,0 12,16A1,1 0 0,0 13,15A1,1 0 0,0 12,14Z"/></svg>
                                        ${disk.name}
                                    </span>
                                    <div class="progress-container">
                                        <div class="progress-bar disk-bar ${isVM ? 'allocated' : ''}" style="width: ${perc}%"></div>
                                    </div>
                                    <span class="stat-value">${usedText}${formatBytes(disk.max)}</span>
                                `;
                                disksContainer.appendChild(diskRow);
                            });
                        } else if (res.maxdisk) {
                            const diskRow = document.createElement('div');
                            diskRow.className = 'stat-row';
                            const isVM = res.type === 'qemu';
                            const diskPerc = isVM ? 100 : (res.disk / res.maxdisk * 100).toFixed(1);
                            const usedText = !isVM ? `${formatBytes(res.disk)} / ` : '';
                            
                            diskRow.innerHTML = `
                                <span class="stat-label">
                                    <svg class="stat-icon" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6,2H18A2,2 0 0,1 20,4V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2M12,4A1,1 0 0,0 11,5A1,1 0 0,0 12,6A1,1 0 0,0 13,5A1,1 0 0,0 12,4M18,20V4H6V20H18M12,18A3,3 0 0,1 9,15A3,3 0 0,1 12,12A3,3 0 0,1 15,15A3,3 0 0,1 12,18M12,14A1,1 0 0,0 11,15A1,1 0 0,0 12,16A1,1 0 0,0 13,15A1,1 0 0,0 12,14Z"/></svg>
                                    DISK
                                </span>
                                <div class="progress-container">
                                    <div class="progress-bar disk-bar ${isVM ? 'allocated' : ''}" style="width: ${diskPerc}%"></div>
                                </div>
                                <span class="stat-value">${usedText}${formatBytes(res.maxdisk)}</span>
                            `;
                            disksContainer.appendChild(diskRow);
                        }
                    }
                }).catch(err => console.error('Details error:', err));
            }

            const tagsContainer = clone.querySelector('.user-tags');
            if (res.tags) {
                tagsContainer.innerHTML = '';
                tagsContainer.classList.remove('hidden');
                // Proxmox tags are semicolon-separated
                res.tags.split(';').forEach(tag => {
                    if (!tag) return;
                    const span = document.createElement('span');
                    span.className = 'tag-pill';
                    span.textContent = tag;
                    tagsContainer.appendChild(span);
                });
            }

            // Power Controls
            const powerControls = clone.querySelector('.power-controls');
            const btnStart = powerControls.querySelector('.b-start');
            const btnShutdown = powerControls.querySelector('.b-shutdown');
            const btnStop = powerControls.querySelector('.b-stop');
            const btnReboot = powerControls.querySelector('.b-reboot');
            const powerStatus = powerControls.querySelector('.power-status');

            const updatePowerButtons = () => {
                const status = res.status;
                const type = res.type;
                [btnStart, btnShutdown, btnStop, btnReboot].forEach(b => b.classList.add('hidden'));

                if (type === 'node') {
                    btnShutdown.classList.remove('hidden');
                    btnReboot.classList.remove('hidden');
                } else {
                    if (status === 'stopped') {
                        btnStart.classList.remove('hidden');
                    } else if (status === 'running') {
                        btnShutdown.classList.remove('hidden');
                        btnStop.classList.remove('hidden');
                        btnReboot.classList.remove('hidden');
                    }
                }
            };

            updatePowerButtons();

            const pollStatus = async (targetStatus, maxAttempts = 20) => {
                let attempts = 0;
                const check = async () => {
                    attempts++;
                    try {
                        let currentStatus;
                        if (res.type === 'node') {
                            const data = await resourceApi.getNodeStatus(res.node);
                            // Proxmox nodes report 'online' when up
                            currentStatus = data.status === 'online' ? 'running' : 'stopped';
                        } else {
                            const data = await resourceApi.getResourceStatus(res.node, res.type, res.vmid);
                            currentStatus = data.status;
                        }

                        if (currentStatus === targetStatus || attempts >= maxAttempts) {
                            // Optimistic Update: update local state immediately if reached
                            if (currentStatus === targetStatus) {
                                const expectedStatus = (res.type === 'node' && targetStatus === 'running') ? 'online' : targetStatus;
                                pendingStatusOverrides.set(getResourceKey(res), expectedStatus);
                                res.status = (res.type === 'node' && targetStatus === 'running') ? 'online' : targetStatus;
                                filterAndRender();
                            }
                            powerStatus.textContent = chrome.i18n.getMessage('finalizing') || 'Finalizing...';
                            setTimeout(() => {
                                fetchAndRender().then(() => refreshUntilSynced());
                            }, 2500); // Wait a bit, then keep refreshing until cluster/resources catches up.
                        } else {
                            powerStatus.textContent = `${chrome.i18n.getMessage('actionSent') || 'Action sent!'} (${attempts}/${maxAttempts})`;
                            setTimeout(check, 2000);
                        }
                    } catch (err) {
                        console.error('Polling failed:', err);
                        fetchAndRender();
                    }
                };
                setTimeout(check, 2000);
            };

            const handleAction = async (action) => {
                powerStatus.classList.remove('hidden');
                powerStatus.textContent = chrome.i18n.getMessage('sendingAction') || 'Sending...';
                [btnStart, btnShutdown, btnStop, btnReboot].forEach(b => b.style.pointerEvents = 'none');

                try {
                    if (res.type === 'node') {
                        await resourceApi.nodeAction(res.node, action);
                    } else {
                        await resourceApi.vmAction(res.node, res.type, res.vmid, action);
                    }
                    powerStatus.textContent = chrome.i18n.getMessage('actionSent') || 'Action sent!';
                    
                    // Store the ID to scroll/expand back to it after reload
                    const clusterSegment = res.__clusterId || activeClusterId || 'cluster';
                    const resId = res.vmid ? `vm-${clusterSegment}-${res.vmid}` : `node-${clusterSegment}-${res.node}`;
                    writeScopedUiValue('lastActiveResource', resId);

                    // Determine target status for polling
                    if (action === 'start') {
                        pollStatus('running');
                    } else if (action === 'shutdown' || action === 'stop') {
                        pollStatus('stopped');
                    } else {
                        // Reboot or other: wait fixed time
                        setTimeout(() => fetchAndRender(), 4500);
                    }
                } catch (err) {
                    console.error('Action failed:', err);
                    powerStatus.textContent = 'Error!';
                    setTimeout(() => {
                        powerStatus.classList.add('hidden');
                        [btnStart, btnShutdown, btnStop, btnReboot].forEach(b => b.style.pointerEvents = 'auto');
                    }, 3000);
                }
            };

            btnStart.onclick = (e) => { e.stopPropagation(); handleAction('start'); };
            btnShutdown.onclick = (e) => { e.stopPropagation(); handleAction('shutdown'); };
            btnStop.onclick = (e) => { e.stopPropagation(); handleAction('stop'); };
            btnReboot.onclick = (e) => { e.stopPropagation(); handleAction('reboot'); };

            // Console and Spice Logic
            if (res.type === 'node') {
                novncBtn.classList.add('hidden');
                shellBtn.classList.remove('hidden');
                shellBtn.onclick = (e) => {
                    e.stopPropagation();
                    openConsole(res.node, 'node', null, res.node, resourceApi, res.__clusterId);
                };
            } else {
                novncBtn.onclick = (e) => {
                    e.stopPropagation();
                    openConsole(res.node, res.type, res.vmid, res.name, resourceApi, res.__clusterId);
                };

                if (res.type === 'qemu' && res.status === 'running') {
                    resourceApi?.isSpiceEnabled(res.node, res.type, res.vmid).then(enabled => {
                        if (enabled) {
                            spiceBtn.classList.remove('hidden');
                            spiceBtn.onclick = (e) => {
                                e.stopPropagation();
                                downloadSpiceFile(res, resourceApi);
                            };
                        }
                    });
                }
            }

            resourceList.appendChild(clone);
        }

        // Persistence: Check if we need to scroll to an item
        if (currentExpandedId) {
            const lastActiveItem = resourceList.querySelector(`[data-id="${currentExpandedId}"]`);
            if (lastActiveItem) {
                setTimeout(() => {
                    lastActiveItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        }
    }

    const sessionErrorOverlay = document.getElementById('session-error');
    const loginBtn = document.getElementById('login-btn');
    const closeSessionErrorBtn = document.getElementById('close-session-error');

    loginBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: settings.proxmoxUrl });
        sessionErrorOverlay.classList.add('hidden');
    });

    closeSessionErrorBtn.addEventListener('click', () => {
        sessionErrorOverlay.classList.add('hidden');
    });

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function focusTerminalInput(tabId) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    const target = document.querySelector('textarea.xterm-helper-textarea') || document.querySelector('.xterm textarea');
                    const viewport = document.querySelector('.xterm-viewport') || document.querySelector('.xterm-screen') || document.querySelector('.xterm');
                    if (viewport && typeof viewport.click === 'function') viewport.click();
                    if (target) target.focus();
                    return Boolean(target);
                }
            });
            return true;
        } catch (_error) {
            return false;
        }
    }

    async function readTerminalScreenText(tabId) {
        try {
            const result = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    const screenText = (document.querySelector('.xterm-rows')?.textContent ||
                        document.querySelector('.xterm-screen')?.textContent ||
                        '').trim();
                    return screenText;
                }
            });
            return result?.[0]?.result || '';
        } catch (_error) {
            return '';
        }
    }

    async function waitForTerminalScreenChangeUntil(tabId, beforeText, deadlineMs, intervalMs = 90) {
        while (Date.now() < deadlineMs) {
            await sleep(intervalMs);
            const now = await readTerminalScreenText(tabId);
            if (now && now !== beforeText) {
                return true;
            }
        }
        return false;
    }

    async function waitForTabComplete(tabId, timeoutMs) {
        if (timeoutMs <= 0) return false;
        try {
            const tab = await chrome.tabs.get(tabId);
            if (tab?.status === 'complete') return true;
        } catch (_error) {
            return false;
        }
        return await new Promise(resolve => {
            let settled = false;
            const done = (result) => {
                if (settled) return;
                settled = true;
                chrome.tabs.onUpdated.removeListener(handleUpdate);
                clearTimeout(timeoutId);
                resolve(result);
            };
            const handleUpdate = (updatedTabId, changeInfo) => {
                if (updatedTabId !== tabId) return;
                if (changeInfo.status === 'complete') done(true);
            };
            const timeoutId = setTimeout(() => done(false), timeoutMs);
            chrome.tabs.onUpdated.addListener(handleUpdate);
        });
    }

    async function waitForTerminalReady(tabId, deadlineMs, options = {}) {
        const wasNewTab = Boolean(options.wasNewTab);
        let promptStabilityHits = 0;
        const minPromptStability = wasNewTab ? 2 : 1;

        while (Date.now() < deadlineMs) {
            try {
                const probe = await chrome.scripting.executeScript({
                    target: { tabId },
                    func: () => {
                        const target = document.querySelector('textarea.xterm-helper-textarea') || document.querySelector('.xterm textarea');
                        const shellVisible = Boolean(document.querySelector('.xterm .xterm-screen, .xterm-screen'));
                        const screenText = (document.querySelector('.xterm-rows')?.textContent || document.querySelector('.xterm-screen')?.textContent || '').trim();
                        if (!target) return { ready: false, reason: 'no_terminal_target', screenText };
                        const rect = target.getBoundingClientRect();
                        const visible = rect.width > 0 && rect.height > 0;
                        return {
                            ready: visible || shellVisible,
                            reason: visible || shellVisible ? 'ready' : 'terminal_hidden',
                            screenText
                        };
                    }
                });
                const payload = probe?.[0]?.result || { ready: false, reason: 'probe_no_result' };
                const hasPromptLikeScreen = Boolean(payload.screenText && payload.screenText.length > 0);
                if (hasPromptLikeScreen) {
                    promptStabilityHits += 1;
                } else {
                    promptStabilityHits = 0;
                }
                if (payload.ready && promptStabilityHits >= minPromptStability) {
                    return { ok: true, promptStable: true, screenText: payload.screenText || '' };
                }
            } catch (_error) {
                return { ok: false, reason: 'timeout_or_no_effect' };
            }
            await sleep(wasNewTab ? 120 : 90);
        }
        return { ok: false, reason: 'timeout_or_no_effect' };
    }

    async function performBestEffortPaste(tabId, command, wasNewTab, deadlineMs) {
        const focused = await focusTerminalInput(tabId);
        if (!focused) {
            return { ok: false, reason: 'timeout_or_no_effect' };
        }

        const beforeText = await readTerminalScreenText(tabId);
        let injected;
        try {
            injected = await chrome.scripting.executeScript({
                target: { tabId },
                args: [command],
                func: (pasteText) => {
                    const target = document.querySelector('textarea.xterm-helper-textarea') || document.querySelector('.xterm textarea');
                    const viewport = document.querySelector('.xterm-viewport') || document.querySelector('.xterm-screen') || document.querySelector('.xterm');
                    if (!target) {
                        return { hasTarget: false, wroteIntoInput: false };
                    }

                    if (viewport && typeof viewport.click === 'function') {
                        viewport.click();
                    }
                    target.focus();

                    let wroteIntoInput = false;
                    try {
                        if (typeof DataTransfer !== 'undefined') {
                            const transfer = new DataTransfer();
                            transfer.setData('text/plain', pasteText);
                            const pasteEvent = new ClipboardEvent('paste', {
                                bubbles: true,
                                cancelable: true,
                                clipboardData: transfer
                            });
                            target.dispatchEvent(pasteEvent);
                        }
                    } catch (_error) {
                        // Best-effort only.
                    }

                    try {
                        target.setRangeText(pasteText, target.selectionStart || 0, target.selectionEnd || 0, 'end');
                        target.dispatchEvent(new InputEvent('beforeinput', {
                            bubbles: true,
                            cancelable: true,
                            inputType: 'insertFromPaste',
                            data: pasteText
                        }));
                        target.dispatchEvent(new InputEvent('input', {
                            bubbles: true,
                            inputType: 'insertFromPaste',
                            data: pasteText
                        }));
                        wroteIntoInput = true;
                    } catch (_error) {
                        // Best-effort only.
                    }

                    return { hasTarget: true, wroteIntoInput };
                }
            });
        } catch (_error) {
            return { ok: false, reason: 'timeout_or_no_effect' };
        }

        const payload = injected?.[0]?.result || { hasTarget: false, wroteIntoInput: false };
        if (!payload.hasTarget) {
            return { ok: false, reason: 'timeout_or_no_effect' };
        }
        if (!wasNewTab && payload.wroteIntoInput) {
            return { ok: true, method: 'best_effort_existing_tab_input_injected' };
        }

        const changed = await waitForTerminalScreenChangeUntil(tabId, beforeText, deadlineMs, 85);
        if (changed) {
            return { ok: true, method: 'best_effort_screen_change' };
        }
        if (wasNewTab && payload.wroteIntoInput) {
            return { ok: true, method: 'best_effort_new_tab_plausible' };
        }
        return { ok: false, reason: 'timeout_or_no_effect' };
    }

    async function tryAutoPasteIntoConsoleTab(tabId, command, options = {}) {
        const wasNewTab = Boolean(options.wasNewTab);
        if (activePasteFlows.has(tabId)) {
            return { ok: false, reason: 'timeout_or_no_effect' };
        }
        activePasteFlows.add(tabId);
        try {
            const startedAt = Date.now();
            const deadlineMs = startedAt + AUTO_PASTE_TIMEOUT_MS;
            if (wasNewTab) {
                const tabReadyTimeout = Math.min(NEW_TAB_READY_TIMEOUT_MS, Math.max(0, deadlineMs - Date.now()));
                const pageReady = await waitForTabComplete(tabId, tabReadyTimeout);
                if (!pageReady || Date.now() >= deadlineMs) {
                    return { ok: false, reason: 'timeout_or_no_effect' };
                }
                const terminalReadyDeadlineMs = Math.min(deadlineMs, Date.now() + 450);
                const terminalReady = await waitForTerminalReady(tabId, terminalReadyDeadlineMs, { wasNewTab });
                if (Date.now() >= deadlineMs) {
                    return { ok: false, reason: 'timeout_or_no_effect' };
                }
            }

            if (wasNewTab) {
                const settleBudget = Math.min(NEW_TAB_SETTLE_DELAY_MS, Math.max(0, deadlineMs - Date.now()));
                if (settleBudget > 0) {
                    await sleep(settleBudget);
                }
            }
            if (Date.now() >= deadlineMs) {
                return { ok: false, reason: 'timeout_or_no_effect' };
            }

            return await performBestEffortPaste(tabId, command, wasNewTab, deadlineMs);
        } finally {
            activePasteFlows.delete(tabId);
        }
    }

    async function openConsole(node, type, vmid, name, apiOverride = null, clusterId = null) {
        const targetApi = apiOverride || api;
        if (!targetApi) return null;
        const clusterUrl = clusterId && clusters[clusterId]?.proxmoxUrl
            ? clusters[clusterId].proxmoxUrl
            : settings.proxmoxUrl;
        debugStatus.style.display = 'block';
        debugStatus.textContent = 'Checking session...';
        console.log(`[Popup] Attempting to open console for ${node} ${vmid || ''}`);
        
        try {
            const hasSession = await targetApi.checkSession();
            console.log(`[Popup] Session check result: ${hasSession}`);
            
            if (!hasSession) {
                console.log('[Popup] Showing session error overlay');
                debugStatus.textContent = 'Session invalid. Login required.';
                sessionErrorOverlay.classList.remove('hidden');
                return null;
            }
            
            const url = targetApi.getConsoleUrl(node, type, vmid, name);
            if (!url) return null;

            const tabSettings = await chrome.storage.local.get(['consoleTabMode']);
            const mode = tabSettings.consoleTabMode || 'duplicate';

            if (mode === 'single') {
                // Reuse any existing Proxmox console tab (novnc or xtermjs)
                const tabs = await chrome.tabs.query({ url: `${clusterUrl}/*` });
                const consoleTab = tabs.find(t => {
                    try {
                        const tabUrl = new URL(t.url);
                        const params = tabUrl.searchParams;
                        const hasConsoleParam = params.has('console');
                        const isNovnc = params.get('novnc') === '1';
                        const isXtermjs = params.get('xtermjs') === '1';
                        return hasConsoleParam && (isNovnc || isXtermjs);
                    } catch (e) {
                        // Ignore tabs with URLs that cannot be parsed
                        return false;
                    }
                });
                if (consoleTab) {
                    const updatedTab = await chrome.tabs.update(consoleTab.id, { url, active: true });
                    debugStatus.textContent = 'Updated existing console tab.';
                    setTimeout(() => { debugStatus.style.display = 'none'; }, 2000);
                    return { tabId: updatedTab?.id || consoleTab.id || null, wasNewTab: false };
                }
            } else if (mode === 'duplicate') {
                // Focus existing tab for this specific resource
                const tabs = await chrome.tabs.query({ url: `${clusterUrl}/*` });
                const existingTab = tabs.find(t => {
                    try {
                        const tabUrl = new URL(t.url);
                        const params = tabUrl.searchParams;

                        const hasConsoleParam = params.has('console');
                        const isNovnc = params.get('novnc') === '1';
                        const isXtermjs = params.get('xtermjs') === '1';
                        if (!hasConsoleParam || (!isNovnc && !isXtermjs)) {
                            return false;
                        }

                        if (vmid) {
                            // Match exact VMID
                            return params.get('vmid') === String(vmid);
                        }

                        // Node console: match exact node name
                        return params.get('node') === node;
                    } catch (e) {
                        // Ignore tabs with URLs that cannot be parsed
                        return false;
                    }
                });
                if (existingTab) {
                    const updatedTab = await chrome.tabs.update(existingTab.id, { active: true });
                    debugStatus.textContent = 'Focusing existing tab.';
                    setTimeout(() => { debugStatus.style.display = 'none'; }, 2000);
                    return { tabId: updatedTab?.id || existingTab.id || null, wasNewTab: false };
                }
            }

            console.log(`[Popup] Opening console URL: ${url}`);
            debugStatus.textContent = 'Opening console...';
            const createdTab = await chrome.tabs.create({ url });
            setTimeout(() => { debugStatus.style.display = 'none'; }, 2000);
            return { tabId: createdTab?.id || null, wasNewTab: true };
        } catch (e) {
            console.error('[Popup] Failed to open console:', e);
            debugStatus.textContent = `Error: ${e.message}`;
            const url = targetApi.getConsoleUrl(node, type, vmid, name);
            if (url) {
                const fallbackTab = await chrome.tabs.create({ url });
                return { tabId: fallbackTab?.id || null, wasNewTab: true };
            }
            return null;
        }
    }

    async function downloadSpiceFile(res, api) {
        try {
            const spiceData = await api.getSpiceProxy(res.node, res.type, res.vmid);
            let config = "[virt-viewer]\n";
            for (const [key, value] of Object.entries(spiceData)) {
                config += `${key}=${value}\n`;
            }
            
            const blob = new Blob([config], { type: 'application/x-virt-viewer' });
            const url = URL.createObjectURL(blob);
            const filename = `${res.name || res.vmid}.vv`;
            
            chrome.downloads.download({
                url: url,
                filename: filename,
                conflictAction: 'overwrite',
                saveAs: false
            }, (downloadId) => {
                if (downloadId) {
                    // Listen for when the download is actually complete
                    const onDownloadChanged = (delta) => {
                        if (delta.id === downloadId && delta.state && delta.state.current === 'complete') {
                            chrome.downloads.onChanged.removeListener(onDownloadChanged);
                            chrome.downloads.open(downloadId);
                        }
                    };
                    chrome.downloads.onChanged.addListener(onDownloadChanged);
                }
            });
        } catch (error) {
            const message = `Failed to get SPICE proxy: ${error.message}`;
            debugStatus.style.display = 'block';
            debugStatus.textContent = message;
            setInlineSettingsStatus(message, 'error');
        }
    }

    function filterAndRender() {
        const query = searchInput.value.toLowerCase().trim();
        
        const filtered = allResources.filter(res => {
            // 1. Type filter
            if (activeFilters.type !== 'all' && res.type !== activeFilters.type) return false;

            // 2. Status filter
            if (activeFilters.status !== 'all' && res.status !== activeFilters.status) return false;

            const name = (res.name || res.vmid || res.node || '').toString().toLowerCase();
            const vmid = (res.vmid || '').toString().toLowerCase();
            const node = (res.node || '').toString().toLowerCase();
            const type = (res.type || '').toString().toLowerCase();
            const ip = (res.ip || '').toString().toLowerCase();
            const tags = (res.tags || '').toString().toLowerCase();
            
            // 3. Tag filter (from clickable pills)
            if (activeFilters.tag && !tags.includes(activeFilters.tag.toLowerCase())) return false;

            // 4. Search query (keyboard input)
            if (!query) return true;

            return name.includes(query) || vmid.includes(query) || node.includes(query) || 
                   type.includes(query) || ip.includes(query) || tags.includes(query);
        });
        renderResources(filtered);
    }

    function renderTagFilters(resources) {
        const allTags = new Set();
        resources.forEach(res => {
            if (res.tags) {
                res.tags.split(';').forEach(t => {
                    if (t) allTags.add(t);
                });
            }
        });

        if (allTags.size === 0) {
            tagFiltersContainer.classList.add('hidden');
            tagFiltersSection?.classList.add('hidden');
            return;
        }

        tagFiltersContainer.innerHTML = '';
        tagFiltersContainer.classList.remove('hidden');
        tagFiltersSection?.classList.remove('hidden');

        // Sort tags alphabetically
        const sortedTags = Array.from(allTags).sort();

        sortedTags.forEach(tag => {
            const pill = document.createElement('button');
            pill.className = 'tag-filter-pill';
            if (activeFilters.tag === tag) pill.classList.add('active');
            pill.textContent = tag;
            
            pill.addEventListener('click', () => {
                if (activeFilters.tag === tag) {
                    activeFilters.tag = null;
                    pill.classList.remove('active');
                } else {
                    activeFilters.tag = tag;
                    document.querySelectorAll('.tag-filter-pill').forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                }
                filterAndRender();
            });
            
            tagFiltersContainer.appendChild(pill);
        });
    }

    function updateUsageStats(container, res) {
        const cpuBar = container.querySelector('.cpu-bar');
        const cpuValue = container.querySelector('.cpu-value');
        const memBar = container.querySelector('.mem-bar');
        const memValue = container.querySelector('.mem-value');
        const loadRow = container.querySelector('#load-row');
        const loadValue = container.querySelector('.load-value');
        const ioDiskValue = container.querySelector('.io-disk-value');
        const ioNetValue = container.querySelector('.io-net-value');
        const haRow = container.querySelector('#ha-row');
        const haValue = container.querySelector('.ha-value');

        if (!cpuBar || !memBar) return;

        if (res.status === 'running' || res.status === 'online' || res.type === 'node') {
            // CPU
            const cpuPerc = (res.cpu * 100).toFixed(1);
            cpuBar.style.width = `${cpuPerc}%`;
            cpuValue.textContent = `${cpuPerc}%`;

            // RAM
            const memPerc = (res.maxmem > 0) ? (res.mem / res.maxmem * 100).toFixed(1) : 0;
            memBar.style.width = `${memPerc}%`;
            memValue.textContent = `${formatBytes(res.mem)} / ${formatBytes(res.maxmem)}`;

            // IO Stats
            if (ioDiskValue) {
                const read = formatBytes(res.diskread || 0);
                const write = formatBytes(res.diskwrite || 0);
                ioDiskValue.textContent = `R: ${read}/s W: ${write}/s`;
            }
            if (ioNetValue) {
                const inNet = formatBytes(res.netin || 0);
                const outNet = formatBytes(res.netout || 0);
                ioNetValue.textContent = `IN: ${inNet}/s OUT: ${outNet}/s`;
            }

            // Node specifics
            if (res.type === 'node' && loadRow) {
                loadRow.classList.remove('hidden');
                // Proxmox node status has loadavg array
                if (Array.isArray(res.loadavg)) {
                    loadValue.textContent = res.loadavg.join(', ');
                } else if (res.loadavg) {
                    loadValue.textContent = res.loadavg;
                }
            }

            // HA
            if (res.hastatus && haRow) {
                haRow.classList.remove('hidden');
                haValue.textContent = res.hastatus;
            }
        }
    }

    function formatUptime(seconds) {
        if (!seconds) return '';
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);

        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0 || parts.length === 0) parts.push(`${m}m`);
        
        return parts.join(' ');
    }

    async function updateFailoverNodes(resources, primaryUrl) {
        try {
            const nodes = resources.filter(res => res.type === 'node');
            if (nodes.length <= 1) return;

            const urlObj = new URL(primaryUrl);
            const port = urlObj.port || (urlObj.protocol === 'https:' ? '8006' : '80');
            const protocol = urlObj.protocol;

            // Generate URLs for all nodes, assuming they listen on the same port
            const failoverUrls = nodes.map(n => `${protocol}//${n.node}:${port}`);
            
            // Unique URLs including the primary one
            const uniqueUrls = [...new Set([primaryUrl, ...failoverUrls])];
            
            await chrome.storage.local.set({ failoverUrls: uniqueUrls });
        } catch (e) {
            console.error('Failed to update failover nodes:', e);
        }
    }

    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 B';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }
});
