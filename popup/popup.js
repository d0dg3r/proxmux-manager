import { ProxmoxAPI } from '../lib/proxmox-api.js';

document.addEventListener('DOMContentLoaded', async () => {
    const resourceList = document.getElementById('resource-list');
    const loadingOverlay = document.getElementById('loading');
    const noAuthOverlay = document.getElementById('no-auth');
    const settingsBtn = document.getElementById('settings-btn');
    const sidepanelBtn = document.getElementById('sidepanel-btn');
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

    let allResources = [];
    let activeFilters = {
        type: 'all', // 'all', 'node', 'qemu', 'lxc'
        status: 'all' // 'all', 'running', 'stopped'
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
        const window = await chrome.windows.getCurrent();
        chrome.sidePanel.open({ windowId: window.id });
        window.close(); // Optional: Close the popup if it's open
    });
    openSettingsOverlayBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

    // Load saved settings
    const settings = await chrome.storage.local.get(['proxmoxUrl', 'apiUser', 'apiTokenId', 'apiSecret', 'apiToken', 'failoverUrls']);
    
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
            const osTag = clone.querySelector('.tag.os');
            const ipTag = clone.querySelector('.tag.ip');
            const novncBtn = clone.querySelector('.novnc');
            const spiceBtn = clone.querySelector('.spice');
            const sshBtn = clone.querySelector('.ssh');
            const shellBtn = clone.querySelector('.shell');

            nameEl.textContent = res.name || res.vmid || res.node;
            nodeEl.textContent = `${res.type.toUpperCase()} @ ${res.node} ${res.vmid ? `(ID ${res.vmid})` : ''}`;
            
            indicator.classList.add(res.status === 'running' ? 'status-running' : (res.status === 'stopped' ? 'status-stopped' : 'status-unknown'));

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
                                chrome.tabs.create({ url: `ssh://root@${details.ip}` });
                            });
                        }
                    }
                    if (details.ip) {
                        ipTag.textContent = details.ip;
                        ipTag.classList.remove('hidden');
                    }
                });
            }

            if (res.type === 'node') {
                novncBtn.classList.add('hidden');
                shellBtn.classList.remove('hidden');
                shellBtn.addEventListener('click', () => {
                    const url = api.getConsoleUrl(res.node, 'node', null, res.node);
                    chrome.tabs.create({ url });
                });
            } else {
                novncBtn.addEventListener('click', () => {
                    const url = api.getConsoleUrl(res.node, res.type, res.vmid, res.name);
                    chrome.tabs.create({ url });
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

            // 3. Search query
            if (!query) return true;

            const name = (res.name || res.vmid || res.node || '').toString().toLowerCase();
            const vmid = (res.vmid || '').toString().toLowerCase();
            const node = (res.node || '').toString().toLowerCase();
            const type = (res.type || '').toString().toLowerCase();
            const ip = (res.ip || '').toString().toLowerCase();
            
            return name.includes(query) || vmid.includes(query) || node.includes(query) || 
                   type.includes(query) || ip.includes(query);
        });

        renderResources(filtered, api);
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
