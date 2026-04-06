/**
 * FME Themes Tab — v1.2.0
 * Tabel nativ, modal instalare 3 pasi, parsing manifest nou.
 * v1.2: installTemplates, previewWithTemplates, restoreFromPreview, preview banner.
 */

var FMEThemesTab = (() => {
  const STORAGE_KEY          = 'fme_installed_themes';
  const INJECTED_STYLE_PREFIX = 'fme-theme-style-';

  let _container       = null;
  let _themes          = [];          // from index.json (listing only)
  let _installedThemes = {};          // { id: { id, name, cssText, version, installedAt } }
  let _settings        = null;
  let _currentFilter   = 'all';
  let _searchVal       = '';
  let _modal           = null;
  let _detectedEngine  = null;        // cached per page load
  let _previewActive   = false;       // prevents double-preview

  const ENGINE_LABELS = {
    invision:   'Invision Community',
    phpbb3:     'phpBB3',
    phpbb2:     'phpBB2',
    punbb:      'PunBB',
    mybb:       'MyBB',
    prosilver:  'phpBB3 (prosilver)',
    subsilver:  'phpBB2 (subsilver)',
    subsilver2: 'phpBB2 (subsilver2)',
  };

  // Maps manifest minEngine values → canonical engine keys used by the forum
  const ENGINE_ALIASES = {
    phpbb3:     ['phpbb3', 'prosilver'],
    phpbb2:     ['phpbb2', 'subsilver', 'subsilver2'],
    prosilver:  ['phpbb3', 'prosilver'],
    subsilver:  ['phpbb2', 'subsilver', 'subsilver2'],
    subsilver2: ['phpbb2', 'subsilver', 'subsilver2'],
    invision:   ['invision'],
    punbb:      ['punbb'],
    mybb:       ['mybb'],
  };

  const BANNER_ID = 'fme-preview-banner';

  // Marker injected into templates installed by FME — source of truth, independent of storage
  const FME_MARKER_PREFIX = '<!-- @FME';
  function buildFmeMarker(themeId, version) {
    return `<!-- @FME theme="${themeId}" v="${version}" date="${new Date().toISOString()}" -->`;
  }
  function parseFmeMarker(content) {
    const m = (content || '').match(/<!-- @FME theme="([^"]+)" v="([^"]+)" date="([^"]+)" -->/);
    return m ? { themeId: m[1], version: m[2], date: m[3] } : null;
  }
  function stripFmeMarker(content) {
    return (content || '').replace(/\n?<!-- @FME theme="[^"]+" v="[^"]+" date="[^"]+" -->\n?/g, '');
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  async function render(container) {
    _container = container;
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'fme-themes-wrapper main-content';
    wrapper.id = 'main-content';
    wrapper.style.fontSize = '12px';

    wrapper.innerHTML = `
      <h2>Teme</h2>
      <ul class="h2-breadcrumb clearfix">
        <li class="first">Browse &amp; Instaleaza</li>
      </ul>
      <blockquote class="block_left">
        <p class="explain">Rasfoieste, personalizeaza si instaleaza teme pentru forumul tau din catalogul GitHub.</p>
      </blockquote>
      <div class="fme-filter-tabs" id="fme-theme-filter-tabs">
        <div id="menu-body"><div id="tabs_menu"><ul>
          <li class="fme-filter-tab fme-filter-tab--active" id="activetab" data-filter="all"><a href="#"><span>Toate</span></a></li>
          <li class="fme-filter-tab" data-filter="installed"><a href="#"><span>Instalate</span></a></li>
        </ul></div></div>
      </div>
      <div class="panel-menu" style="margin:0!important;background:var(--fme-card, #fff)!important;border:1px solid var(--fme-border, #cdcdcd)!important;padding:0 0 10px 0!important;color:var(--fme-text, #333)!important;">
        <br/>
        <fieldset style="margin:0 12px 12px 12px;">
          <legend>Catalog teme</legend>
          <div class="fme-toolbar">
            <input type="search" id="fme-theme-search" placeholder="Cauta tema..." />
            <input type="button" id="fme-themes-refresh" value="Refresh" title="Reincarca din GitHub" />
          </div>
          <br />
          <div id="fme-themes-list-area">
            <div class="fme-loading">
              <div class="fme-spinner"></div>
              <span>Se incarca temele din GitHub&hellip;</span>
            </div>
          </div>
        </fieldset>

        <fieldset style="margin:0 12px 12px 12px;">
          <legend>\u00CEncarcă temă proprie</legend>
          <div style="padding:4px 0 8px;font-size:11px;color:var(--fme-muted, #64748b);">
            Încarcă un fișier <strong>manifest.json</strong> sau o arhivă <strong>.zip</strong> cu o temă proprie.
            Se validează strict după modelul de pe GitHub.
          </div>
          <div class="div_btns" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <input type="button" id="fme-upload-theme-btn" value="Alege manifest.json" class="btn" />
            <input type="file" id="fme-upload-theme-file" accept=".json,application/json" style="display:none;" />
            <span id="fme-upload-theme-status" style="font-size:11px;min-width:180px;"></span>
          </div>
          <div id="fme-upload-validation-area" style="display:none;margin-top:10px;"></div>
        </fieldset>
      </div>
    `;

    container.appendChild(wrapper);
    bindEvents(wrapper);
    await loadData(wrapper);
  }

  // ─── Data loading ────────────────────────────────────────────────────────────

  async function loadData(wrapper) {
    const listArea = wrapper.querySelector('#fme-themes-list-area');
    listArea.innerHTML = `<div class="fme-loading"><div class="fme-spinner"></div><span>Se incarca&hellip;</span></div>`;

    try {
      _settings        = await FMEGitHub.getSettings();
      _installedThemes = await getInstalledThemes();

      const catalog = await FMEGitHub.fetchJSON(
        _settings.themesOwner, _settings.themesRepo,
        'index.json', 'main', _settings.githubToken || null
      );

      if (!catalog || !Array.isArray(catalog.themes))
        throw new Error('index.json invalid: expected { themes: [] }');

      _themes = catalog.themes;
      renderTable(wrapper);
    } catch (err) {
      listArea.innerHTML = `
        <div class="fme-error-state">
          <p class="fme-error-title">Nu s-au putut incarca temele</p>
          <p class="fme-error-msg">${escHtml(err.message)}</p>
          <p class="fme-error-hint">Verifica setarile GitHub si conexiunea la internet.</p>
          <input type="button" id="fme-themes-retry" value="Retry" />
        </div>
      `;
      listArea.querySelector('#fme-themes-retry')?.addEventListener('click', () => loadData(wrapper));
    }
  }

  // ─── Table render ────────────────────────────────────────────────────────────

  function renderTable(wrapper) {
    const listArea = wrapper.querySelector('#fme-themes-list-area');

    let filtered = _themes;
    if (_searchVal) {
      filtered = filtered.filter(t =>
        (t.name || '').toLowerCase().includes(_searchVal) ||
        (t.description || '').toLowerCase().includes(_searchVal) ||
        (t.author || '').toLowerCase().includes(_searchVal) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(_searchVal))
      );
    }
    if (_currentFilter === 'installed') {
      filtered = filtered.filter(t => !!_installedThemes[t.id]);
    }

    if (filtered.length === 0) {
      listArea.innerHTML = '<div class="fme-empty">Nu au fost gasite teme.</div>';
      return;
    }

    let rowsHtml = '';
    filtered.forEach((theme, idx) => {
      const installed  = !!_installedThemes[theme.id];
      const tagsHtml   = (theme.tags || []).map(t => `<span class="fme-tag">${escHtml(t)}</span>`).join(' ');
      const statusHtml = installed
        ? `<span class="fme-badge fme-badge-installed">Instalata</span>`
        : `<span style="color:var(--fme-text-dim,#999);font-size:11px;">—</span>`;

      rowsHtml += `
        <tr>
          <td><strong>${escHtml(theme.name || theme.id)}</strong></td>
          <td style="color:var(--fme-muted, #666);">${escHtml(theme.author || '—')}</td>
          <td>${theme.version ? `<span class="fme-badge fme-badge-version">v${escHtml(theme.version)}</span>` : '—'}</td>
          <td>${tagsHtml || '—'}</td>
          <td>${statusHtml}</td>
          <td>
            <input type="button" class="fme-tpl-edit-btn" data-theme-idx="${idx}" value="Detalii / Instaleaza" />
            <input type="button" class="fme-preview-btn" data-theme-idx="${idx}" value="Preview" style="margin-left:4px;" />
            ${installed ? `<input type="button" class="fme-uninstall-btn" data-theme-id="${escHtml(theme.id)}" value="Dezinstaleaza" style="margin-left:4px;" />` : ''}
          </td>
        </tr>
      `;
    });

    listArea.innerHTML = `
      <table class="fme-table" id="fme-themes-table">
        <thead>
          <tr>
            <th>Nume</th>
            <th>Autor</th>
            <th>Versiune</th>
            <th>Tags</th>
            <th>Status</th>
            <th style="width:260px;">Actiuni</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

    listArea.querySelectorAll('.fme-tpl-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openInstallModal(filtered[+btn.dataset.themeIdx]));
    });
    listArea.querySelectorAll('.fme-preview-btn').forEach(btn => {
      btn.addEventListener('click', () => handlePreview(wrapper, filtered[+btn.dataset.themeIdx]));
    });
    listArea.querySelectorAll('.fme-uninstall-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await handleUninstall(btn.dataset.themeId);
        renderTable(wrapper);
      });
    });
  }

  // ─── Events ──────────────────────────────────────────────────────────────────

  function bindEvents(wrapper) {
    wrapper.querySelector('#fme-theme-filter-tabs').addEventListener('click', e => {
      e.preventDefault();
      const tab = e.target.closest('.fme-filter-tab');
      if (!tab) return;
      wrapper.querySelectorAll('.fme-filter-tab').forEach(t => {
        t.classList.remove('fme-filter-tab--active');
        t.removeAttribute('id');
      });
      tab.classList.add('fme-filter-tab--active');
      tab.id = 'activetab';
      _currentFilter = tab.dataset.filter;
      renderTable(wrapper);
    });

    let searchTimer;
    wrapper.querySelector('#fme-theme-search').addEventListener('input', e => {
      clearTimeout(searchTimer);
      _searchVal = e.target.value.toLowerCase().trim();
      searchTimer = setTimeout(() => renderTable(wrapper), 250);
    });

    wrapper.querySelector('#fme-themes-refresh').addEventListener('click', () => loadData(wrapper));

    // Custom theme upload
    const uploadBtn  = wrapper.querySelector('#fme-upload-theme-btn');
    const uploadFile = wrapper.querySelector('#fme-upload-theme-file');
    uploadBtn.addEventListener('click', () => uploadFile.click());
    uploadFile.addEventListener('change', () => {
      const file = uploadFile.files[0];
      if (!file) return;
      handleCustomUpload(file, wrapper);
      uploadFile.value = '';
    });
  }

  // ─── Install modal ───────────────────────────────────────────────────────────

  async function openInstallModal(theme) {
    closeModal();

    _modal = document.createElement('div');
    _modal.className = 'fme-modal-overlay';
    _modal.innerHTML = `
      <div class="fme-modal" style="max-width:780px;max-height:92vh;">
        <div class="fme-modal-header">
          <span class="fme-modal-title">${escHtml(theme.name || theme.id)}</span>
          <button class="fme-modal-close" id="fme-theme-modal-close">&times;</button>
        </div>
        <div class="fme-modal-body" style="padding:16px;">
          <div id="fme-install-loading" class="fme-loading fme-loading-inline" style="padding:24px 0;">
            <div class="fme-spinner"></div>
            <span>Se incarca detaliile temei&hellip;</span>
          </div>
          <div id="fme-install-content" style="display:none;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(_modal);
    _modal.querySelector('#fme-theme-modal-close').addEventListener('click', closeModal);
    _modal.addEventListener('click', e => { if (e.target === _modal) closeModal(); });

    try {
      const manifest = await FMEGitHub.fetchJSON(
        _settings.themesOwner, _settings.themesRepo,
        theme.manifest || `${(theme.path || '').replace(/\/$/, '')}/manifest.json`,
        'main', _settings.githubToken || null
      );
      renderInstallStep1(theme, manifest);
    } catch (err) {
      _modal.querySelector('#fme-install-loading').innerHTML = `
        <div class="fme-error-state" style="width:100%;">
          <p class="fme-error-title">Nu s-a putut incarca manifest-ul</p>
          <p class="fme-error-msg">${escHtml(err.message)}</p>
        </div>
      `;
    }
  }

  function renderInstallStep1(theme, manifest) {
    const loading = _modal.querySelector('#fme-install-loading');
    const content = _modal.querySelector('#fme-install-content');
    loading.style.display = 'none';
    content.style.display = 'block';

    const installed = !!_installedThemes[theme.id];
    const rawBase   = `https://raw.githubusercontent.com/${_settings.themesOwner}/${_settings.themesRepo}/main/`;
    const screenshotPath = manifest.files?.preview?.screenshot
      ? rawBase + (theme.path || '').replace(/\/$/, '') + '/' + manifest.files.preview.screenshot
      : (theme.screenshot ? rawBase + theme.screenshot : null);

    const cssFiles  = manifest.files?.css       || [];
    const tplFiles  = manifest.files?.templates || [];
    const jsFiles   = manifest.files?.js        || [];
    const plugins   = manifest.files?.plugins   || [];
    const variables = manifest.variables        || [];

    // Determine template support status based on tid availability
    const tid = FMEForumAPI.getTid();
    const tplStatus      = tid ? '&#x2713; Suportat' : '&#x26A0; Necesita admin page';
    const tplStatusStyle = tid ? 'color:#27ae60;'     : 'color:#e67e22;font-size:11px;';

    const componentRows = [
      ...buildComponentRows(cssFiles,  'CSS', '#3498db', f => f.label||f.file, '&#x2713; Suportat',  'color:#27ae60;'),
      ...buildComponentRows(tplFiles,  'TPL', '#9b59b6', f => f.label||f.id,   tplStatus,            tplStatusStyle),
      ...buildComponentRows(jsFiles,   'JS',  '#f39c12', f => f.label||f.file,  'v1.2',              'color:#e67e22;font-size:11px;'),
      ...buildComponentRows(plugins,   'PLG', '#2ecc71', f => f.label||f.id,    'v1.2',              'color:#e67e22;font-size:11px;'),
    ].join('');

    const varHtml = variables.length > 0 ? `
      <fieldset style="margin-top:12px;">
        <legend>Variabile personalizabile</legend>
        <div id="fme-variables-area" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px;">
          ${variables.map(v => buildVariableInput(v)).join('')}
        </div>
      </fieldset>
    ` : '';

    // Preview button label: full preview if templates present and tid available
    const hasTemplates = tplFiles.length > 0;
    const previewBtnLabel = (hasTemplates && tid)
      ? 'Preview complet (CSS + Template, 5min)'
      : 'Preview pe forum (15s)';

    content.innerHTML = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;">

        <div style="flex:1;min-width:220px;">
          <table style="width:100%;font-size:12px;margin-bottom:8px;">
            <tr><td style="color:var(--fme-muted, #666);width:80px;">Autor</td><td><strong>${escHtml(manifest.author||theme.author||'—')}</strong></td></tr>
            <tr><td style="color:var(--fme-muted, #666);">Versiune</td><td><span class="fme-badge fme-badge-version">v${escHtml(manifest.version||theme.version||'1.0.0')}</span></td></tr>
            <tr><td style="color:var(--fme-muted, #666);">Engine</td><td>${escHtml(manifest.minEngine||theme.minEngine||'—')}</td></tr>
            <tr><td style="color:var(--fme-muted, #666);">Tags</td><td>${(manifest.tags||theme.tags||[]).map(t=>`<span class="fme-tag">${escHtml(t)}</span>`).join(' ')}</td></tr>
          </table>
          <p style="font-size:12px;color:color-mix(in srgb, var(--fme-text, #333) 84%, transparent);line-height:1.5;">${escHtml(manifest.description||theme.description||'')}</p>
        </div>
      </div>

      <fieldset style="margin-top:12px;">
        <legend>Compatibilitate</legend>
        <table style="width:100%;font-size:12px;padding:4px 0;">
          <tr>
            <td style="color:var(--fme-muted, #666);width:150px;padding:3px 0;">Versiune forum</td>
            <td id="fme-compat-current"><span style="color:var(--fme-muted, #999);">Se verifica&hellip;</span></td>
          </tr>
          <tr>
            <td style="color:var(--fme-muted, #666);padding:3px 0;">Ceruta de tema</td>
            <td>${escHtml(manifest.minEngine || theme.minEngine || '—')}</td>
          </tr>
          <tr>
            <td style="color:var(--fme-muted, #666);padding:3px 0;">Status</td>
            <td id="fme-compat-status"><span style="color:var(--fme-muted, #999);">Se verifica&hellip;</span></td>
          </tr>
        </table>
      </fieldset>

      <fieldset style="margin-top:12px;">
        <legend>Componente incluse</legend>
        <table class="fme-table" style="margin:8px 0 4px;">
          <thead><tr><th style="width:60px;">Tip</th><th>Fisier</th><th style="width:140px;">Status</th></tr></thead>
          <tbody>${componentRows || '<tr><td colspan="3" style="color:var(--fme-muted, #999);text-align:center;padding:8px;">Nicio componenta gasita</td></tr>'}</tbody>
        </table>
      </fieldset>

      ${varHtml}

      <div id="fme-install-status" style="min-height:24px;margin-top:10px;"></div>
      <div id="fme-install-progress" style="display:none;font-size:12px;color:var(--fme-text, #555);margin-top:6px;padding:6px 8px;background:var(--fme-surface, #f8f8f8);border:1px solid var(--fme-border, #e0e0e0);border-radius:3px;"></div>

      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
        ${installed
          ? `<input type="button" id="fme-modal-uninstall-btn" value="Dezinstaleaza" />
             <input type="button" id="fme-modal-reinstall-btn" value="Reinstaleaza tema" style="margin-left:4px;" />`
          : `<input type="button" id="fme-modal-install-btn" value="Instaleaza tema" />`
        }
        <input type="button" id="fme-modal-preview-btn" value="${escHtml(previewBtnLabel)}" />
        <input type="button" id="fme-modal-cancel-btn" value="Inchide" />
      </div>
    `;

    // Wire buttons
    const statusEl   = content.querySelector('#fme-install-status');
    const progressEl = content.querySelector('#fme-install-progress');

    content.querySelector('#fme-modal-install-btn,#fme-modal-reinstall-btn')?.addEventListener('click', async (e) => {
      // Version compatibility check before installing
      const requiredForInstall = manifest.minEngine || theme.minEngine || '';
      if (requiredForInstall) {
        const detectedForInstall = await detectForumEngine();
        if (detectedForInstall && !engineCompatible(detectedForInstall, requiredForInstall)) {
          const detLabel = ENGINE_LABELS[detectedForInstall] || detectedForInstall;
          setModalStatus(statusEl, 'error',
            `Incompatibil: forumul tau foloseste ${detLabel}, tema necesita ${escHtml(requiredForInstall)}.`);
          return;
        }
      }

      const vars = getVariableValues(content);
      showInstallProgressModal(theme, manifest, vars, e.target);
    });

    content.querySelector('#fme-modal-uninstall-btn')?.addEventListener('click', async () => {
      await handleUninstall(theme.id);
      _installedThemes = await getInstalledThemes();
      renderTable(_container.querySelector('.fme-themes-wrapper') || _container);
      setModalStatus(statusEl, 'success', 'Tema dezinstalata.');
    });

    content.querySelector('#fme-modal-preview-btn').addEventListener('click', async () => {
      // Version compatibility check before preview
      const requiredForPreview = manifest.minEngine || theme.minEngine || '';
      if (requiredForPreview) {
        const detectedForPreview = await detectForumEngine();
        if (detectedForPreview && !engineCompatible(detectedForPreview, requiredForPreview)) {
          const detLabel = ENGINE_LABELS[detectedForPreview] || detectedForPreview;
          setModalStatus(statusEl, 'error',
            `Preview imposibil: forumul tau foloseste ${detLabel}, tema necesita ${escHtml(requiredForPreview)}.`);
          return;
        }
      }

      const vars = getVariableValues(content);

      if (hasTemplates && tid) {
        // Full preview with templates — show progress modal
        showPreviewProgressModal(theme, manifest, vars);
      } else {
        // Basic CSS-only preview
        const btn = content.querySelector('#fme-modal-preview-btn');
        btn.disabled = true;
        btn.value = 'Se deschide...';
        statusEl.innerHTML = '';
        await handlePreview(null, theme, manifest, vars);
        setModalStatus(statusEl, 'success', 'Preview deschis in tab nou (15s).');
        btn.value = previewBtnLabel;
        btn.disabled = false;
      }
    });

    content.querySelector('#fme-modal-cancel-btn').addEventListener('click', closeModal);

    // Async: populate compatibility fieldset
    const requiredEngine = manifest.minEngine || theme.minEngine || '';
    detectForumEngine().then(detected => {
      const currentEl = content.querySelector('#fme-compat-current');
      const statusEl2 = content.querySelector('#fme-compat-status');
      if (!currentEl || !statusEl2) return; // modal closed

      if (!detected) {
        currentEl.innerHTML = '<span style="color:var(--fme-muted, #999);">Nedeterminata</span>';
        statusEl2.innerHTML = '<span style="color:var(--fme-muted, #999);">—</span>';
        return;
      }

      const label = ENGINE_LABELS[detected] || detected;
      currentEl.textContent = label;

      if (!requiredEngine) {
        statusEl2.innerHTML = '<span style="color:var(--fme-muted, #999);">Nicio restrictie</span>';
        return;
      }

      const ok = engineCompatible(detected, requiredEngine);
      if (ok) {
        statusEl2.innerHTML = '<span style="color:var(--fme-success, #27ae60);font-weight:600;">&#x2713; Compatibil</span>';
      } else {
        statusEl2.innerHTML = `
          <span style="color:var(--fme-danger, #e74c3c);font-weight:600;">&#x2717; Incompatibil</span>
          <span style="color:var(--fme-muted, #999);font-size:11px;margin-left:6px;">
            (forum: ${escHtml(label)}, cerut: ${escHtml(requiredEngine)})
          </span>`;
        // Warn on install button
        const installBtn = content.querySelector('#fme-modal-install-btn,#fme-modal-reinstall-btn');
        if (installBtn) {
          installBtn.title = 'Atentie: tema poate sa nu fie compatibila cu platforma forumului tau.';
          installBtn.style.borderColor = 'var(--fme-warning, #e67e22)';
        }
      }
    });
  }

  // ─── Engine detection ─────────────────────────────────────────────────────────

  function getTid() {
    return FMEForumAPI.getTid();
  }

  async function detectForumEngine() {
    if (_detectedEngine !== null) return _detectedEngine;
    const tid = FMEForumAPI.getTid();
    if (!tid) { _detectedEngine = ''; return ''; }

    const url = `${window.location.origin}/admin/?part=themes&sub=styles&mode=version&extended_admin=1&tid=${encodeURIComponent(tid)}`;
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      // DOMParser does not set .checked from HTML attribute — check attribute directly
      const radios  = Array.from(doc.querySelectorAll('input[name="tpl"]'));
      const checked = radios.find(r => r.hasAttribute('checked'));
      _detectedEngine = checked ? checked.value.toLowerCase() : '';
    } catch (_) {
      _detectedEngine = '';
    }
    return _detectedEngine;
  }

  function engineCompatible(detected, required) {
    if (!detected || !required) return null;
    const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const d = norm(detected);
    const r = norm(required);
    if (d === r) return true;
    // Check alias expansion: phpbb3 ↔ prosilver, phpbb2 ↔ subsilver/subsilver2
    const aliases = ENGINE_ALIASES[r] || [r];
    return aliases.some(alias => norm(alias) === d);
  }

  // ─── Component rows (collapsed if > INLINE_LIMIT) ────────────────────────────

  const INLINE_LIMIT = 3;

  function buildComponentRows(files, type, color, labelFn, statusText, statusStyle) {
    if (files.length === 0) return [];

    if (files.length <= INLINE_LIMIT) {
      return files.map(f => `
        <tr>
          <td><span class="fme-badge" style="background:${color};color:#fff;border-color:transparent;">${type}</span></td>
          <td>${escHtml(labelFn(f))}</td>
          <td><span style="${statusStyle}">${statusText}</span></td>
        </tr>
      `);
    }

    // Summary row + collapsible detail
    const detailId  = `fme-comp-detail-${type.toLowerCase()}-${Math.random().toString(36).slice(2,7)}`;
    const modeLabel = countModes(files);
    return [`
      <tr>
        <td><span class="fme-badge" style="background:${color};color:#fff;border-color:transparent;">${type}</span></td>
        <td>
          <strong>${files.length} fisiere</strong>
          ${modeLabel ? `<span style="color:var(--fme-muted, #999);font-size:11px;margin-left:6px;">(${modeLabel})</span>` : ''}
          &nbsp;<a href="#" style="font-size:11px;color:var(--fme-accent, #3c9ebf);" onclick="
            var d=document.getElementById('${detailId}');
            d.style.display=d.style.display==='none'?'':'none';
            this.textContent=d.style.display===''?'&#x25B2; ascunde':'&#x25BC; detalii';
            return false;
          ">&#x25BC; detalii</a>
          <div id="${detailId}" style="display:none;margin-top:6px;font-size:11px;color:var(--fme-text, #555);">
            ${files.map(f => `<div style="padding:2px 0;border-bottom:1px solid var(--fme-border, #f0f0f0);">${escHtml(labelFn(f))}</div>`).join('')}
          </div>
        </td>
        <td><span style="${statusStyle}">${statusText}</span></td>
      </tr>
    `];
  }

  function countModes(files) {
    const modes = {};
    files.forEach(f => { if (f.mode) modes[f.mode] = (modes[f.mode] || 0) + 1; });
    return Object.entries(modes).map(([m, n]) => `${n} ${m}`).join(', ');
  }

  // ─── Variables helpers ───────────────────────────────────────────────────────

  function buildVariableInput(v) {
    if (v.type === 'color') {
      return `
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="color" id="fme-var-${escHtml(v.id)}" value="${escHtml(v.default||'#000000')}"
            style="width:36px;height:28px;border:1px solid var(--fme-border, #ccc);border-radius:3px;cursor:pointer;background:var(--fme-card, #fff);" />
          <label for="fme-var-${escHtml(v.id)}" style="font-size:12px;color:var(--fme-text, #333);">${escHtml(v.label||v.id)}</label>
        </div>`;
    }
    return `
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="text" id="fme-var-${escHtml(v.id)}" value="${escHtml(v.default||'')}"
          style="width:80px;border:1px solid var(--fme-border, #ccc);border-radius:3px;padding:3px 6px;font-size:12px;background:var(--fme-surface, #fff);color:var(--fme-text, #333);" />
        <label for="fme-var-${escHtml(v.id)}" style="font-size:12px;color:var(--fme-text, #333);">${escHtml(v.label||v.id)}</label>
      </div>`;
  }

  function getVariableValues(container) {
    const vars = {};
    container.querySelectorAll('[id^="fme-var-"]').forEach(el => {
      const key = el.id.replace('fme-var-', '');
      vars[key] = el.value;
    });
    return vars;
  }

  function applyVariables(cssText, vars) {
    let result = cssText;
    Object.entries(vars).forEach(([key, val]) => {
      result = result.replace(new RegExp(`var\\(--${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g'), val);
    });
    return result;
  }

  // ─── Install / Uninstall ─────────────────────────────────────────────────────

  async function handleInstall(theme, manifest, vars = {}) {
    const cssFiles = manifest.files?.css || [];
    if (cssFiles.length === 0) return { type: 'error', message: 'Tema nu contine fisiere CSS.' };

    try {
      const themePath = (theme.path || manifest.path || '').replace(/\/$/, '');
      const cssTexts  = await Promise.all(
        cssFiles.map(f => FMEGitHub.fetchRaw(
          _settings.themesOwner, _settings.themesRepo,
          `${themePath}/${f.file}`, 'main', _settings.githubToken || null
        ))
      );
      let cssText = cssTexts.join('\n\n');
      if (Object.keys(vars).length) cssText = applyVariables(cssText, vars);

      injectThemeCSS(theme.id, cssText);

      const tplFiles = manifest.files?.templates || [];
      _installedThemes[theme.id] = {
        id: theme.id,
        name: manifest.name || theme.name,
        cssText,
        version: manifest.version || theme.version || '1.0.0',
        installedAt: new Date().toISOString(),
        templates: tplFiles.map(t => ({ id: t.id, category: t.category || 'main', label: t.label || t.id })),
        plugins: (manifest.files?.plugins || []).map(p => ({ id: p.id, label: p.label || p.id })),
      };
      await saveInstalledThemes(_installedThemes);
      if (typeof FMEActivityLog !== 'undefined') FMEActivityLog.log('theme-install', 'Temă instalată: ' + (manifest.name || theme.name));
      return { type: 'success', message: `"${manifest.name || theme.name}" instalata cu succes!` };
    } catch (err) {
      return { type: 'error', message: 'Eroare: ' + err.message };
    }
  }

  async function handleUninstall(themeId) {
    if (typeof FMEActivityLog !== 'undefined') FMEActivityLog.log('theme-uninstall', 'Temă dezinstalată: ' + themeId);
    removeThemeCSS(themeId);

    // Reset modified templates back to default
    const themeData = _installedThemes[themeId];
    if (themeData && themeData.templates && themeData.templates.length > 0) {
      const tid = FMEForumAPI.getTid();
      if (tid) {
        for (const tpl of themeData.templates) {
          try {
            await FMEForumAPI.resetTemplate(tid, tpl.id, tpl.category || 'main', tpl.label || null);
          } catch (_) {
            // Skip errors on individual template resets
          }
        }
      }
    }

    delete _installedThemes[themeId];
    await saveInstalledThemes(_installedThemes);
  }

  // ─── Template install ─────────────────────────────────────────────────────────

  /**
   * Installs all template files from a theme manifest onto the current forum.
   * @param {object}   manifest    — parsed theme manifest
   * @param {string}   tid         — forum theme ID
   * @param {Function} [progressCb] — called with a progress string for each step
   * @returns {Promise<{ installed: number, errors: Array<{ id, error }> }>}
   */
  async function installTemplates(manifest, tid, progressCb, themePathOverride) {
    const tplFiles = manifest.files?.templates || [];
    if (tplFiles.length === 0) return { installed: 0, errors: [] };

    const errors    = [];
    let   installed = 0;
    const themePath = (themePathOverride || manifest.path || '').replace(/\/$/, '');

    for (const tpl of tplFiles) {
      try {
        progressCb?.(`Template: ${tpl.id || tpl.label}\u2026`);

        // 1. Fetch HTML content from GitHub
        const htmlContent = await FMEGitHub.fetchRaw(
          _settings.themesOwner, _settings.themesRepo,
          `${themePath}/${tpl.file}`, 'main', _settings.githubToken || null
        );

        // 2. Find the edit URL on the forum
        const editUrl = await FMEForumAPI.findTemplateEditUrl(tid, tpl.id, tpl.category || 'main', tpl.label || null);
        if (!editUrl) throw new Error(`Template ${tpl.id} negasit`);

        // 3. Load form data
        const formData = await FMEForumAPI.loadTemplateContent(editUrl);

        // 4. Strip any old FME marker and append fresh one
        const cleanContent = stripFmeMarker(htmlContent);
        const markedContent = cleanContent + '\n' + buildFmeMarker(manifest.name || 'unknown', manifest.version || '1.0.0');

        // 5. Save
        await FMEForumAPI.saveTemplate(
          formData.formAction, formData.hiddenFields,
          formData.textareaName, markedContent, formData.submitField
        );

        installed++;
      } catch (err) {
        errors.push({ id: tpl.id || tpl.label || '?', error: err.message });
      }
    }

    return { installed, errors };
  }

  // ─── Preview progress modal ───────────────────────────────────────────────────

  /**
   * Shows a progress modal that replaces the install modal body while
   * running previewWithTemplates. On completion opens the forum tab with ?tt=1.
   */
  function showPreviewProgressModal(theme, manifest, vars) {
    // Re-use the existing modal overlay — clear its body and replace
    if (!_modal) return;

    const modalEl = _modal.querySelector('.fme-modal');
    if (!modalEl) return;

    const header = modalEl.querySelector('.fme-modal-header .fme-modal-title');
    if (header) header.textContent = `Preview: ${manifest.name || theme.name}`;

    const body = modalEl.querySelector('.fme-modal-body');
    body.innerHTML = `
      <div id="fme-preview-progress-wrap" style="padding:8px 0;">
        <div id="fme-preview-progress-steps" style="font-size:12px;line-height:1.8;color:var(--fme-text, #555);min-height:120px;max-height:260px;overflow-y:auto;margin-bottom:12px;"></div>
        <div id="fme-preview-progress-bar-wrap"
             style="background:var(--fme-surface, #e8e8e8);border:1px solid var(--fme-border, #dcdcdc);border-radius:4px;height:8px;overflow:hidden;margin-bottom:12px;">
          <div id="fme-preview-progress-bar"
               style="background:var(--fme-success, #27ae60);height:100%;width:0%;transition:width 0.3s;"></div>
        </div>
        <div id="fme-preview-progress-status" style="font-size:12px;color:var(--fme-success, #27ae60);font-weight:600;min-height:20px;"></div>
        <div style="margin-top:14px;">
          <input type="button" id="fme-preview-progress-close" value="Inchide" disabled />
        </div>
      </div>
    `;

    const stepsEl  = body.querySelector('#fme-preview-progress-steps');
    const barEl    = body.querySelector('#fme-preview-progress-bar');
    const statusEl = body.querySelector('#fme-preview-progress-status');
    const closeBtn = body.querySelector('#fme-preview-progress-close');

    closeBtn.addEventListener('click', closeModal);

    const tplCount = (manifest.files?.templates || []).length;
    let   stepsDone = 0;
    // Total steps: tplCount backups + tplCount installs + 1 (open tab) = 2*tplCount+1
    const totalSteps = Math.max(tplCount * 2 + 1, 1);

    function addStep(msg, isError) {
      const line = document.createElement('div');
      line.style.cssText = isError
        ? 'color:var(--fme-danger, #e74c3c);padding:1px 0;'
        : 'color:var(--fme-text, #555);padding:1px 0;';
      line.textContent = msg;
      stepsEl.appendChild(line);
      stepsEl.scrollTop = stepsEl.scrollHeight;

      stepsDone++;
      barEl.style.width = Math.min(100, Math.round((stepsDone / totalSteps) * 100)) + '%';
    }

    function progressCb(msg) { addStep(msg, false); }

    // Run the preview async
    (async () => {
      addStep('Se pregateste preview-ul\u2026', false);

      const result = await previewWithTemplates(theme, manifest, vars, progressCb);

      if (!result.ok) {
        addStep('Eroare: ' + (result.message || 'Necunoscuta'), true);
        statusEl.style.color = 'var(--fme-danger, #e74c3c)';
        statusEl.textContent = 'Preview esuat.';
        barEl.style.background = 'var(--fme-danger, #e74c3c)';
        closeBtn.disabled = false;
        return;
      }

      barEl.style.width = '100%';

      const errInfo = result.errors && result.errors.length
        ? ` (${result.errors.length} template-uri au esuat)`
        : '';
      addStep(`\u2713 ${result.installed} template-uri instalate${errInfo}`, false);
      addStep('\u2713 Se deschide tabul forum\u2026', false);

      statusEl.textContent =
        `Preview activ: ${result.installed} template-uri${errInfo}. Se restaureaza automat in 5 min.`;
      closeBtn.disabled = false;
    })();
  }

  // ─── Install progress modal ──────────────────────────────────────────────────

  /**
   * Shows a step-by-step install progress modal replacing the modal body.
   * Installs CSS first, then templates one by one, then plugins.
   */
  function showInstallProgressModal(theme, manifest, vars, installBtn) {
    if (!_modal) return;

    const modalEl = _modal.querySelector('.fme-modal');
    if (!modalEl) return;

    const header = modalEl.querySelector('.fme-modal-header .fme-modal-title');
    if (header) header.textContent = `Instalare: ${manifest.name || theme.name}`;

    const body = modalEl.querySelector('.fme-modal-body');
    const tplFiles    = manifest.files?.templates || [];
    const pluginFiles = manifest.files?.plugins   || [];
    const cssFiles    = manifest.files?.css        || [];
    const tid         = FMEForumAPI.getTid();

    // Total steps: 1 (CSS) + templates + plugins
    const totalSteps = 1 + tplFiles.length + pluginFiles.length;

    body.innerHTML = `
      <div id="fme-install-progress-wrap" style="padding:8px 0;">
        <div id="fme-install-progress-steps" style="font-size:12px;line-height:1.8;color:var(--fme-text, #555);min-height:120px;max-height:300px;overflow-y:auto;margin-bottom:12px;"></div>
        <div id="fme-install-progress-bar-wrap"
             style="background:var(--fme-surface, #e8e8e8);border:1px solid var(--fme-border, #dcdcdc);border-radius:4px;height:8px;overflow:hidden;margin-bottom:12px;">
          <div id="fme-install-progress-bar"
               style="background:var(--fme-success, #27ae60);height:100%;width:0%;transition:width 0.3s;"></div>
        </div>
        <div id="fme-install-progress-status" style="font-size:12px;color:var(--fme-success, #27ae60);font-weight:600;min-height:20px;"></div>
        <div style="margin-top:14px;">
          <input type="button" id="fme-install-progress-close" value="Inchide" disabled />
        </div>
      </div>
    `;

    const stepsEl  = body.querySelector('#fme-install-progress-steps');
    const barEl    = body.querySelector('#fme-install-progress-bar');
    const statusEl = body.querySelector('#fme-install-progress-status');
    const closeBtn = body.querySelector('#fme-install-progress-close');

    let stepsDone = 0;

    function addStep(msg, type) {
      const line = document.createElement('div');
      const colors = {
        error: 'var(--fme-danger, #e74c3c)',
        success: 'var(--fme-success, #27ae60)',
        info: 'var(--fme-text, #555)'
      };
      line.style.cssText = `color:${colors[type] || colors.info};padding:1px 0;`;
      line.textContent = msg;
      stepsEl.appendChild(line);
      stepsEl.scrollTop = stepsEl.scrollHeight;
    }

    function advance() {
      stepsDone++;
      barEl.style.width = Math.min(100, Math.round((stepsDone / totalSteps) * 100)) + '%';
    }

    closeBtn.addEventListener('click', () => {
      closeModal();
      // Re-render table to reflect newly installed state
      _installedThemes && renderTable(_container.querySelector('.fme-themes-wrapper') || _container);
    });

    // Run install steps async
    (async () => {
      let cssOk = false;
      let tplInstalled = 0;
      let tplErrors = [];

      // ── Step 1: CSS ─────────────────────────────────────────────────────────
      addStep('◆ Pas 1: Instalare CSS\u2026', 'info');

      try {
        const result = await handleInstall(theme, manifest, vars);
        advance();

        if (result.type === 'success') {
          addStep('  ✓ CSS instalat cu succes.', 'success');
          cssOk = true;
        } else {
          addStep('  ✗ ' + result.message, 'error');
        }
      } catch (err) {
        advance();
        addStep('  ✗ Eroare CSS: ' + err.message, 'error');
      }

      // ── Step 2: Templates ────────────────────────────────────────────────────
      if (cssOk && tplFiles.length > 0 && tid) {
        addStep(`◆ Pas 2: Instalare template-uri (${tplFiles.length})\u2026`, 'info');

        for (const tpl of tplFiles) {
          const label = tpl.label || tpl.id || tpl.file;
          addStep(`  ⏳ Template: ${label}\u2026`, 'info');

          try {
            const themePath = (theme.path || manifest.path || '').replace(/\/$/, '');

            // Fetch HTML from GitHub
            const htmlContent = await FMEGitHub.fetchRaw(
              _settings.themesOwner, _settings.themesRepo,
              `${themePath}/${tpl.file}`, 'main', _settings.githubToken || null
            );

            // Find edit URL on forum ACP
            const editUrl = await FMEForumAPI.findTemplateEditUrl(tid, tpl.id, tpl.category || 'main', tpl.label || null);
            if (!editUrl) throw new Error('Template negasit in ACP');

            // Load form data
            const formData = await FMEForumAPI.loadTemplateContent(editUrl);

            // Strip old marker + append new
            const cleanContent = stripFmeMarker(htmlContent);
            const markedContent = cleanContent + '\n' + buildFmeMarker(manifest.name || 'unknown', manifest.version || '1.0.0');

            // Save
            await FMEForumAPI.saveTemplate(
              formData.formAction, formData.hiddenFields,
              formData.textareaName, markedContent, formData.submitField
            );

            tplInstalled++;
            addStep(`  ✓ ${label}`, 'success');
          } catch (err) {
            tplErrors.push({ id: label, error: err.message });
            addStep(`  ✗ ${label}: ${err.message}`, 'error');
          }

          advance();
        }
      } else if (tplFiles.length > 0 && !tid) {
        addStep('◆ Template-uri: skip (tid nedisponibil)', 'error');
        tplFiles.forEach(() => advance());
      } else if (tplFiles.length > 0 && !cssOk) {
        addStep('◆ Template-uri: skip (CSS a esuat)', 'error');
        tplFiles.forEach(() => advance());
      }

      // ── Step 3: Plugins ──────────────────────────────────────────────────────
      if (pluginFiles.length > 0 && tid) {
        addStep(`◆ Pas ${tplFiles.length > 0 ? '3' : '2'}: Instalare plugin-uri (${pluginFiles.length})\u2026`, 'info');

        for (const p of pluginFiles) {
          const plabel = p.label || p.id || p.file;
          addStep(`  ⏳ Plugin: ${plabel}\u2026`, 'info');

          try {
            const themePath = (theme.path || manifest.path || '').replace(/\/$/, '');

            // Fetch JS code from GitHub
            const jsCode = await FMEGitHub.fetchRaw(
              _settings.themesOwner, _settings.themesRepo,
              `${themePath}/${p.file}`, 'main', _settings.githubToken || null
            );

            // Save via JS module system
            const placement = p.placement || 'all';
            const saved = await FMEForumAPI.saveJsPlugin(tid, jsCode, placement, true);

            if (saved) {
              addStep(`  ✓ ${plabel}`, 'success');
            } else {
              addStep(`  ⚠ ${plabel} (salvat local, activare manuală din Plugins)`, 'info');
            }
          } catch (err) {
            addStep(`  ⚠ ${plabel}: ${err.message} (se poate activa manual din Plugins)`, 'info');
          }

          advance();
        }
      } else if (pluginFiles.length > 0) {
        addStep(`◆ Plugin-uri: ${pluginFiles.length} disponibile (se pot activa din tab-ul Plugins)`, 'info');
        pluginFiles.forEach(() => advance());
      }

      // ── Summary ──────────────────────────────────────────────────────────────
      barEl.style.width = '100%';

      _installedThemes = await getInstalledThemes();

      const summaryParts = [];
      if (cssOk)          summaryParts.push('CSS ✓');
      if (tplInstalled)   summaryParts.push(`${tplInstalled}/${tplFiles.length} template-uri ✓`);
      if (tplErrors.length) summaryParts.push(`${tplErrors.length} erori template`);
      if (pluginFiles.length) summaryParts.push(`${pluginFiles.length} plugin-uri`);

      const allOk = cssOk && tplErrors.length === 0;

      if (allOk) {
        statusEl.style.color = '#27ae60';
        statusEl.textContent = 'Instalare completa: ' + summaryParts.join(' | ');
        addStep('✓ Instalare finalizata cu succes!', 'success');
      } else if (cssOk) {
        statusEl.style.color = '#e67e22';
        statusEl.textContent = 'Instalare partiala: ' + summaryParts.join(' | ');
        addStep('⚠ Instalare finalizata cu erori.', 'error');
      } else {
        statusEl.style.color = '#e74c3c';
        statusEl.textContent = 'Instalare esuata.';
        barEl.style.background = '#e74c3c';
        addStep('✗ Instalarea a esuat.', 'error');
      }

      closeBtn.disabled = false;
    })();
  }

  // ─── Preview with templates (Preview C) ──────────────────────────────────────

  /**
   * Full preview: backs up templates, installs new ones, injects CSS, and
   * schedules an automatic restore after 5 minutes.
   * @param {object} theme
   * @param {object} manifest
   * @param {object} [vars={}]
   * @returns {Promise<{ ok: boolean, message?: string, installed?: number, errors?: Array }>}
   */
  async function previewWithTemplates(theme, manifest, vars, progressCb) {
    vars = vars || {};
    progressCb = typeof progressCb === 'function' ? progressCb : () => {};

    if (_previewActive) return { ok: false, message: 'Preview deja activ.' };

    const PREVIEW_DURATION_MS = 5 * 60 * 1000; // 5 minutes
    const tid = FMEForumAPI.getTid();
    if (!tid) return { ok: false, message: 'Nu s-a putut determina tid-ul.' };

    const tplFiles  = manifest.files?.templates || [];
    const cssFiles  = manifest.files?.css        || [];
    const themePath = (theme.path || '').replace(/\/$/, '');

    // Step 1: build CSS text
    let cssText = '';
    if (cssFiles.length > 0) {
      try {
        progressCb('Se incarca fisierele CSS…');
        const cssTexts = await Promise.all(
          cssFiles.map(f => FMEGitHub.fetchRaw(
            _settings.themesOwner, _settings.themesRepo,
            `${themePath}/${f.file}`, 'main', _settings.githubToken || null
          ))
        );
        cssText = cssTexts.join('\n\n');
        if (Object.keys(vars).length) cssText = applyVariables(cssText, vars);
      } catch (err) {
        return { ok: false, message: 'Eroare la incarcarea CSS: ' + err.message };
      }
    }

    // Step 2: backup current templates and install new ones
    const backups = [];
    const errors  = [];

    for (const tpl of tplFiles) {
      try {
        progressCb(`Backup: ${tpl.id || tpl.label}…`);
        const editUrl = await FMEForumAPI.findTemplateEditUrl(tid, tpl.id, tpl.category || 'main', tpl.label || null);
        if (!editUrl) throw new Error('negasit');

        const formData = await FMEForumAPI.loadTemplateContent(editUrl);
        backups.push({
          templateId:      tpl.id,
          formAction:      formData.formAction,
          hiddenFields:    formData.hiddenFields,
          textareaName:    formData.textareaName,
          originalContent: formData.content,
          submitField:     formData.submitField,
        });

        // Fetch new content from GitHub
        progressCb(`Instaleaza: ${tpl.id || tpl.label}…`);
        const newContent = await FMEGitHub.fetchRaw(
          _settings.themesOwner, _settings.themesRepo,
          `${themePath}/${tpl.file}`, 'main', _settings.githubToken || null
        );

        await FMEForumAPI.saveTemplate(
          formData.formAction, formData.hiddenFields,
          formData.textareaName, newContent, formData.submitField
        );
      } catch (err) {
        errors.push({ id: tpl.id, error: err.message });
      }
    }

    // Step 3: save backup to session storage
    const previewData = {
      themeId:   theme.id,
      themeName: manifest.name || theme.name,
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + PREVIEW_DURATION_MS).toISOString(),
      backups,
      cssText,
    };
    await setSessionStorage('fme_preview_active', previewData);
    _previewActive = true;

    // Step 4: show preview banner
    showPreviewBanner(manifest.name || theme.name, PREVIEW_DURATION_MS, () => restoreFromPreview());

    // Step 5: open forum tab with ?tt=1 (templates modified, not published) + inject CSS
    const forumPreviewUrl = window.location.origin + '/?tt=1';
    if (cssText) {
      try { await FMEGitHub.previewOnForum(cssText, PREVIEW_DURATION_MS, forumPreviewUrl); } catch (_) {}
    } else {
      try { window.open(forumPreviewUrl, '_blank'); } catch (_) {}
    }

    // Step 6: auto-restore after duration
    setTimeout(() => restoreFromPreview(), PREVIEW_DURATION_MS);

    return { ok: true, installed: backups.length, errors };
  }

  // ─── Restore from preview ─────────────────────────────────────────────────────

  async function restoreFromPreview() {
    _previewActive = false;
    removePreviewBanner();

    const data = await getSessionStorage('fme_preview_active');
    if (!data || !data.backups) return;

    for (const backup of data.backups) {
      try {
        await FMEForumAPI.saveTemplate(
          backup.formAction, backup.hiddenFields,
          backup.textareaName, backup.originalContent, backup.submitField
        );
      } catch (_) {}
    }

    await setSessionStorage('fme_preview_active', null);
  }

  // ─── Preview banner ───────────────────────────────────────────────────────────

  function showPreviewBanner(themeName, durationMs, onRestore) {
    removePreviewBanner();

    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483640',
      'background:#f39c12', 'color:#fff', 'padding:10px 16px',
      'display:flex', 'align-items:center', 'gap:12px',
      'font-family:sans-serif', 'font-size:13px',
      'box-shadow:0 2px 8px rgba(0,0,0,0.2)',
    ].join(';');

    const countdownId = 'fme-preview-countdown';
    banner.innerHTML = `
      <strong>FME Preview activ:</strong>
      <span>${escHtml(themeName)}</span>
      <span style="opacity:0.8;font-size:12px;">Se restaureaza automat in <span id="${countdownId}">${Math.ceil(durationMs / 1000)}s</span></span>
      <input type="button" id="fme-preview-restore-btn" value="Restaureaza Acum"
        style="margin-left:auto;background:#fff;color:#f39c12;border:none;border-radius:4px;padding:5px 12px;cursor:pointer;font-weight:600;" />
    `;

    document.body.prepend(banner);

    // Countdown timer
    let remaining = Math.ceil(durationMs / 1000);
    const interval = setInterval(() => {
      remaining--;
      const el = document.getElementById(countdownId);
      if (el) el.textContent = remaining + 's';
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    banner.querySelector('#fme-preview-restore-btn').addEventListener('click', () => {
      clearInterval(interval);
      onRestore();
    });
  }

  function removePreviewBanner() {
    document.getElementById(BANNER_ID)?.remove();
  }

  // ─── Preview (CSS only) ───────────────────────────────────────────────────────

  async function handlePreview(wrapper, theme, manifest, vars) {
    vars = vars || {};
    const DURATION = 15000;

    // Use cached CSS if installed and no custom vars
    const cached = _installedThemes[theme.id];
    if (cached && !Object.keys(vars).length) {
      try { await FMEGitHub.previewOnForum(cached.cssText, DURATION); } catch (_) {}
      return;
    }

    // Fetch manifest if not passed
    if (!manifest) {
      try {
        manifest = await FMEGitHub.fetchJSON(
          _settings.themesOwner, _settings.themesRepo,
          theme.manifest || `${(theme.path||'').replace(/\/$/, '')}/manifest.json`,
          'main', _settings.githubToken || null
        );
      } catch (err) {
        return;
      }
    }

    const cssFiles = manifest.files?.css || [];
    if (cssFiles.length === 0) return;

    try {
      const themePath = (theme.path || '').replace(/\/$/, '');
      const cssTexts  = await Promise.all(
        cssFiles.map(f => FMEGitHub.fetchRaw(
          _settings.themesOwner, _settings.themesRepo,
          `${themePath}/${f.file}`, 'main', _settings.githubToken || null
        ))
      );
      let cssText = cssTexts.join('\n\n');
      if (Object.keys(vars).length) cssText = applyVariables(cssText, vars);
      await FMEGitHub.previewOnForum(cssText, DURATION);
    } catch (_) {}
  }

  // ─── CSS injection ────────────────────────────────────────────────────────────

  function injectThemeCSS(themeId, cssText) {
    const id = INJECTED_STYLE_PREFIX + themeId;
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = cssText;
  }

  function removeThemeCSS(themeId) {
    document.getElementById(INJECTED_STYLE_PREFIX + themeId)?.remove();
  }

  async function reapplyInstalledThemes() {
    const installed = await getInstalledThemes();
    Object.values(installed).forEach(t => { if (t.cssText) injectThemeCSS(t.id, t.cssText); });
  }

  // ─── Storage ──────────────────────────────────────────────────────────────────

  function getInstalledThemes() {
    return new Promise(resolve =>
      chrome.storage.local.get({ [STORAGE_KEY]: {} }, d => resolve(d[STORAGE_KEY]))
    );
  }

  function saveInstalledThemes(themes) {
    return new Promise((resolve, reject) =>
      chrome.storage.local.set({ [STORAGE_KEY]: themes }, () =>
        chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve()
      )
    );
  }

  function setSessionStorage(key, value) {
    return new Promise(resolve =>
      chrome.storage.local.set({ [key]: value }, resolve)
    );
  }

  function getSessionStorage(key) {
    return new Promise(resolve =>
      chrome.storage.local.get({ [key]: null }, d => resolve(d ? d[key] : null))
    );
  }

  // ─── Modal helpers ────────────────────────────────────────────────────────────

  function closeModal() {
    if (_modal) { _modal.remove(); _modal = null; }
  }

  function setModalStatus(el, type, msg) {
    if (!el || !msg) { if (el) el.innerHTML = ''; return; }
    const cls = type === 'success' ? 'fme-alert-success' : type === 'error' ? 'fme-alert-error' : 'fme-alert-info';
    el.innerHTML = `<div class="fme-alert ${cls}" style="margin:0;">${escHtml(msg)}</div>`;
  }

  // ─── Custom theme upload + validation ─────────────────────────────────────────

  /**
   * Strict manifest validation rules.
   * Schema can also be fetched from GitHub (themesRepo/schema.json) if available.
   */
  const MANIFEST_SCHEMA = {
    required:     ['author', 'version', 'description', 'files'],
    stringFields: ['author', 'version', 'description', 'name', 'minEngine', 'path'],
    validEngines: ['phpbb3', 'phpbb2', 'prosilver', 'subsilver', 'subsilver2', 'invision', 'punbb', 'mybb'],
    versionRegex: /^\d+\.\d+\.\d+$/,
    filesRequired: ['css'],        // files.css is mandatory
    filesOptional: ['templates', 'js', 'plugins', 'preview'],
    cssFileFields: ['file', 'label'],
    tplFileFields: ['id', 'file'],
    jsFileFields:  ['file', 'label'],
    pluginFields:  ['id'],
  };

  /**
   * Validate a manifest object against the FME schema.
   * @param {object} manifest
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  function validateManifest(manifest) {
    const errors = [];
    const warnings = [];

    if (!manifest || typeof manifest !== 'object') {
      return { valid: false, errors: ['Manifestul nu este un obiect JSON valid.'], warnings: [] };
    }

    // Required fields
    for (const field of MANIFEST_SCHEMA.required) {
      if (manifest[field] === undefined || manifest[field] === null || manifest[field] === '') {
        errors.push(`Câmpul obligatoriu "${field}" lipsește.`);
      }
    }

    // String fields type check
    for (const field of MANIFEST_SCHEMA.stringFields) {
      if (manifest[field] !== undefined && typeof manifest[field] !== 'string') {
        errors.push(`Câmpul "${field}" trebuie să fie string.`);
      }
    }

    // Version format
    if (manifest.version && !MANIFEST_SCHEMA.versionRegex.test(manifest.version)) {
      errors.push(`Versiunea "${manifest.version}" nu e validă (formatul așteptat: X.Y.Z).`);
    }

    // Engine validation
    if (manifest.minEngine) {
      const eng = manifest.minEngine.toLowerCase();
      if (!MANIFEST_SCHEMA.validEngines.includes(eng)) {
        warnings.push(`Engine "${manifest.minEngine}" necunoscut. Acceptate: ${MANIFEST_SCHEMA.validEngines.join(', ')}.`);
      }
    }

    // Tags
    if (manifest.tags !== undefined) {
      if (!Array.isArray(manifest.tags)) {
        errors.push('"tags" trebuie să fie un array de stringuri.');
      } else if (manifest.tags.some(t => typeof t !== 'string')) {
        errors.push('Toate elementele din "tags" trebuie să fie stringuri.');
      }
    }

    // Variables
    if (manifest.variables !== undefined) {
      if (!Array.isArray(manifest.variables)) {
        errors.push('"variables" trebuie să fie un array.');
      } else {
        manifest.variables.forEach((v, i) => {
          if (!v.id) errors.push(`variables[${i}]: lipsește "id".`);
          if (!v.type) warnings.push(`variables[${i}]: lipsește "type" (recomandat: color, text).`);
        });
      }
    }

    // Files validation
    if (manifest.files && typeof manifest.files === 'object') {
      // CSS files (mandatory)
      if (!manifest.files.css || !Array.isArray(manifest.files.css) || manifest.files.css.length === 0) {
        errors.push('"files.css" este obligatoriu și trebuie să conțină cel puțin un fișier.');
      } else {
        manifest.files.css.forEach((f, i) => {
          if (!f.file) errors.push(`files.css[${i}]: lipsește "file".`);
          if (f.file && !/\.(css|scss)$/i.test(f.file)) warnings.push(`files.css[${i}]: "${f.file}" nu pare a fi un fișier CSS.`);
        });
      }

      // Templates
      if (manifest.files.templates) {
        if (!Array.isArray(manifest.files.templates)) {
          errors.push('"files.templates" trebuie să fie un array.');
        } else {
          manifest.files.templates.forEach((f, i) => {
            if (!f.id) errors.push(`files.templates[${i}]: lipsește "id".`);
            if (!f.file) errors.push(`files.templates[${i}]: lipsește "file".`);
          });
        }
      }

      // JS files
      if (manifest.files.js) {
        if (!Array.isArray(manifest.files.js)) {
          errors.push('"files.js" trebuie să fie un array.');
        } else {
          manifest.files.js.forEach((f, i) => {
            if (!f.file) errors.push(`files.js[${i}]: lipsește "file".`);
          });
        }
      }

      // Plugins
      if (manifest.files.plugins) {
        if (!Array.isArray(manifest.files.plugins)) {
          errors.push('"files.plugins" trebuie să fie un array.');
        } else {
          manifest.files.plugins.forEach((f, i) => {
            if (!f.id) errors.push(`files.plugins[${i}]: lipsește "id".`);
          });
        }
      }

      // Preview
      if (manifest.files.preview && typeof manifest.files.preview !== 'object') {
        warnings.push('"files.preview" ar trebui să fie un obiect cu "screenshot".'); 
      }

      // Unknown keys in files
      const knownFileKeys = new Set([...MANIFEST_SCHEMA.filesRequired, ...MANIFEST_SCHEMA.filesOptional]);
      Object.keys(manifest.files).forEach(k => {
        if (!knownFileKeys.has(k)) warnings.push(`files: cheie necunoscută "${k}".`);
      });
    } else if (manifest.files !== undefined) {
      errors.push('"files" trebuie să fie un obiect.');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Handle custom theme upload (manifest.json file).
   */
  async function handleCustomUpload(file, wrapper) {
    const statusEl     = wrapper.querySelector('#fme-upload-theme-status');
    const validArea    = wrapper.querySelector('#fme-upload-validation-area');
    statusEl.style.color = '#555';
    statusEl.textContent = 'Se citește fișierul...';
    validArea.style.display = 'none';
    validArea.innerHTML = '';

    let manifest;
    try {
      const text = await file.text();
      manifest = JSON.parse(text);
    } catch (err) {
      statusEl.style.color = '#e74c3c';
      statusEl.textContent = 'JSON invalid: ' + err.message;
      return;
    }

    // Validate
    const result = validateManifest(manifest);

    // Try to also fetch remote schema for additional checks
    let remoteSchema = null;
    try {
      if (_settings) {
        remoteSchema = await FMEGitHub.fetchJSON(
          _settings.themesOwner, _settings.themesRepo,
          'schema.json', 'main', _settings.githubToken || null
        );
      }
    } catch (_) { /* no remote schema available, that's ok */ }

    if (remoteSchema && remoteSchema.requiredFields) {
      for (const field of remoteSchema.requiredFields) {
        if (!manifest[field]) {
          result.errors.push(`Schema remotă: câmpul "${field}" este obligatoriu.`);
          result.valid = false;
        }
      }
    }

    // Render validation results
    validArea.style.display = 'block';

    if (result.valid) {
      statusEl.style.color = '#27ae60';
      statusEl.textContent = '✓ Manifest valid!';

      const cssCount = (manifest.files?.css || []).length;
      const tplCount = (manifest.files?.templates || []).length;
      const jsCount  = (manifest.files?.js || []).length;
      const plgCount = (manifest.files?.plugins || []).length;

      let warningsHtml = '';
      if (result.warnings.length > 0) {
        warningsHtml = `
          <div class="fme-alert fme-alert-info" style="margin-top:8px;font-size:11px;">
            <strong>Atenționări:</strong>
            <ul style="margin:4px 0 0 16px;padding:0;">${result.warnings.map(w => `<li>${escHtml(w)}</li>`).join('')}</ul>
          </div>
        `;
      }

      validArea.innerHTML = `
        <div class="fme-alert fme-alert-success" style="margin:0;">
          <strong>✓ Manifestul "${escHtml(manifest.name || manifest.author || '?')}" este valid!</strong>
        </div>
        <table class="forumline" width="100%" cellspacing="1" cellpadding="4" style="margin-top:8px;">
          <tr class="row1"><td style="width:120px;font-weight:600;">Nume</td><td>${escHtml(manifest.name || '—')}</td></tr>
          <tr class="row2"><td style="font-weight:600;">Autor</td><td>${escHtml(manifest.author || '—')}</td></tr>
          <tr class="row1"><td style="font-weight:600;">Versiune</td><td>${escHtml(manifest.version || '—')}</td></tr>
          <tr class="row2"><td style="font-weight:600;">Engine</td><td>${escHtml(manifest.minEngine || 'Orice')}</td></tr>
          <tr class="row1"><td style="font-weight:600;">Componente</td>
            <td>${cssCount} CSS, ${tplCount} TPL, ${jsCount} JS, ${plgCount} Plugins</td>
          </tr>
          <tr class="row2"><td style="font-weight:600;">Descriere</td><td>${escHtml(manifest.description || '—')}</td></tr>
        </table>
        ${warningsHtml}
        <div style="margin-top:10px;">
          <input type="button" id="fme-upload-install-btn" value="Instalează tema" class="icon_ok" />
          <span id="fme-upload-install-status" style="font-size:11px;margin-left:8px;"></span>
        </div>
      `;

      // Wire install button
      validArea.querySelector('#fme-upload-install-btn').addEventListener('click', async () => {
        const btn = validArea.querySelector('#fme-upload-install-btn');
        const iStatus = validArea.querySelector('#fme-upload-install-status');
        btn.disabled = true;
        btn.value = 'Se instalează...';
        iStatus.textContent = '';

        try {
          await installCustomTheme(manifest, wrapper);
          iStatus.style.color = '#27ae60';
          iStatus.textContent = '✓ Tema a fost instalată local!';
          btn.value = 'Instalată!';
        } catch (err) {
          iStatus.style.color = '#e74c3c';
          iStatus.textContent = 'Eroare: ' + err.message;
          btn.value = 'Instalează tema';
          btn.disabled = false;
        }
      });
    } else {
      statusEl.style.color = '#e74c3c';
      statusEl.textContent = `✗ ${result.errors.length} erori găsite.`;

      validArea.innerHTML = `
        <div class="fme-alert fme-alert-error" style="margin:0;">
          <strong>Manifestul nu este valid.</strong> Corectează erorile de mai jos:
          <ul style="margin:6px 0 0 16px;padding:0;">
            ${result.errors.map(e => `<li>${escHtml(e)}</li>`).join('')}
          </ul>
        </div>
        ${result.warnings.length > 0 ? `
          <div class="fme-alert fme-alert-info" style="margin-top:8px;font-size:11px;">
            <strong>Atenționări:</strong>
            <ul style="margin:4px 0 0 16px;padding:0;">${result.warnings.map(w => `<li>${escHtml(w)}</li>`).join('')}</ul>
          </div>
        ` : ''}
        <div style="margin-top:8px;padding:8px 10px;background:#fff8f0;border:1px solid #f0c78a;border-radius:4px;font-size:11px;color:#8a6d3b;">
          <strong>Model manifest.json corect:</strong><br>
          <pre style="margin-top:6px;font-family:Consolas,monospace;font-size:11px;background:#fafafa;padding:8px;border-radius:3px;overflow-x:auto;">{
  "name": "Numele Temei",
  "author": "AutorulTău",
  "version": "1.0.0",
  "description": "Descriere scurtă a temei",
  "minEngine": "phpbb3",
  "tags": ["dark", "modern"],
  "files": {
    "css": [{ "file": "style.css", "label": "Stiluri principale" }],
    "templates": [{ "id": "overall_header", "file": "tpl/header.html", "category": "main", "label": "Header" }],
    "plugins": [{ "id": "my-plugin", "label": "Plugin-ul meu", "file": "plugins/my-plugin.js" }],
    "preview": { "screenshot": "preview.png" }
  },
  "variables": [{ "id": "accent-color", "type": "color", "label": "Culoare accent", "default": "#6c63ff" }]
}</pre>
        </div>
      `;
    }
  }

  /**
   * Install a custom theme from a locally validated manifest.
   * Only CSS inline content is supported for local themes (no GitHub fetch).
   * For full themes with files, the user must host on GitHub.
   */
  async function installCustomTheme(manifest, wrapper) {
    const themeId = 'custom-' + (manifest.name || 'theme').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);

    // For a local manifest, we can't fetch CSS files from GitHub.
    // Check if CSS is provided inline or as data URIs.
    const cssFiles = manifest.files?.css || [];
    if (cssFiles.length === 0) throw new Error('Niciun fișier CSS definit.');

    // Try to fetch CSS from the themes repo if a path is specified
    let cssText = '';
    const themePath = (manifest.path || '').replace(/\/$/, '');

    if (themePath && _settings) {
      // Theme has a path — try fetching from GitHub
      try {
        const cssTexts = await Promise.all(
          cssFiles.map(f => FMEGitHub.fetchRaw(
            _settings.themesOwner, _settings.themesRepo,
            `${themePath}/${f.file}`, 'main', _settings.githubToken || null
          ))
        );
        cssText = cssTexts.join('\n\n');
      } catch (err) {
        throw new Error(`Nu s-au putut încărca fișierele CSS de pe GitHub: ${err.message}. Asigură-te că fișierele există la calea "${themePath}" în repo-ul de teme.`);
      }
    } else {
      // No path — check for inline CSS content in the manifest
      if (cssFiles[0].content) {
        cssText = cssFiles.map(f => f.content || '').join('\n\n');
      } else {
        throw new Error('Tema nu are "path" setat și nici CSS inline. Setează "path" în manifest pentru a încărca de pe GitHub, sau adaugă "content" în files.css[].');
      }
    }

    // Apply variables
    const vars = {};
    (manifest.variables || []).forEach(v => { vars[v.id] = v.default || ''; });
    if (Object.keys(vars).length) cssText = applyVariables(cssText, vars);

    // Inject and save
    injectThemeCSS(themeId, cssText);

    const tplFiles = manifest.files?.templates || [];
    _installedThemes[themeId] = {
      id:          themeId,
      name:        manifest.name || 'Temă proprie',
      cssText,
      version:     manifest.version || '1.0.0',
      installedAt: new Date().toISOString(),
      templates:   tplFiles.map(t => ({ id: t.id, category: t.category || 'main', label: t.label || t.id })),
      plugins:     (manifest.files?.plugins || []).map(p => ({ id: p.id, label: p.label || p.id })),
      custom:      true,
      path:        themePath || null,
    };
    await saveInstalledThemes(_installedThemes);

    if (typeof FMEActivityLog !== 'undefined') {
      FMEActivityLog.log('theme-install', 'Temă proprie instalată: ' + (manifest.name || themeId));
    }

    // Rebuild table
    renderTable(_container.querySelector('.fme-themes-wrapper') || _container);
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { render, reapplyInstalledThemes, parseFmeMarker, stripFmeMarker, FME_MARKER_PREFIX, getInstalledThemes };
})();
