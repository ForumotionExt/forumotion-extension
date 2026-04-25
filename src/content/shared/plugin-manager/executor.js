'use strict';
import Utils from '../utils.js';
/**
 * @file executor.js
 * @description Execută plugin-urile cu hook 'acp' în contextul content script-ului.
 *              Injectează codul ca <script> tag în document (nu eval direct).
 *              Injectează CSS via <style> tag.
 */

import Registry from './registry.js';
import bus      from '../../core/bus.js';

const ATTR_PLUGIN_ID = 'data-fme-plugin';

/**
 * Injectează un <script> tag cu codul dat.
 * Folsim un tag în loc de eval pentru a respecta CSP-ul extensiei.
 * @param {string} code
 * @param {string} pluginId
 */
function _injectScript(code, pluginId) {
  const existing = document.querySelector(`script[${ATTR_PLUGIN_ID}="${pluginId}"]`);
  if (existing) existing.remove();

  return new Promise((resolve, reject) => {
    Utils.Runtime.send('fme:execute_script', { code, pluginId })
      .then(() => resolve())
      .catch(err => reject(err));
  });
  /*const script = document.createElement('script');
  script.setAttribute(ATTR_PLUGIN_ID, pluginId);
  script.textContent = code;

  // Adăugăm în <head> — se execută imediat și sincron
  (document.head ?? document.documentElement).appendChild(script);*/
}

/**
 * Injectează un <style> tag cu CSS-ul dat.
 * @param {string} css
 * @param {string} pluginId
 */
function _injectStyle(css, pluginId) {
  if (!css) return;

  const existing = document.querySelector(`style[${ATTR_PLUGIN_ID}="${pluginId}"]`);
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.setAttribute(ATTR_PLUGIN_ID, pluginId);
  style.textContent = css;

  (document.head ?? document.documentElement).appendChild(style);
}

/**
 * Elimină script și style injectate ale unui plugin.
 * @param {string} pluginId
 */
function _eject(pluginId) {
  document.querySelectorAll(`[${ATTR_PLUGIN_ID}="${pluginId}"]`).forEach(el => el.remove());
}


const Executor = {
  /**
   * Rulează un singur plugin în contextul ACP.
   * Înregistrează eroarea în Registry dacă execuția eșuează.
   *
   * @param {Object} plugin — record din Registry
   */
  async runOne(plugin) {
    if (!plugin?.code) {
      console.warn(`[Executor] Plugin "${plugin.id}" nu are cod. Skip.`);
      return;
    }

    try {
      // Injectează CSS primul — evită flash of unstyled content
      if (plugin.style) {
        _injectStyle(plugin.style, plugin.id);
      }

      // Wrap în IIFE cu try/catch dacă nu e deja (double-safety)
      const code = _ensureIIFE(plugin.code, plugin.id);
      _injectScript(code, plugin.id);

      // Curăță eroarea anterioară dacă execuția reușește
      await Registry.clearError(plugin.id);

      bus.emit('plugin:executed', { id: plugin.id, hook: 'acp' });

    } catch (err) {
      console.error(`[Executor] Plugin "${plugin.id}" a eșuat:`, err);
      await Registry.markError(plugin.id, err.message);
      bus.emit('plugin:error', { id: plugin.id, hook: 'acp', error: err.message });
    }
  },

  /**
   * Rulează toate plugin-urile active cu hook 'acp'.
   * Apelat de Kernel la fiecare init ACP.
   */
  async runAcpPlugins() {
    const plugins = await Registry.getActiveByHook('acp');

    if (!plugins.length) return;

    console.log(`[Executor] Rulăm ${plugins.length} plugin(e) ACP.`);

    // Rulăm secvențial — evităm race conditions pe DOM
    for (const plugin of plugins) {
      await Executor.runOne(plugin);
    }
  },

  /**
   * Elimină toate elementele injectate ale unui plugin (la dezactivare/dezinstalare).
   * @param {string} pluginId
   */
  eject(pluginId) {
    _eject(pluginId);
    bus.emit('plugin:ejected', { id: pluginId });
  },

  /**
   * Elimină toate plugin-urile injectate (la page unload sau reset).
   */
  ejectAll() {
    document.querySelectorAll(`[${ATTR_PLUGIN_ID}]`).forEach(el => el.remove());
  },
};

/**
 * Asigură că codul e wrapped în IIFE cu try/catch și identificator de plugin.
 * @param {string} code
 * @param {string} pluginId
 * @returns {string}
 */
function _ensureIIFE(code, pluginId) {
  const trimmed = code.trim();

  // Dacă e deja un IIFE complet, îl lăsăm așa
  if (/^\(function\s*\(/.test(trimmed) || /^\(\(\)\s*=>/.test(trimmed)) {
    return trimmed;
  }

  return `(function () {
  'use strict';
  try {
${trimmed.split('\n').map(l => '    ' + l).join('\n')}
  } catch (__fme_err) {
    console.error('[FME Plugin: ${pluginId}] Eroare:', __fme_err);
  }
})();`;
}

export default Executor;