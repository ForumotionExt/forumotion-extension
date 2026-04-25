'use strict';

/**
 * @file registry.js
 * @description CRUD layer peste Storage pentru plugin-uri.
 *
 * Stocarea e separată în două niveluri:
 *  - fme_ext_plugins          → metadate (fără code/style)
 *  - fme_plugin_code_{id}     → codul JS al pluginului
 *  - fme_plugin_style_{id}    → CSS-ul pluginului (opțional)
 *
 * Pluginurile vechi (cu code inline) sunt suportate prin fallback în _withCode().
 */

import Storage             from '../storage.js';
import FMInjector          from './fm-injector.js';
import Utils               from '../utils.js';
import { RESOURCE_LIMITS } from '../../../config.js';

// ─── Chei separate pentru cod/style ──────────────────────────────────────────

const _codeKey  = id => `fme_plugin_code_${id}`;
const _styleKey = id => `fme_plugin_style_${id}`;

// ─── Storage primitives ───────────────────────────────────────────────────────

async function _read() {
  return Storage.Plugins.get();
}

async function _write(cfg) {
  const toMigrate = {};

  const sanitized = {
    ...cfg,
    installed: cfg.installed.map(plugin => {
      if (!plugin.code && !plugin.style) return plugin;
      if (plugin.code)  toMigrate[_codeKey(plugin.id)]  = plugin.code;
      if (plugin.style) toMigrate[_styleKey(plugin.id)] = plugin.style;
      const { code, style, ...meta } = plugin;
      return meta;
    }),
  };

  if (Object.keys(toMigrate).length > 0) {
    await chrome.storage.local.set(toMigrate);
  }

  return Storage.Plugins.set(sanitized);
}

// ─── Hydrate metadate cu code/style din chei separate ────────────────────────

async function _withCode(plugins) {
  if (!plugins.length) return [];

  const keys = plugins.flatMap(p => [_codeKey(p.id), _styleKey(p.id)]);
  const data = await chrome.storage.local.get(keys);

  return plugins.map(p => ({
    ...p,
    // Cheie separată are prioritate; fallback la inline (date vechi / migrare lazy)
    code : data[_codeKey(p.id)]  ?? p.code  ?? '',
    style: data[_styleKey(p.id)] ?? p.style ?? null,
  }));
}

// ─── Salvează code/style în chei separate cu error handling pentru quota ─────

