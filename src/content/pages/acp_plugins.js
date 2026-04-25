'use strict';
import BasePage      from './_base.js';
import PluginManager from '../shared/plugin-manager/plugin-manager.js';

export default BasePage('acp_plugins', async ({ Utils, FM, t, bus, params }) => {
  const plugins = await PluginManager.getAll({ active: true, hook: 'acp' });

  const D = FM.ACP_DOM.CONTENT,
        I = FM.ACP_DOM.ICONS,
        B = FM.ACP_DOM.BADGE;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function hookBadges(hooks = []) {
    const colors = { forum: '#d4edda;color:#155724', acp: '#cce5ff;color:#004085' };
    return hooks.map(h =>
      `<small style="background:${colors[h] ?? '#eee;color:#333'};padding:1px 5px;border-radius:3px;margin-right:2px;font-weight:bold;">${h}</small>`
    ).join('');
  }

  function statusBadge(p) {
    if (p.lastError) return `<span class="${B.ERROR}" title="${Utils.Str.escapeHTML(p.lastError ?? '')}"><i class="fa ${I.WARNING}"></i>&nbsp;${t('acp_plugins.error')}</span>`;
    if (p.active)    return `<span class="${B.OK}"><i class="fa ${I.CHECK}"></i>&nbsp;${t('acp_plugins.active')}</span>`;
    return                  `<span class="${B.WARN}"><i class="fa ${I.TIMES}"></i>&nbsp;${t('acp_plugins.inactive')}</span>`;
  }

  const renderInstalled = (list) => {
    if (!list.length) {
      return `<p class="${D.HELP_TEXT}">${t('acp_plugins.noPlugins')}</p>`;
    }

    return `
      <table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
        <thead>
          <tr class="${D.ROW_ODD}">
            <th align="left" width="28%">${t('common.name')}</th>
            <th align="left" width="12%">${t('common.version')}</th>
            <th align="left" width="15%">${t('common.author')}</th>
            <th align="left" width="12%">${t('acp_plugins.col.hooks', {}, 'Hooks')}</th>
            <th align="left" width="13%">${t('common.status')}</th>
            <th align="center">${t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((p, i) => `
            <tr class="${i % 2 === 0 ? D.ROW_ODD : D.ROW_EVEN}" data-plugin-id="${p.id}">
              <td>
                <i class="fa ${p.manifest?.icon ?? I.PLUGIN}"></i>&nbsp;
                <strong>${Utils.Str.escapeHTML(p.name)}</strong>
                ${p.manifest?.description
                  ? `<br><small class="${D.HELP_TEXT}">${Utils.Str.escapeHTML(p.manifest.description)}</small>`
                  : ''}
                ${p.lastError
                  ? `<br><small style="color:#c0392b;"><i class="fa ${I.WARNING}"></i>&nbsp;${Utils.Str.escapeHTML(p.lastError)}</small>`
                  : ''}
              </td>
              <td><code>${Utils.Str.escapeHTML(p.version ?? '—')}</code></td>
              <td><small>${Utils.Str.escapeHTML(p.author ?? '—')}</small></td>
              <td>${hookBadges(p.hooks ?? [])}</td>
              <td class="fme-acpp-status">${statusBadge(p)}</td>
              <td align="center" style="white-space:nowrap">
                <a href="#" class="fme-plugin-toggle" data-id="${p.id}" data-active="${p.active}"
                  title="${p.active ? t('acp_plugins.disable') : t('acp_plugins.enable')}">
                  <i class="fa ${p.active ? I.TIMES : I.CHECK}"></i>
                </a>
                &nbsp;
                ${p.manifest?.settings && Object.keys(p.manifest.settings).length
                  ? `<a href="#" class="fme-plugin-settings" data-id="${p.id}" title="${t('acp_plugins.settings', {}, 'Settings')}">
                      <i class="fa ${I.SETTINGS}"></i>
                    </a>
                    &nbsp;`
                  : ''
                }
                <a href="#" class="fme-plugin-remove" data-id="${p.id}" title="${t('acp_plugins.remove')}">
                  <i class="fa ${I.TRASH}"></i>
                </a>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const installedGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.PLUGIN}"></i>&nbsp;${t('acp_plugins.groups.installed')} (${plugins.length})`,
    { class: D.GROUP },
    `<div id="fme-acpp-list">${renderInstalled(plugins)}</div>`
  );

  const marketGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.MARKET}"></i>&nbsp;${t('acp_plugins.groups.available')}`,
    { class: D.GROUP },
    `<p class="${D.HELP_TEXT}">
      <i class="fa ${I.INFO}"></i>&nbsp;${t('acp_plugins.noAvailable')}
    </p>`
  );

  const html = `
    <div id="fme-acp-plugins-page">
      ${installedGroup}
      ${marketGroup}
      <div id="fme-acpp-msg" style="display:none"></div>
    </div>
  `;

  return {
    html: /*html*/`${html}`,

    onMount: (container, { signal }) => {
      const listEl = container.querySelector('#fme-acpp-list');
      const msgEl  = container.querySelector('#fme-acpp-msg');

      const showMsg = (msg, isError = false) => {
        if (!msgEl) return;
        msgEl.textContent   = msg;
        msgEl.className     = isError ? FM.ACP_DOM.MESSAGES.ERROR : FM.ACP_DOM.MESSAGES.SUCCESS;
        msgEl.style.display = '';
        setTimeout(() => msgEl.style.display = 'none', 2500);
      };

      listEl?.addEventListener('click', async (e) => {
        const link = e.target.closest('a[data-id]');
        if (!link) return;
        e.preventDefault();

        const id = link.dataset.id;

        // ─── Toggle ─────────────────────────────────────────────────────────
        if (link.classList.contains('fme-plugin-toggle')) {
          link.style.opacity = '0.4';
          try {
            const newActive = await PluginManager.toggle(id);
            const row = listEl.querySelector(`tr[data-plugin-id="${id}"]`);
            if (row) {
              const plugin = await PluginManager.getById(id);
              row.querySelector('.fme-acpp-status').innerHTML = statusBadge(plugin);
              const icon = row.querySelector('.fme-plugin-toggle i');
              if (icon) icon.className = `fa ${newActive ? I.TIMES : I.CHECK}`;
              link.dataset.active = String(newActive);
            }
            showMsg(t('common.success'));
          } catch (err) {
            showMsg(err.message, true);
          } finally {
            link.style.opacity = '1';
          }
          return;
        }

        if (link.classList.contains('fme-plugin-settings')) {
          bus.emit('fme:navigate', { section: `plugin_settings&id=${id}` });
          return;
        }

        // ─── Remove ─────────────────────────────────────────────────────────
        if (link.classList.contains('fme-plugin-remove')) {
          if (!confirm(t('acp_plugins.confirmRemove'))) return;
          link.style.opacity = '0.4';
          try {
            await PluginManager.uninstall(id);
            listEl.querySelector(`tr[data-plugin-id="${id}"]`)?.remove();
            showMsg(t('common.success'));
          } catch (err) {
            showMsg(err.message, true);
            link.style.opacity = '1';
          }
        }
      }, { signal });
    }
  };
});