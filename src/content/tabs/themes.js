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
    invision: 'Invision Community',
    phpbb3:   'phpBB3',
    phpbb2:   'phpBB2',
    punbb:    'PunBB',
    mybb:     'MyBB',
  };

  const BANNER_ID = 'fme-preview-banner';

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
      <div class="panel-menu" style="margin:0!important;background:#fff!important;border:1px solid #cdcdcd!important;padding:0 0 10px 0!important;">
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
          <td style="color:#666;">${escHtml(theme.author || '—')}</td>
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
            <tr><td style="color:#666;width:80px;">Autor</td><td><strong>${escHtml(manifest.author||theme.author||'—')}</strong></td></tr>
            <tr><td style="color:#666;">Versiune</td><td><span class="fme-badge fme-badge-version">v${escHtml(manifest.version||theme.version||'1.0.0')}</span></td></tr>
            <tr><td style="color:#666;">Engine</td><td>${escHtml(manifest.minEngine||theme.minEngine||'—')}</td></tr>
            <tr><td style="color:#666;">Tags</td><td>${(manifest.tags||theme.tags||[]).map(t=>`<span class="fme-tag">${escHtml(t)}</span>`).join(' ')}</td></tr>
          </table>
          <p style="font-size:12px;color:#555;line-height:1.5;">${escHtml(manifest.description||theme.description||'')}</p>
        </div>
      </div>

      <fieldset style="margin-top:12px;">
        <legend>Compatibilitate</legend>
        <table style="width:100%;font-size:12px;padding:4px 0;">
          <tr>
            <td style="color:#666;width:150px;padding:3px 0;">Versiune forum</td>
            <td id="fme-compat-current"><span style="color:#999;">Se verifica&hellip;</span></td>
          </tr>
          <tr>
            <td style="color:#666;padding:3px 0;">Ceruta de tema</td>
            <td>${escHtml(manifest.minEngine || theme.minEngine || '—')}</td>
          </tr>
          <tr>
            <td style="color:#666;padding:3px 0;">Status</td>
            <td id="fme-compat-status"><span style="color:#999;">Se verifica&hellip;</span></td>
          </tr>
        </table>
      </fieldset>

      <fieldset style="margin-top:12px;">
        <legend>Componente incluse</legend>
        <table class="fme-table" style="margin:8px 0 4px;">
          <thead><tr><th style="width:60px;">Tip</th><th>Fisier</th><th style="width:140px;">Status</th></tr></thead>
          <tbody>${componentRows || '<tr><td colspan="3" style="color:#999;text-align:center;padding:8px;">Nicio componenta gasita</td></tr>'}</tbody>
        </table>
      </fieldset>

      ${varHtml}

      <div id="fme-install-status" style="min-height:24px;margin-top:10px;"></div>
      <div id="fme-install-progress" style="display:none;font-size:12px;color:#555;margin-top:6px;padding:6px 8px;background:#f8f8f8;border:1px solid #e0e0e0;border-radius:3px;"></div>

      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
        ${installed
          ? `<input type="button" id="fme-modal-uninstall-btn" value="Dezinstaleaza" />
             <input type="button" id="fme-modal-reinstall-btn" value="Reinstaleaza CSS" style="margin-left:4px;" />`
          : `<input type="button" id="fme-modal-install-btn" value="Instaleaza CSS" />`
        }
        <input type="button" id="fme-modal-preview-btn" value="${escHtml(previewBtnLabel)}" />
        <input type="button" id="fme-modal-cancel-btn" value="Inchide" />
      </div>
    `;

    // Wire buttons
    const statusEl   = content.querySelector('#fme-install-status');
    const progressEl = content.querySelector('#fme-install-progress');

    content.querySelector('#fme-modal-install-btn,#fme-modal-reinstall-btn')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      e.target.value = 'Se instaleaza...';
      statusEl.innerHTML = '';
      progressEl.style.display = 'none';

      const vars = getVariableValues(content);

      // Install CSS
      const result = await handleInstall(theme, manifest, vars);
      setModalStatus(statusEl, result.type, result.message);

      // Install templates if CSS succeeded and templates exist
      if (result.type === 'success' && tplFiles.length > 0 && tid) {
        progressEl.style.display = 'block';
        progressEl.textContent = 'Se instaleaza template-urile...';

        const tplResult = await installTemplates(manifest, tid, (msg) => {
          progressEl.textContent = msg;
        });

        if (tplResult.errors.length > 0) {
          const errMsg = tplResult.errors.map(e => `${e.id}: ${e.error}`).join('; ');
          progressEl.textContent = `Template-uri instalate: ${tplResult.installed}/${tplFiles.length}. Erori: ${errMsg}`;
        } else {
          progressEl.textContent = `Template-uri instalate: ${tplResult.installed}/${tplFiles.length}`;
        }
      }

      if (result.type === 'success') {
        _installedThemes = await getInstalledThemes();
        renderTable(_container.querySelector('.fme-themes-wrapper') || _container);
        e.target.value = 'Instalata!';
        setTimeout(() => { e.target.value = 'Reinstaleaza CSS'; e.target.disabled = false; }, 2500);
      } else {
        e.target.value = 'Instaleaza CSS';
        e.target.disabled = false;
      }
    });

    content.querySelector('#fme-modal-uninstall-btn')?.addEventListener('click', async () => {
      await handleUninstall(theme.id);
      _installedThemes = await getInstalledThemes();
      renderTable(_container.querySelector('.fme-themes-wrapper') || _container);
      setModalStatus(statusEl, 'success', 'Tema dezinstalata.');
    });

    content.querySelector('#fme-modal-preview-btn').addEventListener('click', async () => {
      const btn = content.querySelector('#fme-modal-preview-btn');
      btn.disabled = true;
      btn.value = 'Se deschide...';
      statusEl.innerHTML = '';
      progressEl.style.display = 'none';

      const vars = getVariableValues(content);

      if (hasTemplates && tid) {
        // Full preview: CSS + templates
        const result = await previewWithTemplates(theme, manifest, vars);
        if (result.ok) {
          const errInfo = result.errors && result.errors.length
            ? ` (${result.errors.length} template-uri au esuat)`
            : '';
          setModalStatus(statusEl, 'success', `Preview activ: ${result.installed} template-uri instalate${errInfo}. Se restaureaza automat in 5 min.`);
        } else {
          setModalStatus(statusEl, 'error', result.message || 'Eroare la preview.');
        }
      } else {
        // Basic CSS-only preview
        await handlePreview(null, theme, manifest, vars);
        setModalStatus(statusEl, 'success', 'Preview deschis in tab nou (15s).');
      }

      btn.value = previewBtnLabel;
      btn.disabled = false;
    });

    content.querySelector('#fme-modal-cancel-btn').addEventListener('click', closeModal);

    // Async: populate compatibility fieldset
    const requiredEngine = manifest.minEngine || theme.minEngine || '';
    detectForumEngine().then(detected => {
      const currentEl = content.querySelector('#fme-compat-current');
      const statusEl2 = content.querySelector('#fme-compat-status');
      if (!currentEl || !statusEl2) return; // modal closed

      if (!detected) {
        currentEl.innerHTML = '<span style="color:#999;">Nedeterminata</span>';
        statusEl2.innerHTML = '<span style="color:#999;">—</span>';
        return;
      }

      const label = ENGINE_LABELS[detected] || detected;
      currentEl.textContent = label;

      if (!requiredEngine) {
        statusEl2.innerHTML = '<span style="color:#999;">Nicio restrictie</span>';
        return;
      }

      const ok = engineCompatible(detected, requiredEngine);
      if (ok) {
        statusEl2.innerHTML = '<span style="color:#27ae60;font-weight:600;">&#x2713; Compatibil</span>';
      } else {
        statusEl2.innerHTML = `
          <span style="color:#e74c3c;font-weight:600;">&#x2717; Incompatibil</span>
          <span style="color:#999;font-size:11px;margin-left:6px;">
            (forum: ${escHtml(label)}, cerut: ${escHtml(requiredEngine)})
          </span>`;
        // Warn on install button
        const installBtn = content.querySelector('#fme-modal-install-btn,#fme-modal-reinstall-btn');
        if (installBtn) {
          installBtn.title = 'Atentie: tema poate sa nu fie compatibila cu platforma forumului tau.';
          installBtn.style.borderColor = '#e67e22';
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
    const d = norm(detected), r = norm(required);
    return d === r || d.startsWith(r) || r.startsWith(d);
  }

  // ─── Component rows (collapsed if > INLINE_LIMIT) ────────────────────────────

  const INLINE_LIMIT = 3;

  function buildComponentRows(files, type, color, labelFn, statusText, statusStyle) {
    if (files.length === 0) return [];

    if (files.length <= INLINE_LIMIT) {
      return files.map(f => `
        <tr>
          <td><span class="fme-badge" style="background:${color};color:#fff;">${type}</span></td>
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
        <td><span class="fme-badge" style="background:${color};color:#fff;">${type}</span></td>
        <td>
          <strong>${files.length} fisiere</strong>
          ${modeLabel ? `<span style="color:#999;font-size:11px;margin-left:6px;">(${modeLabel})</span>` : ''}
          &nbsp;<a href="#" style="font-size:11px;" onclick="
            var d=document.getElementById('${detailId}');
            d.style.display=d.style.display==='none'?'':'none';
            this.textContent=d.style.display===''?'&#x25B2; ascunde':'&#x25BC; detalii';
            return false;
          ">&#x25BC; detalii</a>
          <div id="${detailId}" style="display:none;margin-top:6px;font-size:11px;color:#555;">
            ${files.map(f => `<div style="padding:2px 0;border-bottom:1px solid #f0f0f0;">${escHtml(labelFn(f))}</div>`).join('')}
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
            style="width:36px;height:28px;border:1px solid #ccc;border-radius:3px;cursor:pointer;" />
          <label for="fme-var-${escHtml(v.id)}" style="font-size:12px;">${escHtml(v.label||v.id)}</label>
        </div>`;
    }
    return `
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="text" id="fme-var-${escHtml(v.id)}" value="${escHtml(v.default||'')}"
          style="width:80px;border:1px solid #ccc;border-radius:3px;padding:3px 6px;font-size:12px;" />
        <label for="fme-var-${escHtml(v.id)}" style="font-size:12px;">${escHtml(v.label||v.id)}</label>
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

      _installedThemes[theme.id] = {
        id: theme.id,
        name: manifest.name || theme.name,
        cssText,
        version: manifest.version || theme.version || '1.0.0',
        installedAt: new Date().toISOString()
      };
      await saveInstalledThemes(_installedThemes);
      return { type: 'success', message: `"${manifest.name || theme.name}" instalata cu succes!` };
    } catch (err) {
      return { type: 'error', message: 'Eroare: ' + err.message };
    }
  }

  async function handleUninstall(themeId) {
    removeThemeCSS(themeId);
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
  async function installTemplates(manifest, tid, progressCb) {
    const tplFiles = manifest.files?.templates || [];
    if (tplFiles.length === 0) return { installed: 0, errors: [] };

    const errors    = [];
    let   installed = 0;
    const themePath = (manifest.path || '').replace(/\/$/, '');

    for (const tpl of tplFiles) {
      try {
        progressCb?.(`Template: ${tpl.id || tpl.label}\u2026`);

        // 1. Fetch HTML content from GitHub
        const htmlContent = await FMEGitHub.fetchRaw(
          _settings.themesOwner, _settings.themesRepo,
          `${themePath}/${tpl.file}`, 'main', _settings.githubToken || null
        );

        // 2. Find the edit URL on the forum
        const editUrl = await FMEForumAPI.findTemplateEditUrl(tid, tpl.id, tpl.category || null);
        if (!editUrl) throw new Error(`Template ${tpl.id} negasit`);

        // 3. Load form data
        const formData = await FMEForumAPI.loadTemplateContent(editUrl);

        // 4. Save
        await FMEForumAPI.saveTemplate(
          formData.formAction, formData.hiddenFields,
          formData.textareaName, htmlContent, formData.submitField
        );

        installed++;
      } catch (err) {
        errors.push({ id: tpl.id || tpl.label || '?', error: err.message });
      }
    }

    return { installed, errors };
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
  async function previewWithTemplates(theme, manifest, vars) {
    vars = vars || {};

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
        const editUrl = await FMEForumAPI.findTemplateEditUrl(tid, tpl.id, tpl.category || null);
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

    // Step 5: open forum tab with CSS
    if (cssText) {
      try { await FMEGitHub.previewOnForum(cssText, PREVIEW_DURATION_MS); } catch (_) {}
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
      chrome.storage.session.set({ [key]: value }, resolve)
    );
  }

  function getSessionStorage(key) {
    return new Promise(resolve =>
      chrome.storage.session.get({ [key]: null }, d => resolve(d[key]))
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

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { render, reapplyInstalledThemes };
})();
