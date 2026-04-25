'use strict';

import { GithubService } from '../../../background/github.api.js';

/**
 * @file loader.js
 * @description Fetch plugin.json, index.js și style.css de pe GitHub marketplace.
 *              Nu face validare de cod — aceasta se face la review pe GitHub.
 */

const BASE_URL = new GithubService({
  repoOwner: 'ForumotionExt',
  repoName: 'marketplace',
});


const Loader = {
  /**
   * Fetch și parsare plugin.json.
   * @param {string} pluginId
   * @returns {Promise<Object>} — manifest validat
   */
  async fetchManifest(pluginId) {
    console.log(`[Loader] Fetching manifest for plugin "${pluginId}"...`);
    const res      = await BASE_URL.fetchFileFrom('plugins', `${pluginId}/plugin.json`, { type: 'json', cacheTtlMs: 0 });
    const manifest = res; // await res.json()

    console.log(`[Loader] Manifest for "${pluginId}":`, manifest);
    // Validare câmpuri obligatorii
    const required = ['id', 'name', 'version', 'entry', 'hooks'];
    const missing  = required.filter(k => !manifest[k]);

    if (missing.length) {
      throw new Error(`[Loader] plugin.json invalid — lipsesc: ${missing.join(', ')}`);
    }

    if (manifest.id !== pluginId) {
      throw new Error(`[Loader] ID mismatch: folder="${pluginId}", manifest.id="${manifest.id}"`);
    }

    // Normalizare hooks → mereu array
    if (typeof manifest.hooks === 'string') {
      manifest.hooks = [manifest.hooks];
    }

    const validHooks = ['forum', 'acp'];
    const invalidHooks = manifest.hooks.filter(h => !validHooks.includes(h));
    if (invalidHooks.length) {
      throw new Error(`[Loader] Hook-uri invalide: ${invalidHooks.join(', ')}`);
    }

    return manifest;
  },

  /**
   * Fetch codul JS principal (index.js sau câmpul `entry` din manifest).
   * @param {string} pluginId
   * @param {string} [entry='index.js']
   * @returns {Promise<string>} — codul sursă
   */
  async fetchCode(pluginId, entry = 'index.js') {
    //const res = await _fetch(Loader.url(pluginId, entry));
    //return res.text();
    return await BASE_URL.fetchFileFrom('plugins', `${pluginId}/${entry}`, { type: 'text' });
  },

  /**
   * Fetch CSS (opțional — returnează null dacă nu există).
   * @param {string} pluginId
   * @param {string} [styleFile]
   * @returns {Promise<string|null>}
   */
  async fetchStyle(pluginId, styleFile) {
    if (!styleFile) return null;

    try {
      //const res = await _fetch(Loader.url(pluginId, styleFile));
      //return res.text();
      return await BASE_URL.fetchFileFrom('plugins', `${pluginId}/${styleFile}`, { type: 'text' });
    } catch {
      // CSS e opțional — nu blocăm instalarea dacă lipsește
      console.warn(`[Loader] Style nu a putut fi încărcat pentru "${pluginId}"`);
      return null;
    }
  },

  /**
   * Încarcă tot ce e necesar pentru un plugin: manifest + cod + style.
   * @param {string} pluginId
   * @returns {Promise<{ manifest: Object, code: string, style: string|null }>}
   */
  async fetchPlugin(pluginId) {
    const manifest = await Loader.fetchManifest(pluginId);

    const [code, style] = await Promise.all([
      Loader.fetchCode(pluginId, manifest.entry),
      Loader.fetchStyle(pluginId, manifest.styles ?? manifest.style ?? null),
    ]);

    return { manifest, code, style };
  },
};

export default Loader;