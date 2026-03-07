# PROXMUX Manager - Store Onboarding Guide

This document contains all the text, metadata, and justifications required to submit PROXMUX Manager to the Chrome Web Store.

## 1. Store Metadata

- **Product Name**: PROXMUX Manager
- **Short Name**: PROXMUX
- **Detailed Description**: (See Section 2)
- **Summary**: Manage your Proxmox VE cluster. Monitor resources, access consoles (noVNC, SPICE), and manage nodes with failover support.
- **Category**: Developer Tools
- **Additional Category**: Productivity
- **Verified Website**: (Your GitHub Repo URL) https://github.com/d0dg3r/proxmux-manager
- **Single Purpose Statement**: Provide a monitoring and management interface for Proxmox VE clusters directly within the browser.

---

## 2. Store Descriptions (No Emojis)

### English (United States)
```text
PROXMUX Manager is the professional Chrome extension for Proxmox VE administrators. Access your virtualization cluster instantly to monitor nodes, VMs, and containers without leaving your current tab.

Key Features:
- Quick Access: List and monitor all cluster resources (VMs, LXCs, Nodes).
- Intelligent Consoles: Support for noVNC, SPICE (remote-viewer), and Node Shells.
- Modern Design: Full Dark and Light mode support following your system preference.
- High Availability: Automatic cluster node discovery and seamless failover.
- Secure: Your API Tokens are stored locally and never leave your browser.

Perfect for DevOps engineers and home-server enthusiasts who need a fast, professional, and secure way to manage their Proxmox infrastructure.
```

### German (Germany)
```text
PROXMUX Manager ist die professionelle Chrome-Erweiterung für Proxmox VE Administratoren. Greifen Sie sofort auf Ihren Virtualisierungs-Cluster zu, um Nodes, VMs und Container zu überwachen, ohne Ihren aktuellen Tab zu verlassen.

Hauptfunktionen:
- Schnellübersicht: Alle Cluster-Ressourcen (VMs, LXCs, Nodes) im Blick.
- Intelligente Konsolen: Unterstützung für noVNC, SPICE (remote-viewer) und Node-Shells.
- Modernes Design: Volle Unterstützung für Dark- und Light-Mode (folgt den Systemeinstellungen).
- Hochverfügbarkeit: Automatische Node-Erkennung und nahtloses Failover.
- Sicher: Ihre API-Token werden lokal gespeichert und verlassen niemals Ihren Browser.

Perfekt für DevOps-Engineers und Home-Server-Enthusiasten, die eine schnelle, professionelle und sichere Lösung für ihre Proxmox-Infrastruktur suchen.
```

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

3. **`downloads` & `downloads.open`**:
   - *Justification*: Necessary to generate and automatically launch SPICE configuration files (.vv) for external viewer applications like remote-viewer.

4. **Host Permissions (`https://*/*`)**:
   - *Justification*: Needed to communicate with self-hosted Proxmox VE API endpoints. The extension only sends requests to URLs explicitly configured by the user.

### User Data Policy:
- **Data Collection**: No personal data, browsing history, or user identity information is collected.
- **Data Usage**: API credentials are used solely for authentication with the user's own Proxmox server.
- **Data Storage**: All sensitive data is stored locally using Chrome's encryption-backed storage and is never transmitted to any third-party or developer-controlled servers.

---

## 4. Visual Assets Checklist
- **Icon**: 128x128 pixels (provided in `icons/icon128.png`).
- **Screenshots**: 1280x800 JPEG (provided in `store/screenshot_dark.jpg` and `store/screenshot_light.jpg`).
- **Marquee/Tile**: 440x280 pixels.
