"use strict";

const _mem = new Map(); // cache in-memory (per sesiune SW)

export const SWCache = {
  memGet(key) {
    const entry = _mem.get(key);
    if (!entry) return null;
    if (entry.ttl && Date.now() > entry.ttl) { _mem.delete(key); return null; }
    return entry.data;
  },

  memSet(key, data, ttlMs = 0) {
    _mem.set(key, { data, ttl: ttlMs ? Date.now() + ttlMs : 0 });
    return data;
  },

  async storageGet(key) {
    const result = await chrome.storage.local.get(`_cache_${key}`);
    const entry  = result[`_cache_${key}`];
    if (!entry) return null;
    if (entry.ttl && Date.now() > entry.ttl) {
      chrome.storage.local.remove(`_cache_${key}`);
      return null;
    }
    return entry.data;
  },

  async storageSet(key, data, ttlMs = 0) {
    try {
      await chrome.storage.local.set({
        [`_cache_${key}`]: { data, ttl: ttlMs ? Date.now() + ttlMs : 0 }
      });
    } catch {
      // Quota depășit — cache rămâne doar în memorie pentru această sesiune
    }
    return data;
  },

  async storageDel(key) {
    await chrome.storage.local.remove(`_cache_${key}`);
  },

  async cleanupExpired() {
    // Folosim chei fixe în loc de get(null) pentru a evita încărcarea întregului storage în memorie
    const CACHE_KEYS = [
      '_cache_marketplace',
      '_cache_ext_version',
      '_cache_ext_changelog',
      '_cache_ext_announcements',
      '_cache_ext_manifest_stable',
      '_cache_ext_manifest_beta',
      '_cache_catalog_plugins',
      '_cache_catalog_themes',
      '_cache_catalog_widgets',
    ];
    try {
      const data = await chrome.storage.local.get(CACHE_KEYS);
      const now  = Date.now();
      const toRemove = CACHE_KEYS.filter(k => {
        const entry = data[k];
        return entry?.ttl && now > entry.ttl;
      });
      if (toRemove.length) await chrome.storage.local.remove(toRemove);
    } catch {
      // Ignorăm erori la cleanup
    }
  },

  async fetchWithCache(key, url, { ttl = 3600_000, memTtl = 300_000, type = 'json' } = {}) {
    // 1. Memory (cea mai rapidă)
    const memHit = this.memGet(key);
    if (memHit) return memHit;

    const storageHit = await this.storageGet(key);
    if (storageHit) {
      this.memSet(key, storageHit, memTtl);
      return storageHit;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${url}`);

    const data = type === 'text'
      ? await response.text()
      : await response.json();
    this.memSet(key, data, memTtl);
    await this.storageSet(key, data, ttl);

    return data;
  },

  async invalidate(key) {
    _mem.delete(key);
    await this.storageDel(key);
  },
};