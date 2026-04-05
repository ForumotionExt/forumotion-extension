/**
 * FME Popup Script
 * Shows status info and lets user open the panel on the current admin tab.
 */

(function () {
  'use strict';

  const manifest = chrome.runtime.getManifest();

  // ─── Set version ──────────────────────────────────────────────────────────────
  const versionEl = document.getElementById('ext-version');
  if (versionEl) versionEl.textContent = 'v' + manifest.version;

  // ─── Check current tab ────────────────────────────────────────────────────────
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) return;

    const isAdminPage = tab.url && isForumotionAdmin(tab.url);
    const statusSection = document.getElementById('status-section');
    const notAdminSection = document.getElementById('not-admin-section');
    const openPanelBtn = document.getElementById('open-panel-btn');

    if (isAdminPage) {
      statusSection.style.display = 'block';
      openPanelBtn.style.display = 'flex';
      loadInstalledThemeCount();
      checkUpdateBadge();
    } else {
      notAdminSection.style.display = 'block';
    }

    // Open panel button: sends a message to the content script
    openPanelBtn?.addEventListener('click', () => {
      chrome.tabs.sendMessage(tab.id, { type: 'FME_OPEN_PANEL' }, (response) => {
        if (chrome.runtime.lastError) {
          // Panel might not be injected yet; try scripting API
          console.warn('[FME Popup] Could not reach content script:', chrome.runtime.lastError.message);
        }
        window.close();
      });
    });
  });

  // ─── Installed themes count ───────────────────────────────────────────────────
  function loadInstalledThemeCount() {
    chrome.storage.local.get({ fme_installed_themes: {} }, (data) => {
      const count = Object.keys(data.fme_installed_themes).length;
      const el = document.getElementById('installed-count');
      const footerEl = document.getElementById('theme-count-footer');
      if (el) el.textContent = count > 0 ? `${count} theme${count > 1 ? 's' : ''} installed` : 'None installed';
      if (footerEl) footerEl.textContent = count > 0 ? `${count} theme${count > 1 ? 's' : ''} installed` : '';
    });
  }

  // ─── Update badge ─────────────────────────────────────────────────────────────
  function checkUpdateBadge() {
    chrome.action.getBadgeText({}, (text) => {
      if (text && text.trim()) {
        const updateRow = document.getElementById('update-row');
        if (updateRow) updateRow.style.display = 'flex';
      }
    });
  }

  // ─── Dashboard button ─────────────────────────────────────────────────────────
  document.getElementById('open-dashboard-btn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
    window.close();
  });

  // ─── URL check ────────────────────────────────────────────────────────────────
  function isForumotionAdmin(url) {
    return /\/admin(hd)?(\/|$|\?)/.test(url) &&
      /forumgratuit\.ro|forumotion\.com|forumotion\.net|forumotion\.eu/.test(url);
  }
})();
