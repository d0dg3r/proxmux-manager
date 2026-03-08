export class ProxmoxAPI {
    constructor(baseUrl, apiToken, failoverUrls = []) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.apiToken = apiToken;
        this.failoverUrls = failoverUrls.map(u => u.replace(/\/$/, ''));
        this.currentUrl = this.baseUrl;
    }

    async fetch(endpoint, options = {}) {
        // Prepare list of URLs to try: primary first, then others
        const urlsToTry = [this.currentUrl, ...this.failoverUrls.filter(u => u !== this.currentUrl)];
        let lastError = null;

        for (const baseUrl of urlsToTry) {
            const url = `${baseUrl}/api2/json${endpoint}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const headers = {
                'Authorization': `PVEAPIToken=${this.apiToken}`,
                'Accept': 'application/json',
                ...options.headers
            };

            // Cache-busting for GET requests using headers instead of query params
            // Proxmox API is strict about unknown query parameters (400 error)
            if (!options.method || options.method === 'GET') {
                headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
                headers['Pragma'] = 'no-cache';
                headers['Expires'] = '0';
            }

            const fetchOptions = { 
                ...options, 
                headers,
                signal: controller.signal,
                credentials: 'omit',
                cache: 'no-store'
            };

            /* 
            if (options.method === 'POST') {
                console.log(`POST Request to ${endpoint} via ${baseUrl}`);
            }
            */

            try {
                const response = await fetch(url, fetchOptions);
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    const text = await response.text();
                    // If it's a 401/403, failover won't help, so throw immediately
                    if (response.status === 401 || response.status === 403) {
                        throw new Error(`API Auth Error: ${response.status} ${response.statusText} - ${text}`);
                    }
                    throw new Error(`API Error: ${response.status} ${response.statusText} - ${text}`);
                }
                const data = await response.json();
                
                // If we succeeded on a failover URL, update currentUrl for future requests
                if (baseUrl !== this.currentUrl) {
                    // console.log(`Failover success! Switched to ${baseUrl}`);
                    this.currentUrl = baseUrl;
                }

                return data.data;
            } catch (e) {
                clearTimeout(timeoutId);
                lastError = e;
                
                const isConnectionError = e.name === 'AbortError' || 
                                        e.message.includes('Failed to fetch') || 
                                        e.message.includes('NetworkError');

                if (isConnectionError) {
                    // console.warn(`Connection to ${baseUrl} failed, trying next node...`, e.message);
                    continue; // Try next URL
                }
                throw e; // Terminate for logic/auth errors
            }
        }
        throw lastError;
    }

    async getResources() {
        return this.fetch('/cluster/resources');
    }

    async getNodeStatus(node) {
        return this.fetch(`/nodes/${node}/status`);
    }

    async getNodeRRD(node, timeframe = 'hour') {
        return this.fetch(`/nodes/${node}/rrddata?timeframe=${timeframe}&cf=AVERAGE`);
    }

    async getVMConfig(node, type, vmid) {
        // type is 'qemu' or 'lxc'
        const endpoint = `/nodes/${node}/${type}/${vmid}/config`;
        return this.fetch(endpoint);
    }

    async getSpiceProxy(node, type, vmid) {
        const endpoint = `/nodes/${node}/${type}/${vmid}/spiceproxy`;
        return this.fetch(endpoint, { method: 'POST' });
    }

    getConsoleUrl(node, type, vmid, name) {
        if (type === 'qemu') {
            return `${this.baseUrl}/?console=kvm&novnc=1&vmid=${vmid}&node=${node}`;
        } else if (type === 'lxc') {
            return `${this.baseUrl}/?console=lxc&novnc=1&vmid=${vmid}&node=${node}`;
        } else if (type === 'node') {
            return `${this.baseUrl}/?console=shell&novnc=1&node=${node}`;
        }
        return null;
    }

    async getLxcInterfaces(node, vmid) {
        return this.fetch(`/nodes/${node}/lxc/${vmid}/interfaces`);
    }

    async getVmAgentNetwork(node, vmid) {
        return this.fetch(`/nodes/${node}/qemu/${vmid}/agent/network-get-interfaces`);
    }

    async isSpiceEnabled(node, type, vmid) {
        if (type !== 'qemu') return false;
        try {
            const config = await this.getVMConfig(node, type, vmid);
            // Proxmox config for SPICE often looks like "vga: qxl" or "vga: type=qxl,..."
            // or "vga: virtio-vga" (which supports spice).
            // Usually, if 'vga' is set to 'qxl' or mentions 'spice' or 'qxl', SPICE is active.
            const vga = config.vga || '';
            return vga.includes('qxl') || vga.includes('spice') || vga.includes('virtio');
        } catch (e) {
            return false;
        }
    }

    async getResourceStatus(node, type, vmid) {
        // type: qemu, lxc
        return this.fetch(`/nodes/${node}/${type}/${vmid}/status/current`);
    }

    async vmAction(node, type, vmid, action) {
        // action: start, stop, shutdown, reboot, pause, resume
        return this.fetch(`/nodes/${node}/${type}/${vmid}/status/${action}`, { method: 'POST' });
    }

    async nodeAction(node, action) {
        // action: reboot, shutdown
        const params = new URLSearchParams();
        params.append('command', action);
        return this.fetch(`/nodes/${node}/status`, { 
            method: 'POST',
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
    }

    async getResourceDetails(res) {
        const details = { ip: null, os: null, disks: [] };
        try {
            if (res.type === 'node') {
                const status = await this.getNodeStatus(res.node);
                const fullVersion = status.pveversion || '';
                const match = fullVersion.match(/pve-manager\/([0-9.]+)/);
                details.os = match ? `PVE ${match[1]}` : 'PVE';
                
                // Map node metrics
                if (status.loadavg) res.loadavg = status.loadavg;
                if (status.cpu) res.cpu = status.cpu;
                if (status.memory) {
                    res.mem = status.memory.used;
                    res.maxmem = status.memory.total;
                }
                
                // Advanced node metrics
                if (status.netin !== undefined) res.netin = status.netin;
                if (status.netout !== undefined) res.netout = status.netout;
                if (status.diskread !== undefined) res.diskread = status.diskread;
                if (status.diskwrite !== undefined) res.diskwrite = status.diskwrite;

                // If node status IO is 0 or missing, try RRD for rates
                if (!res.netin && !res.netout) {
                    try {
                        const rrd = await this.getNodeRRD(res.node);
                        if (rrd && rrd.length > 0) {
                            // Find last non-null entry
                            const lastData = rrd.reverse().find(d => d.netin !== null);
                            if (lastData) {
                                res.netin = lastData.netin;
                                res.netout = lastData.netout;
                                res.diskread = lastData.diskread;
                                res.diskwrite = lastData.diskwrite;
                            }
                        }
                    } catch (e) { console.error('RRD fetch failed', e); }
                }
                
                // 1. Try name if it's an IP
                if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(res.node)) {
                    details.ip = res.node;
                } 
                
                // 2. Try network interfaces if IP still missing
                if (!details.ip) {
                    try {
                        const network = await this.getNodeNetwork(res.node);
                        const bridge = network.find(i => i.type === 'bridge' && i.address);
                        if (bridge) {
                            details.ip = bridge.address;
                        } else {
                            const eth = network.find(i => (i.type === 'eth' || i.iface.startsWith('eno') || i.iface.startsWith('eth')) && i.address);
                            if (eth) details.ip = eth.address;
                        }
                    } catch (netErr) {}
                }
            } else {
                const [config, status] = await Promise.all([
                    this.getVMConfig(res.node, res.type, res.vmid),
                    this.getResourceStatus(res.node, res.type, res.vmid)
                ]);

                details.os = config.ostype || config.os || null;
                
                // Real-time usage often better in status/current
                if (status.uptime) res.uptime = status.uptime;
                if (status.cpu) res.cpu = status.cpu;
                if (status.mem) res.mem = status.mem;
                if (status.maxmem) res.maxmem = status.maxmem;
                
                // Advanced metrics
                if (status.netin !== undefined) res.netin = status.netin;
                if (status.netout !== undefined) res.netout = status.netout;
                if (status.diskread !== undefined) res.diskread = status.diskread;
                if (status.diskwrite !== undefined) res.diskwrite = status.diskwrite;
                if (status.loadavg !== undefined) res.loadavg = status.loadavg;
                if (status.hastatus !== undefined) res.hastatus = status.hastatus;

                // Multi-disk detection from config
                const diskKeys = Object.keys(config).filter(key => 
                    /^(ide|sata|scsi|virtio|rootfs|unused)\d+$/.test(key)
                );

                diskKeys.forEach(key => {
                    const value = config[key];
                    // Example: "local-lvm:vm-101-disk-0,size=32G" or "volume=...,size=..."
                    const sizeMatch = value.match(/size=([\d.KMGT]+)/);
                    if (sizeMatch) {
                        const rawSize = sizeMatch[1];
                        // Convert to bytes
                        let sizeBytes = parseFloat(rawSize);
                        if (rawSize.endsWith('G')) sizeBytes *= 1024 * 1024 * 1024;
                        else if (rawSize.endsWith('M')) sizeBytes *= 1024 * 1024;
                        else if (rawSize.endsWith('K')) sizeBytes *= 1024;
                        else if (rawSize.endsWith('T')) sizeBytes *= 1024 * 1024 * 1024 * 1024;

                        details.disks.push({
                            name: key.toUpperCase(),
                            max: sizeBytes,
                            used: null // Note: usage inside VM is hard without agent
                        });
                    }
                });

                // If only one disk and it matches cluster resource disk, sync usage
                if (details.disks.length === 1 && res.maxdisk && Math.abs(details.disks[0].max - res.maxdisk) < 1024*1024) {
                    details.disks[0].used = res.disk;
                } else if (res.type === 'lxc' && details.disks.length > 0) {
                    // LXC usually has usage in status
                    details.disks[0].used = status.disk || res.disk;
                }

                if (res.type === 'lxc') {
                    const interfaces = await this.getLxcInterfaces(res.node, res.vmid);
                    if (Array.isArray(interfaces)) {
                        const eth0 = interfaces.find(i => i.name === 'eth0');
                        if (eth0 && eth0.inet) details.ip = eth0.inet.split('/')[0];
                    }
                } else if (res.type === 'qemu' && res.status === 'running') {
                    try {
                        const agentNet = await this.getVmAgentNetwork(res.node, res.vmid);
                        if (agentNet && Array.isArray(agentNet.result)) {
                            for (const iface of agentNet.result) {
                                if (iface.name !== 'lo') {
                                    const addr = iface['ip-addresses']?.find(a => a['ip-address-type'] === 'ipv4');
                                    if (addr) {
                                        details.ip = addr['ip-address'];
                                        break;
                                    }
                                }
                            }
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {
            console.error(`Failed to get details for ${res.type} ${res.vmid || res.node}`, e);
        }
        return details;
    }

    /**
     * Checks if the browser has a valid session cookie for Proxmox.
     * Uses chrome.cookies.get if available, otherwise falls back to a fetch test.
     */
    async checkSession() {
        const url = `${this.baseUrl}/api2/json/access/ticket`;
        console.log(`[SessionCheck] Starting check for: ${this.baseUrl}`);

        // 1. Try using chrome.cookies API (requires "cookies" permission + active host permission)
        if (typeof chrome !== 'undefined' && chrome.cookies) {
            try {
                const cookie = await chrome.cookies.get({
                    url: this.baseUrl,
                    name: 'PVEAuthCookie'
                });
                
                if (cookie) {
                    console.log('[SessionCheck] PVEAuthCookie found via chrome.cookies');
                    return true;
                }

                // Try getAll if get() didn't work (wider search)
                const domain = new URL(this.baseUrl).hostname;
                const cookies = await chrome.cookies.getAll({ domain });
                if (cookies.some(c => c.name === 'PVEAuthCookie')) {
                    console.log('[SessionCheck] PVEAuthCookie found via getAll()');
                    return true;
                }
                console.log('[SessionCheck] No PVEAuthCookie found in browser cookies');
            } catch (e) {
                console.warn('[SessionCheck] Cookie API error:', e);
            }
        } else {
            console.log('[SessionCheck] chrome.cookies API NOT available - check permissions and reload extension');
        }

        // 2. Fallback to a lightweight fetch check
        // We use redirect: 'error' to ensure we don't get a 200 from a login page redirect
        try {
            const response = await fetch(url, { 
                method: 'GET',
                credentials: 'include',
                redirect: 'error'
            });
            
            console.log(`[SessionCheck] Fetch response status: ${response.status}`);
            
            if (response.status === 200) {
                const data = await response.json();
                const username = data?.data?.username;
                console.log(`[SessionCheck] Fetch returned 200. Username: ${username || 'NONE'}`);
                return !!username; // Must have a username to be counted as "logged in"
            }
            
            return false; 
        } catch (e) {
            console.warn('[SessionCheck] Fetch check failed (likely no session or CORS):', e.message);
            return false; 
        }
    }
}
