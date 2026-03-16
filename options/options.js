import { ProxmoxAPI } from '../lib/proxmox-api.js';
import { openOrFocusFloatingWindow } from '../lib/window-launcher.js';
import {
    createEncryptedSettingsBackup,
    downloadEncryptedBackupFile,
    importEncryptedSettingsFromText
} from '../lib/settings-backup.js';
import {
    buildClusterPayload,
    createClusterSkeleton,
    getClusterList,
    getClustersState,
    removeClusterAndResolve,
    resolveActiveClusterId,
    saveClustersState
} from '../lib/cluster-store.js';
import { resetToFactoryDefaults } from '../lib/settings-reset.js';

document.addEventListener('DOMContentLoaded', async () => {
    const proxmoxUrlInput = document.getElementById('proxmox-url');
    const apiUserInput = document.getElementById('api-user');
    const apiTokenIdInput = document.getElementById('api-tokenid');
    const apiSecretInput = document.getElementById('api-secret');
    const themeSelect = document.getElementById('theme-select');
    const saveBtn = document.getElementById('save-settings-btn');
    const testBtn = document.getElementById('test-connection-btn');
    const resetBtn = document.getElementById('reset-settings-btn');
    const closeBtn = document.getElementById('close-settings-btn');
    const status = document.getElementById('status');
    const toggleSecretBtn = document.getElementById('toggle-secret');
    const scriptsCacheTtlInput = document.getElementById('scripts-cache-ttl');
    const defaultScriptNodeInput = document.getElementById('default-script-node');
    const defaultActionClickModeSelect = document.getElementById('default-action-click-mode');
    const openFloatingWindowBtn = document.getElementById('open-floating-window-btn');
    const clusterSelect = document.getElementById('cluster-select');
    const clusterNameInput = document.getElementById('cluster-name');
    const addClusterBtn = document.getElementById('add-cluster-btn');
    const removeClusterBtn = document.getElementById('remove-cluster-btn');
    const exportPasswordInput = document.getElementById('export-password');
    const exportPasswordConfirmInput = document.getElementById('export-password-confirm');
    const exportSettingsBtn = document.getElementById('export-settings-btn');
    const importFileInput = document.getElementById('import-file');
    const importPasswordInput = document.getElementById('import-password');
    const importSettingsBtn = document.getElementById('import-settings-btn');
    const settingsSubtabButtons = document.querySelectorAll('[data-settings-subtab]');
    const settingsSubtabPanels = document.querySelectorAll('[data-settings-panel]');
    let clusters = {};
    let activeClusterId = null;
    let pendingOptionsClusterRemovalId = null;
    let pendingOptionsResetConfirmation = false;
    const DEFAULT_SETTINGS = {
        apiUser: 'api-admin@pve',
        apiTokenId: 'full-access',
        theme: 'auto',
        consoleTabMode: 'duplicate',
        communityScriptsCacheTtlHours: 12,
        defaultScriptNode: '',
        defaultActionClickMode: 'sidepanel'
    };

    // i18n Initialization
    function initI18n() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = chrome.i18n.getMessage(key);
            if (translation) el.textContent = translation;
        });
    }

    initI18n();

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
    const updateOptionsInputClearButtons = attachClearButtonsToInputs([
        'cluster-name',
        'proxmox-url',
        'api-user',
        'api-tokenid',
        'default-script-node',
        'export-password',
        'export-password-confirm',
        'import-password'
    ]);

    function normalizeAndValidateHttpsUrl(input) {
        const raw = (input || '').trim();
        if (!raw) {
            return { ok: false, error: 'Please enter a Proxmox URL.' };
        }

        const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw) ? raw : `https://${raw}`;
        let parsed;

        try {
            parsed = new URL(withScheme);
        } catch (e) {
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
            return 'Network request blocked or unreachable. On Windows, this is often an untrusted Proxmox TLS certificate. Open the Proxmox URL in Chrome once, trust/accept the certificate, then retry.';
        }

        if (lower.includes('timeout')) {
            return `${message}. Check VPN/LAN reachability and firewall rules.`;
        }

        return message;
    }

    // Tab Management
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab');
            
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(target).classList.add('active');
        });
    });

    settingsSubtabButtons.forEach((button) => {
        button.addEventListener('click', () => {
            setActiveSettingsSubtab(button.dataset.settingsSubtab);
        });
    });

    // Theme Management
    function applyTheme(theme) {
        document.body.classList.remove('light-theme', 'dark-theme');
        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        }
        // 'auto' does nothing, letting CSS media query handle it
    }

    function getActiveCluster() {
        return activeClusterId ? clusters[activeClusterId] : null;
    }

    function setActiveSettingsSubtab(tab) {
        const targetTab = tab === 'backup' ? 'backup' : 'cluster';
        settingsSubtabButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.settingsSubtab === targetTab);
        });
        settingsSubtabPanels.forEach((panel) => {
            panel.classList.toggle('active', panel.dataset.settingsPanel === targetTab);
        });
    }

    function fillClusterForm() {
        const cluster = getActiveCluster();
        clusterNameInput.value = cluster?.name || '';
        proxmoxUrlInput.value = cluster?.proxmoxUrl || '';
        apiUserInput.value = cluster?.apiUser || DEFAULT_SETTINGS.apiUser;
        apiTokenIdInput.value = cluster?.apiTokenId || DEFAULT_SETTINGS.apiTokenId;
        apiSecretInput.value = cluster?.apiSecret || '';
        updateOptionsInputClearButtons();
    }

    function renderClusterSelect() {
        clusterSelect.innerHTML = '';
        const options = getClusterList(clusters);
        options.forEach((cluster) => {
            const option = document.createElement('option');
            option.value = cluster.id;
            option.textContent = cluster.name;
            clusterSelect.appendChild(option);
        });
        if (activeClusterId && clusters[activeClusterId]) {
            clusterSelect.value = activeClusterId;
        }
        removeClusterBtn.disabled = options.length <= 1;
    }

    function resetOptionsRemoveClusterConfirmation() {
        pendingOptionsClusterRemovalId = null;
        if (removeClusterBtn) {
            removeClusterBtn.textContent = 'Remove Cluster';
        }
    }

    function resetOptionsResetConfirmation() {
        pendingOptionsResetConfirmation = false;
        if (resetBtn) {
            resetBtn.textContent = chrome.i18n.getMessage('resetSettings') || 'Reset Settings';
        }
    }

    async function persistClusterFromForm() {
        const existing = getActiveCluster() || createClusterSkeleton(clusters, clusterNameInput.value.trim() || 'Cluster');
        const user = apiUserInput.value.trim();
        const tokenId = apiTokenIdInput.value.trim();
        const secret = apiSecretInput.value.trim();
        const apiToken = user && tokenId && secret ? `${user}!${tokenId}=${secret}` : '';
        const updated = buildClusterPayload({
            ...existing,
            name: (clusterNameInput.value.trim() || existing.name || 'Cluster'),
            proxmoxUrl: proxmoxUrlInput.value.trim(),
            apiUser: user,
            apiTokenId: tokenId,
            apiSecret: secret,
            apiToken
        }, clusters, 'Cluster');
        clusters = { ...clusters, [updated.id]: updated };
        activeClusterId = resolveActiveClusterId(clusters, updated.id);
        await saveClustersState(clusters, activeClusterId);
        await chrome.storage.local.set({
            activeClusterId,
            activeClusterTabId: activeClusterId,
            proxmoxUrl: updated.proxmoxUrl,
            apiUser: updated.apiUser,
            apiTokenId: updated.apiTokenId,
            apiSecret: updated.apiSecret,
            apiToken: updated.apiToken
        });
        renderClusterSelect();
    }

    async function reloadSettingsFromStorage() {
        const items = await chrome.storage.local.get([
            'theme',
            'consoleTabMode',
            'communityScriptsCacheTtlHours',
            'defaultScriptNode',
            'defaultActionClickMode'
        ]);
        const clusterState = await getClustersState();
        clusters = clusterState.clusters;
        activeClusterId = clusterState.activeClusterId || getClusterList(clusters)[0]?.id || null;
        if (!activeClusterId) {
            const blank = createClusterSkeleton(clusters, 'Cluster');
            clusters = { ...clusters, [blank.id]: blank };
            activeClusterId = blank.id;
            await saveClustersState(clusters, activeClusterId);
        }
        renderClusterSelect();
        fillClusterForm();
        scriptsCacheTtlInput.value = Number(items.communityScriptsCacheTtlHours || 12);
        defaultScriptNodeInput.value = items.defaultScriptNode || '';
        defaultActionClickModeSelect.value = ['sidepanel', 'floating'].includes(items.defaultActionClickMode)
            ? items.defaultActionClickMode
            : 'sidepanel';
        if (items.theme) {
            themeSelect.value = items.theme;
            applyTheme(items.theme);
        } else {
            themeSelect.value = DEFAULT_SETTINGS.theme;
            applyTheme(DEFAULT_SETTINGS.theme);
        }
        if (items.consoleTabMode) {
            document.getElementById('tab-mode-select').value = items.consoleTabMode;
        } else {
            document.getElementById('tab-mode-select').value = DEFAULT_SETTINGS.consoleTabMode;
        }
        updateOptionsInputClearButtons();
    }

    await reloadSettingsFromStorage();
    setActiveSettingsSubtab('cluster');

    themeSelect.addEventListener('change', () => {
        applyTheme(themeSelect.value);
    });

    clusterSelect?.addEventListener('change', async () => {
        resetOptionsResetConfirmation();
        const selectedId = clusterSelect.value;
        if (!selectedId || !clusters[selectedId]) return;
        activeClusterId = selectedId;
        await chrome.storage.local.set({ activeClusterId, activeClusterTabId: activeClusterId });
        resetOptionsRemoveClusterConfirmation();
        fillClusterForm();
    });

    clusterNameInput?.addEventListener('change', async () => {
        resetOptionsResetConfirmation();
        const cluster = getActiveCluster();
        if (!cluster?.id) return;
        const updated = buildClusterPayload({
            ...cluster,
            name: clusterNameInput.value.trim() || cluster.name || 'Cluster'
        }, clusters, 'Cluster');
        clusters = { ...clusters, [cluster.id]: updated };
        activeClusterId = resolveActiveClusterId(clusters, updated.id);
        await saveClustersState(clusters, activeClusterId);
        await chrome.storage.local.set({ activeClusterId, activeClusterTabId: activeClusterId });
        renderClusterSelect();
        resetOptionsRemoveClusterConfirmation();
    });

    addClusterBtn?.addEventListener('click', async () => {
        resetOptionsResetConfirmation();
        await persistClusterFromForm();
        const newCluster = createClusterSkeleton(clusters, `Cluster ${getClusterList(clusters).length + 1}`);
        clusters = { ...clusters, [newCluster.id]: newCluster };
        activeClusterId = newCluster.id;
        await saveClustersState(clusters, activeClusterId);
        renderClusterSelect();
        resetOptionsRemoveClusterConfirmation();
        fillClusterForm();
        status.textContent = 'Cluster added.';
        status.style.color = 'var(--success)';
    });

    removeClusterBtn?.addEventListener('click', async () => {
        resetOptionsResetConfirmation();
        const list = getClusterList(clusters);
        if (list.length <= 1) {
            status.textContent = 'At least one cluster is required.';
            status.style.color = 'var(--error)';
            return;
        }
        const cluster = getActiveCluster();
        if (!cluster) return;
        if (pendingOptionsClusterRemovalId !== cluster.id) {
            pendingOptionsClusterRemovalId = cluster.id;
            if (removeClusterBtn) {
                removeClusterBtn.textContent = 'Click again to remove';
            }
            status.textContent = `Click "Remove Cluster" again to delete "${cluster.name}".`;
            status.style.color = 'var(--text-secondary)';
            return;
        }
        const removed = removeClusterAndResolve(clusters, cluster.id, activeClusterId, { ensureOneCluster: true });
        clusters = removed.clusters;
        activeClusterId = removed.activeClusterId;
        await saveClustersState(clusters, activeClusterId);
        if (activeClusterId) {
            const nextCluster = clusters[activeClusterId];
            await chrome.storage.local.set({
                activeClusterId,
                activeClusterTabId: activeClusterId,
                proxmoxUrl: nextCluster.proxmoxUrl || '',
                apiUser: nextCluster.apiUser || '',
                apiTokenId: nextCluster.apiTokenId || '',
                apiSecret: nextCluster.apiSecret || '',
                apiToken: nextCluster.apiToken || ''
            });
        }
        const refreshedState = await getClustersState();
        clusters = refreshedState.clusters;
        activeClusterId = refreshedState.activeClusterId;
        renderClusterSelect();
        resetOptionsRemoveClusterConfirmation();
        fillClusterForm();
        status.textContent = 'Cluster removed.';
        status.style.color = 'var(--success)';
    });

    // Toggle Secret Visibility
    toggleSecretBtn.addEventListener('click', () => {
        const isPassword = apiSecretInput.type === 'password';
        apiSecretInput.type = isPassword ? 'text' : 'password';
        toggleSecretBtn.innerHTML = isPassword 
            ? '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12,17.5C14.33,17.5 16.31,16.04 17.11,14H1.5L9,14H15.11C14.31,16.04 12.33,17.5 12,17.5M12,5C7,5 2.73,8.11 1,12.5C2.73,16.89 7,20 12,20C17,20 21.27,16.89 23,12.5C21.27,8.11 17,5 12,5M12,18.5C9.67,18.5 7.69,17.04 6.89,15H17.11C16.31,17.04 14.33,18.5 12,18.5Z"/></svg>'
            : '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/></svg>';
    });

    // Save settings
    saveBtn.addEventListener('click', async () => {
        resetOptionsResetConfirmation();
        const normalized = normalizeAndValidateHttpsUrl(proxmoxUrlInput.value);
        const user = apiUserInput.value.trim();
        const tokenId = apiTokenIdInput.value.trim();
        const secret = apiSecretInput.value.trim();
        const theme = themeSelect.value;
        const communityScriptsCacheTtlHours = Math.max(1, Math.min(168, Number(scriptsCacheTtlInput.value || 12)));
        const defaultScriptNode = defaultScriptNodeInput.value.trim();
        const defaultActionClickMode = defaultActionClickModeSelect.value === 'floating' ? 'floating' : 'sidepanel';

        if (!normalized.ok || !user || !tokenId || !secret) {
            status.textContent = normalized.ok ? 'Please fill in all fields.' : normalized.error;
            status.style.color = 'var(--error)';
            return;
        }

        const url = normalized.url;
        proxmoxUrlInput.value = url;
        await persistClusterFromForm();
        await chrome.storage.local.set({
            theme: theme,
            consoleTabMode: document.getElementById('tab-mode-select').value,
            communityScriptsCacheTtlHours,
            defaultScriptNode,
            defaultActionClickMode
        });

        status.textContent = 'Settings saved successfully!';
        status.style.color = 'var(--success)';

        // Request host permission
        try {
            await ensureHostPermission(normalized.originPattern);
        } catch (e) {
            console.error('Host permission request failed:', e);
        }

        setTimeout(() => {
            status.textContent = '';
        }, 3000);
    });

    // Test Connection
    testBtn.addEventListener('click', async () => {
        resetOptionsResetConfirmation();
        const normalized = normalizeAndValidateHttpsUrl(proxmoxUrlInput.value);
        const user = apiUserInput.value.trim();
        const tokenId = apiTokenIdInput.value.trim();
        const secret = apiSecretInput.value.trim();

        if (!normalized.ok || !user || !tokenId || !secret) {
            status.textContent = normalized.ok ? 'Please fill in all fields to test.' : normalized.error;
            status.style.color = 'var(--error)';
            return;
        }

        status.textContent = 'Testing connection...';
        status.style.color = 'var(--text-secondary)';

        try {
            const permissionGranted = await ensureHostPermission(normalized.originPattern);
            if (!permissionGranted) {
                throw new Error(`Host permission denied for ${normalized.originPattern}`);
            }

            const fullToken = `${user}!${tokenId}=${secret}`;
            const api = new ProxmoxAPI(normalized.url, fullToken);
            const version = await api.fetch('/version');

            proxmoxUrlInput.value = normalized.url;
            await persistClusterFromForm();

            status.textContent = `Connection successful! Proxmox Version: ${version.version}`;
            status.style.color = 'var(--success)';
        } catch (error) {
            console.error('Test Connection Failed:', error);
            status.textContent = `Connection failed: ${describeConnectionError(error)}`;
            status.style.color = 'var(--error)';
        }
    });

    openFloatingWindowBtn.addEventListener('click', async () => {
        await openOrFocusFloatingWindow();
    });

    exportSettingsBtn?.addEventListener('click', async () => {
        resetOptionsResetConfirmation();
        try {
            await persistClusterFromForm();
            const result = await createEncryptedSettingsBackup(
                exportPasswordInput.value || '',
                exportPasswordConfirmInput.value || ''
            );
            await downloadEncryptedBackupFile(result.encrypted, result.filename);
            exportPasswordInput.value = '';
            exportPasswordConfirmInput.value = '';
            updateOptionsInputClearButtons();
            status.textContent = 'Encrypted settings exported successfully.';
            status.style.color = 'var(--success)';
        } catch (error) {
            status.textContent = `Export failed: ${error.message || 'Unknown error.'}`;
            status.style.color = 'var(--error)';
        }
    });

    importSettingsBtn?.addEventListener('click', async () => {
        resetOptionsResetConfirmation();
        const selectedFile = importFileInput.files?.[0];
        if (!selectedFile) {
            status.textContent = 'Please choose a backup file to import.';
            status.style.color = 'var(--error)';
            return;
        }

        try {
            const rawText = await selectedFile.text();
            await importEncryptedSettingsFromText(rawText, importPasswordInput.value || '');

            resetOptionsRemoveClusterConfirmation();
            await reloadSettingsFromStorage();
            importPasswordInput.value = '';
            importFileInput.value = '';
            updateOptionsInputClearButtons();
            status.textContent = 'Encrypted settings imported successfully.';
            status.style.color = 'var(--success)';
        } catch (error) {
            status.textContent = `Import failed: ${error.message || 'Unknown error.'}`;
            status.style.color = 'var(--error)';
        }
    });

    resetBtn.addEventListener('click', async () => {
        if (!pendingOptionsResetConfirmation) {
            pendingOptionsResetConfirmation = true;
            resetBtn.textContent = chrome.i18n.getMessage('resetSettingsConfirmAgainLabel') || 'Click again to reset';
            status.textContent = chrome.i18n.getMessage('resetSettingsConfirmAgainHint') || 'Click "Reset Settings" again to reset all settings.';
            status.style.color = 'var(--text-secondary)';
            return;
        }
        resetOptionsResetConfirmation();

        const resetResult = await resetToFactoryDefaults();
        clusters = resetResult.clusters;
        activeClusterId = resetResult.activeClusterId;
        resetOptionsRemoveClusterConfirmation();
        await reloadSettingsFromStorage();
        updateOptionsInputClearButtons();
        status.textContent = chrome.i18n.getMessage('resetSettingsSuccess') || 'Settings reset to defaults.';
        status.style.color = 'var(--success)';

        closeSettingsPage();
    });

    function closeSettingsPage() {
        if (chrome?.tabs?.getCurrent && chrome?.tabs?.remove) {
            chrome.tabs.getCurrent((tab) => {
                if (tab?.id) {
                    chrome.tabs.remove(tab.id);
                } else {
                    window.close();
                }
            });
            return;
        }
        window.close();
    }

    // Close settings page/tab
    closeBtn.addEventListener('click', closeSettingsPage);
});

