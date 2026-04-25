'use strict';
import BasePage from './_base.js';
import { buildTabs } from '../shared/adapter.js';

export default BasePage('templates', async ({ Utils, FM, t, bus, params }) => {
  const origin = Utils.UrlUtils.origin(),
        tid    = Utils.UrlUtils.param('tid'),
        sub    = Utils.UrlUtils.param('mode') ?? 'list';
  const categories = FM.TEMPLATES.CATEGORIES;

  const modified = [
    {
      id      : 'overall_header',
      category: 'main',
      name    : 'overall_header',
      marked  : true,
      version : '1.0.0',
      date    : '2025-03-15',
    },
    {
      id      : 'viewtopic_body',
      category: 'post',
      name    : 'viewtopic_body',
      marked  : true,
      version : '1.1.0',
      date    : '2025-02-20',
    },
    {
      id      : 'profile_view_body',
      category: 'profil',
      name    : 'profile_view_body',
      marked  : false,
      version : '1.0.0',
      date    : '2024-12-10',
    },
  ];

  const tabs = buildTabs([
    { href: FM.ACP_URLS.FME_SECTION(origin, tid, 'templates' + '&mode=list'),   label: t('templates.tabs.modified', 'Modified'),    active: sub === 'list'   },
    { href: FM.ACP_URLS.FME_SECTION(origin, tid, 'templates' + '&mode=browse'), label: t('templates.tabs.browse', 'Browse all'),    active: sub === 'browse' },
    { href: FM.ACP_URLS.FME_SECTION(origin, tid, 'templates' + '&mode=backup'), label: t('templates.tabs.backup', 'Backup'),        active: sub === 'backup' },
  ]);

  const getCategoryLabel = (key) =>
    categories.find(c => c.key === key)?.label ?? Utils.Str.ucFirst(key);

  const markerBadge = (tpl) =>
    tpl.marked
      ? `<span class="${FM.ACP_DOM.BADGE.OK}"><i class="fa ${FM.ACP_DOM.ICONS.CHECK}" style="margin-right:3px;"></i>FME</span>`
      : `<span class="${FM.ACP_DOM.BADGE.WARN}"><i class="fa ${FM.ACP_DOM.ICONS.WARNING}" style="margin-right:3px;"></i>${t('templates.badge.manual', 'Manual')}</span>`;

  const renderModified = () => {
    if (!modified.length) {
      return `<p style="text-align:center; padding:20px; color:#aaa;">
        <i class="fa ${FM.ACP_DOM.ICONS.TEMPLATE}"></i>
        ${t('templates.empty', 'No modified templates found.')}
      </p>`;
    }

    const rows = modified.map((tpl, i) => {
      const rowClass = i % 2 === 0 ? FM.ACP_DOM.CONTENT.ROW_ODD : FM.ACP_DOM.CONTENT.ROW_EVEN;
      const editUrl  = FM.ACP_URLS.TEMPLATE_EDIT(origin, tid, tpl.category, tpl.id);

      return `
        <tr class="${rowClass}">
          <td>
            <code>${Utils.Str.escapeHTML(tpl.name)}</code>
          </td>
          <td style="white-space:nowrap;">
            <i class="fa ${FM.ACP_DOM.ICONS.TEMPLATE}" style="margin-right:4px;"></i>
            ${getCategoryLabel(tpl.category)}
          </td>
          <td style="white-space:nowrap;">${markerBadge(tpl)}</td>
          <td style="white-space:nowrap;">v${Utils.Str.escapeHTML(tpl.version)}</td>
          <td style="white-space:nowrap; color:#888; font-size:0.85em;">
            ${Utils.Str.formatDate(tpl.date)}
          </td>
          <td style="white-space:nowrap; text-align:right;">
            <a href="${editUrl}" class="btn">
              <i class="fa ${FM.ACP_DOM.ICONS.EDIT}" style="margin-right:4px;"></i>
              ${t('templates.actions.edit', 'Edit')}
            </a>
            <input type="button" class="icon_cancel"
              value="${t('templates.actions.restore', 'Restore')}"
              data-id="${tpl.id}"
              title="${t('templates.actions.restoreTitle', 'Restore to original')}" />
          </td>
        </tr>
      `;
    }).join('');

    return `
      <table class="${FM.ACP_DOM.CONTENT.TABLE}" cellpadding="0" cellspacing="1" width="100%">
        <thead>
          <tr>
            <th>${t('templates.col.name', 'Template')}</th>
            <th>${t('templates.col.category', 'Category')}</th>
            <th>${t('templates.col.marker', 'Marker')}</th>
            <th>${t('templates.col.version', 'Version')}</th>
            <th>${t('templates.col.date', 'Modified')}</th>
            <th style="text-align:right;">${t('templates.col.actions', 'Actions')}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  };

  const renderBrowse = () => {
    const sections = categories.map(cat => {
      const listUrl = FM.ACP_URLS.TEMPLATES_LIST(origin, tid, cat.key);

      return Utils.DOM.fieldset(
        cat.label,
        { icon: `<i class="fa ${FM.ACP_DOM.ICONS.TEMPLATE}"></i>` },
        `
          <p>
            <a href="${listUrl}" class="btn">
              <i class="fa ${FM.ACP_DOM.ICONS.EDIT}" style="margin-right:4px;"></i>
              ${t('templates.browse.open', 'Open in ACP')}
            </a>
          </p>
        `
      );
    }).join('');

    return sections;
  };

  const renderBackup = () => Utils.DOM.fieldset(
    t('templates.backup.title', 'Backup & Restore'),
    { icon: `<i class="fa ${FM.ACP_DOM.ICONS.BACKUP}"></i>` },
    `
      <dl>
        <dt><label>${t('templates.backup.desc', 'Export all modified templates to a JSON backup file.')}</label></dt>
        <dd>
          <input type="button" class="icon_ok"
            value="${t('templates.backup.export', 'Export backup')}" id="fme-tpl-export" />
        </dd>
      </dl>
      <dl>
        <dt><label>${t('templates.backup.restore', 'Restore from backup (.json)')}</label></dt>
        <dd>
          <input type="file" accept=".json" id="fme-tpl-import" />
          <input type="button" class="btn"
            value="${t('templates.backup.importBtn', 'Import')}" id="fme-tpl-import-btn" />
        </dd>
      </dl>
      <dl>
        <dt><label style="color:#e9553c;">
          <i class="fa ${FM.ACP_DOM.ICONS.WARNING}" style="margin-right:4px;"></i>
          ${t('templates.backup.restoreAll', 'Restore ALL templates to original')}
        </label></dt>
        <dd>
          <input type="button" class="icon_cancel"
            value="${t('templates.backup.restoreAllBtn', 'Restore all')}" id="fme-tpl-restore-all" />
        </dd>
      </dl>
    `
  );

  let content;

  if (sub === 'browse') {
    content = renderBrowse();
  } else if (sub === 'backup') {
    content = renderBackup();
  } else {
    content = Utils.DOM.fieldset(
      t('templates.title', 'Modified Templates'),
      { icon: `<i class="fa ${FM.ACP_DOM.ICONS.TEMPLATE}"></i>` },
      renderModified()
    );
  }

  return {
    html: /*html*/`
      <div id="menu-body">${tabs}</div>
      <div class="panel_menu"><br>${content}</div>
     `,
    onMount: (container, { signal }) => {}
  };
});