'use strict';
import Utils                         from '../shared/utils.js';
import FM                            from '../shared/forumotion.structure.js';
import { LANGUAGES, t, setLanguage } from '../../i18n/index.js';
import bus                           from './bus.js';
import PAGES                         from './router.js';
import { buildSidebar }              from '../shared/adapter.js';
import PluginManager                 from '../shared/plugin-manager/plugin-manager.js';
import AuditLogger                   from '../shared/audit-logger.js';

const SETTINGS_KEY = 'fme_settings';

class Kernel {
  #origin      = null;
  #tid         = null;
  #pages       = new Map();
  #currentPage = null;

  async init() {
    this.#origin = Utils.UrlUtils.origin();
    this.#tid    = Utils.UrlUtils.param('tid') || null;

    await this.#loadLanguage();

    FM.SESSION.isACP()
      ? await this.#initACP()
      : await this.#initForum();
  }

  async #loadLanguage() {
    const stored  = await Utils.Storage.get([SETTINGS_KEY]);
    const settings = stored[SETTINGS_KEY] ?? {};

    const lang = settings.language
      ?? settings.ui?.language
      ?? Object.keys(LANGUAGES).find(l => navigator.language.startsWith(l))
      ?? 'en';

    setLanguage(lang);
  }

  async #initACP() {
    if (!FM.SESSION.isAuthenticated()) return;

    if (!document.querySelector(FM.ACP_DOM.NAV_BAR)) {
      console.warn('[FME] ACP menu not found. Aborting.');
      return;
    }

    this.#injectNavItem();
    this.#registerBusListeners();

    // Rulează plugin-urile cu hook 'acp' la fiecare page load
    await PluginManager.initAcp();

    if (!FM.SESSION.isFMEPage()) return;

    this.#injectSidebar();

    const activePage = Utils.UrlUtils.param('sub') ?? 'home';
    await this.#renderSection(activePage);
    this.#setActiveNav(activePage);

    bus.emit('fme:ready', { context: 'acp', page: activePage });

    window.addEventListener('popstate', async (e) => {
      if (!FM.SESSION.isFMEPage()) return;
      const pageId = e.state?.fmeSection ?? Utils.UrlUtils.param('sub') ?? 'home';
      const params = e.state?.params    ?? {};
      await this.#renderSection(pageId, params);
      this.#setActiveNav(pageId);
    });
  }

  async #initForum() {
    // Forum — not yet implemented
  }

  #injectNavItem() {
    const fme = Utils.DOM.create('li', { className: 'fme-nav-item' }, `
      <a href="${FM.ACP_URLS.FME_HOME(this.#origin, this.#tid ?? '')}" data-fme-nav="home">
        <span><i class="fa ${FM.ACP_DOM.ICONS?.DASHBOARD ?? 'fa-tachometer'}"></i>&nbsp;FME</span>
      </a>
    `);

    document.querySelector(FM.ACP_DOM.NAV_BAR).lastElementChild.insertAdjacentElement('beforebegin', fme);
  }

  #sidebarMenus() {
    return [
      {
        label: t('nav.groups.main'),
        icon : FM.ACP_DOM.ICONS.DASHBOARD,
        list : [
          { nav: 'marketplace', label: t('nav.marketplace') },
        ],
      },
      {
        label: t('nav.groups.installed'),
        icon : FM.ACP_DOM.ICONS.THEME,
        list : [
          { nav: 'themes',  label: t('nav.themes')  },
          { nav: 'plugins', label: t('nav.plugins') },
        ],
      },
      {
        label: t('nav.groups.admin'),
        icon : FM.ACP_DOM.ICONS.DASHBOARD,
        list : [
          { nav: 'acp_themes',  label: t('nav.adminTheme')   },
          { nav: 'acp_widgets', label: t('nav.adminWidgets') },
          { nav: 'acp_plugins', label: t('nav.adminPlugins') },
        ],
      },
      {
        label: t('nav.groups.system'),
        icon : FM.ACP_DOM.ICONS.SEO,
        list : [
          { nav: 'seo',    label: t('nav.seo')       },
          { nav: 'stats',  label: t('nav.stats')     },
          { nav: 'notes',  label: t('nav.adminNotes') },
          { nav: 'backup', label: t('nav.backup')    },
        ],
      },
      {
        label: t('nav.groups.tools'),
        icon : FM.ACP_DOM.ICONS.SETTINGS,
        list : [
          { nav: 'journal',  label: t('nav.journal')  },
          { nav: 'updates',  label: t('nav.updates')  },
          { nav: 'settings', label: t('nav.settings') },
        ],
      },
      {
        label: t('nav.groups.dev'),
        icon : FM.ACP_DOM.ICONS.AUDIT,
        list : [
          { nav: 'audit',    label: t('nav.acpAudit') },
          { nav: 'advanced', label: t('nav.acpDev')   },
        ],
      },
    ];
  }

  #injectSidebar() {
    const insert = Utils.DOM.find(FM.ACP_DOM.ADMIN_MENU, document);
    if (!insert) return;

    const existing = document.getElementById('fme-sidebar-container');
    if (existing) {
      existing.innerHTML = '';
      existing.innerHTML = buildSidebar('Forumotion Extension', this.#sidebarMenus());
    } else {
      const wrapper = document.createElement('div');
      wrapper.id = 'fme-sidebar-container';
      wrapper.innerHTML = buildSidebar('Forumotion Extension', this.#sidebarMenus());
      insert.insertAdjacentElement('beforebegin', wrapper);
    }
  }

  #setActiveNav(page) {
    const el = Utils.DOM.find(`#${FM.ACP_DOM.SIDEBAR.ITEM_ACTIVE}`);
    if (el) {
      el.setAttribute('class', 'submenu');
      el.removeAttribute('id');
    }

    Utils.DOM.find('a[data-fme-nav="home"]')
      ?.parentNode?.setAttribute('id', 'activetab');

    if (page === 'home') return;

    const navKey = Utils.DOM.find(`[data-fme-nav="${page}"]`)
      ? page
      : (PAGES.find(p => p.page === page)?.navParent ?? page);

    const active = Utils.DOM.find(`[data-fme-nav="${navKey}"]`)?.parentNode;
    if (!active) return;

    el?.removeAttribute('class');
    active.setAttribute('id', FM.ACP_DOM.SIDEBAR.ITEM_ACTIVE);
  }

  async #renderSection(id, params = {}) {
    if (id.includes('&')) {
      const { pageId, params: inlineParams } = this.#parseSection(id);
      return this.#renderSection(pageId, { ...inlineParams, ...params });
    }

    const entry = PAGES.find(p => p.page === id);

    if (!entry) {
      console.warn(`[FME] Page not found: "${id}"`);
      return;
    }

    const container = Utils.DOM.find(FM.ACP_DOM.MAIN_CONTENT);
    if (!container) return;

    container.innerHTML = `
      <div style="padding:32px;text-align:center;color:#aaa;">
        <i class="fa fa-spinner fa-spin fa-2x"></i>
      </div>
    `;

    if (this.#currentPage) {
      this.#currentPage.destroy();
      this.#currentPage = null;
    }

    if (!this.#pages.has(id)) {
      const module = await entry.component();
      this.#pages.set(id, module.default);
    }

    const page = this.#pages.get(id);

    try {
      const html = await page.render({ ...entry, params });
      container.innerHTML = html;
      this.#currentPage   = page;
      await page.setup?.(container);
    } catch (err) {
      console.error(`[FME] Render failed for "${id}":`, err);
      container.innerHTML = `
        <div style="padding:24px;">
          <div class="${FM.ACP_DOM.MESSAGES.ERROR}" style="padding:12px;">
            <i class="fa fa-exclamation-triangle"></i>&nbsp;
            <strong>Eroare la încărcarea paginii "${id}"</strong><br>
            <small style="color:#888;">${err.message}</small>
          </div>
        </div>
      `;

      bus.emit('fme:section:error', { page: id, error: err.message });
      AuditLogger.log('kernel', `Error rendering section "${id}": ${err.message}`, '', 'error');
    }
  }

  #parseSection(section = '') {
    const [pageId, ...rest] = section.split('&');
    const params = rest.length
      ? Object.fromEntries(new URLSearchParams(rest.join('&')))
      : {};
    return { pageId, params };
  }

  #registerBusListeners() {
    bus.on('fme:navigate', async ({ section, params = {} }) => {
      console.info(`[FME] Navigation requested: "${section}" with params`, params);

      const { pageId, params: inlineParams } = this.#parseSection(section);
      const mergedParams = { ...inlineParams, ...params };

      const extraQuery = new URLSearchParams(mergedParams).toString();
      const sectionUrl = extraQuery ? `${pageId}&${extraQuery}` : pageId;
      const url = FM.ACP_URLS.FME_SECTION(this.#origin, this.#tid ?? '', sectionUrl);

      history.pushState({ fmeSection: pageId, params: mergedParams }, '', url);
      await this.#renderSection(pageId, mergedParams);
      console.log(`FME Navigate: `, pageId);
      this.#setActiveNav(pageId);
    });

    bus.on('settings:changed', async (payload) => {
      const { _section: section = 'settings', ...newSettings } = payload ?? {};
      const lang = newSettings.language ?? newSettings.ui?.language;
      if (lang) setLanguage(lang);
      AuditLogger.log('settings', 'Settings saved', lang ? `lang: ${lang}` : '');
      this.#injectSidebar();
      const { pageId, params } = this.#parseSection(section);
      await this.#renderSection(pageId, params);
      this.#setActiveNav(pageId);
    });

    bus.on('fme:error', ({ error }) => {
      console.error('[FME]', error);
    });

    // ── Plugin events ────────────────────────────────────────────────────────
    bus.on('plugin:error', ({ id, error }) => {
      console.error(`[FME] Plugin "${id}" error:`, error);
    });

    // ── Audit listeners ──────────────────────────────────────────────────────
    bus.on('themes:updated', ({ id, action, count }) => {
      const label = ({
        save        : 'Theme saved',
        remove      : 'Theme deleted',
        apply       : 'Theme applied',
        revert      : 'Theme reverted',
        'revert-all': 'All themes reverted',
        import      : `Themes imported (${count ?? '?'})`,
      })[action] ?? action;
      AuditLogger.log('acp_themes', label, id ?? '');
    });

    bus.on('plugin:installed',   ({ id, name }) => AuditLogger.log('plugins', 'Plugin installed',   name ? `${name} (${id})` : `id: ${id}`));
    bus.on('plugin:uninstalled', ({ id })       => AuditLogger.log('plugins', 'Plugin uninstalled', `id: ${id}`));
    bus.on('plugin:toggled',     ({ id, active }) => AuditLogger.log('plugins', active ? 'Plugin enabled' : 'Plugin disabled', `id: ${id}`));
    bus.on('plugin:updated',     ({ id })       => AuditLogger.log('plugins', 'Plugin updated',     `id: ${id}`));
    bus.on('update:available',   ({ version })  => AuditLogger.log('updates', 'Update available',   `v${version}`, 'warning'));
  }
}

export async function createApp() {
  try {
    const kernel = new Kernel();
    await kernel.init();
    return kernel;
  } catch (err) {
    console.error('[FME] Kernel error:', err);
    bus.emit('fme:error', { error: err.message });
    AuditLogger.log('kernel', 'Kernel initialization error: ', err.message, 'error');
  }
}