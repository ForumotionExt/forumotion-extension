/**
 * FME Activity Log Tab
 * Automatic journal of all FME actions (theme installs, CSS saves, widget changes, etc.)
 * Stored in chrome.storage.local. Max 200 entries, oldest trimmed first.
 */

var FMEActivityLog = (() => {
  'use strict';

  const STORAGE_KEY = 'fme_activity_log';
  const MAX_ENTRIES = 200;
  const PAGE_SIZE   = 25;

  const TYPE_META = {
    'theme-install':   { icon: 'fa-paint-brush', color: '#27ae60', label: 'Temă instalată' },
    'theme-uninstall': { icon: 'fa-paint-brush', color: '#e74c3c', label: 'Temă dezinstalată' },
    'theme-preview':   { icon: 'fa-eye',         color: '#3498db', label: 'Preview temă' },
    'css-acp-save':    { icon: 'fa-magic',        color: '#8e44ad', label: 'ACP CSS salvat' },
    'css-forum-save':  { icon: 'fa-css3',         color: '#023531', label: 'Forum CSS salvat' },
    'widget-create':   { icon: 'fa-code',         color: '#39683b', label: 'Widget creat' },
    'widget-delete':   { icon: 'fa-code',         color: '#e74c3c', label: 'Widget șters' },
    'widget-toggle':   { icon: 'fa-code',         color: '#f39c12', label: 'Widget toggle' },
    'backup-export':   { icon: 'fa-database',     color: '#ff4242', label: 'Backup export' },
    'backup-import':   { icon: 'fa-database',     color: '#27ae60', label: 'Backup import' },
    'chatbox-save':    { icon: 'fa-comments',     color: '#27ae60', label: 'Chatbox config' },
    'template-edit':   { icon: 'fa-file-code-o',  color: '#3c9ebf', label: 'Template editat' },
    'settings-save':   { icon: 'fa-cog',          color: '#8e44ad', label: 'Setări salvate' },
    'note-save':       { icon: 'fa-sticky-note-o',color: '#3c9ebf', label: 'Notiță salvată' },
    'general':         { icon: 'fa-info-circle',  color: '#64748b', label: 'General' },
  };

  let _container = null;
  let _entries   = [];
  let _page      = 0;

  // ─── Public API ──────────────────────────────────────────────────────────────

  async function render(container) {
    _container = container;
    _page      = 0;
    container.innerHTML = '';

    _entries = await loadLog();

    const wrapper = document.createElement('div');
    wrapper.className = 'main-content';
    wrapper.id        = 'main-content';
    wrapper.style.fontSize = '12px';

    wrapper.innerHTML = `
      <div class="fme-section-header">
        <h2 class="fme-section-title">FME</h2>
        <ul class="h2-breadcrumb clearfix"><li class="first">Jurnal activitate</li></ul>
        <blockquote class="block_left">
          <p class="explain">
            Istoric automat al tuturor acțiunilor efectuate prin FME. Se păstrează ultimele ${MAX_ENTRIES} intrări.
          </p>
        </blockquote>
      </div>

      <fieldset style="margin:0 12px 12px 12px;">
        <legend><i class="fa fa-history"></i> Jurnal (${_entries.length} intrări)</legend>
        <div id="fme-log-table-area"></div>
        <div id="fme-log-pager" style="margin-top:8px;display:flex;gap:6px;align-items:center;"></div>
        <div class="div_btns" style="margin-top:10px;">
          <input type="button" id="fme-log-clear" value="Golește jurnalul" class="icon_cancel" />
        </div>
      </fieldset>
    `;

    container.appendChild(wrapper);
    renderPage(wrapper);

    wrapper.querySelector('#fme-log-clear').addEventListener('click', async () => {
      if (!confirm('Ștergi tot jurnalul de activitate?')) return;
      _entries = [];
      await saveLog([]);
      _page = 0;
      renderPage(wrapper);
    });
  }

  function renderPage(wrapper) {
    const area  = wrapper.querySelector('#fme-log-table-area');
    const pager = wrapper.querySelector('#fme-log-pager');

    if (_entries.length === 0) {
      area.innerHTML  = '<p class="gensmall" style="color:#888;">Nicio activitate înregistrată.</p>';
      pager.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(_entries.length / PAGE_SIZE);
    const start = _page * PAGE_SIZE;
    const slice = _entries.slice(start, start + PAGE_SIZE);

    let html = '<table class="table1 forumline" cellspacing="1">' +
      '<thead><tr>' +
        '<th class="thbg" style="width:150px;">Data / Ora</th>' +
        '<th class="thbg" style="width:140px;">Tip</th>' +
        '<th class="thbg">Detalii</th>' +
      '</tr></thead><tbody>';

    slice.forEach((entry, i) => {
      const meta = TYPE_META[entry.type] || TYPE_META.general;
      const rowClass = i % 2 === 0 ? 'row1' : 'row2';
      const dateStr = new Date(entry.ts).toLocaleString('ro-RO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      html += '<tr>' +
        '<td class="' + rowClass + '" style="white-space:nowrap;font-size:11px;">' + esc(dateStr) + '</td>' +
        '<td class="' + rowClass + '" style="text-align:center;">' +
          '<span style="display:inline-flex;align-items:center;gap:4px;background:' + meta.color +
            ';color:#fff;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:600;">' +
            '<i class="fa ' + meta.icon + '"></i> ' + esc(meta.label) + '</span>' +
        '</td>' +
        '<td class="' + rowClass + '"><span class="gen">' + esc(entry.detail || '—') + '</span></td>' +
      '</tr>';
    });

    html += '</tbody></table>';
    area.innerHTML = html;

    // Pager
    if (totalPages <= 1) { pager.innerHTML = ''; return; }
    let ph = '<span class="gensmall" style="color:#888;">Pagina:</span> ';
    for (let p = 0; p < totalPages; p++) {
      if (p === _page) {
        ph += '<strong style="padding:2px 6px;background:#3c9ebf;color:#fff;border-radius:3px;font-size:11px;">' + (p + 1) + '</strong> ';
      } else {
        ph += '<a href="#" class="fme-log-page-link" data-p="' + p + '" style="font-size:11px;padding:2px 6px;">' + (p + 1) + '</a> ';
      }
    }
    pager.innerHTML = ph;
    pager.querySelectorAll('.fme-log-page-link').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        _page = parseInt(a.dataset.p, 10);
        renderPage(wrapper);
      });
    });
  }

  // ─── Log API (called from other tabs) ──────────────────────────────────────

  async function log(type, detail) {
    const entries = await loadLog();
    entries.unshift({ ts: Date.now(), type: type || 'general', detail: detail || '' });
    while (entries.length > MAX_ENTRIES) entries.pop();
    await saveLog(entries);
  }

  // ─── Storage ──────────────────────────────────────────────────────────────────

  function loadLog() {
    return new Promise(resolve => {
      chrome.storage.local.get({ [STORAGE_KEY]: [] }, result => {
        resolve(Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : []);
      });
    });
  }

  function saveLog(entries) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [STORAGE_KEY]: entries }, resolve);
    });
  }

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { render, log };
})();
