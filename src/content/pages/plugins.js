'use strict';
import BasePage      from './_base.js';
import { buildTabs } from '../shared/adapter.js';
import Storage       from '../shared/storage.js';
import PluginManager from '../shared/plugin-manager/plugin-manager.js';

const STYLES_ID = 'fme-plugins-styles';
const STYLES    = `
  .fme-feedback { transition: opacity 0.4s ease; }
  .fme-plugin-row { transition: opacity 0.3s ease; }
  .fme-plugin-row.fme-removing { opacity: 0; }
  .fme-btn-group { display: inline-flex; gap: 4px; align-items: center; }
  input[type="button"]:disabled { opacity: 0.5; cursor: not-allowed; }
  .fme-tag {
    display: inline-block; font-size: 0.75em; padding: 1px 6px;
    border-radius: 10px; background: #e8f0f7; color: #5a7a99; margin-right: 3px;
  }
  .fme-card-stars { color: #f5a623; }
  .fme-switch { position: relative; display: inline-block; width: 42px; height: 24px; }
  .fme-switch input { opacity: 0; width: 0; height: 0; }
  .fme-slider {
    position: absolute; cursor: pointer; inset: 0;
    background: #ccc; border-radius: 24px; transition: 0.3s;
  }
  .fme-slider::before {
    content: ''; position: absolute; height: 18px; width: 18px;
    left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s;
  }
  .fme-switch input:checked + .fme-slider { background: #94ce68; }
  .fme-switch input:checked + .fme-slider::before { transform: translateX(18px); }
  .fme-hook-badge {
    display: inline-block; font-size: 0.7em; padding: 1px 5px;
    border-radius: 3px; margin-right: 2px; font-weight: bold;
  }
  .fme-hook-forum { background: #d4edda; color: #155724; }
  .fme-hook-acp   { background: #cce5ff; color: #004085; }
`;

