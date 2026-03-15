# Copilot Instructions for PROXMUX Manager

## Project Overview

**PROXMUX Manager** is a Chrome Browser Extension (Manifest V3) that lets users manage Proxmox VE clusters directly from the browser. It provides instant access to VMs, LXC containers, and node consoles with support for multiple console types (noVNC, SPICE, SSH, Shell).

- **Type:** Chrome Extension (Manifest V3), zero-build project (no transpilation or bundling)
- **Primary Language:** JavaScript (ES6 modules)
- **Current Version:** 1.1.4
- **License:** MIT

---

## Repository Structure

```
PROXMUX-Manager/
├── .github/
│   ├── FUNDING.yml
│   └── workflows/
│       ├── codeql.yml          # Security scanning (CodeQL)
│       ├── e2e-tests.yml       # Playwright end-to-end tests
│       ├── release.yml         # Automated release pipeline
│       └── screenshots.yml     # Store screenshot generation
├── _locales/                   # i18n translations
│   ├── de/messages.json        # German translations
│   └── en/messages.json        # English translations (primary)
├── docs/
│   ├── architecture.md
│   └── roadmap.md
├── icons/                      # Extension logo (proxmux_logo.png)
├── lib/
│   └── proxmox-api.js          # Core Proxmox API client (~221 lines)
├── options/                    # Settings page
│   ├── options.css
│   ├── options.html
│   └── options.js
├── popup/                      # Main extension UI
│   ├── popup.css
│   ├── popup.html
│   └── popup.js
├── store/                      # Chrome Web Store assets & mock data
│   └── mock/
│       └── mock.html           # Mock HTML used by E2E tests
├── tests/
│   └── e2e.spec.js             # Playwright E2E test suite
├── manifest.json               # Extension manifest
├── package.json                # npm scripts and devDependencies
├── package-lock.json
└── playwright.config.js        # Playwright test configuration
```

---

## How to Build, Test, and Run

### No Build Step Required

This is a **direct-load Chrome extension** — there is no compilation, bundling, or transpilation step. JavaScript files are loaded directly by the browser.

### Load the Extension Locally

1. Open `chrome://extensions/` in Chrome/Chromium.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the repository root directory.

### Install Dependencies (for testing only)

```bash
npm install
```

This installs only `@playwright/test` (dev dependency).

### Run E2E Tests

```bash
npm test                  # Run all Playwright tests (headless)
npm run test:ui           # Run with interactive Playwright UI
```

Tests use Playwright with Chromium. In CI: 2 retries, 1 serial worker. Locally: parallel workers, no retries.

### Playwright Configuration

See `playwright.config.js`. Tests live in `./tests/`. The test report is HTML (`reporter: 'html'`). Screenshots are captured on failure.

---

## Key Architectural Patterns

### Component Architecture

```
popup/popup.js (UI logic)
    └─→ lib/proxmox-api.js (API client)
            └─→ Proxmox VE REST API (HTTPS)
            └─→ chrome.cookies (session check)
            └─→ chrome.storage.local (credentials)
```

### ProxmoxAPI Class (`lib/proxmox-api.js`)

The `ProxmoxAPI` class is the single API client for all Proxmox communication.

- **Constructor:** `new ProxmoxAPI(baseUrl, apiToken, failoverUrls)`
- **Failover logic:** Tries primary URL first; on network error, iterates through `failoverUrls`; on success via failover, updates `currentUrl`; on 401/403, throws immediately without retry.
- **Timeout:** 10 seconds per request.
- **Key methods:**
  - `fetch(endpoint, options)` — HTTP wrapper with failover
  - `getResources()` — Lists all VMs, LXCs, nodes
  - `getVMConfig(node, type, vmid)` — Resource configuration
  - `getSpiceProxy(node, type, vmid)` — SPICE proxy data
  - `getConsoleUrl(node, type, vmid, name)` — Builds console URL
  - `checkSession()` — Validates `PVEAuthCookie` via chrome.cookies API
  - `isSpiceEnabled(node, type, vmid)` — Checks SPICE support
  - `getResourceDetails(res)` — Fetches IP & OS info

### UI State Management (`popup/popup.js`)

```javascript
let allResources = [];
let activeFilters = { type: 'all', status: 'all' };
```

- **`renderResources(resources, api)`** — Renders resource items in sorted order: Nodes → Running VMs/LXCs → Stopped VMs/LXCs.
- **`filterAndRender()`** — Applies search text, type pill, and status pill filters.
- **`openConsole(node, type, vmid, name)`** — Validates session (via `checkSession()`), then opens console in new tab.
- **`downloadSpiceFile(res, api)`** — Generates `.vv` config and triggers download.
- **`updateFailoverNodes(resources, primaryUrl)`** — Auto-discovers cluster nodes from resource list.
- **`initI18n()`** — Applies i18n translations to DOM at load time.

### Settings (`options/options.js`)

Stores credentials in `chrome.storage.local`:

```javascript
{
    proxmoxUrl: "https://px01.example.com:8006",
    apiUser: "root@pam",
    apiTokenId: "automation",
    apiSecret: "12345-abcde-...",
    apiToken: "root@pam!automation=12345-abcde-...",   // Combined token
    failoverUrls: ["https://px01.example.com:8006", ...]
}
```

