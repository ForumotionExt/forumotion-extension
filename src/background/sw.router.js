"use strict";

import { SWCache }           from './sw.cache.js';
import Storage               from '../content/shared/storage.js';
import { ThemeRegistry }     from '../content/shared/themes/registry.js';
import { ThemeExecutor }     from '../content/shared/themes/executor.js';
import { DOMAINS }           from '../config.js';
//import { ExtensionUpdater} from './core/extension.updater.js';
//import bus                 from '../content/core/bus.js';

export const registry = new ThemeRegistry();
export const executor = new ThemeExecutor();

export function isForumotionTab(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return DOMAINS.some(d => host === d || host.endsWith(`.${d}`));
  } catch { return false; }
}

const MARKETPLACE_BASE_URL = 'https://raw.githubusercontent.com/ForumotionExt/marketplace/refs/heads/main';
const MARKETPLACE_URL  = 'https://raw.githubusercontent.com/ForumotionExt/marketplace/refs/heads/main/index.json';
const EXT_MANIFEST_URL = 'https://raw.githubusercontent.com/ForumotionExt/forumotion-extension/refs/heads/main/manifest.json';

const TTL = {
  MARKETPLACE:  60 * 60 * 1000,
  EXT_MANIFEST: 60 * 60 * 1000,
  MEM_SHORT:    5  * 60 * 1000,
};