export default BasePage('plugins', async ({ Utils, FM, t, bus, params }) => {

  // ─── State ────────────────────────────────────────────────────────────────

  const origin  = Utils.UrlUtils.origin();
  const tid     = Utils.UrlUtils.param('tid');
  const sub     = Utils.UrlUtils.param('mode') ?? 'list';
  let   plugins = await PluginManager.getAll({ hook: 'forum', active: true }) || [];

  // ─── Helpers UI ───────────────────────────────────────────────────────────

  function statusBadge(p) {
    if (p.lastError) return `<span class="${FM.ACP_DOM.BADGE.ERROR}" title="${Utils.Str.escapeHTML(p.lastError)}">${t('plugins.status.error', 'Error')}</span>`;
    if (p.hasUpdate) return `<span class="${FM.ACP_DOM.BADGE.WARN}">${t('plugins.status.update',    'Update available')}</span>`;
    if (p.active)    return `<span class="${FM.ACP_DOM.BADGE.OK}">${t('plugins.status.active',     'Active')}</span>`;
    return               `<span class="${FM.ACP_DOM.BADGE.ERROR}">${t('plugins.status.disabled', 'Disabled')}</span>`;
  }

  function hookBadges(hooks = []) {
    return hooks.map(h => `<span class="fme-hook-badge fme-hook-${h}">${h}</span>`).join('');
  }

  function buildEmpty(icon, message, hint = '') {
    return `
      <div style="text-align:center; padding:40px 20px; color:#aaa;">
        <i class="fa ${icon} fa-3x" style="display:block; margin-bottom:14px;"></i>
        <p style="margin:0 0 6px; font-size:1.1em; color:#999;">${message}</p>
        ${hint ? `<small style="color:#bbb;">${hint}</small>` : ''}
      </div>
    `;
  }

  function setLoading(btn, loading) {
    btn.disabled = loading;
    if (loading) {
      btn._orig = btn.value;
      btn.value = '…';
    } else if (btn._orig !== undefined) {
      btn.value = btn._orig;
    }
  }

  const tabs = buildTabs([
    {
      href  : FM.ACP_URLS.FME_SECTION(origin, tid, 'plugins&mode=list'),
      label : t('plugins.tabs.installed', 'Installed'),
      active: sub === 'list',
    },
    {
      href  : FM.ACP_URLS.FME_SECTION(origin, tid, 'plugins&mode=browse'),
      label : t('plugins.tabs.browse', 'Browse'),
      active: sub === 'browse',
    },
    {
      href  : FM.ACP_URLS.FME_SECTION(origin, tid, 'plugins&mode=settings'),
      label : t('plugins.tabs.settings', 'Settings'),
      active: sub === 'settings',
    },
  ]);

  function buildListTab() {
    const updateCount = plugins.filter(p => p.hasUpdate).length;
    const errorCount  = plugins.filter(p => p.lastError).length;

    const notice = [
      updateCount > 0 && `
        <div id="fme-plugins-notice" class="${FM.ACP_DOM.MESSAGES.INFO}" style="margin-bottom:8px;padding:10px 14px;">
          <i class="fa ${FM.ACP_DOM.ICONS.DOWNLOAD}"></i>&nbsp;
          <strong>${updateCount}</strong>
          ${updateCount === 1
            ? t('plugins.notice.oneUpdate',    'plugin has an update available.')
            : t('plugins.notice.manyUpdates', 'plugins have updates available.')}
        </div>`,
      errorCount > 0 && `
        <div class="${FM.ACP_DOM.MESSAGES.ERROR}" style="margin-bottom:8px;padding:10px 14px;">
          <i class="fa ${FM.ACP_DOM.ICONS.WARNING}"></i>&nbsp;
          <strong>${errorCount}</strong>
          ${t('plugins.notice.errors', 'plugin(s) encountered errors at last run.')}
        </div>`,
    ].filter(Boolean).join('');

    const content = plugins.length
      ? buildInstalledTable()
      : buildEmpty(
          FM.ACP_DOM.ICONS.PLUGIN,
          t('plugins.empty', 'No plugins installed.'),
          t('plugins.emptyHint', 'Go to Browse to find and install plugins.')
        );

    return Utils.DOM.fieldset(
      t('plugins.title', 'Installed Plugins'),
      { icon: `<i class="fa ${FM.ACP_DOM.ICONS.PLUGIN}"></i>` },
      `${notice}${content}`
    );
  }

  function buildInstalledTable() {
    const rows = plugins.map((p, i) => {
      const rowClass = i % 2 === 0 ? FM.ACP_DOM.CONTENT.ROW_ODD : FM.ACP_DOM.CONTENT.ROW_EVEN;
      const tags     = (p.tags ?? p.manifest?.tags ?? [])
        .map(tag => `<span class="fme-tag">${Utils.Str.escapeHTML(tag)}</span>`)
        .join('');

      return `
        <tr class="${rowClass} fme-plugin-row" data-plugin-id="${p.id}">
          <td>
            <strong>${Utils.Str.escapeHTML(p.name)}</strong>
            <br><small style="color:#888;">${Utils.Str.escapeHTML(p.manifest?.description ?? p.description ?? '')}</small>
            ${tags ? `<br><span style="margin-top:3px;display:inline-block;">${tags}</span>` : ''}
          </td>
          <td style="white-space:nowrap;">
            <i class="fa ${FM.ACP_DOM.ICONS.USER}" style="margin-right:4px;"></i>
            ${Utils.Str.escapeHTML(p.author)}
          </td>
          <td style="white-space:nowrap;" class="fme-cell-version">v${Utils.Str.escapeHTML(p.version)}</td>
          <td style="white-space:nowrap;">${hookBadges(p.hooks ?? [])}</td>
          <td style="white-space:nowrap;" class="fme-cell-status">${statusBadge(p)}</td>
          <td style="white-space:nowrap; text-align:right;">
            <span class="fme-btn-group">
              ${p.hasUpdate ? `
                <input type="button" class="icon_ok fme-btn-update"
                  value="${t('plugins.actions.update', 'Update')}"
                  title="→ v${Utils.Str.escapeHTML(p.latestVersion ?? '')}"
                  data-id="${p.id}" />
              ` : ''}
              <input type="button"
                class="${p.active ? 'icon_cancel' : 'icon_ok'} fme-btn-toggle"
                value="${p.active
                  ? t('plugins.actions.disable', 'Disable')
                  : t('plugins.actions.enable',   'Enable')}"
                data-id="${p.id}" />
              <input type="button" class="btn fme-btn-settings"
                value="${t('plugins.actions.settings', 'Settings')}"
                data-id="${p.id}" />
              <input type="button" class="icon_cancel fme-btn-remove"
                value="${t('plugins.actions.remove', 'Remove')}"
                data-id="${p.id}" />
            </span>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <table class="${FM.ACP_DOM.CONTENT.TABLE}" cellpadding="0" cellspacing="1" width="100%">
        <thead>
          <tr>
            <th>${t('plugins.col.name',     'Plugin')}</th>
            <th>${t('plugins.col.author',   'Author')}</th>
            <th>${t('plugins.col.version', 'Version')}</th>
            <th>${t('plugins.col.hooks',    'Hooks')}</th>
            <th>${t('plugins.col.status',   'Status')}</th>
            <th style="text-align:right;">${t('plugins.col.actions', 'Actions')}</th>
          </tr>
        </thead>
        <tbody id="fme-plugins-tbody">${rows}</tbody>
      </table>
    `;
  }

  function buildBrowseTab() {
    return Utils.DOM.fieldset(
      t('plugins.browse.title', 'Browse Plugins'),
      { icon: `<i class="fa ${FM.ACP_DOM.ICONS.MARKET}"></i>` },
      `<div style="text-align:center; padding:30px 20px; color:#888;">
        <i class="fa ${FM.ACP_DOM.ICONS.MARKET} fa-2x" style="display:block; margin-bottom:12px;"></i>
        <p>${t('plugins.browse.redirect', 'Browse and install plugins from the Marketplace.')}</p><br />
        <input type="button" class="icon_ok"
          value="${t('plugins.browse.goToMarket', 'Open Marketplace')}"
          id="fme-btn-go-marketplace" />
      </div>`
    );
  }

  function buildSettingsTab() {
    return Utils.DOM.fieldset(
      t('plugins.settings.title', 'Plugin Settings'),
      { icon: `<i class="fa ${FM.ACP_DOM.ICONS.SETTINGS}"></i>` },
      `
        <table class="${FM.ACP_DOM.CONTENT.TABLE}" cellpadding="0" cellspacing="1" width="100%">
          <tbody>
            <tr class="${FM.ACP_DOM.CONTENT.ROW_ODD}">
              <td style="width:70%;">
                <strong>${t('plugins.settings.autoUpdate.label', 'Auto-update plugins')}</strong>
                <br><small style="color:#888;">
                  ${t('plugins.settings.autoUpdate.hint', 'Install updates automatically when available.')}
                </small>
              </td>
              <td>
                <label class="fme-switch">
                  <input type="checkbox" id="fme-setting-autoupdate" />
                  <span class="fme-slider"></span>
                </label>
              </td>
            </tr>
            <tr class="${FM.ACP_DOM.CONTENT.ROW_EVEN}">
              <td>
                <strong>${t('plugins.settings.devMode.label', 'Developer mode')}</strong>
                <br><small style="color:#888;">
                  ${t('plugins.settings.devMode.hint', 'Enable detailed plugin debugging logs.')}
                </small>
              </td>
              <td>
                <label class="fme-switch">
                  <input type="checkbox" id="fme-setting-devmode" />
                  <span class="fme-slider"></span>
                </label>
              </td>
            </tr>
            <tr class="${FM.ACP_DOM.CONTENT.ROW_ODD}">
              <td>
                <strong>${t('plugins.settings.reset.label', 'Reset all plugins')}</strong>
                <br><small style="color:#888;">
                  ${t('plugins.settings.reset.hint', 'Uninstall all plugins and clear plugin data.')}
                </small>
              </td>
              <td>
                <input type="button" class="icon_cancel"
                  id="fme-btn-reset-all"
                  value="${t('plugins.settings.reset.btn', 'Reset all')}" />
              </td>
            </tr>
          </tbody>
        </table>
        <div style="text-align:right; padding:10px 0;">
          <input type="button" class="icon_ok"
            id="fme-btn-save-settings"
            value="${t('plugins.settings.save', 'Save Settings')}" />
        </div>
      `
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const tabContent = {
    list    : buildListTab,
    browse  : buildBrowseTab,
    settings: buildSettingsTab,
  }[sub]?.() ?? buildListTab();

  const html = `
    <div id="menu-body">${tabs}</div>
    <div class="panel_menu" id="fme-plugins-panel"><br>${tabContent}</div>
  `;

  return {
    html,
    onMount: (container, { signal }) => {
      Utils.DOM.injectCSS(STYLES_ID, STYLES);

      const panel = container.querySelector('#fme-plugins-panel');
      if (!panel) return;

      const feedback = (message, type = 'success') => {
        panel.querySelector('.fme-feedback')?.remove();

        const cls  = type === 'success' ? FM.ACP_DOM.MESSAGES.SUCCESS  : FM.ACP_DOM.MESSAGES.ERROR;
        const icon = type === 'success' ? FM.ACP_DOM.ICONS.CHECK       : FM.ACP_DOM.ICONS.WARNING;

        const el = Utils.DOM.create('div', {
          class: `${cls} fme-feedback`,
          style: 'margin:0 0 10px; padding:8px 14px;',
        }, `<i class="fa ${icon}"></i>&nbsp;${message}`);

        panel.prepend(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 450); }, 3000);
      };

      const confirmDialog = (message) => Promise.resolve(window.confirm(message));

      async function onToggle(id, btn) {
        setLoading(btn, true);
        try {
          const newActive = await PluginManager.toggle(id);
          const plugin = plugins.find(p => p.id === id);
          if (plugin) plugin.active = newActive;

          const row = panel.querySelector(`tr[data-plugin-id="${id}"]`);
          if (row) {
            row.querySelector('.fme-cell-status').innerHTML = statusBadge({ ...plugin });
            btn.className = `${newActive ? 'icon_cancel' : 'icon_ok'} fme-btn-toggle`;
            btn.value     = newActive
              ? t('plugins.actions.disable', 'Disable')
              : t('plugins.actions.enable',   'Enable');
            row.style.opacity = '0.4';
            requestAnimationFrame(() => { row.style.opacity = '1'; });
          }

          feedback(newActive
            ? t('plugins.feedback.enabled',   'Plugin enabled.')
            : t('plugins.feedback.disabled', 'Plugin disabled.')
          );
        } catch (err) {
          feedback(err.message, 'error');
        } finally {
          setLoading(btn, false);
        }
      }

      async function onUpdate(id, btn) {
        const plugin = plugins.find(p => p.id === id);
        if (!plugin) return;

        const ok = await confirmDialog(
          t('plugins.confirm.update', {},
            `Update "${plugin.name}" to v${plugin.latestVersion ?? 'latest'}?`)
        );
        if (!ok) return;

        setLoading(btn, true);
        try {
          const updated = await PluginManager.update(id);
          const idx = plugins.findIndex(p => p.id === id);
          if (idx !== -1 && updated) plugins[idx] = updated;

          const row = panel.querySelector(`tr[data-plugin-id="${id}"]`);
          if (row) {
            row.querySelector('.fme-cell-version').textContent = `v${updated?.version ?? plugin.version}`;
            row.querySelector('.fme-cell-status').innerHTML    = statusBadge(updated ?? plugin);
            btn.remove();
          }

          feedback(t('plugins.feedback.updated', 'Plugin updated successfully.'));
        } catch (err) {
          feedback(err.message, 'error');
          setLoading(btn, false);
        }
      }

      async function onRemove(id) {
        const plugin = plugins.find(p => p.id === id);
        if (!plugin) return;

        const ok = await confirmDialog(
          t('plugins.confirm.remove', {}, `Remove "${plugin.name}"? This cannot be undone.`)
        );
        if (!ok) return;

        const row = panel.querySelector(`tr[data-plugin-id="${id}"]`);
        if (row) {
          row.classList.add('fme-removing');
          await Utils.Misc.sleep(300);
        }

        try {
          await PluginManager.uninstall(id);
          plugins = plugins.filter(p => p.id !== id);
          row?.remove();

          if (plugins.length === 0) {
            panel.querySelector('#fme-plugins-tbody')
              ?.closest('table')
              ?.replaceWith(Utils.DOM.create('div', {},
                  buildEmpty(FM.ACP_DOM.ICONS.PLUGIN, t('plugins.empty', 'No plugins installed.'))
                ));
          }

          feedback(t('plugins.feedback.removed', 'Plugin removed.'));
        } catch (err) {
          row?.classList.remove('fme-removing');
          feedback(err.message, 'error');
        }
      }

      async function onInstall(btn) {
        let data;
        try   { data = JSON.parse(btn.dataset.plugin); }
        catch { return; }

        setLoading(btn, true);

        try {
          await PluginManager.install(data.id);
          plugins = await PluginManager.getAll();
          btn.outerHTML = `<span class="${FM.ACP_DOM.BADGE.OK}">${t('plugins.status.installed', 'Installed')}</span>`;
          feedback(t('plugins.feedback.installed', {}, `"${data.name}" installed successfully.`));
        } catch (err) {
          feedback(err.message, 'error');
          setLoading(btn, false);
        }
      }

      async function onResetAll(btn) {
        const ok = await confirmDialog(
          t('plugins.confirm.resetAll', {},
            'Remove ALL plugins? This will uninstall everything and cannot be undone.')
        );
        if (!ok) return;

        setLoading(btn, true);

        try {
          for (const p of [...plugins]) {
            await PluginManager.uninstall(p.id).catch(() => {});
          }
          plugins = [];
          bus.emit('fme:plugins:reset', {});
          feedback(t('plugins.feedback.resetAll', 'All plugins removed.'));
          await Utils.Misc.sleep(800);
          bus.emit('fme:navigate', { section: 'plugins' });
        } catch (err) {
          feedback(err.message, 'error');
          setLoading(btn, false);
        }
      }

      async function onSaveSettings(btn) {
        setLoading(btn, true);
        const autoUpdate = panel.querySelector('#fme-setting-autoupdate')?.checked ?? false;
        const devMode    = panel.querySelector('#fme-setting-devmode')?.checked    ?? false;
        await Storage.Settings.patch({ pluginsAutoUpdate: autoUpdate, pluginsDevMode: devMode });
        setLoading(btn, false);
        feedback(t('plugins.feedback.settingsSaved', 'Settings saved.'));
      }

      panel.addEventListener('click', async (e) => {
        const btn = e.target.closest('input[type="button"]');
        if (!btn || btn.disabled) return;

        const id = btn.dataset.id;

        if (btn.classList.contains('fme-btn-toggle'))   return onToggle(id, btn);
        if (btn.classList.contains('fme-btn-update'))   return onUpdate(id, btn);
        if (btn.classList.contains('fme-btn-remove'))   return onRemove(id);
        if (btn.classList.contains('fme-btn-install'))  return onInstall(btn);
        if (btn.classList.contains('fme-btn-settings')) return bus.emit('fme:navigate', { section: 'plugin_settings', params: { id } });
        if (btn.id === 'fme-btn-reset-all')             return onResetAll(btn);
        if (btn.id === 'fme-btn-save-settings')         return onSaveSettings(btn);
        if (btn.id === 'fme-btn-go-marketplace')        return bus.emit('fme:navigate', { section: 'marketplace' });
      }, { signal });
    }
  };
});
