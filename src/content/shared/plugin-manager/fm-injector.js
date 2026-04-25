'use strict';

/**
 * @file fm-injector.js
 * @description Wrapper peste Forumotion JS Modules API.
 *              Creează, actualizează, șterge și toggle-uiește module JS din ACP.
 *              Folosește fetch cu credentials pentru a păstra sesiunea autenticată.
 * 
 * NOTĂ: Forumotion nu are un endpoint oficial de delete pentru JS Modules, așa că implementarea de delete
 *       se face prin update cu cod gol și dezactivare. Dacă Forumotion adaugă un endpoint de delete,
 *       înlocuiește implementarea de delete din acest modul.
 */

import FM from '../forumotion.structure.js';

/** Grupuri de utilizatori acceptate de Forumotion. */
export const AUTH_GROUPS = Object.freeze({
  ADMINS   : '1',
  MODS     : '2',
  MEMBERS  : '3',
  VISITORS : '4',
  ALL      : '4',
});

/** Amplasări disponibile pentru JS Modules. */
export const PLACEMENTS = Object.freeze({
  INDEX    : 'index',
  PORTAL   : 'portal',
  SUBFORUMS: 'viewforum',
  TOPICS   : 'viewtopic',
  GALLERY  : 'gallery',
  ALL      : 'allpages',
  CHATBOX  : 'chatbox',
});

/**
 * Construiește URL-ul ACP pentru JS Modules.
 * @param {string} origin
 * @param {string} tid
 * @param {Object} [extra] — parametri suplimentari
 */
function _url(origin, tid, extra = {}) {
  let _base = null;
  if(extra && extra.mode === 'js') {
    _base = `${origin}/admin/?part=modules&sub=html&mode=js&extended_admin=1&tid=${tid}`;
  } else if(extra && extra.mode === 'js_edit' && !extra.id) {
    _base = `${origin}/admin/?part=modules&sub=html&mode=js_edit&extended_admin=1&tid=${tid}`;
  } else if(extra && extra.mode === 'js_edit' && extra.id && !extra.toggle) {
    _base = `${origin}/admin/?part=modules&sub=html&mode=js_edit&id=${extra.id}&extended_admin=1&tid=${tid}`;
  } else if(extra && extra.mode === 'js_toggle' && extra.id && extra.toggle) {
    console.debug(`[FMInjector] Constructing toggle URL with id=${extra.id} and toggle=${extra.toggle}`);
    _base = `${origin}/admin/?part=modules&sub=html&mode=js_toggle&id=${extra.id}&on=${extra.toggle}&extended_admin=1&tid=${tid}`;
  } else if( extra && extra.mode === 'js_delete' && extra.id ) {
    _base = `${origin}/admin/?part=modules&sub=html&mode=js&extended_admin=1&tid=${tid}`;
  } else {
    throw new Error(`[FMInjector] Invalid extra parameters for URL construction: ${JSON.stringify(extra)}`);
  }

  return _base;
}

/**
 * Parsează lista de module JS din HTML-ul paginii de list.
 * Extrage id și title din link-urile de tip js_edit.
 * @param {string} html
 * @returns {Array<{ id: string, title: string }>}
 */
function _parseModuleList(html) {
  const parser  = new DOMParser();
  const doc     = parser.parseFromString(html, 'text/html');
  const links   = doc.querySelectorAll('td > a[href*="&mode=js_edit&id="]');
  const modules = [];

  links.forEach(link => {
    const href  = link.getAttribute('href');
    const match = href.match(/[?&]id=(\d+)/);
    const parentRow = link.closest('tr');
    if (!match) return;

    modules.push({
      id   : parentRow.getAttribute('data-id') || match[1],
      title: parentRow.querySelector('td:nth-child(2)').textContent.trim() || "Untitled Module",
    });
  });

  return modules;
}

