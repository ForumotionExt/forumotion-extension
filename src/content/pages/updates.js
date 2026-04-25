'use strict';
import BasePage from './_base.js';
import { isNewer } from '../shared/utils.js';
import Storage from '../shared/storage.js';
import { CACHE_TTL } from '../../config.js';

export default BasePage('updates', async ({ Utils, FM, t, bus, params }) => {
  const manifest = chrome.runtime.getManifest();
  const current  = manifest.version ?? '0.0.0';
  const meta     = await Storage.UpdateMeta.get();

  const D = FM.ACP_DOM.CONTENT, I = FM.ACP_DOM.ICONS, B = FM.ACP_DOM.BADGE;

  const hasUpdate = meta.latest && isNewer(meta.latest, current);

  const badge = (upd) => upd
    ? `<span class="${B.WARN}"><i class="fa ${I.WARNING}"></i>&nbsp;${t('updates.updateAvail', 'Update available')}</span>`
    : `<span class="${B.OK}"><i class="fa ${I.CHECK}"></i>&nbsp;${t('updates.upToDate', 'Up to date')}</span>`;

  const renderChangelog = (entries) => {
    if (!Array.isArray(entries) || !entries.length) {
      return `<p class="${D.HELP_TEXT}"><em>${t('updates.noChangelog', 'No changelog available.')}</em></p>`;
    }

    return entries.slice(0, 10).map(v => `
      <div style="margin-bottom:12px;">
        <strong>v${Utils.Str.escapeHTML(v.version)}</strong>
        ${v.date ? `<small class="${D.HELP_TEXT}"> — ${Utils.Str.escapeHTML(v.date)}</small>` : ''}
        ${Object.entries(v.sections ?? {}).map(([section, items]) => !items.length ? '' : `
          <div style="margin-top:5px;">
            <em style="font-size:.85em;color:#666;">${Utils.Str.escapeHTML(section)}</em>
            <ul style="margin:3px 0 0 16px;padding:0;">
              ${items.map(i => `<li style="margin:1px 0;font-size:.9em;">${Utils.Str.escapeHTML(i)}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    `).join('<hr style="border:0;border-top:1px solid #e0e0e0;margin:10px 0;">');
  };

  const savedChangelog = Array.isArray(meta.changelog) ? meta.changelog : null;

  const versionGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.DOWNLOAD}"></i>&nbsp;${t('updates.groups.version', 'Version')}`,
    { class: D.GROUP },
    `<table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <tr class="${D.ROW_ODD}">
        <td width="35%"><strong>${t('updates.current', 'Current version')}</strong></td>
        <td><code>${current}</code></td>
      </tr>
      <tr class="${D.ROW_EVEN}">
        <td><strong>${t('updates.latest', 'Latest version')}</strong></td>
        <td id="fme-latest-version">
          ${meta.latest
            ? `<code>${meta.latest}</code>&nbsp;${badge(hasUpdate)}`
            : `<em class="${D.HELP_TEXT}">${t('updates.notChecked', 'Not checked yet')}</em>`}
        </td>
      </tr>
      <tr class="${D.ROW_ODD}">
        <td><strong>${t('updates.lastChecked', 'Last checked')}</strong></td>
        <td id="fme-last-checked">
          ${meta.checkedAt ? Utils.Str.formatDate(meta.checkedAt) : t('updates.never', 'Never')}
        </td>
      </tr>
      <tr class="${D.ROW_EVEN}">
        <td><strong>${t('updates.channel', 'Channel')}</strong></td>
        <td>
          <select id="fme-update-channel">
            <option value="stable" ${(meta.channel ?? 'stable') === 'stable' ? 'selected' : ''}>${t('updates.stable', 'Stable')}</option>
            <option value="beta"   ${meta.channel === 'beta'   ? 'selected' : ''}>${t('updates.beta',   'Beta')}</option>
          </select>
        </td>
      </tr>
    </table>
    <div class="div_btns" style="margin-top:8px;">
      <input type="button" class="btn icon_search" id="btn-updates-check"
             value="${t('updates.checkNow', 'Check now')}" />
      <input type="button" class="btn icon_ok" id="btn-updates-download"
             value="${t('updates.download', 'Download update')}"
             style="${hasUpdate ? '' : 'display:none'}" />
    </div>`
  );

  const changelogGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.CHANGELOG}"></i>&nbsp;${t('updates.groups.changelog', 'Changelog')}`,
    { class: D.GROUP },
    `<div id="fme-changelog-content" style="padding:4px 0;">
      ${renderChangelog(savedChangelog)}
    </div>`
  );

  return {
    html: `<div id="fme-updates-page">${versionGroup}${changelogGroup}</div>`,

    onMount: (container, { signal, bus: mountBus }) => {
      const checkUpdates = async (force = false) => {
        const btn = container.querySelector('#btn-updates-check');
        if (btn) btn.disabled = true;

        try {
          const channel = container.querySelector('#fme-update-channel')?.value ?? 'stable';

          const [result, changelog] = await Promise.all([
            mountBus.request('update:check', { force, channel }),
            mountBus.request('fetch:changelog'),
          ]);

          await Storage.UpdateMeta.set({
            latest   : result.latest,
            changelog,
            checkedAt: new Date().toISOString(),
            channel,
          });

          const vEl = container.querySelector('#fme-latest-version');
          if (vEl) vEl.innerHTML = `<code>${result.latest}</code>&nbsp;${badge(result.hasUpdate)}`;

          const cEl = container.querySelector('#fme-last-checked');
          if (cEl) cEl.textContent = Utils.Str.formatDate(new Date().toISOString());

          const dlBtn = container.querySelector('#btn-updates-download');
          if (dlBtn) dlBtn.style.display = result.hasUpdate ? '' : 'none';

          const clEl = container.querySelector('#fme-changelog-content');
          if (clEl) clEl.innerHTML = renderChangelog(changelog);

          if (result.hasUpdate) {
            mountBus.emit('update:available', { version: result.latest });
            Utils.Toast.warning(`${t('updates.updateAvail', 'Update available')}: v${result.latest}`);
          } else {
            Utils.Toast.success(t('updates.upToDate', 'Up to date'));
          }
        } catch (err) {
          Utils.Toast.error(`${t('updates.checkFailed', 'Check failed')}: ${err.message}`);
        } finally {
          if (btn) btn.disabled = false;
        }
      };

      mountBus.on('update:check', () => checkUpdates(true));

      container.querySelector('#btn-updates-check')
        ?.addEventListener('click', () => checkUpdates(true), { signal });

      container.querySelector('#btn-updates-download')
        ?.addEventListener('click', () => {
          chrome.tabs.create({ url: 'https://github.com/ForumotionExt/forumotion-extension/releases/latest' });
        }, { signal });

      container.querySelector('#fme-update-channel')
        ?.addEventListener('change', () => checkUpdates(true), { signal });

      const age = meta.checkedAt
        ? (Date.now() - new Date(meta.checkedAt).getTime()) / 1000
        : Infinity;
      if (age > CACHE_TTL.UPDATE_CHECK_SEC) checkUpdates(false);
    },
  };
});
