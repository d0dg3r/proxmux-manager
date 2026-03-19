# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-03-16

### Added
- **Calm Premium Navigation System**: Introduced a calmer, premium visual hierarchy for cluster tabs and filter rows with a single strong active-state signal.

### Changed
- **Filter Interaction Model**: Replaced single-select `All` type behavior with independent multi-toggle filters for `Node`, `VM`, `LXC`, `Online`, and `Offline`.
- **Default Filter Semantics**: Type and status filters now initialize with all toggles enabled and persist per-scope multi-select state.

### Fixed
- **Node Visibility With Status Filters**: Mapped node statuses (`online`/`offline`) to filter statuses (`running`/`stopped`) so nodes remain visible under active status filtering.

## [1.2.1-beta.2] - 2026-03-16

### Added
- **UI Scale Presets**: Added global UI scaling controls (`Compact`, `Standard`, `Large` + fine slider) for popup/sidepanel and options page.
- **Multi-Format SSH Export**: Added OpenSSH, PuTTY `.reg`, and CSV export output with format-aware filenames and MIME types.

### Changed
- **Resource Card Consistency**: Unified row structure and chip placement across `All`, `Favorites`, and cluster-specific tabs.
- **Status Presentation Refresh**: Updated running/stopped/unknown indicators, status filter pills, and transient power-action status chips for clearer state feedback.
- **Stats Alignment**: Standardized details rows to a stable 3-column layout so progress bars share equal width and right-side values align on one vertical line.
- **Control Sizing Consistency**: Rebalanced search field and settings tab sizing/weight in popup and options for better visual hierarchy.

### Fixed
- **Search Field Height Regression**: Fixed oversized popup search input height by constraining rendered control height to match other form controls.
- **Cross-View Scale Sync**: UI scale changes now propagate live between open popup/sidepanel/options contexts via storage change listeners.

## [1.2.0] - 2026-03-15

### Added
- **No-Config Import Entry Flow**: The no-config banner now offers separate `Configure` and `Import Settings` entry points, with direct subtab routing.
- **Encrypted Backup UX Refinement**: In no-config import mode, backup export and Save/Test actions are hidden to keep focus on restore-first onboarding.
- **Factory Reset Helper**: Added a shared reset service that resets all clusters to a single default cluster and restores global defaults consistently.
- **Token Onboarding Guide**: Added a complete setup guide for Proxmox API tokens with best-practice and root fallback paths.
- **Interactive Token Helper Script**: Added `scripts/setup_proxmox_token.sh` to create/manage API users, assign ACLs, create tokens, and print zsh-safe validation commands.
- **Secure Secret Handling**: Token helper now supports unique secret-file output (`600` permissions), plus explicit password-manager import and deletion guidance.

### Changed
- **Multi-Cluster Reset Semantics**: `Reset Settings` now performs a true factory-style reset across all clusters instead of resetting only the active cluster.
- **Screenshot Pipeline**: Store screenshot generation now builds dedicated cluster/connection/settings scenes and exports combined Light+Dark 1280x800 assets.
- **Store Visual Assets**: Replaced old split dark/light screenshot references with new combined release-ready store images.
- **User Docs Formatting**: Standardized user-facing docs with markdown links for internal doc references and fenced `bash` blocks for runnable command sequences.
- **Release Screenshot Process**: Switched screenshot flow to release-integrated handling (assets updated/committed in release branch PRs).

### Fixed
- **Native Browser Dialog Removal**: Removed remaining `window.confirm`/`alert` usage in reset and SPICE error flows; replaced with in-extension confirmation/status UX.
- **Reset Confirmation Consistency**: Added consistent in-addon two-step reset confirmations in popup and options views, including proper state reset on interaction changes.
- **Screenshot Workflow Permissions**: Removed auto-PR behavior from screenshot workflow to avoid GitHub Actions permission failures.
- **Release Notes Consistency**: Updated README release notes heading to match the final stable release.

## [1.2.0-beta.3] - 2026-03-15

### Added
- **No-Config Import Entry Flow**: The no-config banner now offers separate `Configure` and `Import Settings` entry points, with direct subtab routing.
- **Encrypted Backup UX Refinement**: In no-config import mode, backup export and Save/Test actions are hidden to keep focus on restore-first onboarding.
- **Factory Reset Helper**: Added a shared reset service that resets all clusters to a single default cluster and restores global defaults consistently.

