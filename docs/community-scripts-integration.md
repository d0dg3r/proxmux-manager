# Community Scripts Integration

This document describes how PROXMUX Manager integrates Community Scripts metadata and install command generation.

## Data Source Strategy

The extension uses a provider boundary with a GitHub-backed default source:

1. Primary source: GitHub repository tree API
   - `https://api.github.com/repos/community-scripts/ProxmoxVE/git/trees/main?recursive=1`
2. Normalization layer
   - Maps file paths into a stable script record (`slug`, `type`, `name`, `description`, `installUrl`, `scriptPath`).
3. Cache fallback
   - If GitHub is temporarily unavailable, stale cache is returned with `source=cache-fallback`.

This strategy is implemented in `lib/community-scripts.js`.

## Normalized Script Model

Catalog entries are normalized to:

- `name`
- `slug`
- `type`
- `description`
- `installUrl` (trusted raw GitHub URL)
- `scriptPath` (repo-relative source path)

The popup consumes this normalized model directly and lazily reads details from the same provider boundary (`getCommunityScriptDetails`).

## Caching

Data is cached in `chrome.storage.local`:

- `communityScriptsCatalogCacheV1`
- `communityScriptsDetailsCacheV1`

Catalog cache stores metadata (`source`, `updatedAt`, `schemaVersion`) and script records.

The cache TTL is configurable in Options (`communityScriptsCacheTtlHours`). If a fresh GitHub fetch fails, stale cached data is served with warning state for UI messaging.

## Install Command Generation

Command generation is implemented in `lib/install-command.js`.

- Only trusted raw GitHub URLs are accepted:
  - `https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/...`
- A command block is built per selected script:

```bash
# Script Name
bash -c '$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/example.sh)'
```

## Safety Model

Execution is intentionally assisted, not automatic:

1. User selects one or more scripts in popup.
2. Extension builds and copies install commands to clipboard.
3. Extension opens a Proxmox node shell tab.
4. User pastes and executes manually.

No remote auto-execution is performed by default.

## Limitations

- Slug names can differ from desired display naming; deterministic rules are used and an explicit override map exists for exceptional paths.
- GitHub API rate limiting may apply for very frequent refreshes.

## Future DB Provider Path

Provider calls already go through:

- `getCommunityScriptsCatalog(options)`
- `getCommunityScriptDetails(slug, options)`

To move to an external scraper/DB pipeline later:

1. Add a DB-backed provider implementing the same normalized record contract.
2. Route source selection in `community-scripts.js` behind a small provider switch (GitHub vs DB).
3. Keep popup/UI unchanged because it only consumes normalized records and source status.

## UI Components

Main integration is in:

- `popup/popup.html`
- `popup/popup.js`
- `popup/popup.css`

Related settings are in:

- `options/options.html`
- `options/options.js`
