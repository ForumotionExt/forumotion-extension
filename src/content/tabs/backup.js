/**
 * FME Backup & Restore Tab
 * Export all FME data (themes, CSS, widgets, notes, settings) to a JSON file.
 * Import from a previously exported JSON file (githubToken is excluded for security).
 */

var FMEBackupTab = (() => {
  'use strict';

  const LOCAL_KEYS = [
    'fme_installed_themes',
    'fme_acp_custom_css',
    'fme_forum_custom_css',
    'fme_widgets',
    'fme_notes',
  ];

  const SYNC_KEYS = [
    'autoCheckUpdates',
    'githubOwner', 'githubRepo',
    'themesOwner', 'themesRepo',
    'templatesOwner', 'templatesRepo',
    'updateNotificationFrequency',
    'skippedVersions',
    // githubToken intentionally excluded from export
  ];

  let _container = null;

  // ─── Public API ──────────────────────────────────────────────────────────────

  async function render(container) {
    _container = container;
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'fme-backup-wrapper main-content';
    wrapper.id = 'main-content';
    wrapper.style.fontSize = '12px';

    wrapper.innerHTML = `
      <div class="fme-section-header">
        <h2 class="fme-section-title">FME</h2>
        <ul class="h2-breadcrumb clearfix"><li class="first">Backup &amp; Restaurare</li></ul>
        <blockquote class="block_left">
          <p class="explain">Exportă sau importă toate datele extensiei: teme instalate, CSS personalizat, widget-uri, notițe și setări. Token-ul GitHub nu este inclus în export.</p>
        </blockquote>
      </div>

      <fieldset class="fieldset_left">
        <legend>Export backup</legend>
        <p style="font-size:11px;padding:4px 0 8px;">Descarcă un fișier <code>.json</code> cu toate datele extensiei. Poate fi reimportat pe orice browser/dispozitiv.</p>
        <div class="div_btns" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <input type="button" id="fme-backup-export" value="Exportă backup (.json)" class="icon_ok" />
          <span id="fme-export-status" style="font-size:11px;font-weight:600;"></span>
        </div>
      </fieldset>

      <fieldset style="margin-top:12px;">
        <legend>Import backup</legend>
        <p style="font-size:11px;padding:4px 0 8px;"><strong>Atenție:</strong> datele existente vor fi suprascrise de cele din fișier. Token-ul GitHub nu este restaurat.</p>
        <div class="div_btns" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <input type="button" id="fme-backup-import-btn"  value="Alege fișier .json" class="btn" />
          <input type="file"   id="fme-backup-import-file" accept=".json,application/json" style="display:none;" />
          <span id="fme-import-status" style="font-size:11px;font-weight:600;"></span>
        </div>
        <div id="fme-backup-preview" style="display:none;margin-top:10px;"></div>
      </fieldset>

      <fieldset style="margin-top:12px;">
        <legend>Date salvate curent</legend>
        <div id="fme-backup-summary">
          <div class="fme-loading"><div class="fme-spinner"></div><span>Se încarcă...</span></div>
        </div>
      </fieldset>
    `;

    container.appendChild(wrapper);
    bindEvents(wrapper);
    await loadSummary(wrapper);
  }

  // ─── Summary ──────────────────────────────────────────────────────────────────

  async function loadSummary(wrapper) {
    const summaryEl = wrapper.querySelector('#fme-backup-summary');

    const [local, sync] = await Promise.all([
      new Promise(r => chrome.storage.local.get(LOCAL_KEYS, r)),
      new Promise(r => chrome.storage.sync.get(SYNC_KEYS,  r)),
    ]);

    const rows = [
      {
        key:   'fme_installed_themes',
        label: 'Teme instalate',
        stor:  'local',
        value: `${Object.keys(local.fme_installed_themes || {}).length} teme`,
      },
      {
        key:   'fme_acp_custom_css',
        label: 'CSS ACP',
        stor:  'local',
        value: sizeStr(local.fme_acp_custom_css),
      },
      {
        key:   'fme_forum_custom_css',
        label: 'CSS Forum',
        stor:  'local',
        value: sizeStr(local.fme_forum_custom_css),
      },
      {
        key:   'fme_widgets',
        label: 'Widget-uri JS',
        stor:  'local',
        value: `${(local.fme_widgets || []).length} widget-uri (${(local.fme_widgets || []).filter(w => w.enabled).length} active)`,
      },
      {
        key:   'fme_notes',
        label: 'Notițe',
        stor:  'local',
        value: `${(local.fme_notes || []).filter(n => (n.content || '').trim()).length} notițe cu conținut`,
      },
      {
        key:   'settings',
        label: 'Setări',
        stor:  'sync',
        value: `${SYNC_KEYS.length} chei configurate`,
      },
    ];

    summaryEl.innerHTML = `
      <table class="fme-table" style="font-size:11px;">
        <thead><tr><th>Date</th><th>Stocare</th><th>Conținut</th></tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td><strong>${escHtml(r.label)}</strong></td>
              <td><span class="fme-badge ${r.stor === 'local' ? 'fme-badge-version' : 'fme-badge-installed'}">${escHtml(r.stor)}</span></td>
              <td>${escHtml(r.value)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // ─── Events ───────────────────────────────────────────────────────────────────

  function bindEvents(wrapper) {
    wrapper.querySelector('#fme-backup-export').addEventListener('click', () => doExport(wrapper));

    const importBtn  = wrapper.querySelector('#fme-backup-import-btn');
    const importFile = wrapper.querySelector('#fme-backup-import-file');

    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', () => {
      const file = importFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => previewImport(wrapper, ev.target.result, file.name);
      reader.readAsText(file, 'utf-8');
      importFile.value = '';
    });
  }

  // ─── Export ───────────────────────────────────────────────────────────────────

  async function doExport(wrapper) {
    const statusEl = wrapper.querySelector('#fme-export-status');
    statusEl.style.color = '#666';
    statusEl.textContent  = 'Se pregătește…';

    const [local, sync] = await Promise.all([
      new Promise(r => chrome.storage.local.get(LOCAL_KEYS, r)),
      new Promise(r => chrome.storage.sync.get(SYNC_KEYS,  r)),
    ]);

    const backup = {
      _fme_backup_version: 1,
      _exported_at:        new Date().toISOString(),
      _extension_version:  chrome.runtime.getManifest().version,
      local,
      sync,
    };

    const blob     = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url      = URL.createObjectURL(blob);
    const anchor   = document.createElement('a');
    anchor.href     = url;
    anchor.download = `fme-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);

    statusEl.style.color = '#27ae60';
    statusEl.textContent  = 'Descărcat ✓';
    setTimeout(() => { statusEl.textContent = ''; }, 3000);
  }

  // ─── Import preview ───────────────────────────────────────────────────────────

  function previewImport(wrapper, jsonText, fileName) {
    const previewEl = wrapper.querySelector('#fme-backup-preview');
    const statusEl  = wrapper.querySelector('#fme-import-status');

    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (_) {
      statusEl.style.color = '#c00';
      statusEl.textContent  = 'Fișier JSON invalid.';
      return;
    }

    if (!data._fme_backup_version || (!data.local && !data.sync)) {
      statusEl.style.color = '#c00';
      statusEl.textContent  = 'Nu este un backup FME valid.';
      return;
    }

    statusEl.textContent = '';

    const localKeys = Object.keys(data.local || {});
    const syncKeys  = Object.keys(data.sync  || {});

    previewEl.style.display = '';
    previewEl.innerHTML = `
      <div class="fme-alert fme-alert-warning" style="margin-bottom:8px;">
        <strong>Backup din:</strong> ${escHtml(data._exported_at ? new Date(data._exported_at).toLocaleString('ro-RO') : '—')}
        &mdash; extensia v${escHtml(data._extension_version || '—')}
        <br><em>Fișier: ${escHtml(fileName)}</em>
        <br><small>${localKeys.length} chei local, ${syncKeys.length} chei sync. Token-ul GitHub nu va fi restaurat.</small>
      </div>
      <div class="div_btns" style="display:flex;gap:6px;flex-wrap:wrap;">
        <input type="button" id="fme-backup-confirm" value="Confirmă importul" class="icon_ok" />
        <input type="button" id="fme-backup-cancel"  value="Anulează"          class="icon_cancel" style="margin-left:4px;" />
      </div>
    `;

    previewEl.querySelector('#fme-backup-confirm').addEventListener('click', () => doImport(wrapper, data, statusEl, previewEl));
    previewEl.querySelector('#fme-backup-cancel').addEventListener('click', () => {
      previewEl.style.display = 'none';
      statusEl.textContent = '';
    });
  }

  // ─── Do import ────────────────────────────────────────────────────────────────

  async function doImport(wrapper, data, statusEl, previewEl) {
    if (!confirm('Toate datele existente vor fi suprascrise cu cele din fișier. Continui?')) return;

    const safeSync = { ...(data.sync || {}) };
    delete safeSync.githubToken; // Never restore token from a file

    await Promise.all([
      new Promise(r => chrome.storage.local.set(data.local || {}, r)),
      new Promise(r => chrome.storage.sync.set(safeSync, r)),
    ]);

    previewEl.style.display = 'none';
    statusEl.style.color    = '#27ae60';
    statusEl.textContent    = 'Import reușit ✓';
    setTimeout(() => { statusEl.textContent = ''; }, 3000);
    await loadSummary(wrapper);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function sizeStr(str) {
    if (!str || !str.trim()) return '—';
    const lines = str.split('\n').length;
    const kb    = (new Blob([str]).size / 1024).toFixed(1);
    return `${lines} linii / ${kb} KB`;
  }

  function escHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { render };
})();