async function _saveCode(id, code, style) {
  const toSave = { [_codeKey(id)]: code ?? '' };
  if (style) toSave[_styleKey(id)] = style;

  try {
    await chrome.storage.local.set(toSave);
  } catch (err) {
    const isQuota = err.message?.toLowerCase().includes('quota') ||
                    err.name === 'QuotaExceededError';
    if (isQuota) {
      throw new Error(
        `Storage quota depășit. Pluginul "${id}" este prea mare. ` +
        `Dezinstalează pluginuri neutilizate și încearcă din nou.`
      );
    }
    throw err;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _applyFilters(list, { hook, active } = {}) {
  let result = list;
  if (hook   !== undefined) result = result.filter(p => Array.isArray(p.hooks) && p.hooks.includes(hook));
  if (active !== undefined) result = result.filter(p => p.active === active);
  return result;
}

function _checkPluginLimits(installed, hooks, excludeId) {
  for (const hook of hooks) {
    const limit      = hook === 'acp' ? RESOURCE_LIMITS.PLUGINS_ACP : RESOURCE_LIMITS.PLUGINS_FORUM;
    const activeCount = installed.filter(
      p => p.active && p.hooks?.includes(hook) && p.id !== excludeId
    ).length;

    if (activeCount >= limit) {
      throw new Error(
        `Limita de ${limit} plugin-uri active pentru contextul "${hook}" a fost atinsă.`
      );
    }
  }
}

// ─── Registry API ─────────────────────────────────────────────────────────────

const Registry = {

  async getAll({ hook, active } = {}) {
    const fm  = await FMInjector.list(Utils.UrlUtils.origin(), Utils.UrlUtils.param('tid') || '');
    const cfg = await _read();

    let metaList;

    if (fm && fm.length > 0) {
      const cleaned = cfg.installed.map(plugin => {
        if (!plugin.forumModule) return plugin;
        const stillExists = fm.find(m => m.id === plugin.forumModule.moduleId);
        if (!stillExists) {
          console.warn(`[Registry] Modulul FM "${plugin.forumModule.moduleId}" șters, curățăm referința pentru "${plugin.id}"`);
          return { ...plugin, forumModule: null };
        }
        return { ...plugin, forumModule: stillExists };
      });

      const validIds = new Set(cleaned.map(p => p.id));
      await _write({
        installed: cleaned,
        active   : cfg.active.filter(id  => validIds.has(id)),
        pending  : cfg.pending.filter(id => validIds.has(id)),
        error    : cfg.error.filter(id   => validIds.has(id)),
      });

      metaList = _applyFilters(cleaned, { hook, active });
    } else {
      console.warn('[Registry] FMInjector.list() nu a returnat nimic, folosim cache-ul existent.');
      metaList = _applyFilters(cfg.installed, { hook, active });
    }

    return _withCode(metaList);
  },

  async getById(id) {
    const cfg  = await _read();
    const meta = cfg.installed.find(p => p.id === id);
    if (!meta) return null;
    const [hydrated] = await _withCode([meta]);
    return hydrated;
  },

  async getActive() {
    return Registry.getAll({ active: true });
  },

  async getActiveByHook(hook) {
    return Registry.getAll({ active: true, hook });
  },

  async isInstalled(id) {
    const cfg = await _read();
    return cfg.installed.some(p => p.id === id);
  },

  async add(plugin) {
    const cfg = await _read();

    if (cfg.installed.some(p => p.id === plugin.id)) {
      throw new Error(`[Registry] Plugin "${plugin.id}" este deja instalat.`);
    }

    const willBeActive = plugin.active !== false;
    if (willBeActive) {
      _checkPluginLimits(cfg.installed, plugin.hooks ?? [], null);
    }

    // Separă metadatele de cod
    const { code, style, ...meta } = plugin;

    cfg.installed.push({
      ...meta,
      active     : willBeActive,
      installedAt: new Date().toISOString(),
    });

    // Salvează metadate (fără code/style)
    await _write(cfg);

    // Salvează code/style în chei separate
    await _saveCode(plugin.id, code, style);
  },

  async update(id, delta) {
    const cfg = await _read();
    const idx = cfg.installed.findIndex(p => p.id === id);

    if (idx === -1) throw new Error(`[Registry] Plugin "${id}" nu există.`);

    const { code, style, ...metaDelta } = delta;

    // Actualizează metadate
    if (Object.keys(metaDelta).length) {
      cfg.installed[idx] = { ...cfg.installed[idx], ...metaDelta };
      await _write(cfg);
    }

    // Actualizează code/style dacă sunt furnizate
    if (code !== undefined || style !== undefined) {
      const toSave = {};
      if (code  !== undefined) toSave[_codeKey(id)]  = code;
      if (style !== undefined) toSave[_styleKey(id)] = style;
      await chrome.storage.local.set(toSave);
    }
  },

  async remove(id) {
    const cfg = await _read();
    cfg.installed = cfg.installed.filter(p => p.id !== id);
    await _write(cfg);
    // Șterge și cheile separate de cod
    await chrome.storage.local.remove([_codeKey(id), _styleKey(id)]);
  },

  async toggle(id) {
    const cfg    = await _read();
    const plugin = cfg.installed.find(p => p.id === id);

    if (!plugin) throw new Error(`[Registry] Plugin "${id}" nu există.`);

    const newActive = !plugin.active;
    if (newActive) _checkPluginLimits(cfg.installed, plugin.hooks ?? [], id);

    plugin.active = newActive;
    await _write(cfg);
    return plugin.active;
  },

  async setActive(id, active) {
    return Registry.update(id, { active: Boolean(active) });
  },

  async markError(id, message) {
    return Registry.update(id, { lastError: message, lastErrorAt: new Date().toISOString() });
  },

  async clearError(id) {
    return Registry.update(id, { lastError: null, lastErrorAt: null });
  },

  async setForumModule(id, forumModule) {
    return Registry.update(id, { forumModule });
  },

  async clearForumModule(id) {
    return Registry.update(id, { forumModule: null });
  },
};

export default Registry;
