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
    const tagFiltersContainer = document.getElementById('tag-filters');
    let activeFilters = {
        type: 'all', // 'all', 'node', 'qemu', 'lxc'
        status: 'all', // 'all', 'running', 'stopped'
        tag: null // 'null' or string
    };
    const searchInput = document.getElementById('search-input');
    const filterPills = document.querySelectorAll('.filter-pill');

    // UI Event Listeners
    settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

    searchInput.addEventListener('input', () => {
        filterAndRender();
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

            filterAndRender();
        });
    });
    
    sidepanelBtn.addEventListener('click', async () => {
        const currentWindow = await chrome.windows.getCurrent();
        chrome.sidePanel.open({ windowId: currentWindow.id });
        window.close(); // Close the popup
    });
    openSettingsOverlayBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
    refreshBtn.addEventListener('click', () => location.reload());

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

    // Load saved settings
    const settings = await chrome.storage.local.get(['proxmoxUrl', 'apiUser', 'apiTokenId', 'apiSecret', 'apiToken', 'failoverUrls', 'theme']);
    
    if (settings.theme) {
        applyTheme(settings.theme);
    }
    
    if (!settings.proxmoxUrl || !settings.apiToken) {
        loadingOverlay.classList.add('hidden');
        noAuthOverlay.classList.remove('hidden');
        return;
    }

    const api = new ProxmoxAPI(settings.proxmoxUrl, settings.apiToken, settings.failoverUrls || []);
    // console.log('Fetching resources from:', settings.proxmoxUrl);

    try {
        const resources = await api.getResources();
        allResources = resources;
        // console.log('Resources received:', resources.length);
        loadingOverlay.classList.add('hidden');
        renderResources(resources, api);
        renderTagFilters(resources);
        
        // Auto-focus search for speed
        searchInput.focus();

        // Asynchronously discover and update cluster nodes for failover
        updateFailoverNodes(resources, settings.proxmoxUrl);
    } catch (error) {
        console.error('Proxmox API Error:', error);
        loadingOverlay.innerHTML = `
            <div style="color:var(--error); padding: 20px;">
                <p><strong>Connection Failed</strong></p>
                <p style="font-size: 0.8rem; margin: 10px 0;">${error.message}</p>
                <div style="text-align: left; font-size: 0.75rem; color: var(--text-secondary); border-top: 1px solid var(--border); pt-10;">
                    <p>Possible reasons:</p>
                    <ul style="padding-left: 15px;">
                        <li>Host is unreachable</li>
                        <li>Invalid API Token</li>
                        <li>Self-signed certificate (Try opening the Proxmox URL in a new tab and clicking "Proceed")</li>
                    </ul>
                </div>
                <button id="retry-btn" class="action-btn" style="margin-top: 15px;">Retry</button>
            </div>
        `;
        document.getElementById('retry-btn').addEventListener('click', () => location.reload());
    }

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
            const indicator = clone.querySelector('.status-indicator');
            const nameEl = clone.querySelector('.name');
            const nodeEl = clone.querySelector('.node');
            const uptimeEl = clone.querySelector('.uptime');
            const osTag = clone.querySelector('.tag.os');
            const ipTag = clone.querySelector('.tag.ip');
            const novncBtn = clone.querySelector('.novnc');
            const spiceBtn = clone.querySelector('.spice');
            const sshBtn = clone.querySelector('.ssh');
            const shellBtn = clone.querySelector('.shell');

            nameEl.textContent = res.name || res.vmid || res.node;
            nodeEl.textContent = `${res.type.toUpperCase()} @ ${res.node} ${res.vmid ? `(ID ${res.vmid})` : ''}`;

            if (res.uptime && (res.status === 'running' || res.status === 'online')) {
                uptimeEl.textContent = formatUptime(res.uptime);
                uptimeEl.classList.remove('hidden');
            }
            
            indicator.classList.add((res.status === 'running' || res.status === 'online') ? 'status-running' : (res.status === 'stopped' ? 'status-stopped' : 'status-unknown'));

            if (res.type !== 'node') {
                // Fetch IP and OS info
                api.getResourceDetails(res).then(details => {
                    res.ip = details.ip;
                    res.os = details.os;
                    if (details.os) {
                        osTag.textContent = details.os;
                        osTag.classList.remove('hidden');
                        
                        // Show SSH for Linux/Unix systems or ANY LXC (since they are Linux-based)
                        const os = details.os ? details.os.toLowerCase() : '';
                        const linuxDistros = ['linux', 'debian', 'ubuntu', 'alpine', 'centos', 'fedora', 'arch', 'suse'];
                        const isLinux = linuxDistros.some(d => os.includes(d)) || os.startsWith('l');
                        
                        // Rule: LXC with IP or Linux VM with IP
                        if ((res.type === 'lxc' || isLinux) && details.ip) {
                            sshBtn.classList.remove('hidden');
                            sshBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                chrome.tabs.create({ url: `ssh://${details.ip}` });
                            });
                        }
                    }
                    if (details.ip) {
                        ipTag.textContent = details.ip;
                        ipTag.classList.remove('hidden');
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

            if (res.type === 'node') {
                novncBtn.classList.add('hidden');
                shellBtn.classList.remove('hidden');
                shellBtn.addEventListener('click', () => {
                    openConsole(res.node, 'node', null, res.node);
                });
            } else {
                novncBtn.addEventListener('click', () => {
                    openConsole(res.node, res.type, res.vmid, res.name);
                });

                if (res.type === 'qemu' && res.status === 'running') {
                    // Check for SPICE asynchronously
                    api.isSpiceEnabled(res.node, res.type, res.vmid).then(enabled => {
                        if (enabled) {
                            spiceBtn.classList.remove('hidden');
                            spiceBtn.addEventListener('click', () => downloadSpiceFile(res, api));
                        }
                    });
                }
            }

            resourceList.appendChild(clone);
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
            if (url) {
                console.log(`[Popup] Opening console URL: ${url}`);
                debugStatus.textContent = 'Opening console...';
                chrome.tabs.create({ url });
                // Hide status after a short delay
                setTimeout(() => { debugStatus.style.display = 'none'; }, 2000);
            }
        } catch (e) {
            console.error('[Popup] Failed to open console:', e);
            debugStatus.textContent = `Error: ${e.message}`;
            // Fallback
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
});
