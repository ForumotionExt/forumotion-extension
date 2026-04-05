/**
 * FME Content Script Entry Point
 * Injects a native tab into the Forumotion ACP top navigation bar.
 * Handles routing, theme re-application, and popup message forwarding.
 */

(function () {
  'use strict';

  // Guard: only run on actual admin pages (URL check as defense in depth)
  const href = window.location.href;
  const isAdminPage =
    /\/admin(hd)?(\/|$|\?)/.test(href) &&
    (/forumgratuit\.ro|forumotion\.com|forumotion\.net|forumotion\.eu/.test(href));

  if (!isAdminPage) return;

  // Guard: prevent double-injection (e.g., from multiple content script runs)
  if (window.__fmeInitialized) return;
  window.__fmeInitialized = true;

  // Expose BEFORE init() is called so panel.js can use it during mount()
  window.__fmeBindNavClicks = bindNavClicks;

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    try {
      FMEPanel.mount();
      reapplyThemes();
      checkPendingPreviewRestore();
      runStartupChecks();
      listenForNavigation();
      listenForPopupMessages();
      if (typeof FMEAcpCssTab !== 'undefined') FMEAcpCssTab.autoApply();
      if (typeof FMEWidgetsTab !== 'undefined') FMEWidgetsTab.runAcpWidgets();
    } catch (err) {
      console.error('[FME] Failed to initialize:', err);
    }
  }

  // ─── Nav tab click delegation ──────────────────────────────────────────────

  /**
   * Called by panel.js once the FME nav <li> is in the DOM.
   * Sets up click listeners on all top-nav links so that:
   *  - clicking the FME tab shows the FME page
   *  - clicking any native tab hides the FME page
   */
  function bindNavClicks(fmeNavItem, topNavUl) {
    // FME tab click
    fmeNavItem.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      FMEPanel.show();
    });

    // Native tab clicks — hide FME page when user navigates away
    topNavUl.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;
      // Only act if the click is NOT inside the FME tab
      if (fmeNavItem.contains(link)) return;
      FMEPanel.hide();
    });
  }

  // ─── Routing (popstate / hashchange) ──────────────────────────────────────

  function listenForNavigation() {
    window.addEventListener('popstate', () => {
      FMEPanel.hide();
      if (typeof FMEAcpCssTab !== 'undefined') FMEAcpCssTab.autoApply();
    });
    window.addEventListener('hashchange', () => {
      FMEPanel.hide();
      if (typeof FMEAcpCssTab !== 'undefined') FMEAcpCssTab.autoApply();
    });
  }

  // ─── Theme re-application ──────────────────────────────────────────────────

  function reapplyThemes() {
    if (typeof FMEThemesTab !== 'undefined' && FMEThemesTab.reapplyInstalledThemes) {
      try {
        FMEThemesTab.reapplyInstalledThemes();
      } catch (err) {
        console.warn('[FME] Theme re-application failed:', err.message);
      }
    }
  }

  // ─── Popup message listener ────────────────────────────────────────────────

  function listenForPopupMessages() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || !message.type) return false;
      if (message.type === 'FME_OPEN_PANEL') {
        FMEPanel.mount(); // idempotent
        FMEPanel.show();
        sendResponse({ ok: true });
      }
      return false;
    });
  }

  // ─── Pending preview restore ───────────────────────────────────────────────

  async function checkPendingPreviewRestore() {
    try {
      const data = await new Promise(resolve =>
        chrome.storage.local.get({ fme_preview_active: null }, d =>
          resolve(d ? d.fme_preview_active : null)
        )
      );
      if (!data || !data.backups || !data.backups.length) return;

      const elapsed  = Date.now() - new Date(data.startedAt).getTime();
      const expired  = elapsed > 6 * 60 * 1000; // 6-min safety margin
      showRestorePrompt(data, expired);
    } catch (_) {}
  }

  function showRestorePrompt(data, autoRestore) {
    const banner = document.createElement('div');
    banner.id = 'fme-restore-prompt';
    banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483640',
      'background:#e74c3c', 'color:#fff', 'padding:10px 16px',
      'display:flex', 'align-items:center', 'gap:12px',
      'font-family:sans-serif', 'font-size:13px',
      'box-shadow:0 2px 8px rgba(0,0,0,0.2)',
    ].join(';');

    banner.innerHTML = `
      <strong>FME:</strong>
      <span>Preview "${escHtml(data.themeName || data.themeId)}" ${autoRestore ? 'a expirat' : 'este inca activ'}. Template-urile originale trebuie restaurate.</span>
      <input type="button" id="fme-restore-now-btn" value="Restaureaza Acum"
        style="margin-left:auto;background:#fff;color:#e74c3c;border:none;border-radius:4px;padding:5px 12px;cursor:pointer;font-weight:600;" />
      <input type="button" id="fme-restore-skip-btn" value="Ignora"
        style="background:transparent;color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.4);border-radius:4px;padding:5px 12px;cursor:pointer;" />
    `;
    document.body.prepend(banner);

    banner.querySelector('#fme-restore-now-btn').addEventListener('click', async () => {
      const btn = banner.querySelector('#fme-restore-now-btn');
      btn.value    = 'Se restaureaza...';
      btn.disabled = true;

      for (const backup of data.backups) {
        try {
          const params = new URLSearchParams();
          backup.hiddenFields.forEach(f => { if (f.name) params.append(f.name, f.value || ''); });
          params.append(backup.textareaName, backup.originalContent);
          if (backup.submitField?.name) params.append(backup.submitField.name, backup.submitField.value || '');
          await fetch(backup.formAction, {
            method:      'POST',
            headers:     { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:        params.toString(),
            credentials: 'include',
          });
        } catch (_) {}
      }

      chrome.storage.local.set({ fme_preview_active: null }, () => {
        banner.remove();
      });
    });

    banner.querySelector('#fme-restore-skip-btn').addEventListener('click', () => {
      chrome.storage.local.set({ fme_preview_active: null });
      banner.remove();
    });

    if (autoRestore) {
      // Auto-click restore after 3 seconds if expired
      setTimeout(() => banner.querySelector('#fme-restore-now-btn')?.click(), 3000);
    }
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── Startup checks ────────────────────────────────────────────────────────

  async function runStartupChecks() {
    try {
      const settings = await FMEGitHub.getSettings();
      if (settings.autoCheckUpdates) {
        await FMEGitHub.checkForUpdates();
      }
    } catch (err) {
      // Startup check failure is non-fatal
      console.warn('[FME] Startup update check failed:', err.message);
    }
  }
})();
