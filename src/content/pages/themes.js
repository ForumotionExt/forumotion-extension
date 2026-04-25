'use strict';
import BasePage from './_base.js';
import { buildTabs } from '../shared/adapter.js';

export default BasePage('themes', async ({ Utils, FM, t, bus, params }) => {
  const origin = Utils.UrlUtils.origin(), tid = Utils.UrlUtils.param('tid'), sub = Utils.UrlUtils.param('mode') ?? 'list';

  const themes = [
    {
      id      : 'dark_modern',
      name    : 'Dark Modern',
      engine  : 'prosilver',
      active  : true,
      version : '1.2.0',
      author  : 'FME Team',
      modified: '2025-03-10',
    },
    {
      id      : 'light_pro',
      name    : 'Light Pro',
      engine  : 'prosilver',
      active  : false,
      version : '2.0.1',
      author  : 'Designix',
      modified: '2025-02-28',
    },
    {
      id      : 'retro_board',
      name    : 'RetroBoard',
      engine  : 'punbb',
      active  : false,
      version : '1.0.2',
      author  : 'PixelForum',
      modified: '2025-01-30',
    },
  ];

  const tabs = buildTabs([
    { href: FM.ACP_URLS.FME_SECTION(origin, tid, 'themes' + '&mode=list'),   label: t('themes.tabs.list', 'Themes'),       active: sub === 'list'   },
    { href: FM.ACP_URLS.FME_SECTION(origin, tid, 'themes' + '&mode=css'),    label: t('themes.tabs.css', 'Custom CSS'),    active: sub === 'css'    },
    { href: FM.ACP_URLS.FME_SECTION(origin, tid, 'themes' + '&mode=import'), label: t('themes.tabs.import', 'Import'),     active: sub === 'import' },
  ]);

  const engineLabel = (engine) => FM.ENGINES.getLabel(engine) ?? engine;

  const rows = themes.map((theme, i) => {
    const rowClass = i % 2 === 0 ? FM.ACP_DOM.CONTENT.ROW_ODD : FM.ACP_DOM.CONTENT.ROW_EVEN;

    return `
      <tr class="${rowClass}">
        <td>
          <strong>${Utils.Str.escapeHTML(theme.name)}</strong>
          ${theme.active
            ? ` <span class="${FM.ACP_DOM.BADGE.OK}" style="margin-left:6px;">${t('themes.active', 'Active')}</span>`
            : ''}
        </td>
        <td style="white-space:nowrap;">
          <i class="fa ${FM.ACP_DOM.ICONS.MAGIC}" style="margin-right:4px;"></i>
          ${engineLabel(theme.engine)}
        </td>
        <td style="white-space:nowrap;">
          <i class="fa ${FM.ACP_DOM.ICONS.USER}" style="margin-right:4px;"></i>
          ${Utils.Str.escapeHTML(theme.author)}
        </td>
        <td style="white-space:nowrap;">v${Utils.Str.escapeHTML(theme.version)}</td>
        <td style="white-space:nowrap; color:#888; font-size:0.85em;">
          ${Utils.Str.formatDate(theme.modified)}
        </td>
        <td style="white-space:nowrap; text-align:right;">
          ${!theme.active ? `
            <input type="button" class="icon_ok"
              value="${t('themes.actions.activate', 'Activate')}"
              data-id="${theme.id}" />
          ` : ''}
          <input type="button" class="btn"
            value="${t('themes.actions.css', 'CSS')}"
            data-id="${theme.id}"
            title="${t('themes.actions.cssTitle', 'Edit custom CSS')}" />
          <input type="button" class="btn"
            value="${t('themes.actions.export', 'Export')}"
            data-id="${theme.id}" />
          ${!theme.active ? `
            <input type="button" class="icon_cancel"
              value="${t('themes.actions.delete', 'Delete')}"
              data-id="${theme.id}" />
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');

  const table = themes.length
    ? `
      <table class="${FM.ACP_DOM.CONTENT.TABLE}" cellpadding="0" cellspacing="1" width="100%">
        <thead>
          <tr>
            <th>${t('themes.col.name', 'Theme')}</th>
            <th>${t('themes.col.engine', 'Engine')}</th>
            <th>${t('themes.col.author', 'Author')}</th>
            <th>${t('themes.col.version', 'Version')}</th>
            <th>${t('themes.col.modified', 'Modified')}</th>
            <th style="text-align:right;">${t('themes.col.actions', 'Actions')}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `
    : `<p style="text-align:center; padding:20px; color:#aaa;">
        <i class="fa ${FM.ACP_DOM.ICONS.THEME}"></i>
        ${t('themes.empty', 'No themes found.')}
      </p>`;

  const importBlock = sub === 'import'
    ? Utils.DOM.fieldset(
        t('themes.import.title', 'Import Theme'),
        { icon: `<i class="fa ${FM.ACP_DOM.ICONS.UPLOAD}"></i>` },
        `
          <dl>
            <dt><label>${t('themes.import.file', 'Theme file (.zip)')}</label></dt>
            <dd><input type="file" accept=".zip" /></dd>
          </dl>
          <div class="${FM.ACP_SELECTORS.BTNS.selector}">
            <input type="button" class="icon_ok" value="${t('themes.import.submit', 'Import')}" />
          </div>
        `
      )
    : '';

  const listBlock = Utils.DOM.fieldset(
    t('themes.title', 'Installed Themes'),
    { icon: `<i class="fa ${FM.ACP_DOM.ICONS.THEME}"></i>` },
    table
  );

  return {
    html: `
      <div id="menu-body">${tabs}</div>
      <div class="panel_menu"><br>${sub === 'import' ? importBlock : listBlock}</div>
    `,
    onMount: (container, { signal, bus: mountBus }) => {
      container.querySelectorAll('input[type="button"][data-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const themeId = btn.dataset.id;
          const val     = btn.value;

          if (val === t('themes.actions.activate', 'Activate')) {
            alert(`Activate theme: ${themeId}`);
          } else if (val === t('themes.actions.delete', 'Delete')) {
            alert(`Delete theme: ${themeId}`);
          } else if (val === t('themes.actions.css', 'CSS')) {
            mountBus.emit('fme:navigate', { section: 'theme_editor', params: { id: themeId } });
          } else if (val === t('themes.actions.export', 'Export')) {
            alert(`Export theme: ${themeId}`);
          }
        }, { signal });
      });
    },
  }
});