### Changed
- **Multi-Cluster Reset Semantics**: `Reset Settings` now performs a true factory-style reset across all clusters instead of resetting only the active cluster.
- **Screenshot Pipeline**: Store screenshot generation now builds dedicated cluster/connection/settings scenes and exports combined Light+Dark 1280x800 assets.
- **Store Visual Assets**: Replaced old split dark/light screenshot references with new combined release-ready store images.

### Fixed
- **Native Browser Dialog Removal**: Removed remaining `window.confirm`/`alert` usage in reset and SPICE error flows; replaced with in-extension confirmation/status UX.
- **Reset Confirmation Consistency**: Added consistent in-addon two-step reset confirmations in popup and options views, including proper state reset on interaction changes.

## [1.2.0-beta.2] - 2026-03-15

### Added
- **Token Onboarding Guide**: Added a complete setup guide for Proxmox API tokens with best-practice and root fallback paths.
- **Interactive Token Helper Script**: Added `scripts/setup_proxmox_token.sh` to create/manage API users, assign ACLs, create tokens, and print zsh-safe validation commands.
- **Secure Secret Handling**: Token helper now supports unique secret-file output (`600` permissions), plus explicit password-manager import and deletion guidance.

### Changed
- **User Docs Formatting**: Standardized user-facing docs with markdown links for internal doc references and fenced `bash` blocks for runnable command sequences.
- **Release Screenshot Process**: Switched screenshot flow to release-integrated handling (assets updated/committed in release branch PRs).

### Fixed
- **Screenshot Workflow Permissions**: Removed auto-PR behavior from screenshot workflow to avoid GitHub Actions permission failures.
- **Release Notes Consistency**: Updated README “What’s New” heading to match `v1.2.0-beta.2`.

## [1.2.0-beta.1] - 2026-03-15

### Added
- **Toolbar Action Modes**: Added configurable default toolbar click behavior to open either Side Panel or a persistent floating window.
- **Inline Advanced Settings**: Settings now open inside the extension UI (side panel/floating view) for faster in-context configuration.
- **Floating Window Controls**: Added direct open/close controls for the floating manager window.

### Changed
- **Display Controls UX**: Moved display toggles directly under filters and redesigned them as compact chips for faster scanning.
- **Visual Consistency**: Unified filter/display chip styling, reduced chip height, and improved section icon/divider alignment.
- **Light Theme Contrast**: Increased contrast across key surfaces and action controls for better readability.
- **Console Actions**: Standardized noVNC/SPICE/SSH/Shell button coloring across light and dark themes.
- **Console Button Order**: Adjusted action order to show `Shell` before `SSH`.

### Fixed
- Side panel opening reliability from toolbar clicks and floating-window transitions.
- In-view settings navigation behavior to avoid opening separate browser tabs/windows.
- Inline settings action styling and visibility cleanup for a clearer, professional settings workflow.

## [1.1.4] - 2026-03-14

### Added
- **Node Management**: Node resources now feature management IP addresses and direct SSH connectivity.
- **Tab Management**: Added advanced tab behavior settings (Always New, Reuse Dedicated, or Focus Machine).
- **Tab Duplicate Prevention**: Intelligently focuses existing console tabs for the same machine, reducing clutter (Default behavior).
- **Console Experience**: Switched Node Shell and LXC consoles to `xterm.js` for native scaling and reliable copy/paste.

### Fixed
- German translations for missing tab management and shell settings.

## [1.1.3] - 2026-03-09

### Added
- Search reset UX with a clear button in the popup search field.
- Keyboard reset behavior for search input via `Escape`.
- Additional store screenshot outputs in `640x400` alongside `1280x800`.

### Changed
- Refreshed store mock and screenshot generation flow to keep dark/light captures aligned with the current popup UI.
- Updated E2E coverage for search clear/reset and filter toggle state behavior.

### Fixed
- Power action status refresh reliability by preserving confirmed target states until cluster resources catch up.
- Search/filter top-bar layout collisions (filter toggle and clear button overlap).
- Screenshot consistency between dark and light variants.

