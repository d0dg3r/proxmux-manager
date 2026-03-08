# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.1]: https://github.com/d0dg3r/PROXMUX-Manager/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/d0dg3r/PROXMUX-Manager/compare/v1.0.0-beta.2...v1.0.0
[1.0.0-beta.2]: https://github.com/d0dg3r/PROXMUX-Manager/releases/tag/v1.0.0-beta.2
