/**
 * FME Dashboard Script
 * Standalone page — no content script needed.
 */

(function () {
  'use strict';

  const manifest = chrome.runtime.getManifest();
  const VERSION  = manifest.version;

  // ── Version display ───────────────────────────────────────────────────────
  document.getElementById('hdr-version').textContent = 'v' + VERSION;
  document.getElementById('stat-version').textContent = VERSION;

  // ── Forum URL ─────────────────────────────────────────────────────────────
  const forumUrlInput  = document.getElementById('fme-forum-url');
  const forumStatusEl  = document.getElementById('fme-forum-status');
  const adminLinkEl    = document.getElementById('fme-admin-link');
  const adminLinkDesc  = document.getElementById('fme-admin-link-desc');
  const openAdminBtn   = document.getElementById('fme-open-admin-btn');

  chrome.storage.sync.get({ fmeForumUrl: '' }, ({ fmeForumUrl }) => {
    if (fmeForumUrl) {
      forumUrlInput.value = fmeForumUrl;
      applyForumUrl(fmeForumUrl);
    }
  });

  document.getElementById('fme-save-forum-btn').addEventListener('click', () => {
    const url = forumUrlInput.value.trim().replace(/\/$/, '');
    if (!url) { forumStatusEl.textContent = 'Introdu un URL valid.'; return; }
    chrome.storage.sync.set({ fmeForumUrl: url }, () => {
      forumStatusEl.textContent = 'Salvat!';
      applyForumUrl(url);
      setTimeout(() => { forumStatusEl.textContent = ''; }, 2500);
    });
  });

  function applyForumUrl(url) {
    const adminUrl = url + '/admin/';
    adminLinkEl.href = adminUrl;
    adminLinkEl.style.display = 'flex';
    adminLinkDesc.textContent = adminUrl;
    openAdminBtn.style.display = 'inline-flex';
    openAdminBtn.onclick = () => chrome.tabs.create({ url: adminUrl });
  }

  // ── Installed themes ──────────────────────────────────────────────────────
  const themesList      = document.getElementById('fme-themes-list');
  const uninstallAllBtn = document.getElementById('fme-uninstall-all-btn');
  const statThemes      = document.getElementById('stat-themes');

  function loadInstalledThemes() {
    chrome.storage.local.get({ fme_installed_themes: {} }, ({ fme_installed_themes }) => {
      const themes = Object.values(fme_installed_themes);
      statThemes.textContent = themes.length;

      if (themes.length === 0) {
        themesList.innerHTML = '<div class="fme-empty">Nu sunt teme instalate.</div>';
        uninstallAllBtn.style.display = 'none';
        return;
      }

      uninstallAllBtn.style.display = 'inline-flex';
      themesList.innerHTML = themes.map(t => `
        <div class="fme-theme-row" data-theme-id="${escHtml(t.id)}">
          <div>
            <div class="fme-theme-row-name">${escHtml(t.name || t.id)}</div>
            <div class="fme-theme-row-meta">
              Instalata: ${new Date(t.installedAt).toLocaleDateString('ro-RO')}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="fme-badge fme-badge-version">v${escHtml(t.version || '?')}</span>
            <span class="fme-badge fme-badge-ok">Activa</span>
            <button class="fme-btn fme-btn-danger fme-uninstall-one" data-id="${escHtml(t.id)}"
              style="padding:3px 10px;font-size:11px;">Dezinstaleaza</button>
          </div>
        </div>
      `).join('');

      themesList.querySelectorAll('.fme-uninstall-one').forEach(btn => {
        btn.addEventListener('click', () => uninstallTheme(btn.dataset.id));
      });
    });
  }

  function uninstallTheme(id) {
    chrome.storage.local.get({ fme_installed_themes: {} }, ({ fme_installed_themes }) => {
      delete fme_installed_themes[id];
      chrome.storage.local.set({ fme_installed_themes }, loadInstalledThemes);
    });
  }

  uninstallAllBtn.addEventListener('click', () => {
    if (!confirm('Esti sigur ca vrei sa dezinstalezi toate temele?')) return;
    chrome.storage.local.set({ fme_installed_themes: {} }, loadInstalledThemes);
  });

  loadInstalledThemes();

  // ── Update check ─────────────────────────────────────────────────────────
  chrome.action.getBadgeText({}, (text) => {
    if (text && text.trim()) {
      const banner = document.getElementById('fme-update-banner');
      banner.classList.add('visible');
      document.getElementById('fme-update-msg').textContent =
        'O noua versiune a extensiei este disponibila pe GitHub.';
      document.getElementById('fme-update-link').href =
        'https://github.com/ForumotionExt/forumotion-extension/releases/latest';
    }
  });

  // ── Changelog ─────────────────────────────────────────────────────────────
  const changelogArea = document.getElementById('fme-changelog-area');

  chrome.storage.sync.get({
    githubOwner: 'ForumotionExt',
    githubRepo: 'forumotion-extension',
    githubToken: ''
  }, ({ githubOwner, githubRepo, githubToken }) => {
    const url = `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/main/version.json`;
    const headers = { 'Accept': 'application/json' };
    if (githubToken) headers['Authorization'] = `Bearer ${githubToken}`;

    fetch(url, { headers })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const entry = (data.changelog || []).find(c => c.version === VERSION)
          || (data.changelog || [])[0];
        if (!entry) { changelogArea.innerHTML = '<div class="fme-empty">Nicio intrare gasita.</div>'; return; }
        changelogArea.innerHTML = `
          <p style="font-size:11px;color:var(--text-dim);margin-bottom:8px;">
            v${escHtml(entry.version)} &mdash; ${escHtml(entry.date || '')}
          </p>
          <ul class="fme-changelog">
            ${(entry.notes || []).map(n => `<li>${escHtml(n)}</li>`).join('')}
          </ul>
        `;
      })
      .catch(() => {
        changelogArea.innerHTML = '<div class="fme-empty">Nu s-a putut incarca changelog-ul.</div>';
      });
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();
