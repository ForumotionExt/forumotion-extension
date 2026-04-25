'use strict';

/**
 * @file marketplace.js
 * @description Pagina Marketplace FME.
 *
 * Flow:
 *  render()  → skeleton imediat, zero fetch
 *  section   → fetch toate catalogele în paralel, populează items
 *  onMount   → event delegation, tab switch, search, filtre, sort, modal, actions
 */

import BasePage       from './_base.js';
import { buildTabs }  from '../shared/adapter.js';
import PluginManager  from '../shared/plugin-manager/plugin-manager.js';
import {
  normalizeItem,
  typeIcon,
  typeLabel,
  statusBadge,
  sortItems,
  buildPagination,
} from '../shared/marketplace.utils.js';

export default BasePage('marketplace', async ({ Utils, FM, t, bus, params }) => {
  const PAGE_SIZE = 10;
  const D   = FM.ACP_DOM.CONTENT;
  const I   = FM.ACP_DOM.ICONS;
  const B   = FM.ACP_DOM.BADGE;
  const SEL = FM.ACP_SELECTORS;

  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    tab     : 'catalog',
    search  : '',
    sort    : 'downloads',
    page    : 1,
    status  : '',
    author  : '',
    tag     : '',
    minStars: '',
    engine  : '',
    target  : '',
  };

  // ── Items — populate în section ────────────────────────────────────────────
  let items = [];

  // ── Bound helpers ──────────────────────────────────────────────────────────
  const _icon  = (type) => typeIcon(I, type);
  const _label = (type) => typeLabel(t, type);
  const _badge = (item) => statusBadge(B, I, t, item);

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const TABS = [
    { key: 'catalog',    icon: I.MARKET      },
    { key: 'themes',     icon: I.THEME       },
    { key: 'plugins',    icon: I.PLUGIN      },
    { key: 'extensions', icon: I.GLOBE       },
  ];

  const tabLabel = (key, count = null) => {
    const labels = {
      catalog   : t('market.tabs.all',        'Catalog'),
      themes    : t('market.tabs.themes',     'Themes'),
      plugins   : t('market.tabs.plugins',    'Plugins'),
      extensions: t('market.tabs.extensions',  'Extensions'),
    };
    const icon = TABS.find(tb => tb.key === key)?.icon ?? I.MARKET;
    return `<i class="fa ${icon}"></i>&nbsp;${labels[key] ?? key}${count !== null ? ` (${count})` : ''}`;
  };

  let tabIdx = 0;
  const tabsHtml = buildTabs(
    TABS.map((tab, idx) => ({
      href  : 'javascript:void(0)',
      label : tabLabel(tab.key),
      active: idx === 0,
    }))
  ).replace(/<a href="javascript:void\(0\)"/g, () => {
    const key = TABS[tabIdx++]?.key ?? '';
    return `<a href="javascript:void(0)" data-tab="${key}"`;
  });

  // ── Filter helpers ─────────────────────────────────────────────────────────
  const buildFilterOptions = () => {
    const base = state.tab !== 'catalog'
      ? items.filter(i => i.type === state.tab.replace(/s$/, ''))
      : items;
    return {
      statuses: [...new Set(base.map(i => i.status).filter(Boolean))].sort(),
      authors : [...new Set(base.map(i => i.author).filter(Boolean))].sort(),
      tags    : [...new Set(base.flatMap(i => i.tags ?? []))].sort(),
      engines : [...new Set(base.map(i => i.engine).filter(Boolean))].sort(),
      targets : [...new Set(base.map(i => i.target).filter(Boolean))].sort(),
    };
  };

  const hasActiveFilters = () =>
    !!(state.status || state.author || state.tag || state.engine || state.target || state.minStars);

  const clearFilters = () => {
    Object.assign(state, {
      status: '', author: '', tag: '',
      engine: '', target: '', minStars: '', page: 1,
    });
  };

  // ── getList — filtrare completă ────────────────────────────────────────────
  const getList = () => {
    let list = items;

    if (state.tab !== 'catalog') {
      const type = state.tab.replace(/s$/, '');
      list = items.filter(i => i.type === type);
    }

    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter(i =>
        i.name?.toLowerCase().includes(q)        ||
        i.description?.toLowerCase().includes(q) ||
        (i.tags ?? []).some(tag => tag.toLowerCase().includes(q))
      );
    }

    if (state.status)   list = list.filter(i => i.status  === state.status);
    if (state.author)   list = list.filter(i => i.author  === state.author);
    if (state.tag)      list = list.filter(i => (i.tags ?? []).includes(state.tag));
    if (state.engine)   list = list.filter(i => i.engine  === state.engine);
    if (state.target)   list = list.filter(i => i.target  === state.target);
    if (state.minStars) list = list.filter(i => (i.stars ?? 0) >= Number(state.minStars));

    return sortItems(list, state.sort);
  };

  const getPaged = () => {
    const list  = getList();
    const start = (state.page - 1) * PAGE_SIZE;
    return {
      list : list.slice(start, start + PAGE_SIZE),
      total: list.length,
      pages: Math.max(1, Math.ceil(list.length / PAGE_SIZE)),
    };
  };

  // ── renderFilters ──────────────────────────────────────────────────────────
  const renderFilters = () => {
    const f = buildFilterOptions();

    const STATUS_LABELS = {
      stable: t('market.status.stable', 'Stable'),
      beta  : t('market.status.beta',   'Beta'),
      wip   : t('market.status.wip',    'WIP'),
    };

    const sel = (id, val, opts, allLabel) => /* html */`
      <select id="${id}" style="max-width:130px;">
        <option value="">${allLabel}</option>
        ${opts.map(o => /* html */`
          <option value="${Utils.Str.escapeHTML(o)}" ${val === o ? 'selected' : ''}>
            ${Utils.Str.escapeHTML(STATUS_LABELS[o] ?? o)}
          </option>`).join('')}
      </select>`;

    return /* html */`
      <tr class="${D.ROW_EVEN}" id="fme-market-filters">
        <td width="12%">
          <label style="font-size:0.9em;color:#666;">
            <i class="fa fa-filter"></i>&nbsp;${t('market.filter.label', 'Filters')}
          </label>
        </td>
        <td colspan="3" style="padding:4px 8px;">

          ${f.statuses.length ? /* html */`
            <span style="margin-right:10px;">
              <label style="font-size:0.85em;color:#888;">${t('market.filter.status', 'Status')}</label>&nbsp;
              ${sel('fme-filter-status', state.status, f.statuses, t('market.filter.all', 'All'))}
            </span>` : ''}

          ${f.authors.length > 1 ? /* html */`
            <span style="margin-right:10px;">
              <label style="font-size:0.85em;color:#888;">${t('market.filter.author', 'Author')}</label>&nbsp;
              ${sel('fme-filter-author', state.author, f.authors, t('market.filter.all', 'All'))}
            </span>` : ''}

          ${f.tags.length ? /* html */`
            <span style="margin-right:10px;">
              <label style="font-size:0.85em;color:#888;">${t('market.filter.tag', 'Tag')}</label>&nbsp;
              ${sel('fme-filter-tag', state.tag, f.tags, t('market.filter.all_tags', 'All tags'))}
            </span>` : ''}

          <span style="margin-right:10px;">
            <label style="font-size:0.85em;color:#888;">
              <i class="fa fa-star" style="color:#f1c40f;"></i>&nbsp;Min
            </label>&nbsp;
            <select id="fme-filter-stars" style="max-width:80px;">
              <option value=""  ${!state.minStars        ? 'selected' : ''}>${t('market.filter.all', 'All')}</option>
              <option value="1" ${state.minStars === '1'  ? 'selected' : ''}>1+</option>
              <option value="3" ${state.minStars === '3'  ? 'selected' : ''}>3+</option>
              <option value="5" ${state.minStars === '5'  ? 'selected' : ''}>5+</option>
            </select>
          </span>

          ${f.engines.length ? /* html */`
            <span style="margin-right:10px;">
              <label style="font-size:0.85em;color:#888;">Engine</label>&nbsp;
              ${sel('fme-filter-engine', state.engine, f.engines, t('market.filter.all', 'All'))}
            </span>` : ''}

          ${f.targets.length ? /* html */`
            <span style="margin-right:10px;">
              <label style="font-size:0.85em;color:#888;">Target</label>&nbsp;
              ${sel('fme-filter-target', state.target, f.targets, t('market.filter.all', 'All'))}
            </span>` : ''}

          ${hasActiveFilters() ? /* html */`
            <a href="javascript:void(0)" id="fme-clear-filters"
               style="color:#e74c3c;font-size:0.85em;">
              <i class="fa fa-times-circle"></i>&nbsp;
              ${t('market.filter.clear', 'Clear filters')}
            </a>` : ''}

        </td>
      </tr>
    `;
  };

  // ── renderRow ──────────────────────────────────────────────────────────────
  const renderRow = (item, i) => {
    const cls      = i % 2 === 0 ? D.ROW_ODD : D.ROW_EVEN;
    const showType = state.tab === 'catalog';
    const verified = item.author?.includes('FME')
      ? `<i class="fa ${I.CHECK}"
            title="${t('market.verified', 'Verified by FME')}"
            style="color:#fff;background:#637fab;padding:3px;border-radius:50%;
                   font-size:10px;line-height:normal;margin-right:2px;"></i>`
      : `<i class="fa ${I.USER}" style="margin-right:2px;"></i>`;

    return /* html */`
      <tr class="${cls}">
        <td width="4%" style="text-align:center;vertical-align:middle;">
          <i class="fa ${_icon(item.type)}" title="${_label(item.type)}"
             style="font-size:1.3em;color:#369fcf;"></i>
        </td>
        <td style="vertical-align:middle;">
          <strong>${Utils.Str.escapeHTML(item.name ?? '')}</strong>
          <br>
          <small class="${D.HELP_TEXT}">
            ${Utils.Str.escapeHTML(Utils.Str.truncate(item.description ?? '', 110))}
          </small>
          <br>
          <div style="margin:3px 0;">
            ${(item.tags ?? []).map(tag => /* html */`
              <small class="fme-tag-filter"
                     data-tag="${Utils.Str.escapeHTML(tag)}"
                     title="${t('market.filter.by_tag', 'Filter by tag')}"
                     style="background:#edf2f6;color:#5a7080;padding:1px 5px;
                            border-radius:3px;margin-right:2px;cursor:pointer;">
                #${Utils.Str.escapeHTML(tag)}
              </small>`).join('')}
          </div>
        </td>
        ${showType ? /* html */`
          <td width="9%" style="text-align:center;white-space:nowrap;vertical-align:middle;">
            <small>${_label(item.type)}</small>
          </td>` : ''}
        <td width="7%" style="text-align:center;white-space:nowrap;vertical-align:middle;">
          <code>v${Utils.Str.escapeHTML(item.version ?? '?')}</code>
        </td>
        <td width="12%" style="white-space:nowrap;vertical-align:middle;">
          ${verified}
          <small>${item.author?.includes('FME')
            ? `<strong>${Utils.Str.escapeHTML(item.author)}</strong>`
            : Utils.Str.escapeHTML(item.author ?? '—')}</small>
          <br>
          <small class="${D.HELP_TEXT}">
            <i class="fa ${I.DOWNLOAD}"></i>&nbsp;${(item.downloads ?? 0).toLocaleString()}
            &nbsp;·&nbsp;
            <i class="fa fa-star" style="color:#f1c40f;"></i>&nbsp;${item.stars ?? 0}
            ${item.updated
              ? `&nbsp;·&nbsp;<i class="fa fa-calendar-o"></i>&nbsp;${Utils.Str.formatDate(item.updated)}`
              : ''}
          </small>
        </td>
        <td width="14%" style="white-space:nowrap;vertical-align:middle;">
          ${_badge(item)}
        </td>
        <td width="16%" align="right" style="white-space:nowrap;vertical-align:middle;">
          <a href="javascript:void(0)" class="fme-mkt-action btn-details"
             data-id="${Utils.Str.escapeHTML(item.id ?? '')}"
             data-type="${Utils.Str.escapeHTML(item.type ?? '')}"
             title="${t('market.actions.details', 'Details')}"
             style="color:#369fcf;margin:0 3px;font-size:1.15em;">
            <i class="fa fa-info-circle"></i>
          </a>
          ${item.installed && item.hasUpdate ? /* html */`
            <a href="javascript:void(0)" class="fme-mkt-action btn-update"
               data-id="${Utils.Str.escapeHTML(item.id ?? '')}"
               data-type="${Utils.Str.escapeHTML(item.type ?? '')}"
               title="${t('market.actions.update', 'Update')}"
               style="color:#e67e22;margin:0 3px;font-size:1.15em;">
              <i class="fa fa-refresh"></i>
            </a>` : ''}
          ${!item.installed ? /* html */`
            <a href="javascript:void(0)" class="fme-mkt-action btn-install"
               data-id="${Utils.Str.escapeHTML(item.id ?? '')}"
               data-type="${Utils.Str.escapeHTML(item.type ?? '')}"
               data-file="${Utils.Str.escapeHTML(item.file ?? '')}"
               data-path="${Utils.Str.escapeHTML(item.path ?? '')}"
               title="${t('market.actions.install', 'Install')}"
               style="color:#27ae60;margin:0 3px;font-size:1.15em;">
              <i class="fa fa-download"></i>
            </a>` : ''}
          ${item.installed && !item.hasUpdate ? /* html */`
            <a href="javascript:void(0)" class="fme-mkt-action btn-remove"
               data-id="${Utils.Str.escapeHTML(item.id ?? '')}"
               data-type="${Utils.Str.escapeHTML(item.type ?? '')}"
               title="${t('market.actions.remove', 'Remove')}"
               style="color:#e74c3c;margin:0 3px;font-size:1.15em;">
              <i class="fa fa-trash-o"></i>
            </a>` : ''}
        </td>
      </tr>
    `;
  };

  // ── renderModal ────────────────────────────────────────────────────────────
  const renderModal = (item) => /* html */`
    <div id="fme-modal-overlay"
         style="position:fixed;inset:0;background:rgba(0,0,0,0.5);
                z-index:9999;display:flex;align-items:center;
                justify-content:center;padding:20px;">
      <div style="background:#fff;width:100%;max-width:620px;max-height:85vh;
                  overflow:hidden;display:flex;flex-direction:column;
                  border:1px solid #b0bec5;box-shadow:0 4px 20px rgba(0,0,0,0.2);">

        <div style="background:#e8eef2;border-bottom:2px solid #b0bec5;padding:8px 12px;
                    display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <span>
            <i class="fa ${_icon(item.type)}" style="color:#369fcf;margin-right:6px;"></i>
            <strong>${Utils.Str.escapeHTML(item.name ?? '')}</strong>
            &nbsp;<small style="color:#888;">${_label(item.type)}</small>
          </span>
          <a href="javascript:void(0)" id="fme-modal-close-btn"
             style="color:#888;font-size:1.2em;"><i class="fa fa-times"></i></a>
        </div>

        <div style="overflow-y:auto;flex:1;padding:10px 12px;">
          <table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%"
                 style="margin-bottom:10px;">
            <tr class="${D.ROW_ODD}">
              <td width="25%"><strong>${t('market.modal.version', 'Version')}</strong></td>
              <td><code>v${Utils.Str.escapeHTML(item.version ?? '?')}</code></td>
              <td width="25%"><strong>${t('market.modal.author', 'Author')}</strong></td>
              <td>${Utils.Str.escapeHTML(item.author ?? '—')}</td>
            </tr>
            <tr class="${D.ROW_EVEN}">
              <td><strong>${t('market.modal.updated', 'Last updated')}</strong></td>
              <td>${item.updated ? Utils.Str.formatDate(item.updated) : 'N/A'}</td>
              <td><strong>${t('market.modal.downloads', 'Downloads')}</strong></td>
              <td>
                <i class="fa ${I.DOWNLOAD}"></i>&nbsp;${(item.downloads ?? 0).toLocaleString()}
                &nbsp;·&nbsp;
                <i class="fa fa-star" style="color:#f1c40f;"></i>&nbsp;${item.stars ?? 0}
              </td>
            </tr>
            <tr class="${D.ROW_ODD}">
              <td><strong>${t('common.status', 'Status')}</strong></td>
              <td colspan="3">${_badge(item)}</td>
            </tr>
            ${item.engine ? /* html */`
              <tr class="${D.ROW_EVEN}">
                <td><strong>Engine</strong></td>
                <td colspan="3">${Utils.Str.escapeHTML(item.engine)}</td>
              </tr>` : ''}
            ${item.target ? /* html */`
              <tr class="${D.ROW_EVEN}">
                <td><strong>Target</strong></td>
                <td colspan="3">${Utils.Str.escapeHTML(item.target)}</td>
              </tr>` : ''}
          </table>

          ${Utils.DOM.fieldset(
            t('market.modal.description', 'Description'), {},
            /* html */`
              <p class="${D.HELP_TEXT}" style="margin:4px 0;">
                ${Utils.Str.escapeHTML(item.description ?? '')}
              </p>
              <div style="margin-top:6px;">
                ${(item.tags ?? []).map(tag => /* html */`
                  <small style="background:#edf2f6;color:#5a7080;
                         padding:1px 6px;border-radius:3px;margin-right:3px;">
                    #${Utils.Str.escapeHTML(tag)}
                  </small>`).join('')}
              </div>`
          )}

          ${Utils.DOM.fieldset(
            t('market.modal.changelog', 'Changelog'), {},
            /* html */`
              <pre class="${D.HELP_TEXT}"
                   style="white-space:pre-wrap;margin:0;font-size:0.85em;
                          max-height:200px;overflow-y:auto;">${
                Utils.Str.escapeHTML(
                  item.changelog || t('market.modal.noChangelog', 'No changelog available.')
                )}</pre>`
          )}
        </div>

        <div style="background:#f0f4f6;border-top:1px solid #b0bec5;padding:8px 12px;
                    display:flex;gap:6px;justify-content:flex-end;flex-shrink:0;">
          ${item.installed && item.hasUpdate ? /* html */`
            <input type="button" class="icon_add fme-modal-action btn-update"
                   data-id="${Utils.Str.escapeHTML(item.id ?? '')}"
                   data-type="${Utils.Str.escapeHTML(item.type ?? '')}"
                   value="${t('market.modal.update', 'Update')}" />` : ''}
          ${!item.installed ? /* html */`
            <input type="button" class="icon_ok fme-modal-action btn-install"
                   data-id="${Utils.Str.escapeHTML(item.id ?? '')}"
                   data-type="${Utils.Str.escapeHTML(item.type ?? '')}"
                   data-file="${Utils.Str.escapeHTML(item.file ?? '')}"
                   data-path="${Utils.Str.escapeHTML(item.path ?? '')}"
                   value="${t('market.modal.install', 'Install')}" />` : ''}
          ${item.installed && !item.hasUpdate ? /* html */`
            <input type="button" class="icon_cancel fme-modal-action btn-remove"
                   data-id="${Utils.Str.escapeHTML(item.id ?? '')}"
                   data-type="${Utils.Str.escapeHTML(item.type ?? '')}"
                   value="${t('market.modal.remove', 'Remove')}" />` : ''}
          <input type="button" class="btn" id="fme-modal-close-footer"
                 value="${t('market.modal.close', 'Close')}" />
        </div>
      </div>
    </div>
  `;

  // ── refreshResults ─────────────────────────────────────────────────────────
  const refreshResults = (container) => {
    const { list, total, pages } = getPaged();
    const showType = state.tab === 'catalog';

    // Coloana Type — show/hide
    const thType = container.querySelector('#th-type');
    if (thType) thType.style.display = showType ? '' : 'none';

    // Sync toolbar fără a-l distruge
    const searchEl = container.querySelector('#fme-market-search');
    const sortEl   = container.querySelector('#fme-market-sort');
    const clearEl  = container.querySelector('#fme-search-clear');
    if (searchEl && document.activeElement !== searchEl) searchEl.value = state.search;
    if (sortEl)  sortEl.value          = state.sort;
    if (clearEl) clearEl.style.display = state.search ? '' : 'none';

    // Filtre — re-randate la fiecare refresh (opțiunile se schimbă la tab switch)
    const filtersEl = container.querySelector('#fme-market-filters');
    if (filtersEl) {
      const tmp = document.createElement('tbody');
      tmp.innerHTML = renderFilters();
      filtersEl.replaceWith(tmp.firstElementChild);
    }

    // Tbody
    const tbody = container.querySelector('#fme-market-tbody');
    if (tbody) {
      tbody.innerHTML = list.length
        ? list.map((item, i) => renderRow(item, i)).join('')
        : /* html */`
            <tr class="${D.ROW_ODD}">
              <td colspan="7" style="text-align:center;padding:24px;">
                <i class="fa fa-search"></i>&nbsp;
                ${hasActiveFilters() || state.search
                  ? /* html */`
                      ${t('market.empty', 'No items match your filters.')}
                      &nbsp;
                      <a href="javascript:void(0)" id="fme-clear-all"
                         style="color:#e74c3c;">
                        ${t('market.filter.clear', 'Clear filters')}
                      </a>`
                  : t('market.empty_tab', 'No items in this category.')}
              </td>
            </tr>`;
    }

    // Pagination
    const pgEl = container.querySelector('#fme-market-pagination');
    if (pgEl) {
      pgEl.innerHTML = buildPagination(D, t, {
        page: state.page, pages, total, pageSize: PAGE_SIZE,
      });
    }
  };

  // ── updateTabCounts ────────────────────────────────────────────────────────
  const updateTabCounts = (container) => {
    container.querySelectorAll('a[data-tab]').forEach(a => {
      const key   = a.dataset.tab;
      const count = key === 'catalog'
        ? items.length
        : items.filter(i => i.type === key.replace(/s$/, '')).length;
      a.innerHTML = `<span>${tabLabel(key, count)}</span>`;
    });
  };

  // ──────────────────────────────────────────────────────────────────────────
  // PAGE RETURN
  // ──────────────────────────────────────────────────────────────────────────

  return {
    breadcrumbs: [
      { label: t('nav.marketplace', 'Marketplace') },
    ],

    html: /* html */`
      <div id="fme-market-tabs-wrap">
        <div id="menu-body">${tabsHtml}</div>
      </div>
      <div class="panel_menu">
        <br>
        <div data-section="fme-market-content-wrap" id="fme-market-content-wrap">

          <table class="${D.TABLE}" cellspacing="1" cellpadding="5"
                 width="100%" style="margin-bottom:8px;" id="fme-market-toolbar">
            <tr class="${D.ROW_ODD}">
              <td width="12%">
                <label for="fme-market-search">${t('common.search', 'Search')}</label>
              </td>
              <td>
                <input type="text" id="fme-market-search" style="width:220px"
                       placeholder="${t('market.search', 'Search…')}" />
                <input type="button" id="fme-search-clear" value="✕"
                       class="btn" style="margin-left:4px;display:none;" />
              </td>
              <td width="12%" align="right">
                <label for="fme-market-sort">${t('market.sort.label', 'Sort by')}</label>
              </td>
              <td width="25%">
                <select id="fme-market-sort">
                  <option value="downloads">${t('market.sort.popular',  'Most downloaded')}</option>
                  <option value="stars">    ${t('market.sort.stars',    'Most starred')}</option>
                  <option value="updated">  ${t('market.sort.updated',  'Recently updated')}</option>
                  <option value="name">     ${t('market.sort.name',     'Name (A–Z)')}</option>
                </select>
              </td>
            </tr>
            <!-- Filtere — placeholder, completat după fetch -->
            <tr class="${D.ROW_EVEN}" id="fme-market-filters">
              <td colspan="4" style="text-align:center;color:#aaa;padding:6px;">
                <i class="fa fa-spinner fa-spin"></i>
              </td>
            </tr>
          </table>

          <table class="${D.TABLE}" cellspacing="1" cellpadding="4" width="100%">
            <thead>
              <tr>
                <th class="thbg" colspan="2" align="left">${t('common.name',      'Name')}</th>
                <th class="thbg" id="th-type">             ${t('common.type',    'Type')}</th>
                <th class="thbg">                          ${t('common.version', 'Version')}</th>
                <th class="thbg">                          ${t('common.author',  'Author')}</th>
                <th class="thbg">                          ${t('common.status',  'Status')}</th>
                <th class="thbg" align="right">            ${t('common.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody id="fme-market-tbody">
              <tr class="${D.ROW_ODD}">
                <td colspan="7" style="text-align:center;padding:24px;">
                  <i class="fa fa-spinner fa-spin"></i>&nbsp;
                  ${t('common.loading', 'Loading…')}
                </td>
              </tr>
            </tbody>
          </table>

          <div id="fme-market-pagination"></div>
        </div>
      </div>
    `,

    // ── Sections ─────────────────────────────────────────────────────────────
    sections: {
      'fme-market-content-wrap': async (el, { bus, signal }) => {
        const container = el;

        const catalogResults = await Promise.allSettled([
          bus.request('fetch:catalog', { type: 'themes'     }),
          bus.request('fetch:catalog', { type: 'plugins'    }),
          bus.request('fetch:catalog', { type: 'extensions' }),
        ]);

        let installed = [];
        try {
          const res = await bus.request('plugins:all');
          installed = Array.isArray(res) ? res : (res?.installed ?? []);
        } catch { /* silent — handler poate lipsi din SW */ }

        if (signal.aborted) return;

        const toItems = (res, type) => {
          if (!res || res.status !== 'fulfilled') return [];
          const data = res.value;
          return (
            data?.items ??
            data?.[type + 's'] ??
            (Array.isArray(data) ? data : [])
          ).map(item => normalizeItem(item, type));
        };

        items = [
          ...toItems(catalogResults[0], 'theme'),
          ...toItems(catalogResults[1], 'plugin'),
          ...toItems(catalogResults[2], 'extension'),
        ];

        const installedIds = new Set(installed.map(p => p.id));
        items.forEach(item => { if (installedIds.has(item.id)) item.installed = true; });

        updateTabCounts(container);
        refreshResults(container);
      },
    },

    // ── onMount ───────────────────────────────────────────────────────────────
    async onMount(container, { signal, bus }) {

      // ── Modal ──────────────────────────────────────────────────────────────
      const closeModal = () => document.querySelector('#fme-modal-overlay')?.remove();
      signal.addEventListener('abort', closeModal);

      const openModal = (id) => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        closeModal();
        document.body.insertAdjacentHTML('beforeend', renderModal(item));
        document.querySelector('#fme-modal-close-btn')
          ?.addEventListener('click', closeModal);
        document.querySelector('#fme-modal-close-footer')
          ?.addEventListener('click', closeModal);
        document.querySelector('#fme-modal-overlay')
          ?.addEventListener('click', e => {
            if (e.target.id === 'fme-modal-overlay') closeModal();
          });
        document.querySelectorAll('.fme-modal-action')
          .forEach(btn => btn.addEventListener('click', async () => {
            closeModal();
            await handleAction(btn, btn.dataset.id);
          }));
      };

      // ── handleAction ───────────────────────────────────────────────────────
      const handleAction = async (el, id) => {
        const item = items.find(i => i.id === id);
        if (!item) return;

        const origHTML = el.innerHTML ?? el.value;
        const isInput  = el.tagName === 'INPUT';
        const setLoad  = () => {
          if (isInput) el.value = '…';
          else         el.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
          el.style.pointerEvents = 'none';
          el.style.opacity       = '0.6';
        };
        const resetEl = () => {
          if (isInput) el.value = origHTML;
          else         el.innerHTML = origHTML;
          el.style.pointerEvents = '';
          el.style.opacity       = '';
        };

        setLoad();

        try {
          if (el.classList.contains('btn-install')) {
            if (item.type === 'plugin') {
              await PluginManager.install(id);
            } else {
              await bus.request('marketplace:install', {
                entry: { id: item.id, type: item.type, file: item.file ?? undefined, path: item.path ?? undefined }
              });
            }
            item.installed = true;
            item.hasUpdate = false;
            Utils.Toast?.success(`${Utils.Str.escapeHTML(item.name)} ${t('market.actions.installed', 'installed.')}`);
          }

          if (el.classList.contains('btn-update')) {
            if (item.type === 'plugin') {
              await PluginManager.update(id);
            }
            item.hasUpdate = false;
            Utils.Toast?.success(`${Utils.Str.escapeHTML(item.name)} ${t('market.actions.updated', 'updated.')}`);
          }

          if (el.classList.contains('btn-remove')) {
            const ok = await (
              Utils.Modal?.confirm(
                t('market.confirmRemove', 'Remove this item?'),
                { confirmClass: 'icon_cancel', confirmLabel: t('market.actions.remove', 'Remove') }
              ) ?? Promise.resolve(window.confirm(t('market.confirmRemove', 'Remove this item?')))
            );
            if (!ok) { resetEl(); return; }

            if (item.type === 'plugin') {
              await PluginManager.uninstall(id);
            }
            item.installed = false;
            item.hasUpdate = false;
            Utils.Toast?.success(`${Utils.Str.escapeHTML(item.name)} ${t('market.actions.removed', 'removed.')}`);
          }

          refreshResults(container);

        } catch (err) {
          console.error(`[Marketplace] Action failed for "${id}":`, err);
          resetEl();
          Utils.Toast?.error(err.message) ?? alert(err.message);
        }
      };

      // ── Tabs ───────────────────────────────────────────────────────────────
      container.querySelector('#fme-market-tabs-wrap')
        ?.addEventListener('click', e => {
          const a = e.target.closest('a[data-tab]');
          if (!a) return;
          e.preventDefault();
          state.tab    = a.dataset.tab;
          state.search = '';
          state.page   = 1;
          clearFilters();

          container.querySelectorAll('#tabs_menu ul li').forEach(li => {
            const link = li.querySelector('a[data-tab]');
            li.id = link?.dataset.tab === state.tab ? SEL.TABS_MENU.ACTIVETAB : '';
          });

          refreshResults(container);
        }, { signal });

      // ── Content clicks — delegat ──────────────────────────────────────────
      container.querySelector('#fme-market-content-wrap')
        ?.addEventListener('click', e => {

          // Paginare
          const pg = e.target.closest('.fme-pg');
          if (pg) {
            e.preventDefault();
            const p = parseInt(pg.dataset.page, 10);
            if (p >= 1) { state.page = p; refreshResults(container); }
            return;
          }

          // Clear search
          if (e.target.id === 'fme-search-clear') {
            state.search = ''; state.page = 1; refreshResults(container); return;
          }

          // Clear filters
          if (e.target.id === 'fme-clear-filters' || e.target.id === 'fme-clear-all') {
            e.preventDefault();
            clearFilters();
            state.search = '';
            refreshResults(container);
            return;
          }

          // Click pe tag → filtru rapid
          const tagEl = e.target.closest('.fme-tag-filter');
          if (tagEl) {
            state.tag  = tagEl.dataset.tag;
            state.page = 1;
            refreshResults(container);
            return;
          }

          // Acțiuni item
          const actionEl = e.target.closest('.fme-mkt-action');
          if (!actionEl) return;
          if (actionEl.classList.contains('btn-details')) { openModal(actionEl.dataset.id); return; }
          handleAction(actionEl, actionEl.dataset.id);
        }, { signal });

      // ── Filtre + Sort ─────────────────────────────────────────────────────
      container.querySelector('#fme-market-content-wrap')
        ?.addEventListener('change', e => {
          const filterMap = {
            'fme-market-sort'   : 'sort',
            'fme-filter-status' : 'status',
            'fme-filter-author' : 'author',
            'fme-filter-tag'    : 'tag',
            'fme-filter-stars'  : 'minStars',
            'fme-filter-engine' : 'engine',
            'fme-filter-target' : 'target',
          };
          const key = filterMap[e.target.id];
          if (!key) return;
          state[key] = e.target.value;
          state.page = 1;
          refreshResults(container);
        }, { signal });

      // ── Search cu debounce ────────────────────────────────────────────────
      container.querySelector('#fme-market-content-wrap')
        ?.addEventListener('input', Utils.Misc.debounce(e => {
          if (e.target.id !== 'fme-market-search') return;
          state.search = e.target.value;
          state.page   = 1;
          refreshResults(container);
        }, 250), { signal });
    },
  };
});