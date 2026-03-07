document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('proxmox-url');
    const apiUserInput = document.getElementById('api-user');
    const apiTokenIdInput = document.getElementById('api-tokenid');
    const apiSecretInput = document.getElementById('api-secret');
    const saveBtn = document.getElementById('save-btn');
    const status = document.getElementById('status');

    // Load saved settings
    chrome.storage.local.get(['proxmoxUrl', 'apiUser', 'apiTokenId', 'apiSecret'], (result) => {
        if (result.proxmoxUrl) urlInput.value = result.proxmoxUrl;
        if (result.apiUser) apiUserInput.value = result.apiUser;
        if (result.apiTokenId) apiTokenIdInput.value = result.apiTokenId;
        if (result.apiSecret) apiSecretInput.value = result.apiSecret;
    });

    saveBtn.addEventListener('click', () => {
        const url = urlInput.value.trim().replace(/\/$/, '');
        const user = apiUserInput.value.trim();
        const tokenId = apiTokenIdInput.value.trim();
        const secret = apiSecretInput.value.trim();

        if (!url || !user || !tokenId || !secret) {
            status.textContent = 'Please fill in all fields.';
            status.style.color = 'red';
            return;
        }

        // Combine into Proxmox API Token format: USER!TOKENID=SECRET
        const fullToken = `${user}!${tokenId}=${secret}`;

        chrome.storage.local.set({
            proxmoxUrl: url,
            apiUser: user,
            apiTokenId: tokenId,
            apiSecret: secret,
            apiToken: fullToken
        }, () => {
            status.textContent = 'Settings saved!';
            status.style.color = 'green';
            
            // Request host permission if needed
            const origin = new URL(url).origin + '/*';
            chrome.permissions.request({
                origins: [origin]
            }, (granted) => {
                if (granted) {
                    status.textContent = 'Settings saved and permissions granted!';
                } else {
                    status.textContent = 'Settings saved, but host permission denied. Links might not work.';
                    status.style.color = 'orange';
                }
            });

            setTimeout(() => {
                status.textContent = '';
            }, 3000);
        });
    });
});
