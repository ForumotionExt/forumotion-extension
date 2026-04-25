'use strict';
import BasePage from './_base.js';
import { buildBtns } from '../shared/adapter.js';

const STORAGE_KEY = 'fme_journal';

export default BasePage('journal', async ({ Utils, FM, t, bus, params }) => {
  const stored  = await Utils.Storage.get([STORAGE_KEY]);
  const entries = stored[STORAGE_KEY] ?? [];

  const D = FM.ACP_DOM.CONTENT;
  const I = FM.ACP_DOM.ICONS;

  // ─── Helpers storage ──────────────────────────────────────────────────────
  const getAll  = async () => {
    const s = await Utils.Storage.get([STORAGE_KEY]);
    return s[STORAGE_KEY] ?? [];
  };
  const saveAll = (list) => Utils.Storage.set({ [STORAGE_KEY]: list });

  // ─── Render entries ───────────────────────────────────────────────────────
  const renderEntries = (list) => {
    if (!list.length) {
      return `<p class="${D.HELP_TEXT}" id="fme-no-entries">${t('journal.noEntries')}</p>`;
    }

    return `
      <table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
        <thead>
          <tr class="${D.ROW_ODD}">
            <th align="left" width="20%">${t('journal.labelDate')}</th>
            <th align="left" width="70%">${t('journal.labelEntry')}</th>
            <th align="center" width="10%">${t('common.actions')}</th>
          </tr>
        </thead>
        <tbody id="fme-journal-body">
          ${list.map((e, i) => `
            <tr class="${i % 2 === 0 ? D.ROW_ODD : D.ROW_EVEN}" data-entry-id="${e.id}">
              <td valign="top"><small>${Utils.Str.formatDate(e.date)}</small></td>
              <td style="white-space:pre-wrap;word-break:break-word">${Utils.Str.escapeHTML(e.text)}</td>
              <td align="center">
                <a href="#" class="fme-entry-delete" data-id="${e.id}" title="${t('journal.delete')}">
                  <i class="fa ${I.TRASH}"></i>
                </a>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };


  // ─── HTML ─────────────────────────────────────────────────────────────────
  const addGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.EDIT}"></i>&nbsp;${t('journal.groups.add')}`,
    { class: D.GROUP },
    `<table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <tr class="${D.ROW_ODD}">
        <td>
          <textarea
            id="fme-journal-input"
            rows="4"
            style="width:98%;resize:vertical"
            placeholder="${t('journal.placeholder')}"
            maxlength="5000"
          ></textarea>
        </td>
      </tr>
    </table>
    ${buildBtns([
      { type: 'button', name: 'add-entry', value: t('journal.add'), cls: 'icon_ok', id: 'fme-journal-add' },
    ])}`
  );

  const logGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.LOG}"></i>&nbsp;${t('journal.groups.log')} <span id="fme-journal-count">(${entries.length})</span>`,
    { class: D.GROUP },
    `<div id="fme-journal-list">${renderEntries([...entries].reverse())}</div>`
  );

  // ─── Inject HTML ──────────────────────────────────────────────────────────
  const html = `
    <div id="fme-journal-page">
      ${addGroup}
      ${logGroup}
      <div id="fme-journal-msg" style="display:none"></div>
    </div>
  `;

  
  return {
    html,
    onMount: (container, { signal }) => {
      const showMsg = (msg, isError = false) => {
        const el = container.querySelector('#fme-journal-msg');
        if (!el) return;
        el.textContent   = msg;
        el.className     = isError ? FM.ACP_DOM.MESSAGES.ERROR : FM.ACP_DOM.MESSAGES.SUCCESS;
        el.style.display = '';
        container.prepend(el);
        setTimeout(() => el.style.display = 'none', 4500);
      };

      const refresh = async () => {
        const list    = await getAll();
        const counter = container.querySelector('#fme-journal-count');
        const list_el = container.querySelector('#fme-journal-list');

        if (counter) counter.textContent = `(${list.length})`;
        if (list_el) list_el.innerHTML   = renderEntries([...list].reverse());

        bindDelete();
      };

      const bindDelete = () => {
        container.querySelectorAll('.fme-entry-delete').forEach(el => {
          el.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!confirm(t('journal.confirmDelete'))) return;
            const list = await getAll();
            await saveAll(list.filter(n => n.id !== el.dataset.id));
            showMsg(t('journal.deleted'));
            refresh();
          });
        });
      };

      container.querySelector('input[name="add-entry"]')?.addEventListener('click', async () => {
        const ta   = container.querySelector('#fme-journal-input');
        const text = ta?.value?.trim();
        if (!text) return;

        const list = await getAll();
        list.push({
          id  : Utils.Misc.uid('jrn'),
          text,
          date: new Date().toISOString(),
        });
        await saveAll(list);
        if (ta) ta.value = '';
        showMsg(t('journal.saved'));
        refresh();
      }, { signal });

      bindDelete();
    }
  };
});