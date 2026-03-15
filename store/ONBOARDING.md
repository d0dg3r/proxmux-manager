# PROXMUX Manager - Store Onboarding Guide

This document contains all the text, metadata, and justifications required to submit PROXMUX Manager to the Chrome Web Store.

## 1. Store Metadata

- **Product Name**: PROXMUX Manager
- **Short Name**: PROXMUX
- **Detailed Description**: (See Section 2)
- **Summary**: Manage your Proxmox VE cluster. Monitor resources, access consoles (noVNC, SPICE), and manage nodes with failover support.
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
- **Interactive Tags**: Discover and click cluster-wide tags for instant categorical filtering.
- **Uptime Display**: Real-time, human-readable uptime (e.g., 2d 5h) for all running resources.
- **Improved Monitoring**: See VM/LXC status, OS types, and IP addresses at a glance.
- **Tabbed Settings UI**: Organized "General", "Help", and "About" sections for better configuration.
- **Intelligent Consoles**: Support for noVNC, SPICE (remote-viewer), and Node Shells.
- **Modern Design**: Selection of Dark, Light, or Follow System themes.
- **High Availability**: Automatic cluster node discovery and seamless failover support.
- **Secure**: API Tokens are stored locally and never leave your browser.

Perfect for DevOps engineers and home-server enthusiasts who need a fast, professional, and secure way to manage their Proxmox infrastructure.
```

### German (Germany)
```text
PROXMUX Manager ist die professionelle Chrome-Erweiterung für Proxmox VE Administratoren. Greifen Sie sofort auf Ihren Virtualisierungs-Cluster zu, um Nodes, VMs und Container zu überwachen, ohne Ihren aktuellen Tab zu verlassen.

Hauptfunktionen:
- **Interaktive Tags**: Entdecken und klicken Sie Cluster-weite Tags für eine sofortige kategorische Filterung.
- **Uptime-Anzeige**: Echtzeit-Uptime in lesbarer Form (z. B. 2d 5h) für alle laufenden Ressourcen.
- **Verbessertes Monitoring**: Sehen Sie VM/LXC-Status, OS-Typen und IP-Adressen auf einen Blick.
- **Tabbed Settings UI**: Strukturierte Bereiche „General“, „Help“ und „About“ für bessere Konfiguration.
- **Intelligente Konsolen**: Unterstützung für noVNC, SPICE (remote-viewer) und Node-Shells.
- **Modernes Design**: Auswahl zwischen Dark, Light oder System-Theme.
- **Hochverfügbarkeit**: Automatische Node-Erkennung im Cluster und nahtloses Failover.
- **Sicher**: API-Token werden lokal gespeichert und verlassen niemals Ihren Browser.

Perfekt für DevOps Engineers und Home-Server-Enthusiasten, die eine schnelle, professionelle und sichere Lösung zur Verwaltung ihrer Proxmox-Infrastruktur benötigen.
```

Use English as the canonical release-source text, then keep the German section synchronized for storefront localization.

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

4. **`cookies`**:
   - *Justification*: Required to verify if the user has an active Proxmox Web UI session cookie. This prevents 401 errors when opening interactive consoles, ensuring a seamless user experience.

5. **Host Permissions (`https://*/*`)**:
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
2. Click the extension icon and then the 'Gear' icon to open Settings.
3. Enter valid Proxmox VE API credentials (URL, User, Token ID, Secret).
4. Save settings.
5. The extension will populate the resource list with VMs and Containers.
6. Verify console buttons (noVNC, SPICE) appear based on resource configuration.

---

## 5. Visual Assets Checklist
- **Icon**: 128x128 pixels (provided in `store/proxmux_logo.png`).
- **Screenshots (Primary Store Set)**: 1280x800 PNG (`store/screenshot_dark.png`, `store/screenshot_light.png`).
- **Screenshots (Compact Variant)**: 640x400 PNG (`store/screenshot_dark_640x400.png`, `store/screenshot_light_640x400.png`).
- **Marquee/Tile**: 440x280 pixels.
