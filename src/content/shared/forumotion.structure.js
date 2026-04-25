/**
 * Forumotion Extension - Forumotion Admin Panel Enhancements
 */

'use strict';

const FMClassDom = {
    success: '.successbox',
    error: '.errorbox',
    messagebox: '.messagebox',
};

const ACP_DOM = {
  // Selectori primari
  NAV_BAR      : '#page-body #tabs > ul',
  MENU         : '#menu',
  MAIN_CONTENT : '#main-content',
  HEADER       : '#header',
  ACTIVE_TAB   : '#activetab',
  NAV_ITEM     : '#menu .submenu',
  ADMIN_SEARCH : '#admin_search',
  GROUP_BORDER : 'coins-border',
  ADMIN_MENU   : '#admin_version',

  MAIN_CONTENT_FALLBACKS: [],
  SIDEBAR_FALLBACKS: [],

  SIDEBAR: {
    HEADER       : 'header',
    GROUP_TOP    : 'coins-top',
    GROUP_LABEL  : 'left-top',
    GROUP_BORDER : 'coins-border',
    ITEM         : 'submenu',
    ITEM_ACTIVE  : 'activesubmenu',
  },
  
  CONTENT: {
    WRAPPER         : 'main-content',
    BREADCRUMB      : 'h2-breadcrumb',
    BREADCRUMB_FIRST: 'first',
    HELP_TEXT       : 'explain',
    TABLE           : 'table1',
    ROW_ODD         : 'row1',
    ROW_EVEN        : 'row2',
    NAV_BAR         : 'nav',
    NAV_RIGHT       : 'right-box gen-box',
    GROUP           : 'gen-group',
  },

  BADGE: {
    OK   : 'badge-ok',
    WARN : 'badge-warn',
    ERROR: 'badge-error',
  },

  MESSAGES: {
    SUCCESS: 'successbox',
    ERROR  : 'errorbox',
    INFO   : 'messagebox',
  },

  // FontAwesome 4.x
  ICONS: {
    HOME     : 'fa-home',
    THEME    : 'fa-paint-brush',
    TEMPLATE : 'fa-file-code-o',
    PLUGIN   : 'fa-plug',
    CSS      : 'fa-css3',
    JS       : 'fa-code',
    WIDGET   : 'fa-code',
    MAGIC    : 'fa-magic',
    SEO      : 'fa-search',
    NOTE     : 'fa-sticky-note-o',
    LOG      : 'fa-history',
    STATS    : 'fa-bar-chart',
    CHANGELOG : 'fa-list-alt',
    BACKUP   : 'fa-database',
    SETTINGS : 'fa-cog',
    DASHBOARD: 'fa-dashboard',
    USER     : 'fa-user',
    SAVE     : 'fa-save',
    TRASH    : 'fa-trash',
    EDIT     : 'fa-edit',
    PLUS     : 'fa-plus',
    CHECK    : 'fa-check',
    TIMES    : 'fa-times',
    WARNING  : 'fa-exclamation-triangle',
    INFO     : 'fa-info-circle',
    SPINNER  : 'fa-spinner fa-spin',
    GITHUB   : 'fa-github',
    DOWNLOAD : 'fa-download',
    UPLOAD   : 'fa-upload',
    LOCK     : 'fa-lock',
    GLOBE    : 'fa-globe',
    MARKET   : 'fa-shopping-cart',
    AUDIT    : 'fa-terminal',
  },
};

const ACP_URLS = {
  HOME    : (o) => `${o}/admin/`,
  GENERAL : (o) => `${o}/admin/?part=general`,
  THEMES  : (o) => `${o}/admin/?part=themes`,

  // Templates
  TEMPLATES_LIST : (o, tid, cat) =>
    `${o}/admin/?part=themes&sub=templates&mode=edit_${cat}&extended_admin=1&tid=${tid}`,
  TEMPLATE_EDIT  : (o, tid, cat, id) =>
    `${o}/admin/?part=themes&sub=templates&mode=edit_${cat}&t=${id}&l=${cat}&extended_admin=1&tid=${tid}`,

  // Theme / CSS
  THEME_VERSION : (o, tid) =>
    `${o}/admin/?part=themes&sub=styles&mode=version&extended_admin=1&tid=${tid}`,
  THEME_CSS     : (o, tid) =>
    `${o}/admin/?part=themes&sub=styles&mode=edit_theme&extended_admin=1&tid=${tid}`,

  // JS Modules
  JS_LIST : (o, tid) =>
    `${o}/admin/?mode=js&part=modules&sub=html&extended_admin=1&tid=${tid}`,
  JS_EDIT : (o, tid, id) =>
    id ? `${o}/admin/?part=modules&sub=html&mode=js_edit&id=${id}&extended_admin=1&tid=${tid}`
    : `${o}/admin/?part=modules&sub=html&mode=js_edit&extended_admin=1&tid=${tid}`,

  // FME (paginile noastre)
  FME_HOME    : (o, tid) => `${o}/admin/?part=fme&extended_admin=1&tid=${tid}`,
  FME_SECTION : (o, tid, sub) => `${o}/admin/?part=fme&sub=${sub}&extended_admin=1&tid=${tid}`,
};

const DOMAINS = [
  'forumgratuit.ro',
  'forumotion.com',
  'forumotion.net',
  'forumotion.eu',
  'forum.st',
  'forumz.ro'
];

