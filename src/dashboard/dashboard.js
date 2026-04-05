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

  // ── Available themes count ────────────────────────────────────────────────
  const statAvailable = document.getElementById('stat-available-themes');
  chrome.storage.sync.get({
    themesOwner: 'ForumotionExt',
    themesRepo: 'forumotion-themes',
    githubToken: ''
  }, ({ themesOwner, themesRepo, githubToken }) => {
    const url = `https://raw.githubusercontent.com/${themesOwner}/${themesRepo}/main/index.json`;
    const headers = { 'Accept': 'application/json' };
    if (githubToken) headers['Authorization'] = `Bearer ${githubToken}`;
    fetch(url, { cache: 'no-store', headers })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const count = Array.isArray(data.themes) ? data.themes.length : '?';
        if (statAvailable) statAvailable.textContent = count;
      })
      .catch(() => { if (statAvailable) statAvailable.textContent = '—'; });
  });

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

  // ── Changelog & Futures ───────────────────────────────────────────────────
  const changelogArea = document.getElementById('fme-changelog-area');
  const futuresArea   = document.getElementById('fme-futures-area');

  fetch(chrome.runtime.getURL('version.json'), { cache: 'no-store' })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
    .then(data => {
        // ── Changelog (all versions) ──────────────────────────────────────
        const entries = data.changelog || [];
        if (entries.length === 0) {
          changelogArea.innerHTML = '<div class="fme-empty">Nicio intrare gasita.</div>';
        } else {
          changelogArea.innerHTML = entries.map(entry => {
            const isCurrent = entry.version === VERSION;
            const notes    = (entry.notes || []).map(n => typeof n === 'string'
              ? { type: detectType(n), text: n }
              : { type: ['feature','bugfix','other'].includes(n.type) ? n.type : 'other', text: n.text || '' });
            const features = notes.filter(n => n.type === 'feature');
            const bugfixes = notes.filter(n => n.type === 'bugfix');
            const others   = notes.filter(n => n.type === 'other');
            const renderGroup = (items, cls, icon, label) => !items.length ? '' :
              `<div class="fme-changelog-group">
                <span class="fme-type-badge ${cls}">${icon} ${label}</span>
                <ul class="fme-changelog-list">${items.map(n => `<li>${escHtml(n.text)}</li>`).join('')}</ul>
              </div>`;
            return `
              <div class="fme-changelog-entry">
                <div class="fme-changelog-entry-header${isCurrent ? ' is-current' : ''}">
                  <span class="fme-changelog-version">v${escHtml(entry.version)}</span>
                  ${entry.date ? `<span class="fme-changelog-date">${escHtml(entry.date)}</span>` : ''}
                  ${isCurrent ? '<span class="fme-badge fme-badge-current">instalata</span>' : ''}
                </div>
                <div class="fme-changelog-body">
                  ${renderGroup(features, 'fme-type-feature', '✨', 'Features')}
                  ${renderGroup(bugfixes, 'fme-type-bugfix',  '🐛', 'Bugfixes')}
                  ${renderGroup(others,   'fme-type-other',   '📝', 'Other')}
                </div>
              </div>`;
          }).join('');
        }

        // ── Futures (roadmap) ─────────────────────────────────────────────
        const futures = data.futures || [];
        if (futures.length === 0) {
          futuresArea.innerHTML = '<div class="fme-empty">Nicio functionalitate viitoare listata.</div>';
        } else {
          futuresArea.innerHTML = `<div class="fme-futures">${
            futures.map(f => `
              <div class="fme-future-item">
                <span class="fme-future-icon">🚀</span>
                <div>
                  <div class="fme-future-title">${escHtml(f.title)}</div>
                  <div class="fme-future-desc">${escHtml(f.description)}</div>
                </div>
              </div>
            `).join('')
          }</div>`;
        }
      })
      .catch((err) => {
        changelogArea.innerHTML = '<div class="fme-empty">Nu s-a putut incarca changelog-ul: ' + (err && err.message ? err.message : err) + '</div>';
        futuresArea.innerHTML   = '<div class="fme-empty">Nu s-au putut incarca functionalitatile viitoare.</div>';
      });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function detectType(text) {
    if (/^(fix|bug|🐛|fixed)/i.test(text)) return 'bugfix';
    if (/^(add|new|feature|✨|🆕|added)/i.test(text)) return 'feature';
    return 'other';
  }

})();
