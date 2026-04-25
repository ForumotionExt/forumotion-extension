(function() {
  "use strict";
  if (window.__FME__) return;

  const _data = JSON.parse(document.currentScript?.getAttribute('data-fme') ?? '{}');

  window.__FME__ = {
    version: _data.version,
    domains: _data.domains,
    _lang: _data.lang,

    utils: {
      url: {
        origin: ()    => window.location.origin,
        tid   : ()    => new URLSearchParams(window.location.search).get('tid') || '',
        param : (key) => new URLSearchParams(window.location.search).get(key) || '',
      },
    },

    session: {
      isACP          : (url = window.location.href) => /\/admin(hd)?/.test(url),
      isFMEPage      : (url = window.location.href) => new URLSearchParams(url.split('?')[1]).get('part') === 'fme',
      getSection     : (url = window.location.href) => new URLSearchParams(url.split('?')[1]).get('sub') || 'home',
      isAuthenticated: () => !!(document.getElementById('menu') || document.getElementById('main-content')),
    },

    dom: {
      selectors: _data.selectors,
      urls: {
        FME_HOME    : (o, tid)      => `${o}/admin/?part=fme&extended_admin=1&tid=${tid}`,
        FME_SECTION : (o, tid, sub) => `${o}/admin/?part=fme&sub=${sub}&extended_admin=1&tid=${tid}`,
        JS_LIST     : (o, tid)      => `${o}/admin/?mode=js&part=modules&sub=html&extended_admin=1&tid=${tid}`,
        JS_EDIT     : (o, tid, id)  => id
          ? `${o}/admin/?part=modules&sub=html&mode=js_edit&id=${id}&extended_admin=1&tid=${tid}`
          : `${o}/admin/?part=modules&sub=html&mode=js_edit&extended_admin=1&tid=${tid}`,
      },
      icons    : _data.icons,
      messages : _data.messages,
      content  : _data.content,
      sidebar  : _data.sidebar,
      badge    : _data.badge,
    },

    engine: {
      list    : _data.engines,
      detect  : (doc = document) =>
        ['prosilver','subsilver','punbb','invision','modernbb','awesomebb']
          .find(e => doc.querySelector(`link[href*="${e}"]`)) ?? null,
      getLabel: (val) => (_data.engines?.find(e => e.value === val))?.label ?? val,
      isValid : (val) => _data.engines?.some(e => e.value === val),
    },

    templates: {
      categories: _data.categories,
    },

    settings: {
      get  : (pluginId)         => _fmeBridge('plugin:settings:get',   { pluginId }),
      save : (pluginId, values) => _fmeBridge('plugin:settings:save',  { pluginId, values }),
      reset: (pluginId)         => _fmeBridge('plugin:settings:reset', { pluginId }),
    },

    storage: {
      get   : (pluginId, key)        => _fmeBridge('plugin:storage:get',    { pluginId, key }),
      set   : (pluginId, key, value) => _fmeBridge('plugin:storage:set',    { pluginId, key, value }),
      remove: (pluginId, key)        => _fmeBridge('plugin:storage:remove', { pluginId, key }),
    },

    bus: {
      emit: (event, detail) => window.dispatchEvent(new CustomEvent(`fme:${event}`, { detail })),
      on  : (event, cb)     => window.addEventListener(`fme:${event}`, e => cb(e.detail)),
      off : (event, cb)     => window.removeEventListener(`fme:${event}`, cb),
    },

    ui: {
      toast: (msg, type = 'info') => window.dispatchEvent(new CustomEvent('fme:toast', { detail: { msg, type } })),
      modal: (opts)               => window.dispatchEvent(new CustomEvent('fme:modal', { detail: opts })),
    },

    libs: {
      loadJSZip: async () => {
        if (window.JSZip) return window.JSZip;

        return new Promise((resolve, reject) => {
          const s   = document.createElement('script');
          s.src     = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
          s.onload  = () => resolve(window.JSZip); // ← returnează referința
          s.onerror = reject;
          document.head.appendChild(s);
        });
      },
    },
  };

  function _fmeBridge(type, payload) {
    return new Promise((resolve, reject) => {
      const id = 'fme_' + Math.random().toString(36).slice(2);
      window.addEventListener(`fme:bridge:response:${id}`, e => resolve(e.detail), { once: true });
      window.dispatchEvent(new CustomEvent('fme:bridge:request', { detail: { id, type, payload } }));
      setTimeout(() => reject(new Error(`FME bridge timeout: ${type}`)), 5000);
    });
  }

  async function loadJSZip() {
    if (window.JSZip) return;

    return await new Promise((resolve, reject) => {
      const s   = document.createElement('script');
      s.src     = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload  = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  console.log(`%c[FME] Bridge disponibil în world: MAIN with version: v${_data.version}`, 'color: skyblue');
})();