const FMInjector = {
  /**
   * Listează toate JS Module-urile din ACP.
   * @param {string} origin
   * @param {string} tid
   * @returns {Promise<Array<{ id: string, title: string }>>}
   */
  async list(origin, tid) {
    const url = _url(origin, tid, { mode: 'js' });
    
    const res = await fetch(url, { credentials: 'include', method: 'GET' });

    if (!res.ok) throw new Error(`[FMInjector] List failed: HTTP ${res.status}`);

    const html = await res.text();
    return _parseModuleList(html);
  },

  /**
   * Creează un JS Module nou în Forumotion ACP.
   *
   * @param {string}   origin
   * @param {string}   tid
   * @param {Object}   opts
   * @param {string}   opts.title        — titlul modulului (recomandat prefix "[FME] PluginName")
   * @param {string}   opts.code         — codul JS (va fi wrapped în IIFE dacă nu e deja)
   * @param {string[]} [opts.auths]      — grupuri autorizate (default: ALL)
   * @param {string[]} [opts.placements] — amplasări (default: ['all'])
   * @param {boolean}  [opts.disabled]   — dacă pornim dezactivat (default: false)
   * @returns {Promise<string>} — ID-ul modulului creat
   */
  async create(origin, tid, opts) {
    const {
      title,
      code,
      auths      = AUTH_GROUPS.ALL,
      placements = PLACEMENTS.ALL,
      disabled   = false,
    } = opts;

    const url  = _url(origin, tid, { mode: 'js_edit' });
    const body = new FormData();

    body.append('title',       title);
    body.append('content',     FMInjector._wrapIIFE(code));
    body.append('js_disabled', disabled ? '1' : '0');

    body.append('js_auths[]',  auths);
    body.append('js_placement[]', placements);
    body.append('mode', 'save');

    // Snapshot al listei înainte de creare — pentru a găsi noul ID după POST
    const before = await FMInjector.list(origin, tid);
    const beforeIds = new Set(before.map(m => m.id));

    const res = await fetch(url, {
      method     : 'POST',
      body,
      credentials: 'include',
    });

    if (!res.ok) throw new Error(`[FMInjector] Create failed: HTTP ${res.status}`);

    const ATTEMPTS = [300, 700, 1500, 3000];
    for (const delay of ATTEMPTS) {
      await new Promise(r => setTimeout(r, delay));

      const after = await FMInjector.list(origin, tid);
      const newMod = after.find(m => !beforeIds.has(m.id));

      if (newMod) return newMod.id;
    }

    if(res.ok && ATTEMPTS.length > 0) {
      console.warn(`[FMInjector] Modul creat, dar ID-ul nu a fost detectat după ${ATTEMPTS.length} încercări. Este posibil ca Forumotion să aibă o întârziere mai mare în procesarea noului modul. Verifică manual în ACP dacă modul a fost creat cu titlul "${title}".`);
    }

    // Snapshot după — diferența ne dă modulul nou creat
    /*const after  = await FMInjector.list(origin, tid);
    const newMod = after.find(m => !before.some(b => b.id === m.id));

    if (!newMod) {
      throw new Error('[FMInjector] Modulul a fost trimis, dar ID-ul nu a putut fi detectat.');
    }
    */
    throw new Error('[FMInjector] Modulul a fost trimis, dar ID-ul nu a putut fi detectat după mai multe încercări.');
    return newMod.id;
  },

  /**
   * Actualizează un JS Module existent.
   *
   * @param {string} origin
   * @param {string} tid
   * @param {string} moduleId
   * @param {Object} opts — aceiași parametri ca create()
   */
  async update(origin, tid, moduleId, opts) {
    const {
      title,
      code,
      auths      = AUTH_GROUPS.ALL,
      placements = [PLACEMENTS.ALL],
      disabled   = false,
    } = opts;

    const url  = _url(origin, tid, { mode: 'js_edit', id: moduleId });
    const body = new FormData();

    body.append('title',       title);
    body.append('content',     FMInjector._wrapIIFE(code));
    body.append('js_disabled', disabled ? '1' : '0');

    body.append('js_auths[]',  auths);
    body.append('js_placement[]', placements);

    const res = await fetch(url, {
      method     : 'POST',
      body,
      credentials: 'include',
    });

    if (!res.ok) throw new Error(`[FMInjector] Update failed: HTTP ${res.status}`);
  },

  /**
   * Toggle activ/inactiv pentru un JS Module.
   * @param {string}  origin
   * @param {string}  tid
   * @param {string}  moduleId
   * @param {boolean} active  — true = activează, false = dezactivează
   */
  async toggle(origin, tid, moduleId, active) {
    // on=1 înseamnă "pune pe ON (activează)", on=0 = dezactivează
    const on  = active ? '1' : '0';
    const url = _url(origin, tid, { mode: 'js_toggle', id: moduleId, toggle: on });
    console.debug(`[FMInjector] Toggling module ${moduleId} to ${active ? 'active' : 'inactive'} via URL: ${url}`);
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`[FMInjector] Toggle failed: HTTP ${res.status}`);
  },

  /**
   * Șterge un JS Module din Forumotion.
   * Forumotion nu are un endpoint de delete direct — se face prin update cu cod gol
   * și dezactivare, sau prin interfața ACP. Dacă există un endpoint, îl folosim.
   *
   * NOTĂ: Dacă Forumotion expune un mod de delete (ex: mode=js_delete&id=X),
   *       înlocuiește implementarea de mai jos.
   *
   * @param {string} origin
   * @param {string} tid
   * @param {string} moduleId
   */
  async delete(origin, tid, moduleId) {
    // Încearcă să ștergi folosind un endpoint de delete (dacă există)
    try {
      const url = _url(origin, tid, { mode: 'js_delete', id: moduleId });
      const select = new FormData();
      body.append('mode', 'js_delete');
      body.append('selected_page[]', moduleId);
      body.append('delete_submit', 'Delete');

      console.debug(`[FMInjector] Attempting to delete module ${moduleId} via URL: ${url}`, body.entries());
      
      const res = await fetch(url, {
        credentials: 'include',
        method: 'POST',
        body: select,
      });

      if (res.ok) {
        const post = await fetch(url, { credentials: 'include', method: 'POST', body: JSON.stringify(
          { mode: 'js_delete', "conf[]": moduleId, confirm: 'Yes',}
        ) });

        if (!post.ok) throw new Error(`[FMInjector] Delete verification failed: HTTP ${post.status}`);
        console.debug(`[FMInjector] Delete request for module ${moduleId} succeeded, verifying deletion...`);
        console.log(`[FMInjector] Module ${moduleId} deleted successfully via delete endpoint.`, { status: post.status, response: await post.text() });

        return;
      }
      console.warn(`[FMInjector] Delete endpoint responded with HTTP ${res.status}, falling back to update method.`);
    } catch (err) {
      console.warn(`[FMInjector] Delete endpoint failed with error: ${err.message}, falling back to update method.`);
    }
  },

  /**
   * Wrap cod în IIFE dacă nu e deja.
   * Adaugă și 'use strict' și un try/catch global pentru siguranță.
   * @param {string} code
   * @returns {string}
   */
  _wrapIIFE(code) {
    const trimmed = code.trim();

    // Dacă e deja un IIFE, nu mai facem wrap
    if (/^\(function\s*\(/.test(trimmed) || /^\(\(\)\s*=>/.test(trimmed)) {
      return trimmed;
    }

    return `(function () {
  'use strict';
  try {
${trimmed.split('\n').map(l => '    ' + l).join('\n')}
  } catch (e) {
    console.error('[FME Plugin] Runtime error:', e);
  }
})();`;
  },
};

export default FMInjector;