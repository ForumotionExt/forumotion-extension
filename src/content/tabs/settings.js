/**
 * FME Settings Tab
 * Renders and manages the Settings tab UI.
 * All settings are persisted to chrome.storage.sync.
 */

var FMESettingsTab = (() => {
  const DEFAULTS = {
    githubToken: '',
    autoCheckUpdates: true,
    githubOwner: 'ForumotionExt',
    githubRepo: 'forumotion-extension',
    themesOwner: 'staark-dev',
    themesRepo: 'forumotion-themes',
    templatesOwner: 'ForumotionExt',
    templatesRepo: 'templates',
    updateNotificationFrequency: '6h'
  };

  function render(container) {
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'fme-settings-wrapper';

    wrapper.innerHTML = `
      <h2><a href="#fme-settings">FME</a></h2>
      <ul class="h2-breadcrumb clearfix"><li class="first">Pagina de setari</li></ul>
      <blockquote class="block_left">
        <p class="explain">Configureaza setarile extensiei, precum integrarea GitHub si comportamentul de update.</p>
      </blockquote>
      <form id="fme-settings-form" class="fme-settings-form">
        <fieldset class="fieldset_left">
          <legend>GitHub Integration</legend>
          <dl>
            <dt>
              <label for="fme-github-token">Personal Access Token&nbsp;:</label>
            </dt>
            <dd>
              <input type="password" id="fme-github-token" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" autocomplete="off" style="width:90%;" />
              <br><small>Creeaza token la <a href="https://github.com/settings/tokens" target="_blank" rel="noopener">github.com/settings/tokens</a>. Necesita doar citire repo public.</small>
            </dd>
          </dl>
        </fieldset>

        <fieldset style="margin-top:12px;">
          <legend>Repository-uri</legend>
          <dl>
            <dt >
              <label for="fme-themes-owner">Teme — Owner&nbsp;:</label>
            </dt>
            <dd style="">
              <input type="text" id="fme-themes-owner" placeholder="staark-dev" style="width:70%;" />
            </dd>
          </dl>
          <dl>
            <dt >
              <label for="fme-themes-repo">Teme — Repo&nbsp;:</label>
            </dt>
            <dd style="">
              <input type="text" id="fme-themes-repo" placeholder="forumotion-themes" style="width:70%;" />
            </dd>
          </dl>
          <dl>  
            <dt >
              <label for="fme-templates-owner">Template-uri — Owner&nbsp;:</label>
            </dt>
            <dd style="">
              <input type="text" id="fme-templates-owner" placeholder="ForumotionExt" style="width:70%;" />
            </dd>
          </dl>
          <dl>
            <dt >
              <label for="fme-templates-repo">Template-uri — Repo&nbsp;:</label>
            </dt>
            <dd style="">
              <input type="text" id="fme-templates-repo" placeholder="templates" style="width:70%;" />
            </dd>
          </dl>
          <dl>
            <dt >
              <label for="fme-ext-owner">Actualizari — Owner&nbsp;:</label>
            </dt>
            <dd style="">
              <input type="text" id="fme-ext-owner" placeholder="ForumotionExt" style="width:70%;" />
            </dd>
          </dl>
          <dl>
            <dt >
              <label for="fme-ext-repo">Actualizari — Repo&nbsp;:</label>
            </dt>
            <dd style="">
              <input type="text" id="fme-ext-repo" placeholder="forumotion-extension" style="width:70%;" />
            </dd>
          </dl> 
        </fieldset>

        <fieldset style="margin-top:12px;">
          <legend>Comportament</legend>
          <label style="display:flex;align-items:center;gap:6px;padding:4px 0;">
            <input type="checkbox" id="fme-auto-updates" />
            Auto-verifica actualizari la pornire
          </label>
        </fieldset>

        <fieldset style="margin-top:12px;">
          <legend>Notificari actualizari</legend>
          <dl>
            <dt>
              <label for="fme-notif-freq">Frecventa notificari desktop&nbsp;:</label>
            </dt>
            <dd>
              <select id="fme-notif-freq" style="width:auto;">
                <option value="6h">La fiecare 6 ore</option>
                <option value="12h">La fiecare 12 ore</option>
                <option value="24h">La fiecare 24 ore</option>
                <option value="never">Niciodata</option>
              </select>
              <br><small>Controleaza cat de des primesti notificari desktop cand exista o versiune noua.</small>
            </dd>
          </dl>
          <dl>
            <dt>
              <label>Versiuni ignorate&nbsp;:</label>
            </dt>
            <dd>
              <input type="button" id="fme-clear-skipped" value="Sterge toate versiunile ignorate" class="icon_ok" />
              <span id="fme-skipped-status" style="font-size:11px;color:#888;margin-left:6px;"></span>
              <br><small>Versiunile ignorate nu declanseaza notificari sau badge-ul NEW.</small>
            </dd>
          </dl>
        </fieldset>

        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
          <input type="submit" id="fme-settings-save" value="Salveaza" />
          <input type="button" id="fme-reset-settings" value="Resetare la implicit" />
        </div>

        <div class="fme-alert fme-alert-success" id="fme-settings-saved" style="display:none;">Setarile au fost salvate.</div>
        <div class="fme-alert fme-alert-error"   id="fme-settings-error"  style="display:none;"></div>
      </form>
    `;

    container.appendChild(wrapper);
    loadCurrentSettings(wrapper);
    bindEvents(wrapper);
  }

  function loadCurrentSettings(wrapper) {
    chrome.storage.sync.get(DEFAULTS, (settings) => {
      setVal(wrapper, 'fme-github-token', settings.githubToken);
      setVal(wrapper, 'fme-themes-owner', settings.themesOwner);
      setVal(wrapper, 'fme-themes-repo', settings.themesRepo);
      setVal(wrapper, 'fme-templates-owner', settings.templatesOwner);
      setVal(wrapper, 'fme-templates-repo', settings.templatesRepo);
      setVal(wrapper, 'fme-ext-owner', settings.githubOwner);
      setVal(wrapper, 'fme-ext-repo', settings.githubRepo);
      const autoCheck = wrapper.querySelector('#fme-auto-updates');
      if (autoCheck) autoCheck.checked = !!settings.autoCheckUpdates;

      const freqSel = wrapper.querySelector('#fme-notif-freq');
      if (freqSel) freqSel.value = settings.updateNotificationFrequency || '6h';
    });

    // Show count of skipped versions
    chrome.storage.sync.get({ skippedVersions: [] }, (s) => {
      const statusEl = wrapper.querySelector('#fme-skipped-status');
      if (statusEl) {
        const count = (s.skippedVersions || []).length;
        statusEl.textContent = count > 0 ? `(${count} versiune${count > 1 ? 'i' : ''} ignorata${count > 1 ? 'te' : ''})` : '(niciuna)';
      }
    });
  }

  function bindEvents(wrapper) {
    const form       = wrapper.querySelector('#fme-settings-form');
    const resetBtn   = wrapper.querySelector('#fme-reset-settings');
    const savedMsg   = wrapper.querySelector('#fme-settings-saved');
    const errorMsg   = wrapper.querySelector('#fme-settings-error');
    const clearSkBtn = wrapper.querySelector('#fme-clear-skipped');
    const statusEl   = wrapper.querySelector('#fme-skipped-status');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      hideAlerts(savedMsg, errorMsg);

      const freqSel = wrapper.querySelector('#fme-notif-freq');
      const settings = {
        githubToken:   getVal(wrapper, 'fme-github-token').trim(),
        themesOwner:   getVal(wrapper, 'fme-themes-owner').trim()    || DEFAULTS.themesOwner,
        themesRepo:    getVal(wrapper, 'fme-themes-repo').trim()     || DEFAULTS.themesRepo,
        templatesOwner: getVal(wrapper, 'fme-templates-owner').trim() || DEFAULTS.templatesOwner,
        templatesRepo: getVal(wrapper, 'fme-templates-repo').trim()  || DEFAULTS.templatesRepo,
        githubOwner:   getVal(wrapper, 'fme-ext-owner').trim()       || DEFAULTS.githubOwner,
        githubRepo:    getVal(wrapper, 'fme-ext-repo').trim()        || DEFAULTS.githubRepo,
        autoCheckUpdates: wrapper.querySelector('#fme-auto-updates')?.checked ?? true,
        updateNotificationFrequency: freqSel ? freqSel.value : '6h'
      };

      chrome.storage.sync.set(settings, () => {
        if (chrome.runtime.lastError) {
          showError(errorMsg, 'Failed to save: ' + chrome.runtime.lastError.message);
          return;
        }
        showSuccess(savedMsg);
        // Reschedule alarm based on new setting
        chrome.runtime.sendMessage({ type: 'RESCHEDULE_ALARM', payload: {} });
      });
    });

    resetBtn.addEventListener('click', () => {
      hideAlerts(savedMsg, errorMsg);
      chrome.storage.sync.set(DEFAULTS, () => {
        loadCurrentSettings(wrapper);
        showSuccess(savedMsg);
        chrome.runtime.sendMessage({ type: 'RESCHEDULE_ALARM', payload: {} });
      });
    });

    if (clearSkBtn) {
      clearSkBtn.addEventListener('click', () => {
        chrome.storage.sync.set({ skippedVersions: [] }, () => {
          if (statusEl) statusEl.textContent = '(niciuna)';
          chrome.action.setBadgeText && chrome.action.setBadgeText({ text: '' });
          chrome.runtime.sendMessage({ type: 'CHECK_UPDATE' });
          showSuccess(savedMsg);
        });
      });
    }
  }

  function getVal(wrapper, id) {
    return wrapper.querySelector(`#${id}`)?.value || '';
  }

  function setVal(wrapper, id, val) {
    const el = wrapper.querySelector(`#${id}`);
    if (el) el.value = val || '';
  }

  function showSuccess(el) {
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
  }

  function hideAlerts(...els) {
    els.forEach(el => { el.style.display = 'none'; });
  }

  return { render };
})();
