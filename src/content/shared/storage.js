'use strict';

/**
 * @file storage.js
 * @description Strat de abstractizare peste chrome.storage.local.
 */
import { RESOURCE_LIMITS, LIMITS } from '../../config.js';

// ─── Chei ─────────────────────────────────────────────────────────────────────

export const KEYS = Object.freeze({
  SETTINGS    : 'fme_settings',
  NOTES       : 'fme_notes',
  JOURNAL     : 'fme_journal',
  SEO         : 'fme_seo',
  AUDIT_LOG   : 'fme_audit_log',
  STATS       : 'fme_stats',
  ACP_CSS     : 'fme_acp_css',
  ACP_WIDGETS : 'fme_acp_widgets',
  ACP_PLUGINS : 'fme_acp_plugins',
  BACKUP_META : 'fme_backup_meta',
  UPDATE_META : 'fme_update_meta',
  DEBUG_MODE  : 'fme_debug_mode',
  EXT_PLUGINS : 'fme_ext_plugins',
});

/** Cheile incluse în export/import backup */
export const BACKUP_KEYS = [
  KEYS.SETTINGS,
  KEYS.NOTES,
  KEYS.JOURNAL,
  KEYS.SEO,
  KEYS.AUDIT_LOG,
];

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS = {
  [KEYS.SETTINGS]: {
    language        : null,    // null = auto-detect din browser
    theme           : 'auto',
    compactNav      : false,
    autoCheckUpdates: true,
    updateInterval  : 3600,
    rememberSection : false,
    debugMode       : false,
    showAudit       : false,
  },
  [KEYS.NOTES]    : [],
  [KEYS.JOURNAL]  : [],
  [KEYS.SEO]      : {
    metaTitle   : '',
    metaDesc    : '',
    metaKeywords: '',
    robots      : 'index, follow',
    canonical   : '',
    ogTitle     : '',
    ogDesc      : '',
    ogImage     : '',
    sitemap     : '',
    analyticsId : '',
  },
  [KEYS.AUDIT_LOG]  : [],
  [KEYS.STATS]      : {},
  [KEYS.ACP_CSS]    : { css: '' },
  [KEYS.ACP_WIDGETS]: {},
  [KEYS.ACP_PLUGINS]: { installed: [] },
  [KEYS.BACKUP_META]: { lastExport: null },
  [KEYS.UPDATE_META]: { latest: null, changelog: null, checkedAt: null, channel: 'stable' },
  [KEYS.DEBUG_MODE] : false,
  [KEYS.EXT_PLUGINS]: {
    installed: [],
    active:  [],  // id-urile pluginurilor active
    pending: [],  // instalare în curs
    error:   []   // id-uri cu erori la execuție
  }
};

// ─── Primitive ────────────────────────────────────────────────────────────────

/**
 * Get raw — restituie valoarea din storage sau default-ul explicit.
 * @template T
 * @param {string}  key
 * @param {T}       [fallback]  — override default dacă vrei
 * @returns {Promise<T>}
 */
async function get(key, fallback) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallback ?? DEFAULTS[key];
}

/**
 * Set raw.
 * @param {string} key
 * @param {*}      value
 * @returns {Promise<void>}
 */
async function set(key, value) {
  return chrome.storage.local.set({ [key]: value });
}

/**
 * Remove.
 * @param {string|string[]} keys
 * @returns {Promise<void>}
 */
async function remove(keys) {
  return chrome.storage.local.remove(keys);
}

/**
 * Get multiple chei simultan.
 * @param {string[]} keys
 * @returns {Promise<Object>}
 */
async function getMany(keys) {
  const result = await chrome.storage.local.get(keys);
  // Completează cu defaults pentru cheile lipsă
  return keys.reduce((acc, k) => {
    acc[k] = result[k] ?? DEFAULTS[k];
    return acc;
  }, {});
}

/**
 * Get tot storage-ul (folosit de devtools și backup).
 * @returns {Promise<Object>}
 */
async function getAll() {
  return chrome.storage.local.get(null);
}

// ─── Metode tipizate ──────────────────────────────────────────────────────────
// Avantaj: apelantul nu trebuie să știe cheia, nu poate face typo,
// și editorul oferă autocompletare pe structura returnată.

const Settings = {
  async get()        { return get(KEYS.SETTINGS); },
  async set(data)    { return set(KEYS.SETTINGS, data); },
  async reset()      { return remove(KEYS.SETTINGS); },
  async patch(delta) {
    const current = await Settings.get();
    return set(KEYS.SETTINGS, { ...current, ...delta });
  },
};

const Notes = {
  async get()        { return get(KEYS.NOTES); },
  async set(list)    { return set(KEYS.NOTES, list); },
  async add(note)    {
    const list = await Notes.get();
    list.push(note);
    return set(KEYS.NOTES, list);
  },
  async remove(id)   {
    const list = await Notes.get();
    return set(KEYS.NOTES, list.filter(n => n.id !== id));
  },
};