## [1.1.2] - 2026-03-08

### Added
- **Tags Support**: Machine tags from Proxmox are now displayed as pills in the resource list.
- **Interactive Tag Filters**: Discover and click cluster-wide tags in the search bar for instant filtering.
- **Uptime Display**: Real-time, human-readable uptime (e.g., `2d 5h`) for all running resources.
- **Tabbed Settings UI**: Organized "General", "Help", and "About" sections.
- **Enhanced Help**: Comprehensive troubleshooting guide for SPICE, SSH (Guest Agent), SSL, and more.
- **Theme Selection**: Dedicated toggle button in the popup header for quick-switching, plus advanced settings in the options page.
- **Manual Refresh**: Dedicated button in the popup header for on-demand updates.
- **Test Connection**: Instant API validation in the settings page.

### Fixed
- Sidepanel height: now properly fills the screen space.
- Header-based alerts: login/session prompts are always visible during scroll.
- Character Encoding: Fixed heart emoji (❤️) and UTF-8 meta tags.
- Renamed project to **PROXMUX-Manager** and updated all repository references.

## [1.1.1] - 2026-03-08

### Added
- Robust session detection using `chrome.cookies` API for consoles.
- New **Login Required** overlay to guide users when their Proxmox session expires.
- Turquoise (**PROX**) and Orange/Brown (**MUX**) branding overhaul for a premium look.
- Detailed debugging status in the popup for easier troubleshooting.

### Fixed
- Resolved 401 errors when opening consoles due to expired browser sessions.

## [1.1.0] - 2026-03-08
- Feature release with improved UI and session handling (Internal).

## [1.0.2] - 2026-03-07

### Fixed
- Fixed a `ReferenceError` in the popup where `updateFailoverNodes` was not defined, breaking the initial resource load for some users.

## [1.0.1] - 2026-03-07
- Critical bug where the "Save Settings" button on the options page was unresponsive due to an ID mismatch.

## [1.0.0] - 2026-03-07

### Added
- Complete **PROXMUX** branding overhaul (All-Caps branding).
- Dark and Light mode support based on system preferences.
- Automated store screenshot generation (1280x800 JPEG).
- Comprehensive Chrome Web Store onboarding documentation.
- SSH console support for Linux-based VMs and Containers.
- Node Failover logic and automatic cluster node discovery.
- Internationalization support for English and German.
- Privacy Policy and Store Onboarding guide.

### Changed
- Refactored options page for better usability.
- Unified console detection logic for noVNC, SPICE, and Shell.

## [1.0.0-beta.2] - 2026-03-05

### Added
- Initial GitHub Actions release workflow.
- SPICE (.vv) file auto-open functionality.
- Side Panel support for persistent cluster management.
- Proxmox API integration for resource monitoring.

[1.2.1]: https://github.com/d0dg3r/PROXMUX-Manager/compare/v1.2.1-beta.2...v1.2.1
[1.2.1-beta.2]: https://github.com/d0dg3r/PROXMUX-Manager/compare/v1.2.0...v1.2.1-beta.2
[1.2.0]: https://github.com/d0dg3r/PROXMUX-Manager/compare/v1.2.0-beta.3...v1.2.0
[1.2.0-beta.3]: https://github.com/d0dg3r/PROXMUX-Manager/compare/v1.2.0-beta.2...v1.2.0-beta.3
[1.2.0-beta.2]: https://github.com/d0dg3r/PROXMUX-Manager/compare/v1.2.0-beta.1...v1.2.0-beta.2
[1.2.0-beta.1]: https://github.com/d0dg3r/PROXMUX-Manager/compare/v1.1.4...v1.2.0-beta.1
[1.1.4]: https://github.com/d0dg3r/PROXMUX-Manager/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/d0dg3r/PROXMUX-Manager/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/d0dg3r/PROXMUX-Manager/compare/v1.1.1...v1.1.2
[1.0.1]: https://github.com/d0dg3r/PROXMUX-Manager/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/d0dg3r/PROXMUX-Manager/compare/v1.0.0-beta.2...v1.0.0
[1.0.0-beta.2]: https://github.com/d0dg3r/PROXMUX-Manager/releases/tag/v1.0.0-beta.2
