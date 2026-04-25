"use strict";
import { t } from '../../i18n/index.js';

const PAGES = [
  // ── Main ──────────────────────────────────────
  { page: 'home',         label: () => t('nav.home', {}, 'Home'),                 category: () => 'main',                       component: () => import('../pages/home.js')         },

  // ── Installed ─────────────────────────────────
  { page: 'marketplace',  label: () => t('nav.marketplace', {}, 'Marketplace'),   category: () => t('nav.groups.installed'),    component: () => import('../pages/marketplace.js')  },
  { page: 'themes',       label: () => t('nav.themes', {}, 'Themes'),             category: () => t('nav.groups.installed'),    component: () => import('../pages/themes.js')       },
  //{ page: 'templates',    label: () => t('nav.templates', {}, 'Templates'),       category: () => t('nav.groups.installed'),    component: () => import('../pages/templates.js')    },
  { page: 'plugins',      label: () => t('nav.plugins', {}, 'Plugins'),           category: () => t('nav.groups.installed'),    component: () => import('../pages/plugins.js')      },
  // ── Admin ──────────────────────────────────────
  { page: 'acp_themes',   label: () => t('nav.adminTheme', {}, 'Theme Builder'),  category: () => t('nav.groups.admin'),        component: () => import('../pages/acp_themes.js')   },
  { page: 'acp_plugins',  label: () => t('nav.adminPlugins', {}, 'ACP Plugins'),  category: () => t('nav.groups.admin'),        component: () => import('../pages/acp_plugins.js')  },
  { page: 'acp_widgets',  label: () => t('nav.adminWidgets', {}, 'ACP Widgets'),  category: () => t('nav.groups.admin'),        component: () => import('../pages/acp_widgets.js')  },
  // ── Tools ──────────────────────────────────────
  { page: 'seo',          label: () => t('nav.seo', {}, 'SEO & Analytics'),       category: () => t('nav.groups.system'),       component: () => import('../pages/seo.js')          },
  { page: 'stats',        label: () => t('nav.stats', {}, 'Statistics'),          category: () => t('nav.groups.system'),       component: () => import('../pages/stats.js')        },
  { page: 'notes',        label: () => t('nav.adminNotes', {}, 'Notite'),         category: () => t('nav.groups.system'),       component: () => import('../pages/notes.js')        },
  { page: 'backup',       label: () => t('nav.backup', {}, 'Backup'),             category: () => t('nav.groups.system'),       component: () => import('../pages/backup.js')       },

  // ── System ─────────────────────────────────────
  { page: 'journal',      label: () => t('nav.journal', {}, 'Logs'),              category: () => t('nav.groups.tools'),        component: () => import('../pages/journal.js')      },
  { page: 'updates',      label: () => t('nav.updates', {}, 'Actualizari'),       category: () => t('nav.groups.tools'),        component: () => import('../pages/updates.js')      },
  { page: 'settings',     label: () => t('nav.settings', {}, 'Configurari'),      category: () => t('nav.groups.tools'),        component: () => import('../pages/settings.js')     },

  // ── Dev ────────────────────────────────────────
  { page: 'audit',        label: () => t('nav.acpAudit', {}, 'Audit'),            category: () => t('nav.groups.dev'),          component: () => import('../pages/audit.js')        },
  { page: 'advanced',     label: () => t('nav.acpDev', {}, 'Avansat'),            category: () => t('nav.groups.dev'),          component: () => import('../pages/devtools.js')     },

  { page: 'plugin_settings',
    label: () => t('nav.pluginSettings', {}, 'Plugin Settings'),
    category: () => t('nav.groups.admin'),
    navParent: 'acp_plugins',
    component: () => import('../pages/plugin_settings.js')
  },

  { page: 'theme_editor',
    label: () => t('nav.themeEditor', {}, 'Theme Editor'),
    category: () => t('nav.groups.admin'),
    navParent: 'acp_themes',
    component: () => import('../pages/theme_editor.js')
  },
];

export default PAGES;