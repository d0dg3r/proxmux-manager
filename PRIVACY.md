# Privacy Policy for ProxMux Manager

Last Updated: March 7, 2026

ProxMux Manager is committed to protecting your privacy. This Privacy Policy explains how our Chrome Extension handles your information.

## 1. Information We Collect
ProxMux Manager **does not collect, store, or transmit any personal data** to our servers or any third-party services.

## 2. Authentication and Credentials
To function, the extension requires:
- Your Proxmox VE API URL
- API Token (User, Realm, Token ID, and Secret)

These credentials are **stored exclusively on your local machine** using Chrome's `chrome.storage.local` API. They are only sent directly to your Proxmox VE server to authenticate API requests. We никогда (never) have access to these credentials.

## 3. Data Transmission
All communication occurs directly between your browser and your Proxmox VE host using standard HTTPS requests. No intermediate servers are involved.

## 4. Permissions Usage
- `storage`: Used to save your settings locally.
- `tabs`: Used to open the console windows.
- `downloads`: Used to download and open SPICE `.vv` files.
- `sidePanel`: Used to provide a persistent management interface.
- `host_permissions`: Required to communicate with your Proxmox API.

## 5. Changes to This Policy
We may update this policy occasionally. Any changes will be reflected in this document.

## 6. Contact
If you have any questions, please contact the developer via the GitHub repository: https://github.com/d0dg3r/ProxMux