---

## Internationalization (i18n)

- Translations live in `_locales/en/messages.json` (English) and `_locales/de/messages.json` (German).
- The extension name and description in `manifest.json` use `__MSG_extName__` / `__MSG_extDescription__` keys.
- HTML elements use custom attributes for runtime i18n:
  - `data-i18n="keyName"` — Sets `textContent`
  - `data-i18n-title="keyName"` — Sets `title` attribute
  - `data-i18n-placeholder="keyName"` — Sets `placeholder` attribute
- The `initI18n()` function in `popup.js` processes all these attributes at DOM load time via `chrome.i18n.getMessage()`.
- When adding new user-visible strings, add the key to **both** `_locales/en/messages.json` and `_locales/de/messages.json`.

---

## Theming & Styling

- Dark mode is the default; light mode activates via `@media (prefers-color-scheme: light)`.
- CSS custom properties (variables) define all colors in `popup.css` and `options.css`.
- Branding: `.prox` → turquoise, `.mux` → orange.
- Popup dimensions: 550px wide × 600px tall (max 700px).

---

## Chrome Extension Permissions

| Permission | Purpose |
|-----------|---------|
| `storage` | Store credentials and failover URLs |
| `tabs` | Open new tabs for consoles |
| `downloads` | Download SPICE `.vv` files |
| `downloads.open` | Auto-open downloaded SPICE files |
| `sidePanel` | Render in Chrome side panel |
| `cookies` | Validate `PVEAuthCookie` session |
| `host_permissions: https://*/*` | Access Proxmox HTTPS API endpoints |

---

## CI/CD Workflows

### E2E Tests (`e2e-tests.yml`)

- **Triggers:** Push to `main`, `develop`, `release/*`; PRs to `main` and `develop`.
- **Steps:** Checkout → Node.js LTS → `npm install` → Install Playwright Chromium → `npm test` → Upload HTML report artifact.
- **Timeout:** 15 minutes.
- **Known issue:** If Playwright browser binaries are missing, add `npx playwright install chromium --with-deps` as a separate step before running tests.

### Release (`release.yml`)

- **Triggers:** Tag push matching `v*`.
- **Steps:** Extracts version from tag → Converts beta version format → Updates `manifest.json` version → Creates ZIP (excludes `.git`, `node_modules`, etc.) → Creates GitHub Release.
- Pre-release if tag contains "beta".

### CodeQL Security Scan (`codeql.yml`)

- **Triggers:** Push to `main`/`develop`, PRs to `main`, weekly schedule (Sunday).
- **Language:** JavaScript.
- Results appear in the GitHub Security tab.

### Screenshots (`screenshots.yml`)

- Generates Chrome Web Store screenshots from the mock environment (`1280x800` and `640x400` variants).

---

## Testing Patterns

- All tests are in `tests/e2e.spec.js` and use Playwright.
- Tests run against `store/mock/mock.html` (a static mock page — no real Proxmox API needed).
- Tests validate DOM content, interactive elements, search input, filter pills, and dark/light mode toggling.
- When adding new UI features, add corresponding E2E tests that work against the mock HTML.
- The mock HTML (`store/mock/mock.html`) must be kept in sync with real UI changes.

---

## Common Development Workflows

### Adding a New UI Feature

1. Update `popup/popup.html` with new DOM elements (use `data-i18n` attributes for text).
2. Add i18n keys to `_locales/en/messages.json` and `_locales/de/messages.json`.
3. Implement logic in `popup/popup.js`.
4. Update `popup/popup.css` for styling.
5. Update `store/mock/mock.html` if needed for E2E tests.
6. Add or update tests in `tests/e2e.spec.js`.
7. Run `npm test` to verify.

### Adding a New API Call

1. Add a new method to the `ProxmoxAPI` class in `lib/proxmox-api.js`.
2. Use `this.fetch(endpoint)` to leverage built-in failover and timeout handling.
3. Call the method from `popup/popup.js`.

### Releasing a New Version

1. Update `CHANGELOG.md` with changes.
2. Tag the commit: `git tag v1.x.x && git push origin v1.x.x`.
3. The `release.yml` workflow handles updating `manifest.json` and creating the GitHub Release ZIP automatically.

---

## Known Issues and Workarounds

- **CORS / Self-signed Certificates:** Proxmox often uses self-signed TLS certificates. Users may need to accept the certificate in Chrome before the extension can connect. The options page includes a tip for this.
- **Session Validation Fallback:** `checkSession()` first tries `chrome.cookies.get('PVEAuthCookie')`; if cookies are unavailable (e.g., restricted context), it falls back to a `fetch` with `credentials: 'include'` and checks the response status and username field.
- **API Token Format:** The combined token string `apiToken` is formatted as `user@realm!tokenId=secret`. This is assembled in `options.js` on save and stored alongside the individual fields.
- **E2E CI Failures:** If the E2E test workflow fails with a "browser not found" error, ensure the Playwright install step runs `npx playwright install chromium --with-deps` before `npm test`.
