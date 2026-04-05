/**
 * FME Chatbox Tab
 * Configuration panel for the FME Forum Chatbox widget.
 * Saved config is read by forum-chatbox.js on forum pages.
 *
 * Config structure (fme_chatbox_config):
 *   { enabled: bool, title: string }
 *   TID is auto-detected from the page via fetchChatboxPageParams().
 */

var FMEChatboxTab = (() => {
  'use strict';

  const STORAGE_KEY = 'fme_chatbox_config';

  const DEFAULT_CONFIG = {
    enabled: false,
    title:   'FME Chatbox',
  };

  let _container = null;
  let _cfg       = null;

  // ─── Public API ───────────────────────────────────────────────────────────────

  async function render(container) {
    _container = container;
    container.innerHTML = '';

    _cfg = await loadConfig();

    const wrapper = document.createElement('div');
    wrapper.className = 'main-content';
    wrapper.id        = 'main-content';
    wrapper.style.fontSize = '12px';

    wrapper.innerHTML = buildHTML();
    container.appendChild(wrapper);

    syncFormValues(wrapper);
    bindEvents(wrapper);
  }

  // ─── HTML skeleton ────────────────────────────────────────────────────────────

  function buildHTML() {
    return `
      <div class="fme-section-header">
        <h2 class="fme-section-title">FME</h2>
        <ul class="h2-breadcrumb clearfix"><li class="first">Chatbox</li></ul>
        <blockquote class="block_left">
          <p class="explain">
            Configurează chatbox-ul personalizat FME care înlocuiește chatbox-ul nativ Forumotion pe paginile forumului.
            TID-ul este detectat automat din pagină — nu e nevoie de configurare manuală.
          </p>
        </blockquote>
      </div>

      <fieldset class="fieldset_left">
        <legend>Setări generale</legend>
        <table class="table1 forumline" cellspacing="1">
          <tbody>
            <tr>
              <td class="row2" style="width:200px;">
                <span class="gen">Activează chatbox FME</span>
              </td>
              <td class="row1">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                  <input type="checkbox" id="fme-cb-enabled" />
                  <span class="gen">Înlocuiește chatbox-ul nativ cu versiunea FME</span>
                </label>
              </td>
            </tr>
            <tr>
              <td class="row2"><span class="gen">Titlu chatbox</span></td>
              <td class="row1">
                <input type="text" id="fme-cb-title" class="inputthin"
                       style="width:260px;" maxlength="80"
                       placeholder="FME Chatbox" />
                <br/><span class="gensmall">Apare în bara de sus a chatbox-ului.</span>
              </td>
            </tr>
          </tbody>
        </table>
      </fieldset>

      <div style="margin-top:12px;display:flex;align-items:center;gap:10px;">
        <input type="button" id="fme-cb-save-btn" class="icon_ok" value="Salvează configurația" />
        <span id="fme-cb-status" style="font-size:12px;"></span>
      </div>

      <fieldset class="fieldset_left" style="margin-top:18px;">
        <legend style="color:#5a9fd4;">ℹ Despre Chatbox</legend>
        <table class="table1 forumline" cellspacing="1">
          <tbody>
            <tr>
              <td class="row2" style="width:200px;"><span class="gen">Cum funcționează</span></td>
              <td class="row1">
                <span class="gen">
                  Chatbox-ul FME se injectează automat pe paginile forumului când este activat.
                  Utilizează API-ul Forumotion (<code>/chatbox/actions</code>) cu polling la 3 secunde.
                  TID-ul se detectează automat din pagina forumului (din <code>new Chatbox(...)</code>).
                </span>
              </td>
            </tr>
            <tr>
              <td class="row2"><span class="gen">Butoane din header</span></td>
              <td class="row1">
                <span class="gen">
                  <b>ℹ</b> — Afișează informații: stare conexiune, TID, nr. mesaje, polling.<br/>
                  <b>⚙</b> — Setări rapide: auto-scroll, golire mesaje.<br/>
                  <b>⤢</b> — Extinde / restrânge zona de mesaje.
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </fieldset>
    `;
  }

  // ─── Data load/save ───────────────────────────────────────────────────────────

  function loadConfig() {
    return new Promise(resolve => {
      chrome.storage.local.get({ [STORAGE_KEY]: null }, result => {
        const stored = result[STORAGE_KEY];
        if (stored && typeof stored === 'object') {
          resolve(Object.assign({}, DEFAULT_CONFIG, stored));
        } else {
          resolve(Object.assign({}, DEFAULT_CONFIG));
        }
      });
    });
  }

  function saveConfig(cfg) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [STORAGE_KEY]: cfg }, resolve);
    });
  }

  // ─── Form sync ────────────────────────────────────────────────────────────────

  function syncFormValues(wrapper) {
    const enabledEl = wrapper.querySelector('#fme-cb-enabled');
    const titleEl   = wrapper.querySelector('#fme-cb-title');
    if (enabledEl) enabledEl.checked    = !!_cfg.enabled;
    if (titleEl)   titleEl.value        = _cfg.title || '';
  }

  function collectFormValues(wrapper) {
    const enabledEl = wrapper.querySelector('#fme-cb-enabled');
    const titleEl   = wrapper.querySelector('#fme-cb-title');
    return {
      enabled: enabledEl ? enabledEl.checked : false,
      title:   (titleEl ? titleEl.value.trim() : '') || 'FME Chatbox',
    };
  }

  // ─── Events ───────────────────────────────────────────────────────────────────

  function bindEvents(wrapper) {
    // Save
    wrapper.querySelector('#fme-cb-save-btn').addEventListener('click', async () => {
      const saveBtn = wrapper.querySelector('#fme-cb-save-btn');
      saveBtn.disabled = true;
      saveBtn.value    = 'Se salvează...';

      const newCfg = collectFormValues(wrapper);
      _cfg = newCfg;

      await saveConfig(newCfg);
      if (typeof FMEActivityLog !== 'undefined') FMEActivityLog.log('chatbox-save', 'Config chatbox salvat (enabled=' + newCfg.enabled + ')');

      saveBtn.disabled = false;
      saveBtn.value    = 'Salvează configurația';
      setStatus(wrapper, '✓ Salvat! Configurația se aplică la vizitarea forumului.', '#10b981');
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  function setStatus(wrapper, msg, color) {
    const el = wrapper.querySelector('#fme-cb-status');
    if (!el) return;
    el.textContent  = msg;
    el.style.color  = color || '#10b981';
    clearTimeout(el._statusTimer);
    el._statusTimer = setTimeout(() => { el.textContent = ''; }, 4000);
  }

  // ─── Exports ──────────────────────────────────────────────────────────────────

  return { render };

})();
