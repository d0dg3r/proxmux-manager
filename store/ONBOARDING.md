# PROXMUX Manager - Store Onboarding Guide

This document contains all the text, metadata, and justifications required to submit PROXMUX Manager to the Chrome Web Store.

Current release prep target: `v1.2.0` (align with `CHANGELOG.md` top entry before submission).

## 1. Store Metadata

- **Product Name**: PROXMUX Manager
- **Short Name**: PROXMUX
- **Detailed Description**: (See Section 2)
- **Summary**: Manage your Proxmox VE cluster from Side Panel or Floating Window. Monitor resources, access consoles, and manage nodes with failover support.
- **Category**: Developer Tools
- **Additional Category**: Productivity
- **Verified Website**: (Your GitHub Repo URL) https://github.com/d0dg3r/PROXMUX-Manager
- **Single Purpose Statement**: Provide a monitoring and management interface for Proxmox VE clusters directly within the browser.

---

## 2. Store Descriptions (No Emojis)

### English (United States)
```text
PROXMUX Manager is the professional Chrome extension for Proxmox VE administrators. Access your virtualization cluster instantly to monitor nodes, VMs, and containers without leaving your current tab.

Key Features:
- Interactive Tags: Discover and click cluster-wide tags for instant categorical filtering.
- Uptime Display: Real-time, human-readable uptime (e.g., 2d 5h) for all running resources.
- Improved Monitoring: See VM/LXC status, OS types, and IP addresses at a glance.
- Flexible Launch Modes: Open the extension in the Chrome Side Panel (default) or a persistent floating window.
- Inline Advanced Settings: Open and edit settings directly inside the active extension view.
- Intelligent Consoles: Support for noVNC, SPICE (remote-viewer), and Node Shells.
- Modern Design: Selection of Dark, Light, or Follow System themes.
- High Availability: Automatic cluster node discovery and seamless failover support.
- Secure: API Tokens are stored locally and never leave your browser.

Perfect for DevOps engineers and home-server enthusiasts who need a fast, professional, and secure way to manage their Proxmox infrastructure.
```

Use the English section above as the canonical source text. If localized storefront text is needed (for example German), derive it from the English block during store submission prep.
For convenience during store submission, the current German storefront draft is maintained in `store/CWS_DESCRIPTION_DE.txt`.

---

## 3. Privacy & Permission Justifications
*Required for the "Privacy" tab in the Developer Dashboard.*

### Permission Justification Strings:

1. **`storage`**:
   - *Justification*: Required to securely store user-provided Proxmox API credentials and cluster node configuration locally on the user's device.

2. **`sidePanel`**:
   - *Justification*: Used to provide a persistent management interface that remains visible alongside the user's browser tabs for efficient cluster monitoring.

3. **`tabs`**:
   - *Justification*: Required to programmatically open and manage new browser tabs for Proxmox console interfaces (noVNC, SPICE, and Shell).

4. **`scripting`**:
   - *Justification*: Required to run limited in-page scripts for assisted console workflows, such as best-effort command insertion in trusted Proxmox console tabs initiated by the user.

5. **`downloads` & `downloads.open`**:
   - *Justification*: Necessary to generate and automatically launch SPICE configuration files (.vv) for external viewer applications like remote-viewer.

6. **`cookies`**:
   - *Justification*: Required to verify if the user has an active Proxmox Web UI session cookie. This prevents 401 errors when opening interactive consoles, ensuring a seamless user experience.

7. **Host Permissions (`https://*/*`)**:
   - *Justification*: Needed to communicate with self-hosted Proxmox VE API endpoints. The extension only sends requests to URLs explicitly configured by the user.

### User Data Policy:
- **Data Collection**: No personal data, browsing history, or user identity information is collected.
- **Data Usage**: API credentials are used solely for authentication with the user's own Proxmox server.
- **Data Storage**: All sensitive data is stored locally using Chrome's encryption-backed storage and is never transmitted to any third-party or developer-controlled servers.

---

## 4. Instructions for Reviewers (Mandatory)
*This is required for the "Testing Instructions" field.*

**Important**: This extension is a management tool for self-hosted Proxmox VE virtualization clusters. Accessing a live environment requires private infrastructure. 

### Recommended approach:
"This extension manages private, self-hosted Proxmox VE clusters. Since a live cluster is required for full functionality, I have provided a video demonstration showing the extension connecting to a test environment, listing resources, and launching consoles."

### How to test manually (if you have a test environment):
1. Install the extension.
2. Click the extension icon; verify it opens in Side Panel by default.
3. Click the floating-window control and verify a persistent floating manager window opens.
4. In the extension header, click the gear icon and verify advanced settings open inline in the same view.
5. Enter valid Proxmox VE API credentials (URL, User, Token ID, Secret).
6. Save settings.
7. The extension will populate the resource list with nodes, VMs, and containers.
8. Verify console buttons (noVNC, SPICE, Shell/SSH) appear based on resource configuration.

### API token setup reference (for internal/reviewer prep)
- Canonical guide: [docs/proxmox-token-setup.md](../docs/proxmox-token-setup.md)
- Interactive helper (run on Proxmox host shell):

```bash
curl -fsSL 'https://raw.githubusercontent.com/d0dg3r/PROXMUX-Manager/refs/heads/main/scripts/setup_proxmox_token.sh' -o '/tmp/setup_proxmox_token.sh' && chmod 700 '/tmp/setup_proxmox_token.sh' && bash '/tmp/setup_proxmox_token.sh'
```

- Recommended approach: dedicated API user + ACL role on `/`
- Fallback approach: root token with `--privsep 0` (higher risk, use only when appropriate)

---

## 5. Visual Assets Checklist
- **Icon**: 128x128 pixels (provided in `store/proxmux_logo.png`).
- **Screenshots (Primary Store Set, combined Light+Dark)**:
  - `store/screenshot_01_multi_cluster_1280x800.png`
  - `store/screenshot_02_resource_expanded_1280x800.png`
  - `store/screenshot_03_onboarding_1280x800.png`
  - `store/screenshot_04_settings_cluster_1280x800.png`
  - `store/screenshot_05_settings_backup_1280x800.png`
- **Source capture model**: Light and Dark are captured per scene at `640x800` and merged side-by-side to one `1280x800` export.
- **Marquee/Tile**: 440x280 pixels (`store/small_promo_tile_new.png`).