const Journal = {
  async get()        { return get(KEYS.JOURNAL); },
  async set(list)    { return set(KEYS.JOURNAL, list); },
  async add(entry)   {
    const list = await Journal.get();
    list.push(entry);
    return set(KEYS.JOURNAL, list);
  },
  async remove(id)   {
    const list = await Journal.get();
    return set(KEYS.JOURNAL, list.filter(e => e.id !== id));
  },
};

const Seo = {
  async get()        { return get(KEYS.SEO); },
  async set(data)    { return set(KEYS.SEO, data); },
  async reset()      { return remove(KEYS.SEO); },
};

const AuditLog = {
  async get()          { return get(KEYS.AUDIT_LOG); },
  async append(entry)  {
    const log = await AuditLog.get();
    log.push(entry);
    if (log.length > LIMITS.AUDIT_LOG_MAX) log.splice(0, log.length - LIMITS.AUDIT_LOG_MAX);
    return set(KEYS.AUDIT_LOG, log);
  },
  async clear()        { return set(KEYS.AUDIT_LOG, []); },
};

const Stats = {
  async get()        { return get(KEYS.STATS); },
  async set(data)    { return set(KEYS.STATS, data); },
};

const AcpCss = {
  async get()        { return get(KEYS.ACP_CSS); },
  async set(css)     { return set(KEYS.ACP_CSS, { css }); },
  async reset()      { return set(KEYS.ACP_CSS, DEFAULTS[KEYS.ACP_CSS]); },
};

const AcpWidgets = {
  async get()              { return get(KEYS.ACP_WIDGETS); },
  async setWidget(id, cfg) {
    const current = await AcpWidgets.get();
    const isNew   = !(id in current);

    if (isNew && Object.keys(current).length >= RESOURCE_LIMITS.ACP_WIDGETS) {
      throw new Error(
        `Limita de ${RESOURCE_LIMITS.ACP_WIDGETS} widget-uri a fost atinsă. Șterge un widget existent înainte de a adăuga unul nou.`
      );
    }

    return set(KEYS.ACP_WIDGETS, { ...current, [id]: { ...(current[id] ?? {}), ...cfg } });
  },
};

const AcpPlugins = {
  async get()           { return get(KEYS.ACP_PLUGINS); },
  async set(data)       { return set(KEYS.ACP_PLUGINS, data); },
  async toggle(id)      {
    const cfg    = await AcpPlugins.get();
    const plugin = cfg.installed.find(p => p.id === id);
    if (plugin) plugin.active = !plugin.active;
    return set(KEYS.ACP_PLUGINS, cfg);
  },
  async remove(id)      {
    const cfg = await AcpPlugins.get();
    cfg.installed = cfg.installed.filter(p => p.id !== id);
    return set(KEYS.ACP_PLUGINS, cfg);
  },
};

const UpdateMeta = {
  async get()        { return get(KEYS.UPDATE_META); },
  async set(data)    { return set(KEYS.UPDATE_META, data); },
};

const BackupMeta = {
  async get()        { return get(KEYS.BACKUP_META); },
  async touch()      { return set(KEYS.BACKUP_META, { lastExport: new Date().toISOString() }); },
};

const DebugMode = {
  async get()        { return get(KEYS.DEBUG_MODE); },
  async toggle()     {
    const current = await DebugMode.get();
    return set(KEYS.DEBUG_MODE, !current);
  },
  async set(val)     { return set(KEYS.DEBUG_MODE, val); },
};

// ─── Backup / Restore ─────────────────────────────────────────────────────────

const Backup = {
  /**
   * Exportă toate cheile din BACKUP_KEYS.
   * @returns {Promise<{ fme_backup: true, date: string, data: Object }>}
   */
  async export() {
    const data = await getMany(BACKUP_KEYS);
    return { fme_backup: true, date: new Date().toISOString(), data };
  },

  /**
   * Importă un backup și îl aplică în storage.
   * @param {{ fme_backup: boolean, data: Object }} payload
   * @throws {Error} dacă formatul e invalid
   */
  async import(payload) {
    if (!payload?.fme_backup || typeof payload.data !== 'object') {
      throw new Error('Format backup invalid');
    }
    return chrome.storage.local.set(payload.data);
  },
};

const Plugins = {
  async get()        { return get(KEYS.EXT_PLUGINS); },
  async set(val)     { return set(KEYS.EXT_PLUGINS, val); },
};

// ─── Export ───────────────────────────────────────────────────────────────────

const Storage = {
  // Primitive
  get,
  set,
  remove,
  getMany,
  getAll,

  // Domenii tipizate
  Settings,
  Notes,
  Journal,
  Seo,
  AuditLog,
  Stats,
  AcpCss,
  AcpWidgets,
  AcpPlugins,
  UpdateMeta,
  BackupMeta,
  DebugMode,
  Backup,
  Plugins,

  // Constante expuse
  KEYS,
  BACKUP_KEYS,
};

export default Storage;