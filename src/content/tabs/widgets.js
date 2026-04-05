/**
 * FME Widgets JS Tab
 * Manage named JavaScript snippets that run automatically on ACP and/or forum pages.
 *
 * Widget structure:
 *   { id, name, description, target, enabled, code, createdAt }
 *   target: 'acp' | 'forum' | 'both'
 *
 * ACP widgets are executed by content.js (via FMEWidgetsTab.runAcpWidgets).
 * Forum widgets are executed by forum-injector.js.
 */

var FMEWidgetsTab = (() => {
  'use strict';

  const STORAGE_KEY = 'fme_widgets';

  const TARGET_LABELS = {
    acp:   { text: 'ACP',         badge: 'fme-badge-version'   },
    forum: { text: 'Forum',       badge: 'fme-badge-installed' },
    both:  { text: 'ACP + Forum', badge: 'fme-badge-update'    },
  };

  let _container = null;
  let _widgets   = [];
  let _editIdx   = null;  // null = new widget; number = editing existing index

  // ─── Public API ──────────────────────────────────────────────────────────────

  async function render(container) {
    _container = container;
    container.innerHTML = '';
    _editIdx = null;

    const wrapper = document.createElement('div');
    wrapper.className = 'fme-widgets-wrapper main-content';
    wrapper.id = 'main-content';
    wrapper.style.fontSize = '12px';

    wrapper.innerHTML = `
      <div class="fme-section-header">
        <h2 class="fme-section-title">FME</h2>
        <ul class="h2-breadcrumb clearfix"><li class="first">Widgets JS</li></ul>
        <blockquote class="block_left">
          <p class="explain">Script-uri JavaScript personalizate rulând automat pe paginile ACP și/sau forum. Fiecare widget poate fi activat/dezactivat individual.</p>
        </blockquote>
      </div>
      <div id="fme-widgets-area"></div>
    `;

    container.appendChild(wrapper);
    await loadWidgets();
    renderList(wrapper);
  }

  /**
   * Called from content.js on every ACP page load.
   * Runs all enabled widgets targeting 'acp' or 'both'.
   */
  /**
   * Sends widget code to the service worker for execution via chrome.scripting,
   * which bypasses both the extension's MV3 CSP and the page's own CSP.
   */
  function execWidget(code, name) {
    chrome.runtime.sendMessage({ type: 'EXEC_WIDGET', payload: { code, name } });
  }

  function runAcpWidgets() {
    chrome.storage.local.get({ [STORAGE_KEY]: [] }, result => {
      const widgets = result[STORAGE_KEY] || [];
      widgets
        .filter(w => w.enabled && (w.target === 'acp' || w.target === 'both'))
        .forEach(w => execWidget(w.code, w.name));
    });
  }

  // ─── Load ─────────────────────────────────────────────────────────────────────

  async function loadWidgets() {
    return new Promise(resolve => {
      chrome.storage.local.get({ [STORAGE_KEY]: [] }, result => {
        _widgets = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
        resolve();
      });
    });
  }

  // ─── List view ────────────────────────────────────────────────────────────────

  function renderList(wrapper) {
    const area = wrapper.querySelector('#fme-widgets-area');
    if (!area) return;

    const activeCount = _widgets.filter(w => w.enabled).length;

    const rowsHtml = _widgets.length
      ? `<table class="fme-table">
          <thead>
            <tr>
              <th style="width:24px;">On</th>
              <th>Nume</th>
              <th>Descriere</th>
              <th>Target</th>
              <th style="width:180px;">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            ${_widgets.map((w, i) => {
              const tm = TARGET_LABELS[w.target] || TARGET_LABELS.acp;
              return `
                <tr data-widget-idx="${i}">
                  <td style="text-align:center;">
                    <input type="checkbox" class="fme-widget-toggle" data-idx="${i}" ${w.enabled ? 'checked' : ''} />
                  </td>
                  <td><strong>${escHtml(w.name)}</strong></td>
                  <td style="color:#666;">${escHtml(w.description || '—')}</td>
                  <td><span class="fme-badge ${tm.badge}">${tm.text}</span></td>
                  <td>
                    <input type="button" class="fme-widget-edit"   data-idx="${i}" value="Editează" />
                    <input type="button" class="fme-widget-delete" data-idx="${i}" value="Șterge" style="margin-left:4px;" />
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>`
      : `<div class="fme-empty" style="padding:20px;text-align:center;color:#999;">Nu există widget-uri. Apasă „Adaugă widget" pentru a crea primul.</div>`;

    area.innerHTML = `
      <div class="panel-menu" style="margin:0!important;background:#fff!important;border:1px solid #cdcdcd!important;padding:0 0 10px 0!important;">
        <br/>
        <fieldset style="margin:0 12px 12px 12px;">
          <legend>Widget-uri active (${activeCount} / ${_widgets.length})</legend>
          ${rowsHtml}
          <div class="div_btns" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
            <input type="button" id="fme-widget-add" value="+ Adaugă widget" class="icon_ok" />
          </div>
        </fieldset>
      </div>
      <div id="fme-widget-editor-area" style="margin-top:10px;"></div>
    `;

    // Toggle enable/disable
    area.querySelectorAll('.fme-widget-toggle').forEach(cb => {
      cb.addEventListener('change', () => {
        const idx = +cb.dataset.idx;
        _widgets[idx].enabled = cb.checked;
        saveWidgets(() => renderList(wrapper));
      });
    });

    area.querySelectorAll('.fme-widget-edit').forEach(btn => {
      btn.addEventListener('click', () => openEditor(wrapper, +btn.dataset.idx));
    });

    area.querySelectorAll('.fme-widget-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteWidget(wrapper, +btn.dataset.idx));
    });

    area.querySelector('#fme-widget-add').addEventListener('click', () => openEditor(wrapper, null));
  }

  // ─── Editor ───────────────────────────────────────────────────────────────────

  function openEditor(wrapper, idx) {
    _editIdx = idx;
    const isNew = idx === null;
    const w = isNew
      ? { name: '', description: '', target: 'acp', enabled: true, code: '// Codul tău JS aici\n' }
      : { ..._widgets[idx] };

    const editorArea = wrapper.querySelector('#fme-widget-editor-area');
    if (!editorArea) return;

    editorArea.innerHTML = `
      <fieldset style="background:#f9f9ff;border-color:#9b8fcc;">
        <legend>${isNew ? 'Widget nou' : `Editează: ${escHtml(w.name)}`}</legend>
        <dl>
          <dt><label for="fme-widget-name">Nume *:</label></dt>
          <dd><input type="text" id="fme-widget-name" value="${escHtml(w.name)}" style="width:60%;" maxlength="80" placeholder="Ex: Auto-expand textarea" /></dd>
        </dl>
        <dl>
          <dt><label for="fme-widget-desc">Descriere:</label></dt>
          <dd><input type="text" id="fme-widget-desc" value="${escHtml(w.description || '')}" style="width:80%;" maxlength="200" placeholder="Scurtă descriere opțională" /></dd>
        </dl>
        <dl>
          <dt><label for="fme-widget-target">Se execută pe:</label></dt>
          <dd>
            <select id="fme-widget-target">
              <option value="acp"   ${w.target === 'acp'   ? 'selected' : ''}>ACP (Panou de administrare)</option>
              <option value="forum" ${w.target === 'forum' ? 'selected' : ''}>Forum (pagini publice)</option>
              <option value="both"  ${w.target === 'both'  ? 'selected' : ''}>ACP + Forum (ambele)</option>
            </select>
          </dd>
        </dl>
        <dl>
          <dt><label for="fme-widget-enabled">Activat:</label></dt>
          <dd><input type="checkbox" id="fme-widget-enabled" ${w.enabled ? 'checked' : ''} /></dd>
        </dl>
        <dl>
          <dt><label for="fme-widget-code">Cod JavaScript *:</label></dt>
          <dd>
            <textarea id="fme-widget-code"
              style="width:100%;height:260px;font-family:Consolas,'Cascadia Code',monospace;font-size:12px;line-height:1.6;padding:10px;border:1px solid #9b8fcc;border-radius:4px;resize:vertical;background:#0f1117;color:#e2e8f0;tab-size:2;"
              placeholder="// Codul rulează la fiecare încărcare de pagină (în contextul content script)&#10;// document, window, și fetch sunt disponibile&#10;document.title = '★ ' + document.title;"
            >${escHtml(w.code)}</textarea>
            <small style="color:#888;">Rulează la fiecare încărcare a paginii vizate. Poți folosi <code>document</code>, <code>window</code>, <code>fetch</code>.</small>
          </dd>
        </dl>
        <div class="div_btns" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <input type="button" id="fme-widget-save"   value="Salvează widget" class="icon_ok" />
          <input type="button" id="fme-widget-cancel" value="Anulează"        class="icon_cancel" style="margin-left:4px;" />
          <span id="fme-widget-editor-status" style="font-size:11px;font-weight:600;"></span>
        </div>
      </fieldset>
    `;

    // Tab key in code editor
    const codeArea = editorArea.querySelector('#fme-widget-code');
    codeArea.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = codeArea.selectionStart, en = codeArea.selectionEnd;
        codeArea.value = codeArea.value.substring(0, s) + '  ' + codeArea.value.substring(en);
        codeArea.selectionStart = codeArea.selectionEnd = s + 2;
      }
    });

    editorArea.querySelector('#fme-widget-save').addEventListener('click', () => saveEditorWidget(wrapper, w.id));
    editorArea.querySelector('#fme-widget-cancel').addEventListener('click', () => {
      editorArea.innerHTML = '';
      _editIdx = null;
    });

    // Scroll to editor
    editorArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function saveEditorWidget(wrapper, existingId) {
    const editorArea = wrapper.querySelector('#fme-widget-editor-area');
    const statusEl   = editorArea.querySelector('#fme-widget-editor-status');

    const name    = editorArea.querySelector('#fme-widget-name').value.trim();
    const desc    = editorArea.querySelector('#fme-widget-desc').value.trim();
    const target  = editorArea.querySelector('#fme-widget-target').value;
    const enabled = editorArea.querySelector('#fme-widget-enabled').checked;
    const code    = editorArea.querySelector('#fme-widget-code').value;

    if (!name) {
      statusEl.style.color = '#c00';
      statusEl.textContent  = 'Numele este obligatoriu.';
      return;
    }
    if (!code.trim()) {
      statusEl.style.color = '#c00';
      statusEl.textContent  = 'Codul JS este obligatoriu.';
      return;
    }

    const widget = {
      id:          existingId || uid(),
      name, desc, description: desc, target, enabled, code,
      createdAt:   _editIdx !== null ? (_widgets[_editIdx]?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
    };

    if (_editIdx !== null) {
      _widgets[_editIdx] = widget;
    } else {
      _widgets.push(widget);
    }

    saveWidgets(() => {
      editorArea.innerHTML = '';
      _editIdx = null;
      renderList(wrapper);
    });
  }

  function deleteWidget(wrapper, idx) {
    const w = _widgets[idx];
    if (!w) return;
    if (!confirm(`Ștergi widget-ul "${w.name}"?`)) return;
    _widgets.splice(idx, 1);
    saveWidgets(() => {
      if (_editIdx === idx) {
        const editorArea = wrapper.querySelector('#fme-widget-editor-area');
        if (editorArea) editorArea.innerHTML = '';
        _editIdx = null;
      }
      renderList(wrapper);
    });
  }

  // ─── Persist ─────────────────────────────────────────────────────────────────

  function saveWidgets(cb) {
    chrome.storage.local.set({ [STORAGE_KEY]: _widgets }, cb || (() => {}));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function escHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { render, runAcpWidgets };
})();
