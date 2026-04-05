# Forumotion Extension (FME)

> A Chrome extension that enhances the Forumotion / ForumGratuit admin control panel (ACP) with professional theme management, template editing, and automatic update notifications.

![Version](https://img.shields.io/badge/version-1.2.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## Table of Contents

- [Features](#features)
- [Supported Domains](#supported-domains)
- [Installation](#installation)
- [Configuration](#configuration)
- [Repository Structure](#repository-structure)
- [Architecture Overview](#architecture-overview)
- [Related Repositories](#related-repositories)
- [Changelog](#changelog)
- [Contributing](#contributing)

---

## Features

| Tab | Description |
|-----|-------------|
| **Teme** | Browse and install CSS themes from the [forumotion-themes](https://github.com/ForumotionExt/forumotion-themes) catalog. Includes live forum preview (15 seconds), filtering by engine, and search. |
| **Template-uri** | Edit native Forumotion templates directly from the ACP using a built-in code editor. Reset templates to default with one click. |
| **Administrare teme** | Export, import, and restore Forumotion themes in `.bbtheme` format. |
| **Actualizări** | Automatic update check every 6 hours. Displays changelog and shows a `NEW` badge on the extension icon when an update is available. |
| **Setări** | Configure GitHub repositories, Personal Access Token (PAT), and auto-update behaviour. Settings sync across devices via Chrome Storage. |

A **standalone Dashboard** page is also available from the extension popup, providing a quick overview of installed themes and extension status.

---

## Supported Domains

The extension activates on the admin panel (`/admin*`, `/adminhd*`) of all Forumotion-powered domains:

```
*.forumgratuit.ro   *.forumotion.com   *.forumotion.net   *.forumotion.eu
```

---

## Installation

### From a Release (recommended)

1. Download the latest `.zip` from [Releases](https://github.com/ForumotionExt/forumotion-extension/releases).
2. Extract the archive to a permanent folder on your computer.
3. Open Chrome and navigate to `chrome://extensions`.
4. Enable **Developer mode** (toggle in the top-right corner).
5. Click **Load unpacked** and select the extracted folder.

### From Source

```bash
git clone https://github.com/ForumotionExt/forumotion-extension.git
```

Then follow steps 3–5 above, selecting the cloned folder.

> **Note:** No build step is required — the extension runs directly from the source files.

---

## Configuration

After installing the extension, open the **Setări** tab inside the ACP panel to configure:

| Setting | Description | Default |
|---------|-------------|---------|
| **GitHub Token (PAT)** | Personal Access Token for authenticated GitHub API requests. Only `public_repo` read access is needed. Create one at [github.com/settings/tokens](https://github.com/settings/tokens). | *(empty)* |
| **Teme — Owner / Repo** | GitHub repository that hosts the themes catalog (`index.json`). | `ForumotionExt / forumotion-themes` |
| **Extension — Owner / Repo** | GitHub repository used for update checks and changelog. | `ForumotionExt / forumotion-extension` |
| **Templates — Owner / Repo** | GitHub repository that hosts default templates. | `ForumotionExt / templates` |
| **Actualizări automate** | Whether the extension should check for updates every 6 hours. | `true` |

Settings are stored in `chrome.storage.sync` and synced across all devices signed into the same Chrome profile.

---

## Repository Structure

```
forumotion-extension/
├── icons/                        # Extension icons (16px, 48px, 128px)
├── manifest.json                 # Chrome Extension Manifest V3
├── version.json                  # Current version, release date, and changelog
└── src/
    ├── background/
    │   └── service-worker.js     # GitHub API requests, update checks, badge management
    ├── content/
    │   ├── content.js            # Entry point: initialises panel, handles navigation
    │   ├── forum-api.js          # Reads/writes Forumotion admin templates (same-origin)
    │   ├── github.js             # GitHub API wrapper (delegates to service worker)
    │   ├── panel.js              # Injects FME nav tab, manages section routing
    │   └── tabs/
    │       ├── themes.js         # Theme browser, installer, preview, filtering
    │       ├── templates.js      # Template editor with category tabs
    │       ├── updates.js        # Version check and changelog display
    │       └── settings.js       # Settings form and Chrome Storage persistence
    ├── popup/
    │   ├── popup.html            # Extension popup UI
    │   └── popup.js              # Popup logic (page detection, status, navigation)
    ├── dashboard/
    │   ├── index.html            # Standalone dashboard page
    │   └── dashboard.js          # Dashboard functionality
    └── styles/
        ├── panel.css             # Panel layout, modals, and UI components
        └── themes-tab.css        # Theme-tab–specific styling
```

---

## Architecture Overview

The extension follows a **distributed, message-passing architecture** across three layers:

```
┌─────────────────────────────────────────────────────────────┐
│  Service Worker (background)                                │
│  • All GitHub API / raw.githubusercontent.com requests      │
│  • Periodic update alarm (every 6 hours)                    │
│  • Badge text management                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ chrome.runtime.sendMessage
┌──────────────────────────▼──────────────────────────────────┐
│  Content Scripts (injected into ACP pages)                  │
│  content.js → panel.js → tabs/* (themes, templates, …)     │
│  forum-api.js  →  same-origin fetch to the ACP             │
│  github.js     →  delegates network calls to SW            │
└─────────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- **No framework or build step** — vanilla ES6+ JavaScript with zero external dependencies.
- **CORS avoidance** — all cross-origin requests are proxied through the service worker.
- **Idempotent injection** — content scripts guard against duplicate panel initialisation.
- **Native styling** — panel UI reuses Forumotion's own CSS classes for a seamless look.
- **Scoped storage** — `chrome.storage.sync` provides cross-device settings with no backend.

---

## Related Repositories

| Repository | Purpose |
|---|---|
| [`ForumotionExt/forumotion-extension`](https://github.com/ForumotionExt/forumotion-extension) | Extension source code and `version.json` |
| [`ForumotionExt/forumotion-themes`](https://github.com/ForumotionExt/forumotion-themes) | Themes catalog (`index.json` + theme files) |
| [`ForumotionExt/templates`](https://github.com/ForumotionExt/templates) | Default Forumotion templates |

---

## Changelog

### v1.2.0
- Theme install modal: 3-step guided process with variable support
- `installTemplates`, `previewWithTemplates`, and `restoreFromPreview` APIs
- Preview banner shown during live forum theme preview

### v1.1.0 — 2026-04-05
- **Forum preview:** live theme preview applied to a new forum tab (15 seconds)
- Fix: theme install and preview from catalog now work correctly
- Fix: "Reset to default" button in template editor
- Themes catalog migrated to `ForumotionExt/forumotion-themes` with new structure
- Redesigned Themes page: native table styled to match the Forumotion ACP
- Standalone Dashboard page accessible from the popup

### v1.0.0 — 2026-03-01
- Native FME panel integrated into Forumotion ACP
- **Teme** tab: browse and install CSS themes from GitHub catalog
- **Template-uri** tab: direct template editing
- **Administrare teme** tab: export, import, and restore themes (`.bbtheme`)
- **Actualizări** tab: automatic version check
- **Setări** tab: GitHub repository and PAT configuration
- Domain support: `forumgratuit.ro`, `forumotion.com`, `forumotion.net`, `forumotion.eu`

---

## Contributing

Contributions are welcome! To get started:

1. Fork the repository and create a feature branch.
2. Make your changes directly in the `src/` directory — no build step required.
3. Test the extension by loading it unpacked in Chrome (`chrome://extensions` → Load unpacked).
4. Open a pull request describing your changes.

Please keep the code vanilla JavaScript (no external dependencies) and follow the existing module pattern used throughout `src/content/`.
