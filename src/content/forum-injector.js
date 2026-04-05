/**
 * FME Forum Injector
 * Runs on non-admin Forumotion forum pages.
 * Applies forum custom CSS and executes enabled JS widgets targeting 'forum' or 'both'.
 *
 * This script is injected via a separate content_scripts entry in manifest.json
 * that excludes /admin* and /adminhd* paths.
 */

(function () {
  'use strict';

  // Double-injection guard
  if (window.__fmeForumInjected) return;
  window.__fmeForumInjected = true;

  const FORUM_CSS_KEY = 'fme_forum_custom_css';
  const WIDGETS_KEY   = 'fme_widgets';
  const STYLE_ID      = 'fme-forum-custom-style';

  // ─── Apply forum CSS ────────────────────────────────────────────────────────

  function applyForumCSS(css) {
    if (!css || !css.trim()) return;

    let tag = document.getElementById(STYLE_ID);
    if (!tag) {
      tag = document.createElement('style');
      tag.id = STYLE_ID;
    }
    tag.textContent = css;
    // Append last to win the cascade
    document.head.appendChild(tag);
  }

  // ─── Run forum widgets ──────────────────────────────────────────────────────

  /**
   * Sends widget code to the service worker for execution via chrome.scripting,
   * which bypasses both the extension's MV3 CSP and the page's own CSP.
   */
  function execWidget(code, name) {
    chrome.runtime.sendMessage({ type: 'EXEC_WIDGET', payload: { code, name } });
  }

  function runForumWidgets(widgets) {
    if (!Array.isArray(widgets)) return;
    widgets
      .filter(w => w.enabled && (w.target === 'forum' || w.target === 'both'))
      .forEach(w => execWidget(w.code, w.name || w.id));
  }

  // ─── Style guard ────────────────────────────────────────────────────────────
  // Re-appends our style tag if the page injects new stylesheets after us.

  let _guardCss    = '';
  let _guardActive = false;

  function startStyleGuard() {
    if (_guardActive || !_guardCss) return;
    _guardActive = true;

    const obs = new MutationObserver(() => {
      const tag = document.getElementById(STYLE_ID);
      if (!tag || !document.head.contains(tag)) {
        applyForumCSS(_guardCss);
      } else if (tag !== document.head.lastElementChild) {
        document.head.appendChild(tag);
      }
    });

    obs.observe(document.head, { childList: true });
  }

  // ─── Bootstrap ──────────────────────────────────────────────────────────────

  chrome.storage.local.get({ [FORUM_CSS_KEY]: '', [WIDGETS_KEY]: [] }, result => {
    const css     = result[FORUM_CSS_KEY] || '';
    const widgets = result[WIDGETS_KEY]   || [];

    if (css) {
      _guardCss = css;
      applyForumCSS(css);
      startStyleGuard();
    }

    runForumWidgets(widgets);
  });
})();
