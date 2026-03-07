# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - Unreleased

### Added
- Started development of v1.1.0.

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

[1.0.1]: https://github.com/d0dg3r/proxmux-manager/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/d0dg3r/proxmux-manager/compare/v1.0.0-beta.2...v1.0.0
[1.0.0-beta.2]: https://github.com/d0dg3r/proxmux-manager/releases/tag/v1.0.0-beta.2
