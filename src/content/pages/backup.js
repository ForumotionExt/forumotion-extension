'use strict';
import BasePage      from './_base.js';
import { buildBtns } from '../shared/adapter.js';
import Storage       from '../shared/storage.js';
import AuditLogger   from '../shared/audit-logger.js';

export default BasePage('backup', async ({ Utils, FM, t, bus, params }) => {
  const meta = await Storage.BackupMeta.get();

  const D = FM.ACP_DOM.CONTENT;
  const I = FM.ACP_DOM.ICONS;

  // ── Info ──────────────────────────────────────────────────────────────────
  const infoGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.INFO}"></i>&nbsp;${t('backup.groups.info')}`,
    { class: D.GROUP },
    `<table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <tr class="${D.ROW_ODD}">
        <td width="35%"><strong>${t('backup.lastBackup')}</strong></td>
        <td id="fme-backup-last-date">
          ${meta.lastExport ? Utils.Str.formatDate(meta.lastExport) : t('backup.never')}
        </td>
      </tr>
      <tr class="${D.ROW_EVEN}">
        <td><strong>${t('backup.includes')}</strong></td>
        <td><small>${t('backup.includes')}</small></td>
      </tr>
    </table>`
  );

  // ── Export ────────────────────────────────────────────────────────────────
  const exportGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.DOWNLOAD}"></i>&nbsp;${t('backup.groups.export')}`,
    { class: D.GROUP },
    `<table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <tr class="${D.ROW_ODD}">
        <td width="35%"><strong>${t('backup.exportTitle')}</strong></td>
        <td>
          <p class="${D.HELP_TEXT}">${t('backup.exportDesc')}</p>
          ${buildBtns([
            { type: 'button', name: 'export', value: t('backup.exportBtn'), cls: 'icon_ok', id: 'fme-backup-export' },
          ])}
        </td>
      </tr>
    </table>`
  );

  // ── Import ────────────────────────────────────────────────────────────────
  const importGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.UPLOAD}"></i>&nbsp;${t('backup.groups.import')}`,
    { class: D.GROUP },
    `<table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <tr class="${D.ROW_ODD}">
        <td width="35%"><strong>${t('backup.importTitle')}</strong></td>
        <td>
          <p class="${D.HELP_TEXT}">${t('backup.importDesc')}</p>
          <p class="${D.HELP_TEXT}" style="color:#c0392b">
            <i class="fa ${I.WARNING}"></i>&nbsp;${t('backup.importWarning')}
          </p>
          <input type="file" id="fme-backup-file" accept=".json" />
          &nbsp;
          ${buildBtns([
            { type: 'button', name: 'import', value: t('backup.importBtn'), cls: 'icon_add', id: 'fme-backup-import' },
          ])}
        </td>
      </tr>
    </table>`
  );

  const html = `
    <div id="fme-backup-page">
      ${infoGroup}
      ${exportGroup}
      ${importGroup}
      <div id="fme-backup-msg" style="display:none"></div>
    </div>
  `;

  return {
    html,
    onMount: (container, { signal }) => {
      const showMsg = (msg, isError = false) => {
        const el = container.querySelector('#fme-backup-msg');
        if (!el) return;
        el.textContent   = msg;
        el.className     = isError ? FM.ACP_DOM.MESSAGES.ERROR : FM.ACP_DOM.MESSAGES.SUCCESS;
        el.style.display = '';
        setTimeout(() => { el.style.display = 'none'; }, 4000);
      };

      // ── Export ────────────────────────────────────────────────────────────
      container.querySelector('#fme-backup-export')?.addEventListener('click', async () => {
        try {
          const payload = await Storage.Backup.export();
          const blob    = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
          const url     = URL.createObjectURL(blob);
          const a       = document.createElement('a');
          a.href        = url;
          a.download    = `fme-backup-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);

          await Storage.BackupMeta.touch();
          await AuditLogger.log('backup', 'Backup exported', `file: fme-backup-${new Date().toISOString().slice(0, 10)}.json`);
          const dateEl = container.querySelector('#fme-backup-last-date');
          if (dateEl) dateEl.textContent = Utils.Str.formatDate(new Date().toISOString());
        } catch {
          showMsg(t('backup.error'), true);
        }
      }, { signal });

      // ── Import ────────────────────────────────────────────────────────────
      container.querySelector('#fme-backup-import')?.addEventListener('click', () => {
        container.querySelector('#fme-backup-file')?.click();
      }, { signal });

      container.querySelector('#fme-backup-file')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
          const text   = await file.text();
          const parsed = JSON.parse(text);

          if (!confirm(t('common.confirm') + '\n' + t('backup.importWarning'))) return;

          await Storage.Backup.import(parsed);
          await AuditLogger.log('backup', 'Backup imported', `file: ${file.name}`, 'warning');
          showMsg(t('backup.success'));
        } catch (err) {
          showMsg(err.message || t('backup.error'), true);
        } finally {
          e.target.value = '';
        }
      }, { signal });
    }
  };
});
