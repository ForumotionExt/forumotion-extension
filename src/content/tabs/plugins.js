/**
 * FME Plugins Tab
 * Manage plugins bundled with installed themes (custom chatbox, popups,
 * notification boxes, etc.). Plugins are JS code fetched from the themes
 * repo and executed on forum pages via forum-injector.js.
 *
 * Similar to widgets but tied to themes — each plugin has a theme origin.
 *
 * Plugin structure:
 *   { id, themeId, name, description, code, enabled, version, installedAt }
 *
 * Storage key: fme_plugins
 */

var FMEPluginsTab = (() => {
  'use strict';

  const STORAGE_KEY = 'fme_plugins';

  let _container = null;
  let _plugins   = [];        // installed plugins (from storage)
  let _catalog   = [];        // available plugins from all installed themes
  let _settings  = null;
  let _installedThemes = {};

  // ─── Public API ──────────────────────────────────────────────────────────────

  async function render(container) {
    _container = container;
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'fme-plugins-wrapper main-content';
    wrapper.id = 'main-content';
    wrapper.style.fontSize = '12px';

    wrapper.innerHTML = `
      <div class="fme-section-header">
        <h2 class="fme-section-title">FME</h2>
        <ul class="h2-breadcrumb clearfix"><li class="first">Plugins</li></ul>
        <blockquote class="block_left">
          <p class="explain">
            Plugin-urile extind funcționalitatea temelor tale — chatbox custom, popup-uri,
            notificări, și altele. Instalează-le din temele FME sau din catalogul disponibil.
          </p>
        </blockquote>
      </div>

      <fieldset class="fieldset_left">
        <legend>Plugin-uri instalate</legend>
        <div id="fme-plugins-installed-area">
          <div class="fme-loading">
            <div class="fme-spinner"></div>
            <span>Se încarcă plugin-urile...</span>
          </div>
        </div>
      </fieldset>

      <fieldset class="fieldset_left" style="margin-top:14px;">
        <legend>Catalog plugin-uri disponibile</legend>
        <div class="fme-toolbar" style="margin-bottom:8px;">
          <input type="button" id="fme-plugins-refresh" value="Reîncarcă" title="Reîncarcă catalogul din teme" />
        </div>
        <div id="fme-plugins-catalog-area">
          <div class="fme-loading">
            <div class="fme-spinner"></div>
            <span>Se scanează temele instalate...</span>
          </div>
        </div>
      </fieldset>

      <fieldset class="fieldset_left" style="margin-top:14px;">
        <legend>Despre plugin-uri</legend>
        <div style="padding:8px 10px;font-size:11px;color:#555;line-height:1.6;">
          <p><strong>Ce sunt plugin-urile?</strong><br>
          Plugin-urile sunt scripturi JS incluse în temele FME care adaugă funcționalitate suplimentară:
          chatbox personalizat, popup-uri, notificări, efecte vizuale, etc.</p>
          <p><strong>Cum funcționează?</strong><br>
          Plugin-urile activate sunt executate automat pe paginile forumului (non-ACP) de către <em>Forum Injector</em>.
          Poți activa/dezactiva fiecare plugin individual.</p>
          <p><strong>Siguranță</strong><br>
          Plugin-urile sunt încărcate doar din repo-ul oficial de teme FME. Codul este vizibil și poate fi inspectat.</p>
        </div>
      </fieldset>
    `;

    container.appendChild(wrapper);

    wrapper.querySelector('#fme-plugins-refresh').addEventListener('click', () => loadAll(wrapper));

    await loadAll(wrapper);
  }

  // ─── Data loading ────────────────────────────────────────────────────────────

  async function loadAll(wrapper) {
    try {
      _settings = await FMEGitHub.getSettings();
      _plugins  = await getPlugins();
      _installedThemes = await getInstalledThemes();
      _catalog  = await buildCatalog();

      renderInstalled(wrapper);
      renderCatalog(wrapper);
    } catch (err) {
      const area = wrapper.querySelector('#fme-plugins-installed-area');
      area.innerHTML = `
        <div class="fme-error-state">
          <p class="fme-error-title">Eroare la încărcare</p>
          <p class="fme-error-msg">${escHtml(err.message)}</p>
        </div>
      `;
    }
  }

  /**
   * Build catalog of available plugins from all installed themes.
   * For each theme with plugins in its manifest, fetch the manifest to get plugin details.
   */
  async function buildCatalog() {
    const catalog = [];

    for (const theme of Object.values(_installedThemes)) {
      const themePlugins = theme.plugins || [];
      for (const p of themePlugins) {
        const isInstalled = _plugins.some(ip => ip.id === p.id && ip.themeId === theme.id);
        catalog.push({
          id:          p.id,
          label:       p.label || p.id,
          themeId:     theme.id,
          themeName:   theme.name,
          themeVersion: theme.version,
          installed:   isInstalled,
        });
      }
    }

    return catalog;
  }

  // ─── Render installed plugins ────────────────────────────────────────────────

  function renderInstalled(wrapper) {
    const area = wrapper.querySelector('#fme-plugins-installed-area');

    if (_plugins.length === 0) {
      area.innerHTML = `
        <div class="fme-empty" style="padding:12px;font-size:12px;color:#666;">
          Niciun plugin instalat. Instalează plugin-uri din catalogul de mai jos.
        </div>
      `;
      return;
    }

    let rowsHtml = '';
    _plugins.forEach((plugin, idx) => {
      const statusBadge = plugin.enabled
        ? '<span class="fme-badge fme-badge-installed">Activ</span>'
        : '<span class="fme-badge" style="background:#999;color:#fff;">Inactiv</span>';

      rowsHtml += `
        <tr class="${idx % 2 === 0 ? 'row1' : 'row2'}">
          <td style="font-weight:600;">${escHtml(plugin.name)}</td>
          <td style="font-size:11px;color:#555;">${escHtml(plugin.description || '—')}</td>
          <td style="font-size:11px;">
            <span class="fme-badge fme-badge-version" style="font-size:10px;">
              ${escHtml(plugin.themeName || plugin.themeId)}
            </span>
          </td>
          <td>${statusBadge}</td>
          <td style="width:180px;text-align:center;">
            <label style="cursor:pointer;font-size:11px;">
              <input type="checkbox" class="fme-plugin-toggle" data-idx="${idx}" ${plugin.enabled ? 'checked' : ''} />
              ${plugin.enabled ? 'Activat' : 'Dezactivat'}
            </label>
            &nbsp;
            <input type="button" class="btn fme-plugin-view-btn" data-idx="${idx}" value="Cod" style="font-size:10px;" />
            &nbsp;
            <input type="button" class="icon_cancel fme-plugin-remove-btn" data-idx="${idx}" value="Șterge" style="font-size:10px;" />
          </td>
        </tr>
      `;
    });

    area.innerHTML = `
      <table class="forumline" width="100%" cellspacing="1" cellpadding="4">
        <tr>
          <th class="thHead">Nume</th>
          <th class="thHead">Descriere</th>
          <th class="thHead" style="width:100px;">Temă</th>
          <th class="thHead" style="width:60px;">Status</th>
          <th class="thHead" style="width:180px;">Acțiuni</th>
        </tr>
        ${rowsHtml}
      </table>
    `;

    // Toggle
    area.querySelectorAll('.fme-plugin-toggle').forEach(cb => {
      cb.addEventListener('change', () => {
        const idx = +cb.dataset.idx;
        _plugins[idx].enabled = cb.checked;
        if (typeof FMEActivityLog !== 'undefined') {
          FMEActivityLog.log('plugin-toggle', (cb.checked ? 'Activat' : 'Dezactivat') + ' plugin: ' + _plugins[idx].name);
        }
        savePlugins(() => renderInstalled(wrapper));
      });
    });

    // View code
    area.querySelectorAll('.fme-plugin-view-btn').forEach(btn => {
      btn.addEventListener('click', () => openCodeModal(_plugins[+btn.dataset.idx]));
    });

    // Remove
    area.querySelectorAll('.fme-plugin-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = +btn.dataset.idx;
        const p = _plugins[idx];
        if (!confirm(`Ștergi plugin-ul "${p.name}"?`)) return;
        if (typeof FMEActivityLog !== 'undefined') {
          FMEActivityLog.log('plugin-delete', 'Șters plugin: ' + p.name);
        }
        _plugins.splice(idx, 1);
        savePlugins(() => {
          renderInstalled(wrapper);
          // Refresh catalog installed status
          _catalog = _catalog.map(c => ({
            ...c,
            installed: _plugins.some(ip => ip.id === c.id && ip.themeId === c.themeId),
          }));
          renderCatalog(wrapper);
        });
      });
    });
  }

  // ─── Render catalog ──────────────────────────────────────────────────────────

  function renderCatalog(wrapper) {
    const area = wrapper.querySelector('#fme-plugins-catalog-area');

    if (_catalog.length === 0) {
      area.innerHTML = `
        <div class="fme-empty" style="padding:12px;font-size:12px;color:#666;">
          Niciun plugin disponibil. Instalează o temă care conține plugin-uri din tab-ul <em>Teme</em>.
        </div>
      `;
      return;
    }

    let rowsHtml = '';
    _catalog.forEach((cat, idx) => {
      const statusHtml = cat.installed
        ? '<span class="fme-badge fme-badge-installed" style="font-size:10px;">Instalat</span>'
        : '<span style="color:#999;font-size:11px;">—</span>';

      rowsHtml += `
        <tr class="${idx % 2 === 0 ? 'row1' : 'row2'}">
          <td style="font-weight:600;">${escHtml(cat.label)}</td>
          <td style="font-size:11px;">
            <span class="fme-badge fme-badge-version" style="font-size:10px;">
              ${escHtml(cat.themeName)} v${escHtml(cat.themeVersion || '?')}
            </span>
          </td>
          <td>${statusHtml}</td>
          <td style="width:100px;text-align:center;">
            ${cat.installed
              ? '<span style="font-size:11px;color:#27ae60;">✓</span>'
              : `<input type="button" class="btn fme-catalog-install-btn" data-cat-idx="${idx}" value="Instalează" />`
            }
          </td>
        </tr>
      `;
    });

    area.innerHTML = `
      <table class="forumline" width="100%" cellspacing="1" cellpadding="4">
        <tr>
          <th class="thHead">Plugin</th>
          <th class="thHead" style="width:140px;">Din tema</th>
          <th class="thHead" style="width:80px;">Status</th>
          <th class="thHead" style="width:100px;">Acțiune</th>
        </tr>
        ${rowsHtml}
      </table>
    `;

    area.querySelectorAll('.fme-catalog-install-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const catItem = _catalog[+btn.dataset.catIdx];
        btn.disabled = true;
        btn.value = 'Se instalează...';
        await installPlugin(catItem, wrapper);
        btn.value = 'Instalează';
        btn.disabled = false;
      });
    });
  }

  // ─── Install plugin from catalog ─────────────────────────────────────────────

  async function installPlugin(catItem, wrapper) {
    try {
      // Fetch theme manifest to get plugin details + code file path
      const theme = _installedThemes[catItem.themeId];
      if (!theme) throw new Error('Tema nu mai este instalată.');

      const themePath = (theme.path || catItem.themeId).replace(/\/$/, '');

      // Fetch manifest from GitHub
      const manifest = await FMEGitHub.fetchJSON(
        _settings.themesOwner, _settings.themesRepo,
        `${themePath}/manifest.json`, 'main', _settings.githubToken || null
      );

      const pluginMeta = (manifest.files?.plugins || []).find(p => p.id === catItem.id);
      if (!pluginMeta) throw new Error(`Plugin "${catItem.id}" nu a fost găsit în manifest.`);

      // Fetch the plugin code file
      const codePath = pluginMeta.file || `plugins/${catItem.id}.js`;
      const code = await FMEGitHub.fetchRaw(
        _settings.themesOwner, _settings.themesRepo,
        `${themePath}/${codePath}`, 'main', _settings.githubToken || null
      );

      const plugin = {
        id:          catItem.id,
        themeId:     catItem.themeId,
        themeName:   catItem.themeName,
        name:        pluginMeta.label || pluginMeta.id,
        description: pluginMeta.description || '',
        code:        code,
        enabled:     true,
        version:     manifest.version || '1.0.0',
        installedAt: new Date().toISOString(),
      };

      _plugins.push(plugin);
      if (typeof FMEActivityLog !== 'undefined') {
        FMEActivityLog.log('plugin-install', 'Plugin instalat: ' + plugin.name + ' (din ' + catItem.themeName + ')');
      }

      await new Promise(r => savePlugins(r));

      // Refresh UI
      _catalog = _catalog.map(c => ({
        ...c,
        installed: _plugins.some(ip => ip.id === c.id && ip.themeId === c.themeId),
      }));
      renderInstalled(wrapper);
      renderCatalog(wrapper);
    } catch (err) {
      alert('Eroare la instalare: ' + err.message);
    }
  }

  // ─── Code viewer modal ───────────────────────────────────────────────────────

  function openCodeModal(plugin) {
    const existing = document.getElementById('fme-plugin-code-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'fme-plugin-code-modal';
    modal.className = 'fme-modal-overlay';
    modal.innerHTML = `
      <div class="fme-modal" style="max-width:760px;max-height:90vh;">
        <div class="fme-modal-header">
          <span class="fme-modal-title">Plugin: ${escHtml(plugin.name)}</span>
          <button class="fme-modal-close" id="fme-plugin-modal-close">&times;</button>
        </div>
        <div class="fme-modal-body" style="padding:14px;">
          <div style="font-size:11px;color:#666;margin-bottom:8px;">
            Temă: <strong>${escHtml(plugin.themeName || plugin.themeId)}</strong>
            &nbsp;|&nbsp; Versiune: ${escHtml(plugin.version || '?')}
            &nbsp;|&nbsp; Instalat: ${new Date(plugin.installedAt).toLocaleDateString('ro-RO')}
          </div>
          <textarea readonly
            style="width:100%;min-height:350px;font-family:Consolas,'Cascadia Code',monospace;font-size:12px;
                   line-height:1.5;padding:10px;border:1px solid var(--fme-border,#ddd);border-radius:4px;background:var(--fme-surface,#fafafa);
                   box-sizing:border-box;resize:vertical;"
          >${escHtml(plugin.code)}</textarea>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#fme-plugin-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  // ─── Storage ─────────────────────────────────────────────────────────────────

  function getPlugins() {
    return new Promise(resolve =>
      chrome.storage.local.get({ [STORAGE_KEY]: [] }, d => resolve(d[STORAGE_KEY] || []))
    );
  }

  function savePlugins(cb) {
    chrome.storage.local.set({ [STORAGE_KEY]: _plugins }, cb || (() => {}));
  }

  function getInstalledThemes() {
    return new Promise(resolve =>
      chrome.storage.local.get({ fme_installed_themes: {} }, d => resolve(d.fme_installed_themes || {}))
    );
  }

  /** Return enabled plugin code for execution on forum pages */
  function getEnabledPluginCode() {
    return _plugins.filter(p => p.enabled).map(p => p.code);
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { render, getEnabledPluginCode };
})();
