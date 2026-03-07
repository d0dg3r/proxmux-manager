export class ProxmoxAPI {
    constructor(baseUrl, apiToken) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.apiToken = apiToken;
    }

    async fetch(endpoint, options = {}) {
        const url = `${this.baseUrl}/api2/json${endpoint}`;
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
            credentials: 'omit' // Critical: Prevent sending cookies that might conflict with API Token
        };

        if (options.method === 'POST') {
            console.log(`POST Request to ${endpoint} with token ending in ...${this.apiToken.slice(-5)}`);
        }

        try {
            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`API Error: ${response.status} ${response.statusText} - ${text}`);
            }
            const data = await response.json();
            return data.data;
        } catch (e) {
            clearTimeout(timeoutId);
            if (e.name === 'AbortError') {
                throw new Error('Request timed out after 10 seconds. Is the Proxmox Host reachable?');
            }
            throw e;
        }
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
}
