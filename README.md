![ProxMux Banner](store/banner_ad.png)

<p align="center">
  <a href="https://github.com/d0dg3r/ProxMux/releases"><img src="https://img.shields.io/github/v/release/d0dg3r/ProxMux?style=flat-square&logo=github" alt="Release"></a>
  <a href="https://github.com/d0dg3r/ProxMux/releases?q=pre"><img src="https://img.shields.io/github/v/release/d0dg3r/ProxMux?include_prereleases&label=pre-release&logo=github&style=flat-square" alt="Pre-release"></a>
  <a href="https://chrome.google.com/webstore/detail/proxmux-manager"><img src="https://img.shields.io/badge/Chrome_Web_Store-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Web Store"></a>
</p>

# ProxMux Manager Chrome Extension

A dedicated Chrome Extension for Proxmox VE cluster management, providing instant access to VM, container, and node consoles.

## Features

- **Quick Overview**: List all cluster resources (VMs, LXCs, Nodes) directly from the toolbar.
- **Status Indicators**: Real-time status (running/stopped) at a glance.
- **Intelligent Consoles**:
    - **noVNC**: Direct links to web consoles for VMs and containers.
    - **SPICE**: Detects SPICE availability and provides a one-click `.vv` file download for `remote-viewer`.
    - **Shell**: Quick access to host node shells.
- **Secure**: Uses Proxmox API Tokens for authentication.
- **Premium UI**: Modern dark theme with a clean, responsive design.

## Installation

1. Clone this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extension folder.

## Configuration

1. Click the extension icon in the toolbar.
2. Click the **Settings** (gear icon) in the top right to open the dedicated options page.
3. Enter your **Proxmox Cluster Details**:
    - **Proxmox URL**: Your primary node URL (e.g., `https://px01.example.com:8006`).
    - **User & Realm**: e.g., `root@pam`.
    - **Token ID**: your API token name (e.g., `automation`).
    - **API Secret**: the token secret value.
4. Click **Save Settings** and grant host permissions.
5. **High Availability**: Once configured, the extension will automatically discover other cluster nodes and store them for failover.

## Requirements

- Proxmox VE 6.x or newer.
- API Token with appropriate permissions (`VM.Console` and `Sys.Audit` for node discovery).

## Installation

### From Chrome Web Store (Recommended)
You can install ProxMux Manager directly from the [Chrome Web Store](https://chrome.google.com/webstore/detail/proxmux-manager) (Coming Soon).

### From Source (Developer Mode)
1. Clone this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extension folder.

## Version 1.0.0 Release Notes
- **High Availability**: Automatic cluster node discovery and failover.
- **Dedicated Settings**: New options page for secure and easy configuration.
- **Enhanced Consoles**: Support for SPICE (with auto-open), noVNC, and Shell.
- **Linux Optimized**: Intelligent SSH detection for VMs and LXCs.
