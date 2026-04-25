// bridge.js — rulează în content script

import FM      from './shared/forumotion.structure.js';
import Storage from './shared/storage.js';
import Utils   from './shared/utils.js';

function setupBridge() {
  const bridgeData = {
    version   : chrome.runtime.getManifest().version,
    domains   : FM.DOMAINS,
    icons     : FM.ACP_DOM.ICONS,
    selectors : FM.ACP_DOM,
    messages  : FM.ACP_DOM.MESSAGES,
    content   : FM.ACP_DOM.CONTENT,
    sidebar   : FM.ACP_DOM.SIDEBAR,
    badge     : FM.ACP_DOM.BADGE,
    engines   : FM.ENGINES.LIST,
    categories: FM.TEMPLATES.CATEGORIES
  };
  
  const script = document.createElement('script');
  script.src   = chrome.runtime.getURL('content/bridge.main.js');
  script.setAttribute('data-fme', JSON.stringify(bridgeData));
  script.onload  = () => script.remove();
  script.onerror = () => console.error('[FME] bridge.main.js failed to load:', script.src);
  (document.head ?? document.documentElement).appendChild(script);

  // Ascultă mesajele de la world: MAIN pentru settings/storage
  window.addEventListener('fme:bridge:request', async (e) => {
    const { id, type, payload } = e.detail;
    try {
      const result = await chrome.runtime.sendMessage({ type, payload });
      window.dispatchEvent(new CustomEvent(`fme:bridge:response:${id}`, { detail: result }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent(`fme:bridge:response:${id}`, { detail: null }));
    }
  });
}

export default setupBridge;