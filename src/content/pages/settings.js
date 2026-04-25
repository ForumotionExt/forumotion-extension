'use strict';
import BasePage                  from './_base.js';
import { getAvailableLanguages } from '../../i18n/index.js';
import { buildBtns }             from '../shared/adapter.js';
import Storage                   from '../shared/storage.js';

export default BasePage('settings', async ({ Utils, FM, t, bus, params }) => {
  const cfg = await Storage.Settings.get();
  const D = FM.ACP_DOM.CONTENT;
  const I = FM.ACP_DOM.ICONS;

  const sel = (val, cfgKey) =>
    (cfg[cfgKey] ?? 'auto') === val ? 'selected' : '';

  const langOptions = getAvailableLanguages()
    .map(({ code, label }) =>
      `<option value="${code}" ${code === (cfg.language ?? '') ? 'selected' : ''}>${label}</option>`
    ).join('');

  const uiGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.MAGIC}"></i>&nbsp;${t('settings.groups.ui')}`,
    { class: D.GROUP },
    `<table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <tr class="${D.ROW_ODD}">
        <td width="35%"><label for="fme-theme">${t('settings.ui.theme')}</label></td>
        <td>
          <select id="fme-theme">
            <option value="light" ${sel('light', 'theme')}>${t('settings.ui.themeLight')}</option>
            <option value="dark"  ${sel('dark',  'theme')}>${t('settings.ui.themeDark')}</option>
            <option value="auto"  ${sel('auto',  'theme')}>${t('settings.ui.themeAuto')}</option>
          </select>
        </td>
      </tr>
      <tr class="${D.ROW_EVEN}">
        <td><label for="fme-language">${t('settings.ui.language')}</label></td>
        <td><select id="fme-language">${langOptions}</select></td>
      </tr>
      <tr class="${D.ROW_ODD}">
        <td><label for="fme-compact-nav">${t('settings.ui.compactNav')}</label></td>
        <td><input type="checkbox" id="fme-compact-nav" ${cfg.compactNav ? 'checked' : ''} /></td>
      </tr>
    </table>`
  );

  const behaviorGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.SETTINGS}"></i>&nbsp;${t('settings.groups.behavior')}`,
    { class: D.GROUP },
    `<table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <tr class="${D.ROW_ODD}">
        <td width="35%"><label for="fme-auto-updates">${t('settings.behavior.autoCheckUpdates')}</label></td>
        <td><input type="checkbox" id="fme-auto-updates" ${cfg.autoCheckUpdates !== false ? 'checked' : ''} /></td>
      </tr>
      <tr class="${D.ROW_EVEN}">
        <td><label for="fme-update-interval">${t('settings.behavior.updateInterval')}</label></td>
        <td><input type="number" id="fme-update-interval" value="${cfg.updateInterval ?? 3600}" min="60" step="60" style="width:80px" /></td>
      </tr>
      <tr class="${D.ROW_ODD}">
        <td><label for="fme-remember-section">${t('settings.behavior.rememberSection')}</label></td>
        <td><input type="checkbox" id="fme-remember-section" ${cfg.rememberSection ? 'checked' : ''} /></td>
      </tr>
    </table>`
  );

  const devGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.AUDIT}"></i>&nbsp;${t('settings.groups.dev')}`,
    { class: D.GROUP },
    `<table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <tr class="${D.ROW_ODD}">
        <td width="35%"><label for="fme-debug">${t('settings.dev.debugMode')}</label></td>
        <td><input type="checkbox" id="fme-debug" ${cfg.debugMode ? 'checked' : ''} /></td>
      </tr>
      <tr class="${D.ROW_EVEN}">
        <td><label for="fme-show-audit">${t('settings.dev.showAudit')}</label></td>
        <td><input type="checkbox" id="fme-show-audit" ${cfg.showAudit ? 'checked' : ''} /></td>
      </tr>
    </table>`
  );

  const btns = buildBtns([
    { type: 'button', name: 'fme-settings-save',  value: t('settings.save'),  cls: 'icon_ok'  },
    { type: 'button', name: 'fme-settings-reset', value: t('settings.reset'), cls: 'icon_search' },
  ]);

  const html = `
    <div id="fme-settings-msg" style="display:none"></div>
    <div id="fme-settings-form">
      ${uiGroup}
      ${behaviorGroup}
      ${devGroup}
      ${btns}
    </div>
  `;

  return {
    html,
    onMount: (container, { signal, bus: mountBus }) => {
      const showMsg = (msg, isError = false) => {
        const el = container.querySelector('#fme-settings-msg');
        if (!el) return;
        el.textContent   = msg;
        el.className     = isError ? FM.ACP_DOM.MESSAGES.ERROR : FM.ACP_DOM.MESSAGES.SUCCESS;
        el.style.display = '';
        setTimeout(() => { el.style.display = 'none'; }, 3000);
      };

      const collect = () => ({
        theme           : container.querySelector('#fme-theme')?.value,
        language        : container.querySelector('#fme-language')?.value,
        compactNav      : container.querySelector('#fme-compact-nav')?.checked     ?? false,
        autoCheckUpdates: container.querySelector('#fme-auto-updates')?.checked    ?? true,
        updateInterval  : parseInt(container.querySelector('#fme-update-interval')?.value || '3600', 10),
        rememberSection : container.querySelector('#fme-remember-section')?.checked ?? false,
        debugMode       : container.querySelector('#fme-debug')?.checked            ?? false,
        showAudit       : container.querySelector('#fme-show-audit')?.checked       ?? false,
      });

      const applySettings = async (showFeedback = false) => {
        try {
          const data = collect();
          await Storage.Settings.set(data);
          mountBus.emit('settings:changed', { ...data, _section: 'settings' });
          if (showFeedback) showMsg(t('settings.saved'));
        } catch {
          if (showFeedback) showMsg(t('common.error'), true);
        }
      };

      container.querySelector('[name="fme-settings-save"]')
        ?.addEventListener('click', () => applySettings(true), { signal });

      container.querySelector('#fme-language')
        ?.addEventListener('change', () => applySettings(false), { signal });

      container.querySelector('[name="fme-settings-reset"]')
        ?.addEventListener('click', async () => {
          if (!confirm(t('common.confirm'))) return;
          await Storage.Settings.reset();
          location.reload();
        }, { signal });
    }
  };
});
