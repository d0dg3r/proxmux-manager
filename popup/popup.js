import { ProxmoxAPI } from '../lib/proxmox-api.js';

document.addEventListener('DOMContentLoaded', async () => {
    const resourceList = document.getElementById('resource-list');
    const loadingOverlay = document.getElementById('loading');
    const noAuthOverlay = document.getElementById('no-auth');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const sidepanelBtn = document.getElementById('sidepanel-btn');
    const closeModalBtn = document.getElementById('close-modal');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const toggleSecretBtn = document.getElementById('toggle-secret');
    const secretInput = document.getElementById('api-secret');
    const proxmoxUrlInput = document.getElementById('proxmox-url');
    const apiUserInput = document.getElementById('api-user');
    const apiTokenIdInput = document.getElementById('api-tokenid');
    const openSettingsOverlayBtn = document.getElementById('open-settings-overlay');
    const saveStatus = document.getElementById('save-status');
    const template = document.getElementById('resource-item-template');

    // UI Event Listeners
    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    
    sidepanelBtn.addEventListener('click', async () => {
        const window = await chrome.windows.getCurrent();
        chrome.sidePanel.open({ windowId: window.id });
        window.close(); // Optional: Close the popup if it's open
    });
    openSettingsOverlayBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeModalBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    
    toggleSecretBtn.addEventListener('click', () => {
        const isPassword = secretInput.type === 'password';
        secretInput.type = isPassword ? 'text' : 'password';
        toggleSecretBtn.innerHTML = isPassword 
            ? '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12,17.5C14.33,17.5 16.31,16.04 17.11,14H1.5L9,14H15.11C14.31,16.04 12.33,17.5 12,17.5M12,5C7,5 2.73,8.11 1,12.5C2.73,16.89 7,20 12,20C17,20 21.27,16.89 23,12.5C21.27,8.11 17,5 12,5M12,18.5C9.67,18.5 7.69,17.04 6.89,15H17.11C16.31,17.04 14.33,18.5 12,18.5Z"/></svg>'
            : '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/></svg>';
    });

    // Load saved settings into modal
    const settings = await chrome.storage.local.get(['proxmoxUrl', 'apiUser', 'apiTokenId', 'apiSecret', 'apiToken']);
    if (settings.proxmoxUrl) proxmoxUrlInput.value = settings.proxmoxUrl;
    if (settings.apiUser) apiUserInput.value = settings.apiUser;
    if (settings.apiTokenId) apiTokenIdInput.value = settings.apiTokenId;
    if (settings.apiSecret) secretInput.value = settings.apiSecret;

    saveSettingsBtn.addEventListener('click', async () => {
        const url = proxmoxUrlInput.value.trim().replace(/\/$/, '');
        const user = apiUserInput.value.trim();
        const tokenId = apiTokenIdInput.value.trim();
        const secret = secretInput.value.trim();

        if (!url || !user || !tokenId || !secret) {
            saveStatus.textContent = 'Please fill in all fields.';
            saveStatus.style.color = 'var(--error)';
            return;
        }

        const fullToken = `${user}!${tokenId}=${secret}`;

        await chrome.storage.local.set({
            proxmoxUrl: url,
            apiUser: user,
            apiTokenId: tokenId,
            apiSecret: secret,
            apiToken: fullToken
        });

        saveStatus.textContent = 'Settings saved. Refreshing...';
        saveStatus.style.color = 'var(--success)';
        
        // Request host permission
        const origin = new URL(url).origin + '/*';
        chrome.permissions.request({ origins: [origin] });

        setTimeout(() => location.reload(), 1000);
    });

    if (!settings.proxmoxUrl || !settings.apiToken) {
        loadingOverlay.classList.add('hidden');
        noAuthOverlay.classList.remove('hidden');
        return;
    }

    const api = new ProxmoxAPI(settings.proxmoxUrl, settings.apiToken);
    console.log('Fetching resources from:', settings.proxmoxUrl);

    try {
        const resources = await api.getResources();
        console.log('Resources received:', resources.length);
        loadingOverlay.classList.add('hidden');
        renderResources(resources, api);
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
});
