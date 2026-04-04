# Forumotion Extension (FME)

  Chrome extension that injects a native tab into the Forumotion/ForumGratuit admin panel (ACP), adding theme
  management, template editing, and automatic update notifications.

  ## Features

  - **Teme** — Browse and install CSS themes from the
  [forumotion-themes](https://github.com/staark-dev/forumotion-themes) catalog
  - **Template-uri** — Edit native Forumotion templates directly from the ACP
  - **Administrare teme** — Export, import, and restore Forumotion themes (`.bbtheme`)
  - **Actualizări** — Automatic update check against this repository
  - **Setări** — Configure GitHub repositories and Personal Access Token

  ## Supported domains

  `*.forumgratuit.ro` · `*.forumotion.com` · `*.forumotion.net` · `*.forumotion.eu`

  ## Installation

  1. Download the latest release `.zip` from [Releases](https://github.com/ForumotionExt/forumotion-extension/releases)
  2. Extract the archive
  3. Open Chrome → `chrome://extensions` → enable **Developer mode**
  4. Click **Load unpacked** and select the extracted folder

  ## Repository structure

  | Repository | Purpose |
  |---|---|
  | `ForumotionExt/forumotion-extension` | Extension source + version.json |
  | `staark-dev/forumotion-themes` | Themes catalog (index.json + theme files) |

  ---
