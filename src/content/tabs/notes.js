/**
 * FME Notes Tab
 * Personal notepad with up to 5 named notes, auto-save, and a clean editor.
 * Data is persisted in chrome.storage.local under 'fme_notes'.
 */

var FMENotesTab = (() => {
  'use strict';

  const STORAGE_KEY = 'fme_notes';
  const MAX_NOTES   = 5;

  let _container = null;
  let _notes     = [];
  let _activeIdx = 0;
  let _saveTimer = null;

  // ─── Public API ──────────────────────────────────────────────────────────────

  async function render(container) {
    _container = container;
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'fme-notes-wrapper main-content';
    wrapper.id = 'main-content';
    wrapper.style.fontSize = '12px';

    wrapper.innerHTML = `
      <div class="fme-section-header">
        <h2 class="fme-section-title">FME</h2>
        <ul class="h2-breadcrumb clearfix"><li class="first">Notițe</li></ul>
        <blockquote class="block_left">
          <p class="explain">Notițe personale salvate local. Poți crea până la ${MAX_NOTES} notițe cu salvare automată.</p>
        </blockquote>
      </div>
      <div id="fme-notes-area"></div>
    `;

    container.appendChild(wrapper);
    await loadNotes();
    renderNotes(wrapper);
  }

  // ─── Load ─────────────────────────────────────────────────────────────────────

  async function loadNotes() {
    return new Promise(resolve => {
      chrome.storage.local.get({ [STORAGE_KEY]: [] }, result => {
        _notes = result[STORAGE_KEY] || [];
        if (!Array.isArray(_notes) || !_notes.length) {
          _notes = [{ id: uid(), title: 'Notița 1', content: '', updatedAt: null }];
        }
        _activeIdx = Math.min(_activeIdx, _notes.length - 1);
        resolve();
      });
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  function renderNotes(wrapper) {
    const area = wrapper.querySelector('#fme-notes-area');
    if (!area) return;

    const canAdd = _notes.length < MAX_NOTES;
    const note   = _notes[_activeIdx];

    const tabsHtml = _notes.map((n, i) => `
      <li class="fme-filter-tab${i === _activeIdx ? ' fme-filter-tab--active" id="activetab' : ''}">
        <a href="#" data-note-idx="${i}"><span>${escHtml(n.title || `Notița ${i + 1}`)}</span></a>
      </li>
    `).join('');

    const lastSaved = note.updatedAt
      ? `Salvat: ${new Date(note.updatedAt).toLocaleString('ro-RO')}`
      : 'Nesalvat';

    area.innerHTML = `
      <div class="fme-filter-tabs">
        <div id="menu-body"><div id="tabs_menu"><ul>
          ${tabsHtml}
          ${canAdd ? `<li class="fme-filter-tab"><a href="#" id="fme-note-add-btn"><span>+ Adaugă</span></a></li>` : ''}
        </ul></div></div>
      </div>
      <div class="panel-menu" style="margin:0!important;background:var(--fme-card, #fff)!important;border:1px solid var(--fme-border, #cdcdcd)!important;padding:0 0 10px 0!important;color:var(--fme-text, #333)!important;">
        <br/>
        <fieldset style="margin:0 12px 12px 12px;">
          <dl>
            <dt><label for="fme-note-title">Titlu:</label></dt>
            <dd>
              <input type="text" id="fme-note-title" value="${escHtml(note.title)}"
                style="width:55%;font-size:12px;" maxlength="60" />
            </dd>
          </dl>
          <dl>
            <dd>
              <textarea id="fme-note-content"
                style="width:100%;height:320px;font-family:Consolas,'Cascadia Code',monospace;font-size:12px;line-height:1.6;padding:10px;border:1px solid var(--fme-border, #cdcdcd);border-radius:3px;resize:vertical;tab-size:2;background:var(--fme-surface, #fff);color:var(--fme-text, #222);"
                placeholder="Scrie notița ta aici..."
              >${escHtml(note.content)}</textarea>
            </dd>
          </dl>
          <div class="div_btns" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <input type="button" id="fme-note-save"   value="Salvează"        class="icon_ok" />
            <input type="button" id="fme-note-delete" value="Șterge notița"   class="icon_cancel"
              ${_notes.length <= 1 ? 'disabled' : ''} />
            <span id="fme-note-status" style="font-size:11px;color:#27ae60;font-weight:600;"></span>
            <span style="margin-left:auto;font-size:10px;color:#999;">${escHtml(lastSaved)}</span>
          </div>
        </fieldset>
      </div>
    `;

    // Events: tab clicks
    area.querySelectorAll('[data-note-idx]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const idx = +a.dataset.noteIdx;
        if (idx === _activeIdx) return;
        flushCurrentNote(wrapper);
        _activeIdx = idx;
        renderNotes(wrapper);
      });
    });

    area.querySelector('#fme-note-add-btn')?.addEventListener('click', e => {
      e.preventDefault();
      flushCurrentNote(wrapper, false);
      addNote(wrapper);
    });

    // Auto-save on type
    area.querySelector('#fme-note-title').addEventListener('input',   () => scheduleSave(wrapper));
    area.querySelector('#fme-note-content').addEventListener('input', () => scheduleSave(wrapper));

    // Tab key in textarea
    area.querySelector('#fme-note-content').addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const t = e.target;
        const s = t.selectionStart, en = t.selectionEnd;
        t.value = t.value.substring(0, s) + '  ' + t.value.substring(en);
        t.selectionStart = t.selectionEnd = s + 2;
      }
    });

    area.querySelector('#fme-note-save').addEventListener('click', () => {
      flushCurrentNote(wrapper, true);
    });

    area.querySelector('#fme-note-delete').addEventListener('click', () => {
      deleteCurrentNote(wrapper);
    });
  }

  // ─── Save logic ───────────────────────────────────────────────────────────────

  function scheduleSave(wrapper) {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => flushCurrentNote(wrapper, false), 1500);
  }

  function flushCurrentNote(wrapper, showStatus) {
    clearTimeout(_saveTimer);
    const titleEl   = wrapper.querySelector('#fme-note-title');
    const contentEl = wrapper.querySelector('#fme-note-content');
    if (!titleEl || !contentEl) return;

    _notes[_activeIdx] = {
      ..._notes[_activeIdx],
      title:     titleEl.value.trim() || `Notița ${_activeIdx + 1}`,
      content:   contentEl.value,
      updatedAt: new Date().toISOString(),
    };

    chrome.storage.local.set({ [STORAGE_KEY]: _notes }, () => {
      if (!showStatus) return;
      if (typeof FMEActivityLog !== 'undefined') FMEActivityLog.log('notes-save', 'Notiță salvată: ' + _notes[_activeIdx].title);
      const statusEl = wrapper.querySelector('#fme-note-status');
      if (statusEl) {
        statusEl.textContent = 'Salvată ✓';
        setTimeout(() => { statusEl.textContent = ''; }, 2000);
      }
    });
  }

  function addNote(wrapper) {
    if (_notes.length >= MAX_NOTES) return;
    _notes.push({ id: uid(), title: `Notița ${_notes.length + 1}`, content: '', updatedAt: null });
    _activeIdx = _notes.length - 1;
    chrome.storage.local.set({ [STORAGE_KEY]: _notes }, () => renderNotes(wrapper));
  }

  function deleteCurrentNote(wrapper) {
    if (_notes.length <= 1) return;
    if (!confirm(`Ștergi notița "${_notes[_activeIdx].title}"?`)) return;
    _notes.splice(_activeIdx, 1);
    _activeIdx = Math.max(0, _activeIdx - 1);
    chrome.storage.local.set({ [STORAGE_KEY]: _notes }, () => renderNotes(wrapper));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function uid() { return Math.random().toString(36).slice(2, 10); }

  function escHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { render };
})();
