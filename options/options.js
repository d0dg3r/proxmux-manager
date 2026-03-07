document.addEventListener('DOMContentLoaded', async () => {
    const proxmoxUrlInput = document.getElementById('proxmox-url');
    const apiUserInput = document.getElementById('api-user');
    const apiTokenIdInput = document.getElementById('api-tokenid');
    const apiSecretInput = document.getElementById('api-secret');
    const saveBtn = document.getElementById('save-btn');
    const status = document.getElementById('status');
    const toggleSecretBtn = document.getElementById('toggle-secret');

    // i18n Initialization
    function initI18n() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = chrome.i18n.getMessage(key);
            if (translation) el.textContent = translation;
        });
    }

    initI18n();

    // Load saved settings
    chrome.storage.local.get(['proxmoxUrl', 'apiUser', 'apiTokenId', 'apiSecret'], (items) => {
        if (items.proxmoxUrl) proxmoxUrlInput.value = items.proxmoxUrl;
        if (items.apiUser) apiUserInput.value = items.apiUser;
        if (items.apiTokenId) apiTokenIdInput.value = items.apiTokenId;
        if (items.apiSecret) apiSecretInput.value = items.apiSecret;
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
        const url = proxmoxUrlInput.value.trim().replace(/\/$/, '');
        const user = apiUserInput.value.trim();
        const tokenId = apiTokenIdInput.value.trim();
        const secret = apiSecretInput.value.trim();

        if (!url || !user || !tokenId || !secret) {
            status.textContent = 'Please fill in all fields.';
            status.style.color = 'var(--error)';
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

        status.textContent = 'Settings saved successfully!';
        status.style.color = 'var(--success)';

        // Request host permission
        try {
            const origin = new URL(url).origin + '/*';
            chrome.permissions.request({ origins: [origin] });
        } catch (e) {
            console.error('Invalid URL for permissions:', e);
        }

        setTimeout(() => {
            status.textContent = '';
        }, 3000);
    });
});