export const handlers = {
  'themes:all': async ({ filters = {} } = {}) => {
    return registry.getAll(filters);
  },
 
  'themes:get': async ({ id } = {}) => {
    if (!id) throw new Error('themes:get necesită { id }.');
    const theme = await registry.get(id);
    if (!theme) throw new Error(`Tema nu există: ${id}`);
    return theme;
  },
 
  'themes:active': async () => {
    return registry.getActive();
  },

  'themes:save': async ({ theme } = {}) => {
    if (!theme)      throw new Error('themes:save necesită { theme }.');
    if (!theme.name) throw new Error('Tema trebuie să aibă un nume.');
 
    const saved = await registry.save(theme);
 
    // Dacă era activă și s-a modificat → re-aplică imediat
    if (saved.active) {
      await executor.apply(saved);
    }
 
    await _broadcast('themes:updated', { id: saved.id, action: 'save' });
    return saved;
  },
 
  'themes:remove': async ({ id } = {}) => {
    if (!id) throw new Error('themes:remove necesită { id }.');
 
    const theme = await registry.get(id);
    if (!theme) throw new Error(`Tema nu există: ${id}`);
 
    // Revocă CSS dacă era activă
    if (theme.active) {
      await executor.revert(id);
      await registry.deactivateAll();
    }
 
    await registry.remove(id);
    await _broadcast('themes:updated', { id, action: 'remove' });
    return { removed: id };
  },

  'themes:apply': async ({ id } = {}) => {
    if (!id) throw new Error('themes:apply necesită { id }.');
 
    const theme = await registry.get(id);
    if (!theme) throw new Error(`Tema nu există: ${id}`);
 
    // Dezactivează tema curentă dacă e alta
    const current = await registry.getActive();
    if (current && current.id !== id) {
      await executor.revert(current.id);
    }
 
    await registry.setActive(id);
    await executor.apply(theme);
    await _broadcast('themes:updated', { id, action: 'apply' });
 
    return { applied: id };
  },
 
  'themes:revert': async ({ id } = {}) => {
    if (!id) throw new Error('themes:revert necesită { id }.');
 
    await executor.revert(id);
    await registry.deactivateAll();
    await _broadcast('themes:updated', { id, action: 'revert' });
 
    return { reverted: id };
  },
 
  'themes:revert-all': async () => {
    await executor.revertAll();
    await registry.deactivateAll();
    await _broadcast('themes:updated', { action: 'revert-all' });
    return { reverted: 'all' };
  },
 
  'themes:export': async ({ id } = {}) => {
    const theme = id
      ? await registry.get(id)
      : null;
 
    if (id && !theme) throw new Error(`Tema nu există: ${id}`);
 
    if (id) {
      // Export single — scoatem starea runtime
      const { active, ...exportable } = theme;
      return JSON.stringify(exportable, null, 2);
    }
 
    // Export all
    const themes    = await registry.getAll();
    const exportable = themes.map(({ active, ...t }) => t);
    return JSON.stringify(
      { version: 1, themes: exportable, exported_at: new Date().toISOString() },
      null, 2
    );
  },
 
  'themes:import': async ({ json } = {}) => {
    if (!json) throw new Error('themes:import necesită { json }.');
 
    let data;
    try { data = typeof json === 'string' ? JSON.parse(json) : json; }
    catch { throw new Error('JSON invalid.'); }
 
    // Suportă single theme sau bundle { themes: [...] }
    const list = data.themes ?? [data];
    const results = [];
 
    for (const t of list) {
      const toSave = { ...t, id: null, active: false };
      results.push(await registry.save(toSave));
    }
 
    await _broadcast('themes:updated', { action: 'import', count: results.length });
    return results;
  },

  'themes:preview': async ({ css, variables, overrides, themeId = '_preview' } = {}) => {
    const fakeTheme = { id: themeId, css: css ?? '', variables: variables ?? {}, overrides: overrides ?? {} };
    await executor.apply(fakeTheme);
    return { previewing: themeId };
  },
 
  'themes:preview-clear': async ({ themeId = '_preview' } = {}) => {
    await executor.revert(themeId);
    return { cleared: themeId };
  },

  'marketplace:index': async ({ forceRefresh = false } = {}) => {
    if (forceRefresh) await SWCache.invalidate('marketplace');

    return SWCache.fetchWithCache('marketplace', MARKETPLACE_URL, {
      ttl:    TTL.MARKETPLACE,
      memTtl: TTL.MEM_SHORT,
    });
  },

  'marketplace:install': async ({ entry } = {}) => {
    // Plugins nu ajung aici — sunt rutate prin content script
    const filePath = entry?.file ?? entry?.path;
    if (!filePath) throw new Error(`Entry fără file/path. Primit: ${JSON.stringify(entry)}`);

    const isTheme = !!entry.path && !entry.file;

    const url = isTheme
      ? `${MARKETPLACE_BASE_URL}/${entry.path}/manifest.json`
      : `${MARKETPLACE_BASE_URL}/${entry.file}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} — ${url}`);

    const content = isTheme ? await res.json() : await res.text();

    return {
      ...entry,
      ...(isTheme ? content : { code: content }),
      id    : null,
      active: false,
      meta  : { source: 'marketplace', fetched_at: new Date().toISOString() }
    };
  },

  'fetch:catalog': async ({ type } = {}) => {
    if (!type) throw new Error('fetch:catalog necesită { type }.');

    const cacheKey = `catalog_${type}`;
    const url      = MARKETPLACE_URL.replace('index.json', `${type}/index.json`);

    return SWCache.fetchWithCache(cacheKey, url, {
      ttl:    TTL.MARKETPLACE,
      memTtl: TTL.MEM_SHORT,
    });
  },

  'fetch:version': async () => {
    const url  = EXT_MANIFEST_URL.replace('manifest.json', 'version.json');
    const data = await SWCache.fetchWithCache('ext_version', url, {
      ttl:    TTL.EXT_MANIFEST,
      memTtl: TTL.MEM_SHORT,
    });
    return typeof data === 'string' ? JSON.parse(data) : data;
  },
 
  'fetch:changelog': async () => {
    const text = await SWCache.fetchWithCache('ext_changelog',
      EXT_MANIFEST_URL.replace('manifest.json', 'CHANGELOG.md'),
      { ttl: TTL.EXT_MANIFEST, memTtl: TTL.MEM_SHORT, type: 'text' }
    );

    return _parseChangelog(text);
  },
 
  'fetch:announcements': async () => {
    return SWCache.fetchWithCache('ext_announcements',
      EXT_MANIFEST_URL.replace('manifest.json', 'announcements.json'),
      { ttl: TTL.EXT_MANIFEST, memTtl: TTL.MEM_SHORT }
    );
  },
 
  'fetch:latest': async () => handlers['update:check'](),
 
  'update:check': async ({ force = false, channel = 'stable' } = {}) => {
    const cacheKey = `ext_manifest_${channel}`;
    if (force) await SWCache.invalidate(cacheKey);
 
    const filename = channel !== 'stable' ? `manifest.${channel}.json` : 'manifest.json';
    const url      = EXT_MANIFEST_URL.replace('manifest.json', filename);
    const release  = await SWCache.fetchWithCache(cacheKey, url, {
      ttl:    TTL.EXT_MANIFEST,
      memTtl: TTL.MEM_SHORT,
    });
 
    const current   = chrome.runtime.getManifest().version;
    const hasUpdate = _semverCompare(release.version, current) > 0;
    return { hasUpdate, current, latest: release.version, release };
  },

  'extension:check-update': async (payload) => handlers['update:check'](payload),
 
  'extension:changelog': async ({ channel = 'stable' } = {}) => {
    const result = await handlers['update:check']({ channel });
    return result.release?.changelog ?? [];
  },

  'fme:execute_script': async ({ code } = {}, sender) => {
    if (!sender?.tab?.id) throw new Error('fme:execute_script necesită sender.tab.id.');
    if (!code)            throw new Error('fme:execute_script necesită { code }.');
 
    await chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      func: (src) => {
        const blob = new Blob([src], { type: 'application/javascript' });
        const url  = URL.createObjectURL(blob);
        const s    = Object.assign(document.createElement('script'), { src: url });
        s.onload   = () => URL.revokeObjectURL(url);
        document.head.appendChild(s);
      },
      args : [code],
      world: 'MAIN',
    });
 
    return { success: true };
  },

  'plugins:all': async ({ filters = {} } = {}) => {
    const data = await Storage.Plugins.get();
    return data?.installed ?? [];
  },

  'logs:recent': async ({ limit = 5 } = {}) => {
    // return LogRegistry.getRecent(limit);
    return [];
  },

  'fetch:css':      () => { throw new Error('Rulează ForumotionAPI direct din content script.'); },
  'fetch:template': () => { throw new Error('Rulează ForumotionAPI direct din content script.'); },

  'devtools:sandbox:getStorage': async ({ keys = null } = {}) => {
    const all = await Storage.getAll();
    if (!keys) return all;
    
    const result = {};
    (Array.isArray(keys) ? keys : [keys]).forEach(k => {
      if (k in all) result[k] = all[k];
    });
    return result;
  },

  'devtools:sandbox:setStorage': async ({ key, value } = {}) => {
    if (!key) throw new Error('setStorage necesită key');
    await Storage.set({ [key]: value });
    return { set: key };
  },

  'devtools:sandbox:removeStorage': async ({ key } = {}) => {
    if (!key) throw new Error('removeStorage necesită key');
    await Storage.remove(key);
    return { removed: key };
  },

  'devtools:sandbox:queryStorage': async ({ pattern = '.*' } = {}) => {
    const all = await Storage.getAll();
    const regex = new RegExp(pattern, 'i');
    const matching = {};
    
    Object.entries(all).forEach(([k, v]) => {
      if (regex.test(k)) matching[k] = v;
    });
    
    return matching;
  },

  'devtools:sandbox:getPlugins': async () => {
    const all = await Storage.getAll();
    return {
      installed: (all.fme_plugins?.installed ?? []).length,
      active: (all.fme_plugins?.installed ?? []).filter(p => p.active).length,
      plugins: all.fme_plugins?.installed ?? [],
    };
  },

  'devtools:sandbox:getThemes': async () => {
    const all = await Storage.getAll();
    const themes = all.fme_themes ?? {};
    return {
      count: Object.keys(themes).length,
      themes: Object.entries(themes).map(([id, t]) => ({
        id,
        name: t.meta?.name ?? 'Unnamed',
        version: t.meta?.version ?? '?',
        size: t.css?.length ?? 0,
        active: t.active ?? false,
      })),
    };
  },

  'debug:fme': async () => {
    // Since service worker can't access window.__FME__, return manifest info and basic data
    const manifest = chrome.runtime.getManifest();
    const all = await Storage.getAll();
    
    return JSON.stringify({
      version: manifest.version,
      manifest: {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        permissions: manifest.permissions,
        host_permissions: manifest.host_permissions,
      },
      storage: {
        keys: Object.keys(all),
        totalSize: Object.entries(all).reduce((sum, [k, v]) => {
          return sum + new Blob([JSON.stringify(v)]).size;
        }, 0),
      },
      note: 'Full __FME__ object only available in content script context'
    }, null, 2);
  },

  'devtools:sandbox:getAuditLog': async ({ limit = 50, type = null } = {}) => {
    const all = await Storage.getAll();
    let entries = all.fme_audit_log ?? [];
    
    if (type) {
      entries = entries.filter(e => e.type === type);
    }
    
    return entries.slice(-limit);
  },

  'devtools:sandbox:getStats': async () => {
    const all = await Storage.getAll();
    const auditLog = all.fme_audit_log ?? [];
    
    const stats = {
      totalStorage: Object.entries(all).reduce((sum, [k, v]) => {
        return sum + new Blob([JSON.stringify(v)]).size;
      }, 0),
      auditEntries: auditLog.length,
      plugins: (all.fme_plugins?.installed ?? []).length,
      themes: Object.keys(all.fme_themes ?? {}).length,
      auditByType: {},
    };

    auditLog.forEach(entry => {
      stats.auditByType[entry.type] = (stats.auditByType[entry.type] ?? 0) + 1;
    });

    return stats;
  },
};