const ENGINES = {
	LIST: [
    { value: 'subsilver', label: 'phpBB2'    },
    { value: 'prosilver', label: 'phpBB3'    },
    { value: 'punbb',     label: 'PunBB'     },
    { value: 'invision',  label: 'Invision'  },
    { value: 'modernbb',  label: 'ModernBB'  },
    { value: 'awesomebb', label: 'AwesomeBB' },
	],

	ALIASES: [
		{ value: 'phpbb2', label: 'phpBB2' },
		{ value: 'phpbb3', label: 'phpBB3' },
		{ value: 'punbb',   label: 'PunBB'   },
		{ value: 'invision',label: 'Invision'},
		{ value: 'modernbb',label: 'ModernBB'},
		{ value: 'awesomebb',label: 'AwesomeBB'},
	],

	detect: (doc = document) => {
    if (doc.querySelector('link[href*="prosilver"]'))  return 'prosilver';
    if (doc.querySelector('link[href*="subsilver"]'))  return 'subsilver';
    if (doc.querySelector('link[href*="punbb"]'))      return 'punbb';
    if (doc.querySelector('link[href*="invision"]'))   return 'invision';
    if (doc.querySelector('link[href*="modernbb"]'))   return 'modernbb';
    if (doc.querySelector('link[href*="awesomebb"]'))  return 'awesomebb';
    return null;
	},

  isValid(value) {
    return this.LIST.some(e => e.value === value);
  },

  getLabel(value) {
    return this.LIST.find(e => e.value === value)?.label ?? value;
  },
};

const SESSION    = {
  isACP(url = window.location.href) {
    return /\/admin(hd)?/.test(url);
  },

  isLoginPage(doc = document) {
    return !!(
      doc.querySelector('input[name="password"]') ||
      doc.querySelector('form[action*="login"]')
    );
  },

  isAuthenticated(doc = document) {
    return !!(
      doc.getElementById('menu') ||
      doc.getElementById('main-content')
    );
  },

  isFMEPage(url = window.location.href) {
    return new URLSearchParams(url.split('?')[1]).get('part') === 'fme';
  },

  getSection(url = window.location.href) {
    return new URLSearchParams(url.split('?')[1]).get('sub') || 'home';
  },
};

const TEMPLATES = {
	CATEGORIES: [
		{ key: 'main', 							label: 'General' },
		{ key: 'portal', 						label: 'Portal' },
		{ key: 'gallery', 					label: 'Galerie' },
		{ key: 'calendar', 					label: 'Calendar' },
		{ key: 'group', 						label: 'Grupuri' },
		{ key: 'post', 							label: 'Postare & Mesaje Private' },
		{ key: 'moderation', 				label: 'Moderare' },
		{ key: 'profil', 						label: 'Profil' },
		{ key: 'mobile',     				label: 'Mobil' },
	],
	
  // Marker FME injectat în template-urile modificate
  MARKER: {
    PREFIX : '<!-- @FME',
    PATTERN: /<!-- @FME theme="([^"]+)" v="([^"]+)" date="([^"]+)" -->/,

    build(themeId, version) {
      return `<!-- @FME theme="${themeId}" v="${version}" date="${new Date().toISOString()}" -->`;
    },

    parse(content) {
      const m = (content || '').match(this.PATTERN);
      return m ? { themeId: m[1], version: m[2], date: m[3] } : null;
    },

    strip(content) {
      return (content || '').replace(
        /\n?<!-- @FME theme="[^"]+" v="[^"]+" date="[^"]+" -->\n?/g, ''
      );
    },
    
    has(content) {
      return this.PATTERN.test(content || '');
    },
  },
};

const ACP_SELECTORS = {
  HEADER: {
    MAIN: {
      selector: '#page-header',
      props: { background: '#fff', height: '80px' }
    },

    RIGHT_SIDE: {
      selector: '.right-header',
      props: { height: '80px', borderLeft: '1px solid transparent' }
    },

    RIGHT_PREVIEW: {
      selector: '.right-header-preview',
      props: { backgroundColor: '#2e3133', height: '20px' }
    },

    LOGO: {
      selector: '.logo-header',
      props: { backgroundColor: 'white', height: '80px', position: 'absolute' }
    },
  },

  PAGE_BODY: {
    selector: '#page-body',

    TABS: {
      selector: '#tabs',
      props: { paddingLeft: '40px', backgroundColor: '#369fcf' }
    },

    WRAPPER: {
      selector: '#wrapper',

      CONTENT: {
        selector: '#content',
        props: { fontSize: '0.8em', backgroundColor: '#fff' }
      },

      MENU: {
        selector: '#menu',
        props: {
          width          : '20%',
          backgroundColor: '#f7f7f7',
          borderRight    : '1px solid #dae3e9',
          borderBottom   : '1px solid #dae3e9',
        },

        HEADER: {
          selector: '.header',
          props: { color: '#369fcf' }
        },

        SIDEBAR: {
          selector: 'header',

          TOP: {
            selector: 'coins-top',
          },

          MENU: {
            selector: 'coins-border',

            SUBMENU: {
              selector: 'submenu'
            },

            ACTIVE: {
              selector: 'activesubmenu'
            }
          }
        }
      },

      MAIN: {
        selector : '#main',
        CONTENT  : { selector: '#main-content' },
      },
    },
  },

  TABS_MENU: {
    selector  : 'tabs_menu',
    ACTIVETAB : 'activetab',
  },

  BTNS: {
    selector: 'div_btns',
    CLASSES: {
      icon_ok     : { selector: '.icon_ok',     props: { backgroundColor: '#94ce68' } },
      icon_add    : { selector: '.icon_add',    props: { backgroundColor: '#94ce68' } },
      icon_search : { selector: '.icon_search', props: { backgroundColor: '#2e3133' } },
    },
  },
};

export default {
  FMClassDom,
  ACP_DOM,
  ACP_URLS,
  ACP_SELECTORS,
  DOMAINS,
  SESSION,
  ENGINES,
  TEMPLATES,
};