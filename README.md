![PROXMUX Banner](store/small_promo_tile_new.png)

<p align="center">
  <a href="https://github.com/d0dg3r/PROXMUX-Manager/releases"><img src="https://img.shields.io/github/v/release/d0dg3r/PROXMUX-Manager?style=flat-square&logo=github" alt="Release"></a>
  <a href="https://github.com/d0dg3r/PROXMUX-Manager/releases?q=pre"><img src="https://img.shields.io/github/v/release/d0dg3r/PROXMUX-Manager?include_prereleases&label=pre-release&logo=github&style=flat-square" alt="Pre-release"></a>
  <a href="https://chrome.google.com/webstore/detail/proxmux-manager"><img src="https://img.shields.io/badge/Chrome_Web_Store-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Web Store"></a>
  <a href="https://github.com/sponsors/d0dg3r"><img src="https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=ff69b4&style=flat-square" alt="Sponsor"></a>
</p>

# PROXMUX Manager Chrome Extension

A dedicated Chrome Extension for Proxmox VE cluster management, providing instant access to VM, container, and node consoles.

- **Interactive Tags**: Discover and click cluster-wide tags in the search bar for instant categorical filtering.
- **Uptime Monitoring**: Real-time, human-readable uptime (e.g., `2d 5h`) for all running resources.
- **Enhanced Filters**: Quick-access pills to isolate Nodes, VMs, LXCs, and power status.
- **Improved Monitoring**: See VM/LXC status, OS types, and IP addresses at a glance.
- **Intelligent Consoles**: Support for noVNC, SPICE (remote-viewer), and Node Shells.
- **Tabbed Settings UI**: Organized "General", "Help", and "About" sections for easier configuration.
- **Theme Selection**: Manually toggle between **Dark**, **Light**, or **System** themes.
- **Stability and Performance**: Automated node discovery with seamless failover and expired session detection.
- **Secure**: Uses Proxmox API Tokens for authentication; all credentials stay local.

## UI & Themes

| Dark Mode (Default) | Light Mode |
| :---: | :---: |
| ![Dark Mode](store/screenshot_dark.png) | ![Light Mode](store/screenshot_light.png) |

Additional compact variants for store and docs:
- `store/screenshot_dark_640x400.png`
- `store/screenshot_light_640x400.png`

## Installation

### From Chrome Web Store (Recommended)
You can install PROXMUX Manager directly from the [Chrome Web Store](https://chrome.google.com/webstore/detail/proxmux-manager) (Coming Soon).

### From Source (Developer Mode)
1. Clone this repository.
2. Open Chrome and go to chrome://extensions/.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extension folder.

## Configuration

1. Click the extension icon in the toolbar.
2. Click the **Settings** (gear icon) in the top right to open the dedicated options page.
3. Enter your **Proxmox Cluster Details**:
    - **Proxmox URL**: Your primary node URL (e.g., https://px01.example.com:8006).
    - **User & Realm**: e.g., root@pam.
    - **Token ID**: your API token name (e.g., automation).
    - **API Secret**: the token secret value.
4. Click **Save Settings** and grant host permissions.
5. **High Availability**: Once configured, the extension will automatically discover other cluster nodes and store them for failover.

## Requirements

- Proxmox VE 6.x or newer.
- API Token with appropriate permissions (VM.Console and Sys.Audit for node discovery).

## What's New in v1.1.4 🚀

- **Node Management**: Nodes now display management IP addresses and offer direct SSH connectivity.
- **Improved Terminal Experience**: Replaced noVNC with `xterm.js` for text-based shells (Node & LXC) for better scaling and clipboard support.
- **Tab Behavior Settings**: Choose how console tabs are opened (New Tab, Reuse, or Focus Existing).
- **Duplicate Prevention**: Intelligently focus existing console tabs for the same machine (Default).

## Version 1.1.3 Release Notes
- **Reliable Power State Sync**: Improved status refresh flow after start/stop/shutdown/reboot actions to avoid stale status rollbacks.
- **Search Reset UX**: Added clear-search support in the popup search field plus keyboard reset with `Escape`.
- **Top-Bar Layout Fix**: Fixed overlap issues between filter toggle and search clear control.
- **E2E Coverage Expansion**: Added tests for search clear/reset and filter toggle active/collapsed behavior.
- **Store Assets Refresh**: Updated screenshot pipeline and generated both `1280x800` and `640x400` dark/light variants.

## Version 1.1.2 Release Notes
- **Power Features**: Introduced **Interactive Tags** and **Uptime Display** for better cluster oversight.
- **Settings Refactor**: New **Tabbed UI** for settings with expanded **Help** guides (SPICE, SSH, SSL).
- **Theme Control**: Manual theme overrides (Dark/Light/Auto).
- **Branding Excellence**: Official rename to **PROXMUX-Manager** and repository-wide synchronization.
- **Manual Refresh**: Dedicated refresh button in the header.
- **Stability**: Fixed sidepanel height and improved character encoding (UTF-8).

## Version 1.1.1 Release Notes
- **Session Safety**: Robust detection of expired browser sessions using cookie-level checks to prevent 401 errors.
- **Debug Insights**: Real-time status indicators in the popup for better transparency.

## Version 1.1.0 Release Notes
- **Real-time Search**: Integrated deep search across your entire cluster.
- **Resource Filtering**: New type-based (Node/VM/LXC) and status-based (Online/Offline) filters.
- **Sticky UI**: Fixed header and search bar using robust Flexbox layout for better scrolling.
- **Auto-Focus**: Instant interaction with the search field upon opening.

## Version 1.0.0 Release Notes
- **Theme Support**: Full Dark and Light mode support.
- **High Availability**: Automatic cluster node discovery and failover.
- **Dedicated Settings**: New options page for secure and easy configuration.
- **Enhanced Consoles**: Support for SPICE (with auto-open), noVNC, and Shell.
- **Linux Optimized**: Intelligent SSH detection for VMs and LXCs.

## Support the Project

If you find **PROXMUX Manager** useful, please consider supporting its development:

- **Star the Repository**: Help others discover the project.
- **GitHub Sponsors**: [Sponsor d0dg3r](https://github.com/sponsors/d0dg3r) to help maintain the extension.
- **Contribute**: Feel free to open issues or pull requests to improve the extension.
