'use strict';

/**
 * @file marketplace.utils.js
 * @description Utilitare pure pentru pagina Marketplace.
 *              Fără dependențe de DOM, bus sau storage.
 */

/**
 * Normalizează un item din catalog la un format uniform.
 * @param {Object} item  — item brut din API
 * @param {string} type  — 'theme' | 'plugin' | 'extension' | 'widget'
 */
export function normalizeItem(item, type) {
  return {
    ...item,
    type,
    updated  : item.updatedAt ?? item.updated ?? null,
    downloads: item.downloads ?? 0,
    stars    : item.stars     ?? 0,
    paid     : item.paid      ?? false,
    // State local — nu vine din API
    installed: false,
    hasUpdate: false,
    changelog: '',
  };
}

/**
 * Returnează iconița FA4 pentru un tip de item.
 * @param {Object} I     — FM.ACP_DOM.ICONS
 * @param {string} type
 */
export function typeIcon(I, type) {
  return {
    theme    : I.THEME,
    plugin   : I.PLUGIN,
    extension: I.GLOBE,
    widget   : I.WIDGET ?? 'fa-th-large',
  }[type] ?? I.MARKET;
}

/**
 * Returnează label-ul localizat pentru un tip de item.
 * @param {Function} t    — funcția de traducere
 * @param {string}   type
 */
export function typeLabel(t, type) {
  return {
    theme    : t('market.types.theme',     {}, 'Theme'),
    plugin   : t('market.types.plugin',    {}, 'Plugin'),
    extension: t('market.types.extension', {}, 'Extension'),
    widget   : t('market.types.widget',    {}, 'Widget'),
  }[type] ?? type;
}

/**
 * Returnează badge-ul HTML pentru starea unui item.
 * @param {Object}   B    — FM.ACP_DOM.BADGE
 * @param {Object}   I    — FM.ACP_DOM.ICONS
 * @param {Function} t
 * @param {Object}   item
 */
export function statusBadge(B, I, t, item) {
  if (!item.installed)
    return `<span class="${B.ERROR}"><i class="fa ${I.TIMES}"></i>&nbsp;${t('market.status.notInstalled', {}, 'Not installed')}</span>`;
  if (item.hasUpdate)
    return `<span class="${B.WARN}"><i class="fa ${I.WARNING}"></i>&nbsp;${t('market.status.updateAvail', {}, 'Update available')}</span>`;
  return `<span class="${B.OK}"><i class="fa ${I.CHECK}"></i>&nbsp;${t('market.status.installed', {}, 'Installed')}</span>`;
}

/**
 * Sortează o listă de items după criteriu.
 * @param {Array}  list
 * @param {string} sort  — 'downloads' | 'updated' | 'name' | 'stars'
 */
export function sortItems(list, sort) {
  return [...list].sort((a, b) => {
    if (sort === 'downloads') return (b.downloads ?? 0) - (a.downloads ?? 0);
    if (sort === 'stars')     return (b.stars     ?? 0) - (a.stars     ?? 0);
    if (sort === 'updated')   return new Date(b.updated ?? 0) - new Date(a.updated ?? 0);
    if (sort === 'name')      return (a.name ?? '').localeCompare(b.name ?? '');
    return 0;
  });
}

/**
 * Construiește HTML pentru paginare.
 * @param {Object}   D         — FM.ACP_DOM.CONTENT
 * @param {Function} t
 * @param {Object}   opts
 * @param {number}   opts.page
 * @param {number}   opts.pages
 * @param {number}   opts.total
 * @param {number}   opts.pageSize
 */
export function buildPagination(D, t, { page, pages, total, pageSize }) {
  if (pages <= 1) return '';

  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);

  const links = Array.from({ length: pages }, (_, i) => i + 1).map(p =>
    p === page
      ? `<strong style="padding:0 4px;">[${p}]</strong>`
      : `<a href="#" class="fme-pg" data-page="${p}" style="padding:0 4px;">${p}</a>`
  ).join('');

  return `
    <div class="${D.NAV_BAR}" style="margin-top:8px;padding:4px 0;
         display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
      <span class="${D.HELP_TEXT}">
        ${t('market.pagination.showing', {}, 'Showing')} ${start}–${end}
        ${t('market.pagination.of', {}, 'of')} ${total}
      </span>
      <span>
        ${page > 1
          ? `<a href="#" class="fme-pg" data-page="${page - 1}">← ${t('market.pagination.prev', {}, 'Prev')}</a>&nbsp;`
          : ''}
        ${links}
        ${page < pages
          ? `&nbsp;<a href="#" class="fme-pg" data-page="${page + 1}">${t('market.pagination.next', {}, 'Next')} →</a>`
          : ''}
      </span>
    </div>
  `;
}