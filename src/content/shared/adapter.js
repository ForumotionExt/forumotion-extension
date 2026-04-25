import FM from './forumotion.structure.js';
import Utils from './utils.js';
import { t } from '../../i18n/index.js';
import PAGES from '../core/router.js';

const S = FM.ACP_SELECTORS.PAGE_BODY.WRAPPER.MENU;
let _pages = [];
export const setPages = (pages) => { _pages = pages; };

const pageBuilder = (content, {
  url,
  pageName,
  category,
  description,
  breadcrumbs,
} = {}) => {
  const origin = Utils.UrlUtils.origin();
  const tid    = Utils.UrlUtils.param('tid');

  const title    = pageName ?? t(`page.${url}.title`, url) ?? Utils.Str.ucFirst(url);
  const desc     = description ?? t(`page.${url}.description`, '');
  const cat      = _pages.find(p => p.page === url)?.category?.() ?? category;
  const catLabel = cat ? Utils.Str.ucWords(cat) : '';

  const h2 = catLabel
    ? Utils.DOM.createFragment('h2', { className: 'home' },
        `<a href="${FM.ACP_URLS.FME_SECTION(origin, tid, url)}">${catLabel}</a>`
      )
    : '';

  const crumbs = breadcrumbs?.length
    ? breadcrumbs
    : [{ label: title }];

  const breadcrumb = Utils.DOM.createFragment('ul', { className: FM.ACP_DOM.CONTENT.BREADCRUMB },
    crumbs.map((crumb, i) => {
      const isFirst = i === 0;
      const isLast  = i === crumbs.length - 1;
      const cls     = isFirst ? FM.ACP_DOM.CONTENT.BREADCRUMB_FIRST : '';

      if (isLast || !crumb.url) {
        return `<li class="${cls}">${crumb.label}</li>`;
      }

      return `<li class="${cls}">
        <a href="${FM.ACP_URLS.FME_SECTION(origin, tid, crumb.url)}">${crumb.label}</a>
      </li>`;
    }).join('')
  );

  const block = desc
    ? Utils.DOM.createFragment('blockquote', { className: 'block_left' },
        `<p class="explain">${desc}</p>`
      )
    : '';

  return Utils.DOM.createFragment('div', {
    className  : 'fme-page',
    'data-page': url,
  }, `${h2} ${breadcrumb} ${block} ${content}`);
};

const buildTab = ({ href, label, active = false }) => `
  <li ${active ? `id="${FM.ACP_SELECTORS.TABS_MENU.ACTIVETAB}"` : ''}>
    <a href="${href}"><span>${label}</span></a>
  </li>
`;

const buildTabs = (tabs = []) => `
  <div id="${FM.ACP_SELECTORS.TABS_MENU.selector}">
    <ul>${tabs.map(buildTab).join('')}</ul>
  </div>
`;

const buildBtns = (btns = []) => {
  const buttons = btns.map(({ type = 'button', name = '', value = '', cls = '', ...opt }) => {
    const _opts = Object.entries(opt)
      .map(([key, val]) => `${key}="${val}"`)
      .join(' ');

    return `<input 
      type="${type}" 
      class="${cls}"
      name="${name}"
      value="${value}"
      ${_opts ? ` ${_opts}` : ''}
    />`;
  }).join('');

  return `<div class="${FM.ACP_SELECTORS.BTNS.selector}">${buttons}</div>`;
};

const buildSidebar = (top, menus = []) => {
  const exists     = Utils.DOM.find(`.${S.SIDEBAR.selector}`, document);
  const origin     = Utils.UrlUtils.origin();
  const tid        = Utils.UrlUtils.param('tid') || null;
  const activePage = Utils.UrlUtils.param('sub') ?? 'home';

  let _header;

  if(exists) {
    exists.innerHTML = `&nbsp;${top}`;
  } else {
    _header = `<div class="${S.SIDEBAR.selector}">&nbsp;${top}</div>`;
  }

  return `
    ${!exists ? _header : ''}
    ${menus.map(({ label = '', icon = '', list = [] }) => `
      <div class="${S.SIDEBAR.TOP.selector}">
        <div class="left-top">&nbsp;&nbsp;<i class="fa ${icon}"></i>&nbsp;${label}</div>
      </div>
      <br clear="all">
      <div class="${S.SIDEBAR.MENU.selector}">
        ${list.map(({ nav = '', label = '' }) => `
          <div ${activePage === nav ? `id="${S.SIDEBAR.MENU.ACTIVE.selector}"` : `class="${S.SIDEBAR.MENU.SUBMENU.selector}"`}>
            <a href="${FM.ACP_URLS.FME_SECTION(origin, tid, nav)}" data-fme-nav="${nav}"><span>${label}</span></a>
          </div>
        `).join('')}
      </div>
      <br clear="all">
    `).join('<br>')}
  `;
};

export function buildPagination(D, t, { page, pages, total, pageSize }) {
  if (pages <= 1) return '';

  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);

  const links = Array.from({ length: pages }, (_, i) => i + 1).map(p =>
    p === page
      ? `<strong>[${p}]</strong>`
      : `<a href="#" class="fme-pg" data-page="${p}">${p}</a>`
  ).join(' ');

  return `
    <div class="${D.NAV_BAR}" style="margin-top:8px;padding:4px 0;
         display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
      <span class="${D.HELP_TEXT}">
        ${t('market.pagination.showing', {}, 'Showing')} ${start}–${end}
        ${t('market.pagination.of', {}, 'of')} ${total}
      </span>
      <span>
        ${page > 1  ? `<a href="#" class="fme-pg" data-page="${page - 1}">← ${t('market.pagination.prev', {}, 'Prev')}</a>&nbsp;` : ''}
        ${links}
        ${page < pages ? `&nbsp;<a href="#" class="fme-pg" data-page="${page + 1}">${t('market.pagination.next', {}, 'Next')} →</a>` : ''}
      </span>
    </div>
  `;
}

export default pageBuilder;
export {
  buildTab,
  buildTabs,
  buildBtns,
  buildSidebar
}