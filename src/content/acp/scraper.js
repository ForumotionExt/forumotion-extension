// kernel/sidebar.js
import FM    from '../shared/forumotion.structure.js';
import Utils from '../shared/utils.js';
import { t } from '../../i18n/index.js';

const SIDEBAR_GROUPS = [
  {
    label : t('nav.groups.installed', {}, 'Customize'),
    icon  : FM.ACP_DOM.ICONS.THEME,
    items : [
      { nav: 'marketplace',  icon: FM.ACP_DOM.ICONS.MARKET, label: t('nav.marketplace', {}, 'Marketplace')  },
      { nav: 'themes',       icon: FM.ACP_DOM.ICONS.THEME,  label: t('nav.themes', {}, 'Themes')            },
      { nav: 'templates',    icon: FM.ACP_DOM.ICONS.WIDGET, label: t('nav.templates', {}, 'Templates')      },
      { nav: 'plugins',      icon: FM.ACP_DOM.ICONS.PLUGIN, label: t('nav.plugins', {}, 'Plugins')          },
    ],
  },
  {
    label : t('nav.groups.admin', {}, 'Admin Panel'),
    icon  : FM.ACP_DOM.ICONS.DASHBOARD,
    items : [
      { nav: 'acp_themes', icon: FM.ACP_DOM.ICONS.CSS,    label: t('nav.adminTheme', {}, 'Theme Builder') },
      { nav: 'acp_widgets',   icon: FM.ACP_DOM.ICONS.WIDGET, label: t('nav.adminWidgets', {}, 'Widgets')     },
      { nav: 'acp_plugins',   icon: FM.ACP_DOM.ICONS.PLUGIN, label: t('nav.adminPlugins', {}, 'Plugins')     },
    ],
  },
  {
    label : t('nav.groups.tools', {}, 'Tools'),
    icon  : FM.ACP_DOM.ICONS.SEO,
    items : [
      { nav: 'seo',    icon: FM.ACP_DOM.ICONS.SEO,    label: t('nav.seo', {}, 'SEO & Analytics')    },
      { nav: 'stats',  icon: FM.ACP_DOM.ICONS.STATS,  label: t('nav.stats', {}, 'Statistici')       },
      { nav: 'notes',  icon: FM.ACP_DOM.ICONS.NOTE,   label: t('nav.adminNotes', {}, 'Notite')      },
      { nav: 'backup', icon: FM.ACP_DOM.ICONS.BACKUP, label: t('nav.backup', {}, 'Backup')          },
    ],
  },
  {
    label : t('nav.groups.system', {}, 'System'),
    icon  : FM.ACP_DOM.ICONS.SETTINGS,
    items : [
      { nav: 'journal',  icon: FM.ACP_DOM.ICONS.GLOBE,    label: t('nav.journal', {}, 'Logs')         },
      { nav: 'updates',  icon: FM.ACP_DOM.ICONS.CHECK,    label: t('nav.updates', {}, 'Actualizari')  },
      { nav: 'settings', icon: FM.ACP_DOM.ICONS.SETTINGS, label: t('nav.settings', {}, 'Configurari') },
    ],
  },
  {
    label : t('nav.groups.dev', {}, "Developers"),
    icon  : FM.ACP_DOM.ICONS.AUDIT,
    items : [
      { nav: 'audit',    icon: FM.ACP_DOM.ICONS.LOCK,  label: t('nav.acpAudit', {}, 'Audit')    },
      { nav: 'advanced', icon: FM.ACP_DOM.ICONS.GLOBE, label: t('nav.acpDev', {}, 'Avansat')    },
    ],
  },
];

const renderItem = (origin, tid, { nav, icon, label }) => `
  <div class="${FM.ACP_DOM.SIDEBAR.ITEM}">
    <a href="${FM.ACP_URLS.FME_SECTION(origin, tid, nav)}" data-fme-nav="${nav}">
      <span><i class="fa ${icon}"></i>&nbsp;&nbsp;${label}</span>
    </a>
  </div>
`;

const renderGroup = (origin, tid, { label, icon, items }) => `
  <br clear="all">
  <div class="coins-top">
    <div class="left-top">&nbsp;&nbsp;<i class="fa ${icon}"></i>&nbsp;${label}</div>
  </div>
  <br clear="all">
  <div class="${FM.ACP_DOM.GROUP_BORDER}">
    ${items.map(item => renderItem(origin, tid, item)).join('')}
  </div>
  <br clear="all"><br>
`;

export const buildSidebar = (origin, tid) =>
  SIDEBAR_GROUPS.map(g => renderGroup(origin, tid, g)).join('');