# Forumotion Extension (FME)

> A Chrome extension that enhances the Forumotion / ForumGratuit admin control panel (ACP) with professional theme management, template editing, and automatic update notifications.

[![Version](https://img.shields.io/badge/version-1.4.51-blue)](https://github.com/ForumotionExt/forumotion-extension/releases)
[![Downloads](https://img.shields.io/github/downloads/ForumotionExt/forumotion-extension/total?label=downloads&color=brightgreen)](https://github.com/ForumotionExt/forumotion-extension/releases)
[![Forumotion Compatible](https://img.shields.io/badge/Forumotion-Compatible-blueviolet)](https://www.forumotion.com/)
[![License](https://img.shields.io/github/license/ForumotionExt/forumotion-extension?color=lightgrey)](https://github.com/ForumotionExt/forumotion-extension/blob/main/LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/ForumotionExt/forumotion-extension?color=orange)](https://github.com/ForumotionExt/forumotion-extension/commits)
[![Issues](https://img.shields.io/github/issues/ForumotionExt/forumotion-extension?color=red)](https://github.com/ForumotionExt/forumotion-extension/issues)
[![Stars](https://img.shields.io/github/stars/ForumotionExt/forumotion-extension?color=yellow)](https://github.com/ForumotionExt/forumotion-extension/stargazers)

---

### v1.0.0 — 2026-03-01
- Native FME panel integrated into Forumotion ACP
- **Teme** tab: browse and install CSS themes from GitHub catalog
- **Template-uri** tab: direct template editing
- **Administrare teme** tab: export, import, and restore themes (`.bbtheme`)
- **Actualizări** tab: automatic version check
- **Setări** tab: GitHub repository and PAT configuration
- Domain support: `forumgratuit.ro`, `forumotion.com`, `forumotion.net`, `forumotion.eu`

---


## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Supported Domains](#supported-domains)
- [Browser Compatibility](#browser-compatibility)
- [Manual Installation](#manual-installation)
  - [Google Chrome](#google-chrome)
  - [Mozilla Firefox](#mozilla-firefox)
  - [Opera](#opera)
  - [Safari (macOS)](#safari-macos)
- [Usage](#usage)
- [Resource Limits](#resource-limits)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**Forumotion Extension (FME)** is a browser extension built with Manifest V3 that enhances the admin experience on [Forumotion](https://www.forumotion.com) and [ForumGratuit](https://www.forumgratuit.ro) forums. It injects a fully featured panel directly into the forum's admin control panel (ACP), giving administrators access to themes, plugins, SEO analysis, notes, a marketplace, audit logs, and more — without leaving the ACP.

The extension is written in pure Vanilla JS with no external dependencies.

---

## Features

| Feature | Description |
|---|---|
| **Admin Panel (FME Panel)** | Embedded panel inside the Forumotion ACP with internal navigation |
| **Theme Manager** | Install, manage, and apply custom admin themes (up to 10 saved themes) |
| **Plugin System** | Load and manage plugins with sandbox isolation and conflict detection |
| **Marketplace** | Browse and install themes and plugins from the FME marketplace |
| **SEO Analyzer** | Analyze your forum's SEO directly from the admin panel |
| **Admin Notes** | Save and manage notes from within the ACP |
| **Audit Log** | Track admin actions (up to 500 entries, last 7 days highlighted) |
| **Backup & Settings** | Backup extension data and manage preferences |
| **Dashboard** | Overview popup with stats: themes installed, active plugins, notes, storage used |
| **Auto-update Check** | Checks for new versions every hour via GitHub |

---

## Supported Domains

FME activates automatically on the admin pages of the following domains:

- `*.forumgratuit.ro`
- `*.forumotion.com`
- `*.forumotion.net`
- `*.forumotion.eu`
- `*.forum.st`
- `*.forumz.ro`

The extension panel loads on `/admin` and `/adminhd` paths. On regular forum pages (non-admin), a lightweight forum-side script is injected separately.

---

## Browser Compatibility

| Browser | Minimum Version | Build |
|---|---|---|
| Google Chrome / Chromium | 88+ | `fme-chrome-v1_4_50` |
| Mozilla Firefox | 128+ | `fme-firefox-v1_4_51` |
| Opera | 74+ | `fme-opera-v1_4_52` |
| Safari | 16+ (macOS 13+) | via Xcode conversion |

> Each browser has its own dedicated build. Make sure to download the correct ZIP for your browser.

---

## Manual Installation

Since FME is distributed via GitHub and not through official browser stores, it must be installed manually as an unpacked extension. Download the correct ZIP for your browser from the [Releases page](https://github.com/ForumotionExt/forumotion-extension/releases/latest), then follow the steps for your browser below.

---

### Google Chrome

> Also works for **Brave**, **Microsoft Edge**, **Vivaldi**, and other Chromium-based browsers.

**Required build:** `fme-chrome-v1_4_50.zip`

1. Download and **extract** `fme-chrome-v1_4_50.zip` to a permanent location on your computer (e.g. `Documents/fme-chrome`).
   > Do not delete or move this folder after installation — Chrome loads the extension directly from it.

2. Open Chrome and navigate to:
   ```
   chrome://extensions
   ```

3. Enable **Developer mode** using the toggle in the top-right corner.

4. Click **Load unpacked**.

5. In the file picker, select the extracted folder (the one containing `manifest.json`).

6. FME will appear in your extensions list with the label *Forumotion Extension (FME)*.

7. Click the puzzle piece icon (🧩) in the Chrome toolbar and **pin** FME for quick access.

8. Navigate to your forum's admin panel (e.g. `yourforum.forumotion.com/admin`) to confirm the extension is active.

> Chrome may display a banner warning about developer mode extensions — this is expected and can be dismissed.

---

### Mozilla Firefox

> Minimum required version: **Firefox 128**
> Extension ID: `fme@forumotion.ext`

**Required build:** `fme-firefox-v1_4_51.zip`

1. Download and **extract** `fme-firefox-v1_4_51.zip` to a permanent location on your computer.

#### Option A — Temporary load (resets on restart)

2. Open Firefox and navigate to:
   ```
   about:debugging#/runtime/this-firefox
   ```

3. Click **Load Temporary Add-on…**

4. Inside the extracted folder, select the `manifest.json` file.

5. FME will be loaded immediately and will remain active until Firefox is closed.

> You will need to repeat these steps every time Firefox restarts.

#### Option B — Persistent load via Firefox Developer Edition

2. Download and install [Firefox Developer Edition](https://www.mozilla.org/en-US/firefox/developer/).

3. Open it and navigate to:
   ```
   about:config
   ```
   Search for `xpinstall.signatures.required` and set its value to **`false`**.

4. Then navigate to:
   ```
   about:debugging#/runtime/this-firefox
   ```

5. Click **Load Temporary Add-on…** and select `manifest.json` from the extracted folder.

6. FME is now persistent across browser restarts in Firefox Developer Edition.

---

### Opera

> Opera uses the Chromium engine — installation is identical to Chrome.

**Required build:** `fme-opera-v1_4_52.zip`

1. Download and **extract** `fme-opera-v1_4_52.zip` to a permanent location on your computer.

2. Open Opera and navigate to:
   ```
   opera://extensions
   ```

3. Enable **Developer mode** using the toggle in the top-right corner.

4. Click **Load unpacked**.

5. Select the extracted folder containing `manifest.json`.

6. FME will appear in the extensions list. Pin it to the toolbar for easy access.

7. Navigate to your forum's admin panel to confirm the extension is active.

---

### Safari (macOS)

> Minimum required: **Safari 16** on **macOS 13 (Ventura)** or later.
> Bundle ID: `com.forumotion.ForumotionExt.Extension`

Safari requires extensions to be wrapped in a native macOS app using Xcode. There is no dedicated Safari build — use the Chrome ZIP as the source.

#### Prerequisites

- macOS 13 (Ventura) or later
- [Xcode](https://apps.apple.com/app/xcode/id497799835) installed (free, from the Mac App Store)
- A free Apple Developer account (no paid membership required for local use)

#### Steps

1. Download and extract `fme-chrome-v1_4_50.zip` to a folder, for example `~/fme-safari`.

2. Open **Terminal** and run the following command to convert the extension into a Safari-compatible Xcode project:
   ```bash
   xcrun safari-web-extension-converter ~/fme-safari \
     --project-location ~/fme-safari-app \
     --app-name "ForumotionExt" \
     --bundle-identifier "com.forumotion.ForumotionExt.Extension"
   ```

3. Open the generated Xcode project:
   ```bash
   open ~/fme-safari-app/ForumotionExt.xcodeproj
   ```

4. In Xcode, open the **Signing & Capabilities** tab and select your Apple ID under **Team**.

5. Press **⌘ + R** (or click the ▶ Run button) to build and launch the companion app.

6. Open **Safari** and go to:
   ```
   Safari → Settings → Extensions
   ```

7. Find **ForumotionExt** in the list and enable it by checking the checkbox.

8. When Safari asks for permissions, click **Allow on Every Website** — or restrict access to `*.forumotion.com` and `*.forumgratuit.ro` only.

9. Navigate to your forum's admin panel to confirm FME is active.

> macOS may show a security warning for locally signed applications. This is expected for developer builds and can be dismissed.

---

## Usage

Once installed and active:

1. Go to your Forumotion or ForumGratuit admin panel (`yourforum.forumotion.com/admin`).
2. The **FME panel** will be embedded directly in the ACP interface.
3. Click the **FME icon** in the browser toolbar to open the popup, which shows:
   - Panel status (active / not on an admin page)
   - Number of installed themes
   - Pending update notification (if any)
4. Click **Dashboard** in the popup to open a full overview with four tabs: **Overview**, **Themes**, **Plugins**, and **About**.
5. Use the FME panel inside the ACP to access all features: Marketplace, Theme Builder, Plugin Manager, SEO Analyzer, Notes, Audit Log, Backup, and Settings.

---

## Resource Limits

| Resource | Limit |
|---|---|
| Active plugins — ACP context | 5 |
| Active plugins — Forum context | 10 |
| Saved themes (Theme Builder) | 10 |
| Configured ACP widgets | 10 |
| Audit log entries | 500 (last 7 days highlighted) |
| Network fetch timeout | 10 seconds |
| Update check interval | Every 1 hour |

---

## Contributing

Pull requests are welcome. Please target the `beta` branch for all new features and fixes.

```bash
git clone -b beta https://github.com/ForumotionExt/forumotion-extension.git
cd forumotion-extension
```

1. Create a new branch from `beta`
2. Make your changes
3. Open a Pull Request targeting `beta`

To report a bug or request a feature, open an [Issue on GitHub](https://github.com/ForumotionExt/forumotion-extension/issues).

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for full details.

---

<p align="center">
  Built for the Forumotion community &nbsp;·&nbsp;
  <a href="https://github.com/ForumotionExt/forumotion-extension">GitHub</a> &nbsp;·&nbsp;
  <a href="https://github.com/ForumotionExt/forumotion-extension/issues">Report an Issue</a>
</p>
