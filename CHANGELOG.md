# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)  
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.4.2] - 2026-04-06
[Release](https://github.com/ForumotionExt/forumotion-extension/releases/tag/v1.4.2)

### Added
- **ACP Styles**
  - Custom JavaScript support in ACP
  - Dedicated editor for script management
  - `.js` file upload support
  - Automatic execution with session persistence

- **SEO Tools (Extended)**
  - Custom URL scanning
  - Social preview
  - Keyword insights
  - Export and copy options for reporting

- **Templates**
  - Bulk Search & Replace across all categories
  - Contextual preview before applying changes
  - Batch replace on selected items

- **Backup & Statistics**
  - Support for custom ACP JavaScript in export/import
  - Included in extension summary

### Fixed
- Custom ACP CSS/JS is now properly auto-saved and persists between sessions
- Improved ACP UI integration:
  - Tabs
  - Modals
  - SEO blocks
  - Quote / explain sections
  - Support cards

---

## [1.4.1] - 2026-04-06

### Added
- **Dashboard Home**
  - Quick Stats
  - Download/update links
  - Roadmap section

- **Widgets JS**
  - Publish/unpublish directly on forum
  - Dedicated entry per widget
  - Enable/disable toggle

- **Quick Stats**
  - Installed/published widgets counter
  - Available themes counter
  - Current FME version display

### Changed
- Updated roadmap:
  - Plugins system
  - Auto-hashtags for themes
  - Template auto-validation
  - ACP dark mode fixes

### Fixed
- “Available themes” counter now reads from the real GitHub catalog (with fallback)
- Improved Roadmap/Changelog layout for better badge display
- Activity Log protected against “Extension context invalidated” errors

---

## [1.4.0] - 2026-04-06

### Added
- **SEO Tools Tab**
  - Full SEO analysis (28 checks)
  - Meta tags inventory
  - Link analysis
  - Recommendations

- **Plugins Tab**
  - JS plugin manager from GitHub catalog
  - Install/uninstall support

- **Activity Log Tab**
  - Filtering
  - CSV export
  - Selective deletion

- **Chatbox Tab**
  - Chatbox admin panel inside FME

- **Forum Chatbox**
  - Auto-rejoin
  - Login button
  - `/clear` command
  - Character counter
  - Sound notifications
  - Commands panel

- Theme installation:
  - Step-by-step modal (CSS, templates, JS plugins)

- Theme uninstall:
  - Automatic template reset before removal

- JS Plugin install:
  - Auto download & save via `saveJsPlugin()`

- Quick Stats dashboard
- Widget publishing system
- CSS Snippet Catalog
- Template Marker System
- Redesigned Home panel

### Fixed
- Rewritten `findTemplateEditUrl` (correct Forumotion URLs)
- Fixed template install using incorrect path reference
- Fixed install button label (“Install CSS” → “Install Theme”)

---

## [1.3.0] - 2026-04-05

### Added
- **Forum CSS Tab**
  - CSS editor for forum pages (non-admin)
  - “Forum Dark 2026” preset
  - File upload support

- **Widgets JS Tab**
  - JS snippet manager
  - CSP-safe execution via `chrome.scripting`

- **Notes Tab**
  - Multi-tab notepad
  - Auto-save after 1.5s
  - Up to 5 notes

- **Backup & Restore**
  - Full data export/import (JSON)

- **Statistics**
  - Local data summary + forum stats on demand

- Forum Injector script
- Redesigned panel (10 sections, 4 categories)
- Version compatibility check before install/preview
- Template preview progress modal
- `?tt=1` parameter for template preview
- Widget examples (11 ready-to-use snippets)

### Fixed
- Replaced `chrome.storage.session` with `chrome.storage.local`
- Replaced `chrome.tabs.create` with `window.open`
- Widget execution now properly bypasses CSP restrictions

---

## [1.2.0] - 2026-04-05

### Added
- Theme install modal (3-step guided process with CSS variables)
- `installTemplates` API
- `previewWithTemplates` API
- `restoreFromPreview` API
- Preview banner on forum
- Full changelog section in dashboard

### Changed
- Added roadmap section in dashboard

---

## [1.1.0] - 2026-04-05

### Added
- Forum preview in new tab (15 seconds)
- Redesigned themes page (ACP-style table)
- Dedicated theme install page (variables support)
- Standalone dashboard page

### Fixed
- Theme install & preview now work correctly
- “Reset to default” button in template editor fixed

### Changed
- Theme catalog moved to new GitHub repository

---

## [1.0.0] - 2026-03-01

### Added
- Native panel integrated into Forumotion ACP
- Themes tab (browse & install from GitHub)
- Templates tab (direct editing)
- Theme management (export/import/restore `.bbtheme`)
- Updates tab (version check)
- Settings tab (GitHub repo & PAT configuration)

### Changed
- Supported domains:
  - forumgratuit.ro
  - forumotion.com
  - forumotion.net
  - forumotion.eu

---

## Version Links

[1.4.2]: https://github.com/ForumotionExt/forumotion-extension/compare/v1.4.1...v1.4.2  
[1.4.1]: https://github.com/ForumotionExt/forumotion-extension/compare/v1.4.0...v1.4.1  
[1.4.0]: https://github.com/ForumotionExt/forumotion-extension/compare/v1.3.0...v1.4.0  
[1.3.0]: https://github.com/ForumotionExt/forumotion-extension/compare/v1.2.0...v1.3.0  
[1.2.0]: https://github.com/ForumotionExt/forumotion-extension/compare/v1.1.0...v1.2.0  
[1.1.0]: https://github.com/ForumotionExt/forumotion-extension/compare/v1.0.0...v1.1.0  
[1.0.0]: https://github.com/ForumotionExt/forumotion-extension/releases/tag/v1.0.0
