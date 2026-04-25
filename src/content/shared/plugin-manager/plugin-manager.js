'use strict';

/**
 * @file plugin-manager.js
 * @description Orchestrator principal pentru sistemul de plugin-uri FME.
 *
 * Responsabilități:
 *  - install / uninstall / toggle plugin-uri
 *  - coordonează Loader, Registry, Executor, FMInjector
 *  - expune API simplu pentru UI (pagina Plugins) și Kernel
 *  - emite evenimente bus pentru acțiuni majore (install, uninstall, toggle, update)
 */

import Utils       from '../utils.js';
import FM          from '../forumotion.structure.js';
import bus         from '../../core/bus.js';
import Registry    from './registry.js';
import Loader      from './loader.js';
import Executor    from './executor.js';
import FMInjector  from './fm-injector.js';
import { AUTH_GROUPS, PLACEMENTS } from './fm-injector.js';
import setupBridge from '../../bridge.js';

const PluginManager = {
  /**
   * Inițializat de Kernel după isACP().
   * Rulează toate plugin-urile ACP active.
   */
  async initAcp() {
    setupBridge();
    
    await Executor.runAcpPlugins();
    bus.emit('plugin:acp:ready');
  },

  /**
   * Instalează un plugin din marketplace.
   *
   * @param {string} pluginId   — ID-ul din marketplace (folder name)
   * @param {Object} [fmOpts]  — opțiuni pentru Forumotion JS Module (pentru hook 'forum')
   * @param {string[]} [fmOpts.auths]      — grupuri autorizate (default: ALL)
   * @param {string[]} [fmOpts.placements] — amplasări (default: ['all'])
   *
   * @returns {Promise<Object>} — plugin record salvat
   */
  async install(pluginId, fmOpts = {}) {
    // 1. Verifică dacă nu e deja instalat
    if (await Registry.isInstalled(pluginId)) {
      throw new Error(`Plugin "${pluginId}" este deja instalat.`);
    }

    bus.emit('plugin:installing', { id: pluginId });

    // 2. Fetch manifest + cod + style de pe GitHub
    const { manifest, code, style } = await Loader.fetchPlugin(pluginId);

    // 3. Construiește record-ul de bază
    const record = {
      id        : manifest.id ?? pluginId,
      name      : manifest.name ?? "Unnamed Plugin",
      version   : manifest.version ?? '0.0.1',
      author    : manifest.author    ?? 'unknown',
      category  : manifest.category  ?? 'other',
      hooks     : manifest.hooks ?? [],
      active    : true,
      code,
      style,
      forumModule: null,
      lastError  : null,
      lastErrorAt: null,
      manifest,
    };

    // 4. Forum hook → creăm JS Module în Forumotion
    if (manifest.hooks.includes('forum')) {
      const origin = Utils.UrlUtils.origin();
      const tid    = Utils.UrlUtils.param('tid') || '';

      const moduleId = await FMInjector.create(origin, tid, {
        title     : `[FME Plugin] ${manifest.name} - v${manifest.version}`,
        code,
        auths     : fmOpts.auths      ?? AUTH_GROUPS.ALL,
        placements: fmOpts.placements ?? [PLACEMENTS.ALL],
        disabled  : false,
      });

      record.forumModule = { moduleId, tid };
    }

    // 5. Salvează în Storage
    await Registry.add(record);

    // 6. Dacă are hook ACP, rulăm imediat
    if (manifest.hooks.includes('acp') && FM.SESSION.isACP()) {
      await Executor.runOne(record);
    }

    bus.emit('plugin:installed', { id: pluginId, name: manifest.name });

    return record;
  },

  /**
   * Dezinstalează complet un plugin.
   * Șterge JS Module din Forumotion (dacă e cazul) și elimină din Storage.
   *
   * @param {string} pluginId
   */
  async uninstall(pluginId) {
    const plugin = await Registry.getById(pluginId);
    if (!plugin) throw new Error(`Plugin "${pluginId}" nu este instalat.`);

    bus.emit('plugin:uninstalling', { id: pluginId });

    // 1. Forum hook → șterge JS Module din Forumotion
    if (plugin.forumModule) {
      const { moduleId, tid } = plugin.forumModule;
      const origin            = Utils.UrlUtils.origin();

      try {
        await FMInjector.delete(origin, tid, moduleId);
      } catch (err) {
        // Nu blocăm dezinstalarea dacă modulul nu mai există în FM
        console.warn(`[PluginManager] Nu s-a putut șterge JS Module ${moduleId}:`, err.message);
      }
    }

    // 2. ACP hook → eject din DOM
    if (plugin.hooks.includes('acp')) {
      Executor.eject(pluginId);
    }

    // 3. Șterge din Storage
    await Registry.remove(pluginId);

    bus.emit('plugin:uninstalled', { id: pluginId });
  },

  /**
   * Comută starea activ/inactiv a unui plugin.
   * Sincronizează cu Forumotion JS Module și DOM ACP.
   *
   * @param {string} pluginId
   * @returns {Promise<boolean>} — noua stare active
   */
  async toggle(pluginId) {
    const plugin    = await Registry.getById(pluginId);
    if (!plugin) throw new Error(`Plugin "${pluginId}" nu este instalat.`);

    const newActive = await Registry.toggle(pluginId);

    // Forum hook → toggle JS Module în Forumotion
    if (plugin.forumModule) {
      const { moduleId, tid } = plugin.forumModule;
      const origin            = Utils.UrlUtils.origin();

      try {
        await FMInjector.toggle(origin, tid, moduleId, newActive);
      } catch (err) {
        console.warn(`[PluginManager] Toggle FM module eșuat pentru "${pluginId}":`, err.message);
      }
    }

    // ACP hook → eject sau reinjectează
    if (plugin.hooks.includes('acp') && FM.SESSION.isACP()) {
      if (newActive) {
        await Executor.runOne({ ...plugin, active: true });
      } else {
        Executor.eject(pluginId);
      }
    }

    bus.emit('plugin:toggled', { id: pluginId, active: newActive });
    return newActive;
  },

  /**
   * Actualizează un plugin instalat la ultima versiune din marketplace.
   * Păstrează opțiunile FM (auths, placements) dacă nu sunt specificate.
   *
   * @param {string} pluginId
   */
  async update(pluginId) {
    const existing = await Registry.getById(pluginId);
    if (!existing) throw new Error(`Plugin "${pluginId}" nu este instalat.`);

    bus.emit('plugin:updating', { id: pluginId });

    const { manifest, code, style } = await Loader.fetchPlugin(pluginId);

    const versionChanged = manifest.version !== existing.version;
    const codeChanged    = code  !== existing.code;
    const styleChanged   = style !== existing.style;
    const hasChanges     = versionChanged || codeChanged || styleChanged;

    // ─── Deja la zi ───────────────────────────────────────────────────────────
    if (!hasChanges) {
      console.log(`[PluginManager] Plugin "${pluginId}" este deja la zi.`);
      bus.emit('plugin:up-to-date', { id: pluginId, version: manifest.version });
      return { plugin: existing, updated: false }; // ← updated: false
    }

    // ─── Actualizare ──────────────────────────────────────────────────────────
    console.log(`[PluginManager] Update "${pluginId}":`, {
      version: versionChanged ? `${existing.version} → ${manifest.version}` : 'neschimbat',
      code   : codeChanged    ? '✅ actualizat' : 'neschimbat',
      style  : styleChanged   ? '✅ actualizat' : 'neschimbat',
    });

    const delta = { manifest };
    if (versionChanged) delta.version = manifest.version;
    if (codeChanged)    delta.code    = code;
    if (styleChanged)   delta.style   = style;

    await Registry.update(pluginId, delta);

    // Forum hook → actualizează JS Module
    if (existing.forumModule && codeChanged) {
      const { moduleId, tid } = existing.forumModule;
      const origin            = Utils.UrlUtils.origin();

      await FMInjector.update(origin, tid, moduleId, {
        title   : `[FME] ${manifest.name}`,
        code,
        disabled: !existing.active,
      });
    }

    // ACP hook → re-injectează dacă codul sau style s-a schimbat
    if (existing.hooks.includes('acp') && existing.active && FM.SESSION.isACP()) {
      if (codeChanged || styleChanged) {
        Executor.eject(pluginId);
        await Executor.runOne({ ...existing, code, style });
      }
    }

    bus.emit('plugin:updated', {
      id     : pluginId,
      version: manifest.version,
      changes: { version: versionChanged, code: codeChanged, style: styleChanged },
    });

    const updated = await Registry.getById(pluginId);
    return { plugin: updated, updated: true }; // ← updated: true
  },

  /** Returnează toate plugin-urile instalate. */
  async getAll({ hook, active } = {}) { return Registry.getAll({ hook, active }); },

  /** Returnează un plugin după ID. */
  async getById(id)                   { return Registry.getById(id); },

  /** Returnează plugin-urile active. */
  async getActive()                   { return Registry.getActive(); },

  /** Verifică dacă un plugin e instalat. */
  async isInstalled(id)               { return Registry.isInstalled(id); },
};

export default PluginManager;