export function initRouter() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const isBusRequest = message?.type === 'bus:request';
 
    // Rezolvăm event-ul din oricare format
    const event   = isBusRequest ? message.event : message?.type;
    const payload = message?.payload ?? {};
 
    if (!event) {
      sendResponse(isBusRequest
        ? { error: 'Missing event.' }
        : { ok: false, error: 'Missing message type.' }
      );
      return false;
    }
 
    const handler = handlers[event];
 
    if (!handler) {
      sendResponse(isBusRequest
        ? { error: `Unknown event: "${event}"` }
        : { ok: false, error: `Unknown type: "${event}"` }
      );
      return false;
    }
 
    handler(payload, sender)
      .then(data => sendResponse(
        isBusRequest
          ? { data }
          : { ok: true, data }
      ))
      .catch(err => {
        console.error(`[FME SW] Handler "${event}" failed:`, err);
        sendResponse(
          isBusRequest
            ? { error: err.message }
            : { ok: false, error: err.message }
        );
      });
 
    return true; // răspuns async
  });
}

export async function prefetchOnStartup() {
  await SWCache.cleanupExpired();

  // Fără await — rulează în background, nu blochează startup-ul
  Promise.allSettled([
    handlers['marketplace:index'](),
    handlers['update:check'](),
  ]).then(results => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`[FME SW] Prefetch #${i} failed:`, r.reason?.message);
      }
    });
  });
}

