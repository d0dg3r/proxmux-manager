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

            const fetchOptions = { 
                ...options, 
                headers,
                signal: controller.signal,
                credentials: 'omit'
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

    async getResourceDetails(res) {
        const details = { ip: null, os: null };
        try {
            const config = await this.getVMConfig(res.node, res.type, res.vmid);
            details.os = config.ostype || config.os || null;

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
                } catch (e) {
                    // Agent might not be running
                }
            }
        } catch (e) {
            console.error(`Failed to get details for ${res.vmid}`, e);
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
