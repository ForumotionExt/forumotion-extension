(function () {
  'use strict';

  const KEYS = {
    THEMES     : 'fme_installed_themes',
    EXT_PLUGINS: 'fme_ext_plugins',
    ACP_PLUGINS: 'fme_acp_plugins',
    UPDATE_META: 'fme_update_meta',
    BACKUP_META: 'fme_backup_meta',
    NOTES      : 'fme_notes',
  };

  // ─── Tab navigation ─────────────────────────────────────────────────────────
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`)?.classList.add('active');
    });
  });

  // ─── Manifest / build info ──────────────────────────────────────────────────
  const manifest = chrome.runtime.getManifest();
  const build    = manifest.build ?? {};

  document.getElementById('ext-version').textContent  = `v${manifest.version}`;
  document.getElementById('info-version').textContent = manifest.version;
  document.getElementById('info-build').textContent   = build.display
    ? `${build.display} · ${build.date ?? ''}`
    : manifest.version;
  document.getElementById('info-env').textContent     = build.env ?? 'production';

  // ─── Storage data ────────────────────────────────────────────────────────────
  chrome.storage.local.get(Object.values(KEYS), (data) => {
    renderThemes(data[KEYS.THEMES] ?? {});
    renderExtPlugins(data[KEYS.EXT_PLUGINS] ?? { installed: [], active: [], error: [] });
    renderAcpPlugins(data[KEYS.ACP_PLUGINS] ?? { installed: [] });
    renderUpdateMeta(data[KEYS.UPDATE_META] ?? {});
    renderBackupMeta(data[KEYS.BACKUP_META] ?? {});
    renderNotes(data[KEYS.NOTES] ?? []);
    estimateStorage();
  });

  // ─── Themes ─────────────────────────────────────────────────────────────────
  function renderThemes(themes) {
    const entries = Object.entries(themes);
    document.getElementById('stat-themes').textContent  = entries.length;
    document.getElementById('themes-count').textContent = entries.length;

    const list = document.getElementById('themes-list');
    if (!entries.length) return;

    list.innerHTML = '';
    for (const [id, theme] of entries) {
      list.appendChild(makeListItem(
        'dot-active',
        theme.name ?? id,
        theme.author ?? theme.version ?? ''
      ));
    }
  }

  // ─── Extension plugins ───────────────────────────────────────────────────────
  function renderExtPlugins(data) {
    const installed = data.installed ?? [];
    const active    = new Set(data.active ?? []);
    const errors    = new Set(data.error  ?? []);

    document.getElementById('stat-plugins').textContent      = active.size;
    document.getElementById('ext-plugins-count').textContent = installed.length;

    const list = document.getElementById('ext-plugins-list');
    if (!installed.length) return;

    list.innerHTML = '';
    for (const plugin of installed) {
      const key      = plugin.id ?? plugin.name ?? '';
      const isError  = errors.has(key);
      const isActive = active.has(key);
      list.appendChild(makeListItem(
        isError ? 'dot-error' : isActive ? 'dot-active' : 'dot-inactive',
        plugin.name ?? plugin.id ?? 'Unknown',
        isError ? 'Error' : isActive ? 'Active' : 'Inactive'
      ));
    }
  }

  // ─── ACP plugins ─────────────────────────────────────────────────────────────
  function renderAcpPlugins(data) {
    const installed = data.installed ?? [];
    document.getElementById('acp-plugins-count').textContent = installed.length;

    const list = document.getElementById('acp-plugins-list');
    if (!installed.length) return;

    list.innerHTML = '';
    for (const plugin of installed) {
      list.appendChild(makeListItem(
        plugin.active !== false ? 'dot-active' : 'dot-inactive',
        plugin.name ?? plugin.id ?? 'Unknown',
        plugin.active !== false ? 'Active' : 'Inactive'
      ));
    }
  }

  // ─── Update meta ─────────────────────────────────────────────────────────────
  function renderUpdateMeta(data) {
    if (data.latest && data.latest !== manifest.version) {
      document.getElementById('update-badge').style.display = 'inline-block';
    }
    document.getElementById('info-update-check').textContent = data.checkedAt
      ? new Date(data.checkedAt).toLocaleDateString()
      : 'Never';
  }

  // ─── Backup meta ─────────────────────────────────────────────────────────────
  function renderBackupMeta(data) {
    document.getElementById('info-backup').textContent = data.lastExport
      ? new Date(data.lastExport).toLocaleDateString()
      : 'Never';
  }

  // ─── Notes count ─────────────────────────────────────────────────────────────
  function renderNotes(notes) {
    document.getElementById('stat-notes').textContent = Array.isArray(notes) ? notes.length : 0;
  }

  // ─── Storage estimate ────────────────────────────────────────────────────────
  function estimateStorage() {
    if (typeof chrome.storage.local.getBytesInUse === 'function') {
      chrome.storage.local.getBytesInUse(null, (bytes) => {
        const kb = (bytes / 1024).toFixed(1);
        document.getElementById('stat-storage').textContent = `${kb} KB`;
      });
    } else {
      // Safari / Firefox don't support getBytesInUse — estimate from raw data
      chrome.storage.local.get(null, (all) => {
        try {
          const kb = (new Blob([JSON.stringify(all)]).size / 1024).toFixed(1);
          document.getElementById('stat-storage').textContent = `~${kb} KB`;
        } catch {
          document.getElementById('stat-storage').textContent = '—';
        }
      });
    }
  }

  // ─── Changelog ───────────────────────────────────────────────────────────────
  fetch(chrome.runtime.getURL('version.json'))
    .then(r => r.json())
    .then(({ changelog = {} }) => {
      const list = document.getElementById('changelog-list');
      list.innerHTML = '';

      for (const [ver, entry] of Object.entries(changelog)) {
        const notes = (entry.notes ?? []).map(n => `<li>${esc(n)}</li>`).join('');
        const item  = document.createElement('div');
        item.className = 'changelog-item';
        item.innerHTML =
          `<div class="changelog-version">${esc(ver)}` +
          (entry.date ? `<span class="changelog-date">${esc(entry.date)}</span>` : '') +
          `</div><ul class="changelog-notes">${notes}</ul>`;
        list.appendChild(item);
      }

      if (!list.children.length) list.innerHTML = '<div class="empty-state">No changelog available</div>';
    })
    .catch(() => {
      document.getElementById('changelog-list').innerHTML =
        '<div class="empty-state">Could not load changelog</div>';
    });

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function makeListItem(dotClass, name, meta) {
    const el = document.createElement('div');
    el.className = 'list-item';
    el.innerHTML =
      `<span class="status-dot ${dotClass}"></span>` +
      `<span class="list-item-name">${esc(name)}</span>` +
      (meta ? `<span class="list-item-meta">${esc(meta)}</span>` : '');
    return el;
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }
})();
