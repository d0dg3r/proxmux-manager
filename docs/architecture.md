# PROXMUX Manager - Technical Architecture

This document describes the technical architecture and design patterns of the PROXMUX Manager Chrome Extension.

## 1. Overview
PROXMUX Manager is a Chrome Extension (Manifest V3) designed to manage Proxmox VE clusters. It follows a modular architecture separating API logic from the user interface.

## 2. Component Diagram

```mermaid
graph TD
    UI[Popup / Side Panel] --> API[ProxmoxAPI Library]
    UI --> CS[CommunityScripts Provider]
    API --> PVE[Proxmox VE API]
    UI --> Storage[chrome.storage.local]
    API --> Cookies[chrome.cookies API]
    UI --> Tabs[chrome.tabs API]
    CS --> CSWebsite[community-scripts.org]
```

## 3. Core Components

### 3.1 ProxmoxAPI (`lib/proxmox-api.js`)
The heart of the extension. It encapsulates all communication with the Proxmox VE API.
- **Authentication**: Uses `PVEAPIToken` for all resource-related requests.
- **Session Management**: Specifically checks for the `PVEAuthCookie` using the `chrome.cookies` API to ensure interactive consoles (noVNC, Shell) can be opened without 401 errors.
- **Failover Logic**: Implements a retry mechanism that automatically switches to discovered cluster nodes if the primary node is unreachable.

### 3.2 UI Layer (`popup/`)
The extension uses a shared UI for both the browser action popup and the Chrome Side Panel.
- **`popup.html`**: Defines the searchable resource list and filter system.
- **`popup.js`**: Handles state management, filtering, and event delegation. It interacts with `ProxmoxAPI` to fetch data and launch consoles.
- **i18n**: Fully localized using `chrome.i18n` for English and German.

### 3.3 Data Storage
Uses `chrome.storage.local` to store:
- API Credentials (URL, Token, Secret).
- Failover Node URLs (discovered dynamically).
- User preferences (theme, display settings).
- Community Scripts catalog/details cache and cache TTL settings.

Uses `localStorage` for popup session UX state:
- Last search query.
- Last active type/status filters.
- Last expanded resource item.

## 4. Key Flows

### 4.1 Resource Loading & Failover
1. Extension triggers `api.getResources()`.
2. `ProxmoxAPI` tries the primary URL.
3. If it fails (Network Error), it iterates through `failoverUrls`.
4. On success, it updates the `currentUrl` for the current session and returns data.
5. `popup.js` then calls `updateFailoverNodes()` to keep the node list fresh.

### 4.2 Console Authorization
Before opening a `novnc` or `shell` URL, the extension:
1. Calls `api.checkSession()`.
2. Verifies the presence of `PVEAuthCookie` via `chrome.cookies.get`.
3. Performs a fallback `fetch` with `credentials: 'include'` to double-check.
4. If invalid, displays the **Login Required** overlay.

### 4.3 Power Action Status Synchronization
Power actions (`start`, `shutdown`, `stop`, `reboot`) are handled with a two-stage strategy:
1. Send action to Proxmox (`vmAction` / `nodeAction`).
2. Poll resource status endpoints (`/status/current` or node status) until the target state is confirmed.
3. Store confirmed state in an in-memory override map (`pendingStatusOverrides`) keyed by resource identity.
4. During list refresh (`/cluster/resources`), apply overrides to avoid stale cluster cache rollbacks.
5. Retry refresh with backoff (3s, 6s, 12s) until cluster data catches up and overrides can be cleared.

This prevents transient UI regressions where a resource successfully changed state but briefly reappeared with the previous state.

### 4.4 Search and Filter UX Flow
The popup top-bar search pipeline is designed for fast iterative filtering:
1. User input updates `localStorage` and triggers immediate in-memory filtering.
2. A context-aware clear control is shown only when a query exists.
3. Search reset works via clear button and `Escape`, then re-renders the full filtered list.
4. Filter group visibility is controlled by a collapsible toggle with an explicit active/collapsed visual state.
5. Search, filters, and expanded row state are restored when the popup opens again.

### 4.5 Community Scripts Assisted Install Flow
1. Popup loads Community Scripts catalog via hybrid source strategy (API/JSON first, website fallback).
2. User searches and selects one or more scripts.
3. Extension fetches detail data on demand (About text + install URL).
4. Extension builds trusted install commands and copies them to clipboard.
5. Extension opens target node shell tab; user pastes and executes manually.

## 5. Security Model
- **Token Security**: API Tokens are stored locally in the browser's profile and are never transmitted to any third-party.
- **Least Privilege**: The extension requests only necessary permissions (`storage`, `tabs`, `downloads`, `sidePanel`, `cookies`).
- **Isolation**: All API calls are made from the local extension context.

## 6. Quality and Release Verification
- **E2E Testing**: Playwright test suite validates popup behavior in a controlled mock environment, including search reset and filter toggle interactions.
- **Visual Asset Pipeline**: Store screenshots are generated from a deterministic mock UI (`store/mock/`) to keep dark/light captures consistent with released UX.
- **Release Discipline**: Version bumps, docs updates, screenshot refresh, and local test validation are treated as mandatory release gates.
