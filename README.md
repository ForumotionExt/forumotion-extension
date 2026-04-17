# Forumotion Extension (FME)

> A Chrome extension that enhances the Forumotion / ForumGratuit admin control panel (ACP) with professional theme management, template editing, and automatic update notifications.

[![Version](https://img.shields.io/github/v/release/ForumotionExt/forumotion-extension?label=version&color=blue)](https://github.com/ForumotionExt/forumotion-extension/releases)
[![Downloads](https://img.shields.io/github/downloads/ForumotionExt/forumotion-extension/total?label=downloads&color=brightgreen)](https://github.com/ForumotionExt/forumotion-extension/releases)
[![License](https://img.shields.io/github/license/ForumotionExt/forumotion-extension?color=lightgrey)](https://github.com/ForumotionExt/forumotion-extension/blob/main/LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/ForumotionExt/forumotion-extension?color=orange)](https://github.com/ForumotionExt/forumotion-extension/commits)
[![Issues](https://img.shields.io/github/issues/ForumotionExt/forumotion-extension?color=red)](https://github.com/ForumotionExt/forumotion-extension/issues)
[![Stars](https://img.shields.io/github/stars/ForumotionExt/forumotion-extension?color=yellow)](https://github.com/ForumotionExt/forumotion-extension/stargazers)

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
- [Roadmap](#roadmap)
- [Contributing](#contributing)

---

## Features

| Tab | Group | Description |
|-----|-------|-------------|
| **Teme** | Conținut | Browse and install CSS themes from the [forumotion-themes](https://github.com/ForumotionExt/forumotion-themes) catalog. Live preview, version compatibility check (phpBB3 ↔ prosilver, phpBB2 ↔ subsilver), CSS variable support, and real-time progress modal for template previews. |
| **Template-uri** | Conținut | Edit native Forumotion templates directly from the ACP. Reset to default with one click. |
| **ACP Styles** | CSS & JS | Inject custom CSS into the ACP. Built-in Dark 2026 preset, CSS file upload, and live style guard (auto-reinjection on SPA navigation). |
| **Forum CSS** | CSS & JS | Inject custom CSS into forum (non-admin) pages via the Forum Injector. Forum Dark 2026 preset and file upload included. |
| **Widgets JS** | CSS & JS | Manage named JavaScript snippets that auto-run on ACP and/or forum pages. Includes direct publish/unpublish to Forumotion JS management and execution via `chrome.scripting.executeScript`. |
| **Statistici** | Utile | Overview of installed themes, CSS file sizes, widget and note counts, storage usage, and on-demand forum statistics. |
| **Notițe** | Utile | Multi-tab personal notepad (up to 5 notes) with 1.5-second auto-save. |
| **Backup & Restore** | Utile | Export all FME data (themes, CSS, widgets, notes, settings) to a dated JSON file. Restore from any previous backup. |
| **SEO Tools** | Utile | Analiză SEO cu 28 verificări, inventar meta tags, analiză link-uri, și recomandări prioritizate. |
| **Activity Log** | Utile | Jurnal de activitate cu filtrare, export CSV și ștergere selectivă. |
| **Chatbox** | Utile | Panou de administrare chatbox cu configurare directă din FME. |
| **Plugins** | Conținut | Manager de plugin-uri JS din catalog GitHub cu instalare/dezinstalare automată. |
| **Actualizări** | Meta | Automatic version check every 6 hours. Full changelog, rollback links, skip-version support, and `NEW` badge on the extension icon. |
| **Setări** | Meta | Configure GitHub repositories, Personal Access Token (PAT), and update preferences. Synced across devices via `chrome.storage.sync`. |

A **standalone Dashboard** page is accessible from the extension popup. The **Forum Injector** content script automatically applies Forum CSS and forum-targeted widgets on all non-admin forum pages.

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
├── version.json                  # Current version, release date, changelog, and roadmap
├── widgets-examples/             # Ready-to-use widget snippets (copy-paste into Widgets JS tab)
│   ├── README.md
│   ├── acp/                      # ACP widgets: clock, quick-search, word-counter, confirm, back-to-top
│   ├── forum/                    # Forum widgets: banner, ticker, dark-toggle, progress-bar, word-count, etc.
│   └── both/                     # ACP + Forum: toast notifications, keyboard shortcuts
└── src/
    ├── background/
    │   └── service-worker.js     # GitHub API, update checks, badge, chrome.scripting widget execution
    ├── content/
    │   ├── content.js            # Entry point: panel init, navigation, ACP widget runner
    │   ├── forum-api.js          # Reads/writes Forumotion admin templates (same-origin fetch)
    │   ├── forum-chatbox.js      # Forum chatbox: auto-rejoin, login, /clear, sound, char counter
    │   ├── github.js             # GitHub API wrapper (delegates to service worker)
    │   ├── panel.js              # FME nav tab, 10-section routing with 4 sidebar groups
    │   ├── forum-injector.js     # Non-admin pages: applies Forum CSS + forum-targeted widgets
    │   └── tabs/
    │       ├── themes.js         # Theme browser, install, preview, version compatibility check
    │       ├── templates.js      # Template editor with category tabs
    │       ├── acp-css.js        # ACP custom CSS editor with Dark 2026 preset and style guard
    │       ├── forum-css.js      # Forum custom CSS editor with Forum Dark 2026 preset
    │       ├── widgets.js        # JS snippets manager (CRUD, target: acp/forum/both, enable/disable)
    │       ├── notes.js          # Multi-tab notepad with auto-save
    │       ├── backup.js         # Export/import all FME data as JSON
    │       ├── stats.js          # Extension + forum stats overview
    │       ├── seo-tools.js      # SEO analysis: 28 checks, meta tags, links, recommendations
    │       ├── activity-log.js   # Activity log with filtering and CSV export
    │       ├── chatbox.js        # Chatbox admin panel configuration
    │       ├── plugins.js        # JS plugin manager from GitHub catalog
    │       ├── updates.js        # Version check, changelog, rollback, skip-version
    │       └── settings.js       # Settings form with chrome.storage.sync
    ├── popup/
    │   ├── popup.html            # Extension popup UI
    │   └── popup.js              # Popup logic (page detection, navigation)
    ├── dashboard/
    │   ├── index.html            # Standalone dashboard page
    │   └── dashboard.js          # Dashboard functionality
    └── styles/
        ├── panel.css             # Panel layout, sidebar groups, modals, UI components
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

### v1.4.1 — 2026-04-06
- **Dashboard Home redesign:** Quick Stats, link-uri de download/update și secțiune Roadmap în pagina principală
- **Widgets JS publish/unpublish:** publicare directă pe forum cu entry dedicat per widget și toggle enable/disable
- **Quick Stats:** număr pentru widgets instalate/publicate, teme disponibile și versiunea curentă FME
- **Roadmap actualizat:** Plugins, auto-hashtags pentru teme, auto-validare template-uri și fixuri pentru ACP dark mode
- Fix: contorul **Teme disponibile** citește acum catalogul real GitHub, cu fallback la temele instalate
- Fix: layout-ul pentru **Roadmap / Changelog** a fost lărgit și clarificat
- Fix: **Activity Log** protejat împotriva erorii `Extension context invalidated`

### v1.4.0 — 2026-04-06
- **Tab SEO Tools:** analiză SEO completă cu 28 verificări, inventar meta tags, analiză link-uri, și recomandări
- **Tab Plugins:** manager de plugin-uri JS din catalog GitHub cu instalare/dezinstalare automată
- **Tab Activity Log:** jurnal de activitate cu filtrare, export CSV și ștergere selectivă
- **Tab Chatbox:** panou de administrare chatbox cu configurare directă din FME
- **Forum Chatbox:** chatbox complet cu auto-rejoin, buton login, comandă `/clear`, contor caractere, notificări sonore și panou comenzi
- **Instalare teme:** modal progres pas-cu-pas pentru CSS, template-uri și plugin-uri JS
- **Dezinstalare teme:** resetare automată template-uri la implicit înainte de ștergere
- **Plugin JS install:** descărcare și salvare automată JS din GitHub via `saveJsPlugin()`
- **Quick ACP Links:** link-uri rapide către secțiunile importante ale ACP
- **CSS Snippet Catalog:** colecție de snippet-uri CSS predefinite aplicabile cu un click
- **Template Marker System:** sistem de marcaje pentru template-uri modificate
- **Panel Home page:** pagină principală cu sumar rapid și acces direct la funcționalități
- Fix: `findTemplateEditUrl` rescris complet — URL-uri corecte Forumotion (`mode=edit_{category}&t={id}&l={category}`)
- Fix: instalare template-uri folosea `manifest.path` (undefined) în loc de `theme.path`
- Fix: butonul de instalare afișa "Instalează CSS" în loc de "Instalează tema"

### v1.3.0 — 2026-04-05
- **5 new tabs:** Forum CSS, Widgets JS, Notițe, Backup & Restore, Statistici
- **Forum Injector:** separate content script that applies Forum CSS and widgets on non-admin pages
- **Panel groups:** sidebar organised into 4 sections — Conținut, CSS & JS, Utile, Meta (10 sections total)
- **Version compatibility:** phpBB3 ↔ prosilver and phpBB2 ↔ subsilver/subsilver2 alias resolution blocks incompatible installs and previews
- **Preview progress modal:** full template preview shows real-time step-by-step progress with progress bar
- **`?tt=1` on preview tab:** template-based preview tab opens forum with unpublished template changes visible
- **Widget execution:** `chrome.scripting.executeScript` (world: MAIN) bypasses both extension CSP and page CSP
- **Widget examples:** `widgets-examples/` folder with 11 ready-to-use snippets for ACP, forum, and both
- Fix: `chrome.storage.session` → `chrome.storage.local` (session storage unavailable in content scripts)
- Fix: `chrome.tabs.create` → `window.open` in all tabs (tabs API unavailable in content scripts)

### v1.2.0 — 2026-04-05
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

## Roadmap

Funcționalități planificate pentru versiunile viitoare:

| Feature | Description |
|---------|-------------|
| 🦊 **Suport Firefox & Edge** | Portarea extensiei pentru Mozilla Firefox și Microsoft Edge (Manifest V3). |
| 🏪 **Marketplace widget-uri** | Catalog online de widget-uri JS contribuite de comunitate, instalabile direct din tab-ul Widgets JS. |
| 🌐 **Suport multi-forum** | Gestionarea mai multor forumuri din același dashboard, cu profiluri separate de setări. |
| 🔔 **Notificări teme noi** | Alertă automată când sunt adăugate teme noi în catalogul de teme. |
| 🌙 **Dark mode Dashboard** | Temă întunecată pentru pagina Dashboard, cu preferință salvată per browser. |
| 🔍 **Filtrare avansată teme** | Filtrare după motor de forum, culoare dominantă, autor și dată publicare. |
| 📦 **Export temă completă (.fmetheme)** | Pachetare temă + template-uri într-un singur fișier pentru distribuire și reinstalare simplă. |
| ⚡ **Live CSS preview în ACP** | Preview CSS în timp real direct în ACP, fără a deschide un tab nou. |
| ⏰ **Scheduler widget-uri** | Activarea/dezactivarea automată a widget-urilor după un program configurabil. |
| 🎨 **Syntax highlighting** | Colorare sintactică în editorii CSS (ACP Styles, Forum CSS) și JS (Widgets). |

---

## Contributing

Contributions are welcome! To get started:

1. Fork the repository and create a feature branch.
2. Make your changes directly in the `src/` directory — no build step required.
3. Test the extension by loading it unpacked in Chrome (`chrome://extensions` → Load unpacked).
4. Open a pull request describing your changes.

Please keep the code vanilla JavaScript (no external dependencies) and follow the existing module pattern used throughout `src/content/`.
