import { ProxmoxAPI } from '../lib/proxmox-api.js';

document.addEventListener('DOMContentLoaded', async () => {
    const resourceList = document.getElementById('resource-list');
    const loadingOverlay = document.getElementById('loading');
    const noAuthOverlay = document.getElementById('no-auth');
    const settingsBtn = document.getElementById('settings-btn');
    const sidepanelBtn = document.getElementById('sidepanel-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = document.getElementById('theme-icon');
    const openSettingsOverlayBtn = document.getElementById('open-settings-overlay');
    const template = document.getElementById('resource-item-template');

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
    const pendingStatusOverrides = new Map();
    const tagFiltersContainer = document.getElementById('tag-filters');
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

    let displaySettings = {
        uptime: true,
        ip: true,
        os: true,
        vmid: true,
        tags: true
    };
    
    let currentExpandedId = localStorage.getItem('lastActiveResource') || null;

    // UI Event Listeners
    settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

    const updateSearchClearState = () => {
        searchClearBtn.classList.toggle('hidden', !searchInput.value.trim());
    };

    const resetSearch = () => {
        if (!searchInput.value) return;
        searchInput.value = '';
        localStorage.setItem('lastSearchQuery', '');
        updateSearchClearState();
        filterAndRender();
        searchInput.focus();
    };

    searchInput.addEventListener('input', () => {
        localStorage.setItem('lastSearchQuery', searchInput.value);
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

            localStorage.setItem('lastFilters', JSON.stringify(activeFilters));
            filterAndRender();
        });
    });
    
    sidepanelBtn.addEventListener('click', async () => {
        const currentWindow = await chrome.windows.getCurrent();
        chrome.sidePanel.open({ windowId: currentWindow.id });
        window.close(); // Close the popup
    });
    openSettingsOverlayBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
    refreshBtn.addEventListener('click', () => {
        localStorage.removeItem('lastActiveResource');
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
        displaySettingsMenu.classList.toggle('hidden');
    });

    // Close settings menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!displaySettingsMenu.contains(e.target) && !displaySettingsBtn.contains(e.target)) {
            displaySettingsMenu.classList.add('hidden');
        }
    });

    // Handle Display Settings Changes
    ['uptime', 'ip', 'os', 'vmid', 'tags'].forEach(setting => {
        const checkbox = document.getElementById(`show-${setting}`);
        checkbox.addEventListener('change', async () => {
            displaySettings[setting] = checkbox.checked;
            applyDisplaySettings();
            await chrome.storage.local.set({ displaySettings });
        });
    });

    function applyDisplaySettings() {
        resourceList.classList.toggle('hide-uptime', !displaySettings.uptime);
        resourceList.classList.toggle('hide-ip', !displaySettings.ip);
        resourceList.classList.toggle('hide-os', !displaySettings.os);
        resourceList.classList.toggle('hide-vmid', !displaySettings.vmid);
        resourceList.classList.toggle('hide-tags', !displaySettings.tags);
    }

    // Load saved settings
    const stored = await chrome.storage.local.get(['proxmoxUrl', 'apiUser', 'apiTokenId', 'apiSecret', 'apiToken', 'failoverUrls', 'theme', 'displaySettings']);
    const settings = stored;
    
    if (settings.displaySettings) {
        displaySettings = settings.displaySettings;
        // Update checkboxes
        Object.keys(displaySettings).forEach(s => {
            const cb = document.getElementById(`show-${s}`);
            if (cb) cb.checked = displaySettings[s];
        });
    }
    applyDisplaySettings();
    
    if (settings.theme) {
        applyTheme(settings.theme);
    }
    
    if (!settings.proxmoxUrl || !settings.apiToken) {
        loadingOverlay.classList.add('hidden');
        noAuthOverlay.classList.remove('hidden');
        return;
    }

    const api = new ProxmoxAPI(settings.proxmoxUrl, settings.apiToken, settings.failoverUrls || []);

    const getResourceKey = (res) => (res.vmid ? `${res.node}/${res.type}/${res.vmid}` : `node/${res.node}`);

    const fetchAndRender = async (showLoading = false) => {
        if (showLoading) loadingOverlay.classList.remove('hidden');
        try {
            const resources = await api.getResources();
            allResources = resources;

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

            filterAndRender();
        } catch (error) {
            console.error('Proxmox API Error:', error);
            if (showLoading) {
                loadingOverlay.innerHTML = `
                    <div style="color:var(--error); padding: 20px;">
                        <p><strong>Connection Failed</strong></p>
                        <p style="font-size: 0.8rem; margin: 10px 0;">${error.message}</p>
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

    // Initial load
    fetchAndRender(true).then(() => {
        // Restore Search & Filters
        const savedSearch = localStorage.getItem('lastSearchQuery');
        if (savedSearch) {
            searchInput.value = savedSearch;
        }
        updateSearchClearState();
        const savedFilters = localStorage.getItem('lastFilters');
        if (savedFilters) {
            activeFilters = JSON.parse(savedFilters);
            // Update UI for restored filters
            filterPills.forEach(pill => {
                const pType = pill.getAttribute('data-filter-type');
                const pStatus = pill.getAttribute('data-filter-status');
                pill.classList.remove('active');
                if (pType === activeFilters.type) pill.classList.add('active');
                if (pStatus === activeFilters.status && pStatus !== 'all') pill.classList.add('active');
            });
        }

        if (savedSearch || savedFilters) {
            filterAndRender();
        }
        
        renderTagFilters(allResources);
        searchInput.focus();
        updateFailoverNodes(allResources, settings.proxmoxUrl);
    });

    async function renderResources(resources, api) {
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
            const clone = template.content.cloneNode(true);
            const item = clone.querySelector('.resource-item');
            
            // Set unique ID for persistence
            const resId = res.vmid ? `vm-${res.vmid}` : `node-${res.node}`;
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
                    localStorage.setItem('lastActiveResource', currentExpandedId);
                } else {
                    localStorage.removeItem('lastActiveResource');
                }
            });

            // Usage Stats (Initial from cluster/resources)
            updateUsageStats(clone, res);

            // Fetch details (IP, OS, Disks) for all types if status allows
            if (res.status === 'running' || res.status === 'online' || res.type === 'node') {
                api.getResourceDetails(res).then(details => {
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
                            const data = await api.getNodeStatus(res.node);
                            // Proxmox nodes report 'online' when up
                            currentStatus = data.status === 'online' ? 'running' : 'stopped';
                        } else {
                            const data = await api.getResourceStatus(res.node, res.type, res.vmid);
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
                        await api.nodeAction(res.node, action);
                    } else {
                        await api.vmAction(res.node, res.type, res.vmid, action);
                    }
                    powerStatus.textContent = chrome.i18n.getMessage('actionSent') || 'Action sent!';
                    
                    // Store the ID to scroll/expand back to it after reload
                    const resId = res.vmid ? `vm-${res.vmid}` : `node-${res.node}`;
                    localStorage.setItem('lastActiveResource', resId);

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
                    openConsole(res.node, 'node', null, res.node);
                };
            } else {
                novncBtn.onclick = (e) => {
                    e.stopPropagation();
                    openConsole(res.node, res.type, res.vmid, res.name);
                };

                if (res.type === 'qemu' && res.status === 'running') {
                    api.isSpiceEnabled(res.node, res.type, res.vmid).then(enabled => {
                        if (enabled) {
                            spiceBtn.classList.remove('hidden');
                            spiceBtn.onclick = (e) => {
                                e.stopPropagation();
                                downloadSpiceFile(res, api);
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

    const debugStatus = document.getElementById('debug-status');

    async function openConsole(node, type, vmid, name) {
        debugStatus.style.display = 'block';
        debugStatus.textContent = 'Checking session...';
        console.log(`[Popup] Attempting to open console for ${node} ${vmid || ''}`);
        
        try {
            const hasSession = await api.checkSession();
            console.log(`[Popup] Session check result: ${hasSession}`);
            
            if (!hasSession) {
                console.log('[Popup] Showing session error overlay');
                debugStatus.textContent = 'Session invalid. Login required.';
                sessionErrorOverlay.classList.remove('hidden');
                return;
            }
            
            const url = api.getConsoleUrl(node, type, vmid, name);
            if (!url) return;

            const tabSettings = await chrome.storage.local.get(['consoleTabMode']);
            const mode = tabSettings.consoleTabMode || 'duplicate';

            if (mode === 'single') {
                // Reuse any existing Proxmox console tab (novnc or xtermjs)
                const tabs = await chrome.tabs.query({ url: `${settings.proxmoxUrl}/*` });
                const consoleTab = tabs.find(t => t.url.includes('console=') && (t.url.includes('novnc=1') || t.url.includes('xtermjs=1')));
                if (consoleTab) {
                    await chrome.tabs.update(consoleTab.id, { url, active: true });
                    debugStatus.textContent = 'Updated existing console tab.';
                    setTimeout(() => { debugStatus.style.display = 'none'; }, 2000);
                    return;
                }
            } else if (mode === 'duplicate') {
                // Focus existing tab for this specific resource
                const resourceIdParam = vmid ? `vmid=${vmid}` : `node=${node}`;
                const tabs = await chrome.tabs.query({ url: `${settings.proxmoxUrl}/*` });
                const existingTab = tabs.find(t => 
                    t.url.includes(resourceIdParam) && 
                    t.url.includes('console=') && 
                    (t.url.includes('novnc=1') || t.url.includes('xtermjs=1'))
                );
                if (existingTab) {
                    await chrome.tabs.update(existingTab.id, { active: true });
                    debugStatus.textContent = 'Focusing existing tab.';
                    setTimeout(() => { debugStatus.style.display = 'none'; }, 2000);
                    return;
                }
            }

            console.log(`[Popup] Opening console URL: ${url}`);
            debugStatus.textContent = 'Opening console...';
            chrome.tabs.create({ url });
            setTimeout(() => { debugStatus.style.display = 'none'; }, 2000);
        } catch (e) {
            console.error('[Popup] Failed to open console:', e);
            debugStatus.textContent = `Error: ${e.message}`;
            const url = api.getConsoleUrl(node, type, vmid, name);
            if (url) chrome.tabs.create({ url });
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
            alert(`Failed to get SPICE proxy: ${error.message}`);
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

        renderResources(filtered, api);
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
            return;
        }

        tagFiltersContainer.innerHTML = '';
        tagFiltersContainer.classList.remove('hidden');

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