async function _broadcast(event, payload = {}) {
  const message = { type: 'bus:broadcast', event, payload };
  const tabs    = await chrome.tabs.query({});

  for (const tab of tabs) {
    if (!isForumotionTab(tab.url)) continue;
    chrome.tabs.sendMessage(tab.id, message).catch(() => {});
  }

  chrome.runtime.sendMessage(message).catch(() => {});
}

function _semverCompare(a, b) {
  const pa = String(a ?? '0').split('.').map(Number);
  const pb = String(b ?? '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return  1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function _parseChangelog(text) {
  if (!text?.trim()) return [];

  const versions = [];
  let   current  = null;
  let   section  = null;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    // ## [1.5.0] - 2025-04-20  sau  ## 1.5.0 - 2025-04-20
    const versionMatch = line.match(/^##\s+\[?([^\]]+)\]?\s*[-–]?\s*(\d{4}-\d{2}-\d{2})?/);
    if (versionMatch) {
      current = {
        version : versionMatch[1].trim(),
        date    : versionMatch[2] ?? null,
        sections: {},
      };
      versions.push(current);
      section = null;
      continue;
    }

    // ### Added / Fixed / Changed etc.
    const sectionMatch = line.match(/^###\s+(.+)/);
    if (sectionMatch && current) {
      section = sectionMatch[1].trim();
      current.sections[section] = [];
      continue;
    }

    const itemMatch = line.match(/^[-*]\s+(.+)/);
    if (itemMatch && current && section) {
      const clean = itemMatch[1]
        .trim()
        .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold** → text
        .replace(/__(.+?)__/g, '$1')        // __bold__ → text
        .replace(/_(.+?)_/g, '$1')          // _italic_ → text
        .replace(/`(.+?)`/g, '$1');         // `code` → text
      current.sections[section].push(clean);
      continue;
    }
  }

  return versions;
}