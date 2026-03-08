# PROXMUX Manager - Roadmap & Backlog

This document outlines the planned features, improvements, and technical debt for PROXMUX Manager.

## 🚀 Roadmap (Planned Features)

### v1.2.0: Power Management
- [ ] **VM/LXC Controls**: Add buttons for Start, Stop, Shutdown, and Reboot directly in the resource list.
- [ ] **Confirmation Dialogs**: Protection against accidental shutdowns.
- [ ] **Status Polling**: Real-time status updates after a power action is triggered.

### v1.3.0: Cluster Dashboard
- [ ] **Resource Overview**: Visual dashboard showing CPU, RAM, and Storage usage across the entire cluster.
- [ ] **Node Health**: Visual indicators for node load and availability.
- [ ] **Search Enhancements**: Grouping resources by node or pool.

### Future Ideas
- [ ] **Multi-Cluster Support**: Manage multiple Proxmox clusters with a quick-switch toggle.
- [ ] **Backup Monitoring**: View recent backup tasks and their status.
- [ ] **Dark/Light Mode Toggle**: Manual override for the system-wide theme setting.

## 🛠 Backlog (Technical Debt & Improvements)

### High Priority
- [ ] **SSL Certificate Handling**: Improve the "Connection Failed" guide for users with self-signed certificates (maybe a direct link to the cert acceptance page).
- [ ] **Performance**: Optimize the rendering of large resource lists (virtual scrolling).

### Medium Priority
- [x] **E2E Testing**: Implemented Playwright tests and GitHub Actions workflow.
- [ ] **Refactoring**: Move i18n logic into a shared utility.
- [ ] **Testing**: Implement unit tests for `ProxmoxAPI` logic using Jest.
- [ ] **Error Logging**: Centralized error reporting within the UI for better user feedback.

### Feedback
If you have ideas or feature requests, please open an issue on [GitHub](https://github.com/d0dg3r/PROXMUX-Manager/issues).
