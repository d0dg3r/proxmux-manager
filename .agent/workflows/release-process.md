---
description: How to prepare and submit a new release for PROXMUX Manager
---

This workflow defines the standard process for creating a new release.

1.  **Version Update**:
    - Update `"version"` in `manifest.json`.
    - Update `"version"` and `"name"` in `package.json`.
2.  **Documentation**:
    - Add a new entry in `CHANGELOG.md` following the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.
    - Add relevant release notes to `README.md` (always newest first).
3.  **Screenshot Refresh**:
    - If UI changes were made, update `store/mock/mock.html` and `store/mock/popup.css`.
    // turbo
    - Run `node store/generate_screenshots_ci.js` to regenerate store assets.
4.  **Git Branching**:
    - Create a new branch: `git checkout -b release/v[VERSION]`.
    - Commit all changes: `git commit -m "chore: prepare v[VERSION] release"`.
5.  **Pull Request**:
    // turbo
    - Push the branch: `git push origin release/v[VERSION]`.
    // turbo
    - Create a PR using GitHub CLI: `gh pr create --title "Release v[VERSION]" --body "Summary of changes..." --base main`.
