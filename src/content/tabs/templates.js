/**
 * FME Templates Tab
 * Fetches the Forumotion admin template list directly from the admin panel
 * (same-origin, no CORS), renders categories + template table, opens a code
 * editor modal for editing, and saves back via the native admin form.
 */

var FMETemplatesTab = (() => {
  // ─── Constants ───────────────────────────────────────────────────────────────

  const CATEGORIES = [
    { key: 'main',       label: 'General'   },
    { key: 'portal',     label: 'Portal'    },
    { key: 'gallery',    label: 'Galerie'   },
    { key: 'calendar',   label: 'Calendar'  },
    { key: 'group',      label: 'Grupuri'   },
    { key: 'post',       label: 'Postare & Mesaje Private'   },
    { key: 'moderation', label: 'Moderare'  },
    { key: 'profil',     label: 'Profil'    },
    { key: 'mobile',     label: 'Versiunea pentru mobil'     },
  ];

  // ─── State ───────────────────────────────────────────────────────────────────

  let _container      = null;
  let _currentMode    = CATEGORIES[0].key;
  let _templates      = [];   // array of { name, description, status, editUrl, value }
  let _searchTimer    = null;
  let _modal          = null; // the modal DOM element (appended to document.body)
  let _installedThemes = {};  // loaded from chrome.storage.local for FME badge detection
  let _fmeTemplateIds = new Set(); // template IDs known to be installed by FME themes

  // ─── Public API ──────────────────────────────────────────────────────────────
  function stylePanel() {
    // Additional styles specific to this tab can be injected here if needed.
    document.head.insertAdjacentHTML('beforeend', `
      <style>
        /* Override default table styles for better readability */ 
        .panel_menu {
            margin: 0px !important;
            background-color: var(--fme-card, #fff) !important;
            border: 1px solid var(--fme-border, #cdcdcd) !important;;
            padding: 0 0 10px 0 !important;
            border-width: 1px !important;
        }
      </style>
    `);
  }


  async function render(container) {
    _container = container;
    container.innerHTML = '';
    stylePanel();

    // Load installed themes to detect FME-modified templates
    await loadInstalledThemes();

    const wrapper = document.createElement('div');
    wrapper.className = 'fme-templates-wrapper';
    wrapper.id = 'main-content';
    wrapper.style = 'font-size:12px;';
    wrapper.innerHTML = `
      <h2 class="fme-section-title">FME</h2>
      <ul class="h2-breadcrumb clearfix"><li class="first">Templates</li></ul>
      <blockquote class="block_left">
        <p class="explain">
        În acest spațiu puteți <strong>modifica template-urile forumului dvs.</strong> și, astfel, personaliza aspectul și structura acestuia într-un mod foarte detaliat.<strong> Template-urile modificate </strong>sunt marcate în <strong>roșu înainte de publicare</strong> și apoi în <strong>verde când sunt aplicate pe forumul tău</strong>. <br> <br>
        <strong> Înainte de orice modificare </strong>, vă recomandăm să <strong> faceți o copie de rezervă </strong> a template-ului dvs.!</p>
      </blockquote>
      <div class="fme-filter-tabs" id="fme-tpl-categories"></div>
      <div class="panel-menu" style="margin: 0px !important; background-color: var(--fme-card, #fff) !important; border: 1px solid var(--fme-border, #cdcdcd) !important; padding: 0 0 10px 0 !important; border-width: 1px !important;">
        <br />
        <fieldset style="margin:0 12px 12px 12px;">
          <legend>Lista template-urilor</legend>
          <div class="fme-toolbar">
            <input type="search" id="fme-tpl-search" placeholder="Cauta template..." />
            <input type="button" id="fme-tpl-refresh" value="Refresh" title="Reincarca lista" />
          </div>
          <div id="fme-tpl-list-area">
            <div class="fme-loading">
              <div class="fme-spinner"></div>
              <span>Se incarca lista de template-uri...</span>
            </div>
          </div>
        </fieldset>
      </div>
    `;

    container.appendChild(wrapper);
    buildCategoryTabs(wrapper);
    bindEvents(wrapper);
    await loadTemplateList(wrapper);
  }

  // ─── Tid extraction ──────────────────────────────────────────────────────────

  function getTid() {
    // 1. From current page URL query string
    const urlMatch = window.location.search.match(/[?&]tid=([a-f0-9]+)/i);
    if (urlMatch) return urlMatch[1];

    // 2. From any link on the page that contains tid=
    const tidLink = document.querySelector('a[href*="tid="]');
    if (tidLink) {
      const linkMatch = tidLink.getAttribute('href').match(/[?&]tid=([a-f0-9]+)/i);
      if (linkMatch) return linkMatch[1];
    }

    // 3. Fallback: _tc param from URL
    const tcMatch = window.location.search.match(/[?&]_tc=([a-f0-9]+)/i);
    if (tcMatch) return tcMatch[1];

    return null;
  }

  // ─── Fetch helper ─────────────────────────────────────────────────────────────

  async function fetchPage(url) {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status} la ${url}`);
    const html = await response.text();
    return new DOMParser().parseFromString(html, 'text/html');
  }

  // ─── Template list parser ─────────────────────────────────────────────────────

  /**
   * Parses the admin template list page.
   * Expected table columns: Nume | Descriere | Valoare | Statut | Modificat pe | Actiune
   *
   * Returns array of { name, description, value, status, editUrl }
   */
  function parseTemplateList(doc) {
    const results = [];

    // Find table rows — skip the header row
    const rows = doc.querySelectorAll('table tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      // Expect at least 5 cells (name, desc, value, status, modified, action)
      if (cells.length < 5) return;

      // Name: first <a> in first cell
      const nameLink = cells[0].querySelector('a');
      if (!nameLink) return; // header or empty row
      const name = nameLink.textContent.trim();

      const description = cells[1] ? cells[1].textContent.trim() : '';
      const value       = cells[2] ? cells[2].textContent.trim() : '';
      const status      = cells[3] ? cells[3].textContent.trim() : '';

      // Action cell: for modified templates Forumotion places a Reset link BEFORE the Edit link.
      // Prefer any link with action=edit in the href; fall back to the name link.
      const lastCell = cells[cells.length - 1];
      const actionLinks = Array.from(lastCell.querySelectorAll('a[href]'));
      let editUrl = '';
      let resetUrl = '';

      for (const a of actionLinks) {
        const href = a.getAttribute('href') || '';
        if (href.includes('action=edit')) {
          editUrl = href;
        } else if (
          href.includes('mode=delete') ||
          href.includes('action=delete') ||
          href.includes('action=reset') ||
          href.includes('mode=reset')
        ) {
          resetUrl = href;
        }
      }
      // Fall back to template name link (also goes to the edit page)
      if (!editUrl) editUrl = nameLink.getAttribute('href') || '';
      // Last resort: first link in action cell
      if (!editUrl && actionLinks.length) editUrl = actionLinks[0].getAttribute('href') || '';
      if (!editUrl) return;

      // Make absolute if relative
      const makeAbsolute = (url) => {
        if (!url || url.startsWith('http')) return url;
        return window.location.origin + (url.startsWith('/') ? '' : '/') + url;
      };
      editUrl  = makeAbsolute(editUrl);
      resetUrl = makeAbsolute(resetUrl);

      results.push({ name, description, value, status, editUrl, resetUrl });
    });

    return results;
  }

  // ─── Load template list ──────────────────────────────────────────────────────

  async function loadTemplateList(wrapper) {
    const listArea = wrapper.querySelector('#fme-tpl-list-area');
    listArea.innerHTML = `
      <div class="fme-loading">
        <div class="fme-spinner"></div>
        <span>Se incarca template-urile...</span>
      </div>
    `;

    const tid = getTid();
    if (!tid) {
      showFetchError(listArea, 'Nu s-a putut accesa panoul de administrare.', 'Nu s-a putut determina tid-ul temei. Asigura-te ca esti pe pagina de administrare Forumotion.');
      return;
    }

    try {
      if (_currentMode === '__fme__') {
        // Special FME mode: show templates from all installed themes
        await loadFmeModifiedTemplates(wrapper, tid);
        return;
      }

      const url = buildListUrl(tid, _currentMode);
      const doc = await fetchPage(url);
      _templates = parseTemplateList(doc);

      renderTable(wrapper);
    } catch (err) {
      showFetchError(listArea, 'Nu s-a putut accesa panoul de administrare.', err.message);
    }
  }

  /**
   * Loads templates modified by installed FME themes.
   * Strategy 1: Match by stored template IDs (fast, for themes installed after update).
   * Strategy 2: Scan all categories for modified templates and check for @FME marker in content (fallback).
   */
  async function loadFmeModifiedTemplates(wrapper, tid) {
    const listArea = wrapper.querySelector('#fme-tpl-list-area');
    _templates = [];

    listArea.innerHTML = `
      <div class="fme-loading">
        <div class="fme-spinner"></div>
        <span>Se scanează template-urile FME...</span>
      </div>
    `;

    const hasFmeIds = _fmeTemplateIds.size > 0;

    if (hasFmeIds) {
      // Strategy 1: scan only categories from installed themes
      const categoriesToScan = new Set();
      for (const theme of Object.values(_installedThemes)) {
        for (const tpl of (theme.templates || [])) {
          categoriesToScan.add(tpl.category || 'main');
        }
      }

      for (const cat of categoriesToScan) {
        try {
          const url = buildListUrl(tid, cat);
          const doc = await fetchPage(url);
          const catTemplates = parseTemplateList(doc);
          const fmeFiltered = catTemplates.filter(t => _fmeTemplateIds.has(t.name));
          fmeFiltered.forEach(t => { t._fmeCategory = cat; });
          _templates.push(...fmeFiltered);
        } catch (_) { /* skip */ }
      }
    } else {
      // Strategy 2: scan ALL categories for modified templates
      // Then verify each has the @FME marker by checking its content
      for (const cat of CATEGORIES) {
        try {
          const url = buildListUrl(tid, cat.key);
          const doc = await fetchPage(url);
          const catTemplates = parseTemplateList(doc);
          // Only check modified templates (not "Valoare de origine")
          const modified = catTemplates.filter(t =>
            t.status && t.status !== 'Valoare de origine' && t.status !== ''
          );
          for (const tpl of modified) {
            try {
              const tplData = await loadTemplateContent(tpl.editUrl);
              if (tplData.content && tplData.content.includes('<!-- @FME')) {
                tpl._fmeCategory = cat.key;
                tpl._fmeMarkerDetected = true;
                _templates.push(tpl);
              }
            } catch (_) { /* skip */ }
          }
        } catch (_) { /* skip */ }
      }
    }

    if (_templates.length === 0) {
      listArea.innerHTML = '<div class="fme-empty">Nu au fost găsite template-uri modificate de FME.</div>';
      return;
    }

    renderTable(wrapper);
  }

  function buildListUrl(tid, mode) {
    return `${window.location.origin}/admin/?part=themes&sub=templates&mode=${encodeURIComponent(mode)}&extended_admin=1&tid=${encodeURIComponent(tid)}`;
  }

  // ─── Render table ─────────────────────────────────────────────────────────────

  function renderTable(wrapper) {
    const listArea = wrapper.querySelector('#fme-tpl-list-area');
    const searchVal = (wrapper.querySelector('#fme-tpl-search')?.value || '').toLowerCase().trim();

    const filtered = searchVal
      ? _templates.filter(t =>
          t.name.toLowerCase().includes(searchVal) ||
          t.description.toLowerCase().includes(searchVal)
        )
      : _templates;

    if (filtered.length === 0) {
      listArea.innerHTML = '<div class="fme-empty">Nu au fost gasite template-uri in aceasta categorie.</div>';
      return;
    }

    let rowsHtml = '';
    filtered.forEach((tpl, idx) => {
      const isModified = tpl.status && tpl.status !== 'Valoare de origine' && tpl.status !== '';
      const fmeTheme = findThemeForTemplate(tpl.name);
      const hasFmeMarker = tpl._fmeMarkerDetected || !!fmeTheme;
      const fmeBadge = hasFmeMarker
        ? `<span class="fme-badge fme-badge-installed" style="font-size:10px;margin-left:4px;" title="${fmeTheme ? 'Modificat de tema: ' + escHtml(fmeTheme.name) : 'Detectat marker @FME'}">FME</span>`
        : '';
      const categoryBadge = tpl._fmeCategory
        ? ` <span style="font-size:10px;color:#999;margin-left:4px;">[${escHtml(tpl._fmeCategory)}]</span>`
        : '';
      const statusBadge = isModified
        ? `<span class="fme-badge fme-badge-update">${escHtml(tpl.status)}</span>`
        : `<span style="color:var(--fme-text-dim);font-size:11px;">${escHtml(tpl.status || 'Valoare de origine')}</span>`;

      rowsHtml += `
        <tr>
          <td><strong>${escHtml(tpl.name)}</strong>${fmeBadge}${categoryBadge}</td>
          <td style="color:var(--fme-text-muted);">${escHtml(tpl.description)}</td>
          <td>${statusBadge}</td>
          <td>
            <input type="button" class="fme-tpl-edit-btn" data-tpl-idx="${idx}" value="Editeaza" />
          </td>
        </tr>
      `;
    });

    listArea.innerHTML = `
      <table class="fme-table" id="fme-tpl-table">
        <thead>
          <tr>
            <th>Nume</th>
            <th>Descriere</th>
            <th>Statut</th>
            <th style="width:90px;">Actiune</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

    // Bind edit buttons
    listArea.querySelectorAll('.fme-tpl-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.tplIdx, 10);
        openEditorModal(filtered[idx]);
      });
    });
  }

  // ─── Load template content for editing ───────────────────────────────────────

  /**
   * Fetches the edit page for a template and extracts:
   *   content       — textarea value
   *   formAction    — form action URL
   *   hiddenFields  — [{name, value}] array of hidden inputs
   *   textareaName  — name attribute of the content textarea
   *   resetUrl      — optional URL of a reset/delete link
   */
  async function loadTemplateContent(editUrl) {
    const doc = await fetchPage(editUrl);

    // Find the largest textarea on the page (the template content field)
    const textareas = Array.from(doc.querySelectorAll('textarea'));
    if (textareas.length === 0) throw new Error('Nu s-a gasit textarea pe pagina de editare.');

    // Prefer the textarea with the most content or the largest rows attribute
    textareas.sort((a, b) => {
      const rowsA = parseInt(a.getAttribute('rows') || '0', 10);
      const rowsB = parseInt(b.getAttribute('rows') || '0', 10);
      if (rowsB !== rowsA) return rowsB - rowsA;
      return (b.textContent || '').length - (a.textContent || '').length;
    });
    const ta = textareas[0];
    const content = ta.value !== undefined ? ta.value : ta.textContent;
    const textareaName = ta.getAttribute('name') || 'content';

    // Find the parent form
    const form = ta.closest('form') || doc.querySelector('form');
    if (!form) throw new Error('Nu s-a gasit formularul de editare pe pagina.');

    let formAction = form.getAttribute('action') || editUrl;
    if (formAction && !formAction.startsWith('http')) {
      formAction = window.location.origin + (formAction.startsWith('/') ? '' : '/') + formAction;
    }

    // Collect all hidden inputs from the form
    const hiddenFields = [];
    form.querySelectorAll('input[type="hidden"]').forEach(input => {
      hiddenFields.push({ name: input.getAttribute('name'), value: input.value });
    });

    // Look for a reset/delete link (Forumotion usually has one labelled "Sterge" or similar)
    let resetUrl = null;
    const allLinks = Array.from(doc.querySelectorAll('a[href]'));
    const resetPatterns = ['reset', 'delete', 'sterge', 'implicit', 'restore', 'default'];
    for (const link of allLinks) {
      const href  = link.getAttribute('href') || '';
      const text  = link.textContent.toLowerCase();
      const hrefL = href.toLowerCase();
      if (resetPatterns.some(p => text.includes(p) || hrefL.includes(p))) {
        resetUrl = href.startsWith('http') ? href : window.location.origin + (href.startsWith('/') ? '' : '/') + href;
        break;
      }
    }

    // Extract the submit button name/value (required by Forumotion)
    let submitField = null;
    const submitBtn = form.querySelector('input[type="submit"][name], button[type="submit"][name], button:not([type])[name]');
    if (submitBtn) {
      submitField = {
        name:  submitBtn.getAttribute('name') || '',
        value: submitBtn.value || submitBtn.textContent.trim() || ''
      };
    }

    return { content, formAction, hiddenFields, textareaName, resetUrl, submitField };
  }

  // ─── Save template ────────────────────────────────────────────────────────────

  async function saveTemplate(formAction, hiddenFields, textareaName, newContent, submitField) {
    const params = new URLSearchParams();
    hiddenFields.forEach(f => {
      if (f.name) params.append(f.name, f.value || '');
    });
    params.append(textareaName, newContent);
    if (submitField && submitField.name) {
      params.append(submitField.name, submitField.value || '');
    }

    const response = await fetch(formAction, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      credentials: 'include',
    });

    if (!response.ok) throw new Error(`Serverul a raspuns cu HTTP ${response.status}.`);
    return true;
  }

  // ─── Editor modal ─────────────────────────────────────────────────────────────

  function openEditorModal(tpl) {
    // Remove any existing modal
    if (_modal) {
      _modal.remove();
      _modal = null;
    }

    const categoryLabel = CATEGORIES.find(c => c.key === _currentMode)?.label || _currentMode;

    _modal = document.createElement('div');
    _modal.className = 'fme-modal-overlay';
    _modal.id = 'fme-tpl-editor-modal';
    _modal.innerHTML = `
      <div class="fme-modal" style="max-width:860px;max-height:92vh;">
        <div class="fme-modal-header">
          <span class="fme-modal-title">Editare template: ${escHtml(tpl.name)}</span>
          <button class="fme-modal-close" id="fme-tpl-modal-close">&times;</button>
        </div>
        <div class="fme-modal-body" style="display:flex;flex-direction:column;gap:10px;padding:14px 16px;">
          <div class="fme-alert fme-alert-info" style="margin:0;padding:8px 12px;">
            <span>Categorie: <strong>${escHtml(categoryLabel)}</strong> &nbsp;|&nbsp; Template: <strong>${escHtml(tpl.name)}</strong></span>
          </div>
          <div id="fme-tpl-load-state" class="fme-loading fme-loading-inline" style="padding:20px 0;">
            <div class="fme-spinner"></div>
            <span>Se incarca continutul template-ului...</span>
          </div>
          <div id="fme-tpl-editor-area" style="display:none;flex-direction:column;gap:8px;">
            <div class="fme-code-toolbar" style="margin-bottom:0;">
              <input type="button" id="fme-tpl-save-btn" value="Salveaza" />
              <input type="button" id="fme-tpl-reset-btn" value="Reseteaza la implicit" disabled />
              <input type="button" id="fme-tpl-copy-btn" value="Copiaza" />
              <input type="button" id="fme-tpl-cancel-btn" value="Anuleaza" />
            </div>
            <textarea
              id="fme-tpl-editor-textarea"
              spellcheck="false"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              style="
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 12px;
                line-height: 1.6;
                width: 100%;
                min-height: 400px;
                resize: vertical;
                border: 1px solid var(--fme-border, #ddd);
                border-radius: 4px;
                padding: 12px;
                tab-size: 2;
                -moz-tab-size: 2;
                outline: none;
                color: var(--fme-text, #333);
                background: var(--fme-surface, #fafafa);
                box-sizing: border-box;
              "
            ></textarea>
            <div id="fme-tpl-status-area" style="min-height:24px;font-size:12px;"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(_modal);

    // Wire close
    _modal.querySelector('#fme-tpl-modal-close').addEventListener('click', closeEditorModal);
    _modal.querySelector('#fme-tpl-cancel-btn')?.addEventListener('click', closeEditorModal);
    _modal.addEventListener('click', e => {
      if (e.target === _modal) closeEditorModal();
    });

    // Load content then wire remaining buttons
    loadAndPopulateEditor(tpl);
  }

  async function loadAndPopulateEditor(tpl) {
    const loadState  = _modal.querySelector('#fme-tpl-load-state');
    const editorArea = _modal.querySelector('#fme-tpl-editor-area');
    const textarea   = _modal.querySelector('#fme-tpl-editor-textarea');
    const statusArea = _modal.querySelector('#fme-tpl-status-area');
    const saveBtn    = _modal.querySelector('#fme-tpl-save-btn');
    const resetBtn   = _modal.querySelector('#fme-tpl-reset-btn');
    const copyBtn    = _modal.querySelector('#fme-tpl-copy-btn');

    let formAction, hiddenFields, textareaName, resetUrl, submitField;

    try {
      const data = await loadTemplateContent(tpl.editUrl);
      formAction    = data.formAction;
      hiddenFields  = data.hiddenFields;
      textareaName  = data.textareaName;
      resetUrl      = data.resetUrl;
      submitField   = data.submitField;

      textarea.value = data.content;

      // resetUrl: prefer the one extracted from the list page (tpl.resetUrl),
      // fall back to whatever loadTemplateContent found on the edit page
      resetUrl = tpl.resetUrl || data.resetUrl || null;

      // Enable reset button only if a reset URL was found
      if (resetUrl) {
        resetBtn.disabled = false;
      }

      loadState.style.display  = 'none';
      editorArea.style.display = 'flex';

      // Detect FME marker in template content
      if (typeof FMEThemesTab !== 'undefined' && FMEThemesTab.parseFmeMarker) {
        const marker = FMEThemesTab.parseFmeMarker(data.content);
        if (marker) {
          const infoDiv = document.createElement('div');
          infoDiv.className = 'fme-alert fme-alert-info';
          infoDiv.style.cssText = 'margin:0;padding:8px 12px;font-size:11px;';
          const dateStr = new Date(marker.date).toLocaleDateString('ro-RO', { year: 'numeric', month: 'short', day: 'numeric' });
          infoDiv.innerHTML = `<strong>\u2605 FME</strong> &mdash; Acest template a fost instalat de tema <strong>${escHtml(marker.themeId)}</strong> (v${escHtml(marker.version)}) pe ${dateStr}.`;
          editorArea.insertBefore(infoDiv, editorArea.firstChild);
        }
      }

      textarea.focus();

    } catch (err) {
      loadState.innerHTML = `
        <div class="fme-error-state" style="width:100%;">
          <p class="fme-error-title">Nu s-a putut incarca template-ul</p>
          <p class="fme-error-msg">${escHtml(err.message)}</p>
        </div>
      `;
      return;
    }

    // Tab key inserts 2 spaces instead of changing focus
    textarea.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        insertAtCursor(textarea, '  ');
      }
    });

    // Save
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.value = 'Se salveaza...';
      setModalStatus(statusArea, '', '');

      try {
        await saveTemplate(formAction, hiddenFields, textareaName, textarea.value, submitField);
        setModalStatus(statusArea, 'success', 'Template salvat cu succes.');
        saveBtn.value = 'Salvat!';
        setTimeout(() => {
          saveBtn.value = 'Salveaza';
          saveBtn.disabled = false;
        }, 2500);
      } catch (err) {
        setModalStatus(statusArea, 'error', 'Eroare la salvare: ' + err.message);
        saveBtn.value = 'Salveaza';
        saveBtn.disabled = false;
      }
    });

    // Reset to default
    resetBtn.addEventListener('click', async () => {
      if (!resetUrl) return;
      if (!confirm('Esti sigur ca vrei sa resetezi acest template la valoarea implicita? Modificarile tale vor fi pierdute.')) return;

      resetBtn.disabled = true;
      setModalStatus(statusArea, '', 'Se reseteaza...');

      try {
        await fetch(resetUrl, { credentials: 'include' });
        setModalStatus(statusArea, 'success', 'Template resetat la valoarea implicita. Reincarca pagina pentru a vedea modificarile.');
        // Reload editor content
        const data = await loadTemplateContent(tpl.editUrl);
        textarea.value = data.content;
        resetBtn.disabled = !data.resetUrl;
      } catch (err) {
        setModalStatus(statusArea, 'error', 'Eroare la resetare: ' + err.message);
        resetBtn.disabled = false;
      }
    });

    // Copy
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(textarea.value);
        copyBtn.value = 'Copiat!';
        setTimeout(() => { copyBtn.value = 'Copiaza'; }, 2000);
      } catch {
        copyBtn.value = 'Eroare copiere';
      }
    });
  }

  function closeEditorModal() {
    if (_modal) {
      _modal.remove();
      _modal = null;
    }
  }

  // ─── Textarea helpers ─────────────────────────────────────────────────────────

  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end   = textarea.selectionEnd;
    const val   = textarea.value;
    textarea.value = val.substring(0, start) + text + val.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function setModalStatus(el, type, msg) {
    if (!el) return;
    el.innerHTML = '';
    if (!msg) return;

    const alertClass = type === 'success' ? 'fme-alert-success'
                     : type === 'error'   ? 'fme-alert-error'
                     : 'fme-alert-info';

    el.innerHTML = `<div class="fme-alert ${alertClass}" style="margin:0;">${escHtml(msg)}</div>`;
  }

  // ─── Category tabs ────────────────────────────────────────────────────────────

  function buildCategoryTabs(wrapper) {
    const tabsContainer = wrapper.querySelector('#fme-tpl-categories');

    const hasFmeTemplates = hasInstalledThemesWithTemplates();

    // When FME tab is shown, make it the default active tab
    if (hasFmeTemplates) {
      _currentMode = '__fme__';
    }

    const template = document.createElement('template');

    template.innerHTML = `
      <div id="menu-body">
        <div id="tabs_menu">
          <ul>
            ${hasFmeTemplates ? `
              <li class="fme-filter-tab fme-filter-tab--active" id="activetab" data-mode="__fme__">
                <a href="#"><span>\u2605 FME Modificate</span></a>
              </li>
            ` : ''}
            ${CATEGORIES.map((cat, i) => `
              <li 
                class="fme-filter-tab${!hasFmeTemplates && i === 0 ? ' fme-filter-tab--active' : ''}"
                ${!hasFmeTemplates && i === 0 ? 'id="activetab"' : ''}
                data-mode="${cat.key}"
              >
                <a href="#"><span>${cat.label}</span></a>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
    `;

    tabsContainer.appendChild(template.content);
  }

  // ─── Event binding ────────────────────────────────────────────────────────────

  function bindEvents(wrapper) {
    // Category tabs
    wrapper.querySelector('#fme-tpl-categories').addEventListener('click', async e => {
      const tab = e.target.closest('.fme-filter-tab');
      if (!tab) return;
      
      e.preventDefault();

      wrapper.querySelectorAll('.fme-filter-tab').forEach(t => {
        t.classList.remove('fme-filter-tab--active');
        t.removeAttribute('id'); // 👈 curăță ID-ul vechi
      });

      tab.classList.add('fme-filter-tab--active');
      tab.id = 'activetab';

      _currentMode = tab.dataset.mode;
      _templates = [];
      await loadTemplateList(wrapper);
    });

    // Search
    wrapper.querySelector('#fme-tpl-search').addEventListener('input', () => {
      clearTimeout(_searchTimer);
      _searchTimer = setTimeout(() => renderTable(wrapper), 250);
    });

    // Refresh
    wrapper.querySelector('#fme-tpl-refresh').addEventListener('click', () => loadTemplateList(wrapper));
  }

  // ─── Installed themes (FME marker detection) ─────────────────────────────────

  function loadInstalledThemes() {
    return new Promise(resolve => {
      chrome.storage.local.get({ fme_installed_themes: {} }, data => {
        _installedThemes = data.fme_installed_themes || {};
        _fmeTemplateIds = new Set();
        Object.values(_installedThemes).forEach(theme => {
          (theme.templates || []).forEach(t => _fmeTemplateIds.add(t.id));
        });
        resolve();
      });
    });
  }

  /** Find which theme installed a given template ID */
  function findThemeForTemplate(templateId) {
    for (const theme of Object.values(_installedThemes)) {
      if ((theme.templates || []).some(t => t.id === templateId)) {
        return theme;
      }
    }
    return null;
  }

  /** Check if any themes are installed (with or without template data stored) */
  function hasInstalledThemesWithTemplates() {
    // Show FME tab if any theme is installed — even without stored templates[] array
    // (older themes may have installed templates before we added the templates tracking)
    return Object.keys(_installedThemes).length > 0;
  }

  // ─── Error state ──────────────────────────────────────────────────────────────

  function showFetchError(listArea, title, detail) {
    listArea.innerHTML = `
      <div class="fme-error-state">
        <p class="fme-error-title">${escHtml(title)}</p>
        <p class="fme-error-msg">${escHtml(detail)}</p>
        <p class="fme-error-hint">Asigura-te ca esti autentificat in panoul de administrare Forumotion.</p>
      </div>
    `;
  }

  // ─── Utilities ────────────────────────────────────────────────────────────────

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { render };
})();
