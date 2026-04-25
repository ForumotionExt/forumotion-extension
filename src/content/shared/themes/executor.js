/**
 * ThemeExecutor
 * Injectează / revocă CSS-ul unei teme în paginile Forumotion.
 * Folosește chrome.scripting (MV3) — nu are nevoie de bridge.
 */
export class ThemeExecutor {
  static PREFIX       = 'fme-theme-';
  static CSS_CACHE_KEY = 'fme_active_css';

  // ── Public API ─────────────────────────────────────────────────────────────

  async apply(theme) {
    const css = this._buildCSS(theme);
    await chrome.storage.local.set({ [ThemeExecutor.CSS_CACHE_KEY]: { id: theme.id, css } });
    await this._inject(theme.id, css);
    return { success: true, id: theme.id };
  }

  async revert(themeId) {
    await chrome.storage.local.remove(ThemeExecutor.CSS_CACHE_KEY);
    await this._remove(ThemeExecutor.PREFIX + themeId);
    return { success: true, id: themeId };
  }

  async revertAll() {
    await chrome.storage.local.remove(ThemeExecutor.CSS_CACHE_KEY);
    const tabs = await this._activeTabs();
    for (const tab of tabs) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          document.querySelectorAll('[id^="fme-theme-"]').forEach(el => el.remove());
        }
      });
    }
    return { success: true };
  }

  // ── CSS builder ────────────────────────────────────────────────────────────

  _buildCSS(theme) {
    const parts = [];

    // 1. CSS Variables → :root block
    if (theme.variables && Object.keys(theme.variables).length) {
      const vars = Object.entries(theme.variables)
        .map(([k, v]) => `  ${k.startsWith('--') ? k : `--${k}`}: ${v};`)
        .join('\n');
      parts.push(`:root {\n${vars}\n}`);
    }

    // 2. Selector overrides
    if (theme.overrides) {
      for (const [sel, props] of Object.entries(theme.overrides)) {
        const body = Object.entries(props).map(([p, v]) => `  ${p}: ${v};`).join('\n');
        parts.push(`${sel} {\n${body}\n}`);
      }
    }

    // 3. Raw custom CSS (ultimul — prioritate maximă)
    if (theme.css?.trim()) parts.push(theme.css.trim());

    return parts.join('\n\n');
  }

  async applyToTab(tabId, theme) {
    const css     = this._buildCSS(theme);
    const styleId = ThemeExecutor.PREFIX + theme.id;

    await chrome.scripting.executeScript({
      target: { tabId },
      func: (id, cssText) => {
        let el = document.getElementById(id);
        if (!el) {
          el = document.createElement('style');
          el.id = id;
          el.setAttribute('data-fme', 'theme');
          document.head.appendChild(el);
        }
        el.textContent = cssText;
      },
      args: [styleId, css],
    });

    return { success: true, id: theme.id };
  }

  // ── Injection helpers ──────────────────────────────────────────────────────

  async _inject(themeId, css) {
    const styleId = ThemeExecutor.PREFIX + themeId;
    const tabs    = await this._activeTabs();

    for (const tab of tabs) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (id, cssText) => {
          let el = document.getElementById(id);
          if (!el) {
            el = document.createElement('style');
            el.id = id;
            el.setAttribute('data-fme', 'theme');
            document.head.appendChild(el);
          }
          el.textContent = cssText;
        },
        args: [styleId, css]
      });
    }
  }

  async _remove(styleId) {
    const tabs = await this._activeTabs();
    for (const tab of tabs) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (id) => document.getElementById(id)?.remove(),
        args: [styleId]
      });
    }
  }

  async _activeTabs() {
    return chrome.tabs.query({ active: true, currentWindow: true });
  }
}