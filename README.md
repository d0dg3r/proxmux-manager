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
2. Go to **Settings** (gear icon).
3. Enter your **Proxmox URL** (e.g., `https://192.168.1.100:8006`).
4. Enter your **API Token** (Format: `USER@REALM!TOKENID=UUID`).
5. Click **Save Settings** and allow the host permissions when prompted.

## Requirements

- Proxmox VE 6.x or newer.
- API Token with appropriate permissions (`VM.Console` is required for console access).
