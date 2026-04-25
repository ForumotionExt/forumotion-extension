'use strict';
import BasePage from './_base.js';
import { buildBtns } from '../shared/adapter.js';

const STORAGE_KEY = 'fme_notes';

export default BasePage('notes', async ({ Utils, FM, t, bus, params }) => {
  const stored = await Utils.Storage.get([STORAGE_KEY]);
  const notes  = stored[STORAGE_KEY] ?? [];

  const D = FM.ACP_DOM.CONTENT;
  const I = FM.ACP_DOM.ICONS;

  // ─── Storage ──────────────────────────────────────────────────────────────
  const getAll  = async () => {
    const s = await Utils.Storage.get([STORAGE_KEY]);
    return s[STORAGE_KEY] ?? [];
  };
  const saveAll = (list) => Utils.Storage.set({ [STORAGE_KEY]: list });

  // ─── Render notes ─────────────────────────────────────────────────────────
  const renderNotes = (list) => {
    if (!list.length) {
      return `<p class="${D.HELP_TEXT}" id="fme-no-notes">${t('notes.noNotes')}</p>`;
    }

    return `
      <table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%" id="fme-notes-table">
        <thead>
          <tr class="${D.ROW_ODD}">
            <th align="left" width="70%">${t('journal.labelEntry')}</th>
            <th align="left" width="20%">${t('common.date')}</th>
            <th align="center" width="10%">${t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((note, i) => `
            <tr class="${i % 2 === 0 ? D.ROW_ODD : D.ROW_EVEN}" data-note-id="${note.id}">
              <td style="white-space:pre-wrap;word-break:break-word">
                ${note.pinned ? `<i class="fa fa-thumb-tack" title="${t('notes.pinned')}"></i>&nbsp;` : ''}
                ${Utils.Str.escapeHTML(note.text)}
              </td>
              <td><small>${Utils.Str.formatDate(note.date)}</small></td>
              <td align="center" style="white-space:nowrap">
                <a href="#" class="fme-note-pin" data-id="${note.id}" title="${note.pinned ? t('notes.unpin') : t('notes.pin')}">
                  <i class="fa fa-thumb-tack${note.pinned ? '' : '-o'}"></i>
                </a>
                &nbsp;
                <a href="#" class="fme-note-delete" data-id="${note.id}" title="${t('notes.delete')}">
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
    `<i class="fa ${I.PLUS}"></i>&nbsp;${t('notes.groups.add')}`,
    { class: D.GROUP },
    `<table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <tr class="${D.ROW_ODD}">
        <td>
          <textarea
            id="fme-note-input"
            rows="4"
            style="width:98%;resize:vertical"
            placeholder="${t('notes.placeholder')}"
            maxlength="2000"
          ></textarea>
          <br/>
          <small id="fme-note-chars" class="${D.HELP_TEXT}">0 / 2000 ${t('notes.chars')}</small>
        </td>
      </tr>
    </table>
    ${buildBtns([
      { type: 'button', name: 'add-note', value: t('notes.add'), cls: 'icon_ok', id: 'fme-note-add' },
    ])}`
  );

  const savedGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.NOTE}"></i>&nbsp;${t('notes.groups.saved')} <span id="fme-note-count">(${notes.length})</span>`,
    { class: D.GROUP },
    `<div id="fme-notes-list">${renderNotes(notes)}</div>`
  );

  const html = `
    <div id="fme-notes-page">
      ${addGroup}
      ${savedGroup}
      <div id="fme-notes-msg" style="display:none"></div>
    </div>
  `;

  return {
    html,
    onMount: (container, { signal }) => {

      // ─── showMsg ────────────────────────────────────────────────────────
      const showMsg = (msg, isError = false) => {
        const el = container.querySelector('#fme-notes-msg');
        if (!el) return;
        el.textContent   = msg;
        el.className     = isError ? FM.ACP_DOM.MESSAGES.ERROR : FM.ACP_DOM.MESSAGES.SUCCESS;
        el.style.display = '';
        container.prepend(el);
        setTimeout(() => el.style.display = 'none', 4500);
      };

      // ─── refresh ────────────────────────────────────────────────────────
      const refresh = async () => {
        const list   = await getAll();
        const sorted = [...list].sort((a, b) =>
          (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.date) - new Date(a.date)
        );

        const inner   = container.querySelector('#fme-notes-list');
        const counter = container.querySelector('#fme-note-count');

        if (inner)   inner.innerHTML      = renderNotes(sorted); // ✅ refolosim renderNotes
        if (counter) counter.textContent  = `(${list.length})`;

        bindActions(); // ✅ rebind după re-render
      };

      // ─── bindActions ────────────────────────────────────────────────────
      const bindActions = () => {
        // Delete
        container.querySelectorAll('.fme-note-delete').forEach(el => { // ✅ container, nu document
          el.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!confirm(t('notes.confirmDelete'))) return;
            const list = await getAll();
            await saveAll(list.filter(n => n.id !== el.dataset.id));
            showMsg(t('notes.deleted'));
            refresh();
          });
        });

        // Pin
        container.querySelectorAll('.fme-note-pin').forEach(el => {
          el.addEventListener('click', async (e) => {
            e.preventDefault();
            const list = await getAll();
            const note = list.find(n => n.id === el.dataset.id);
            if (note) note.pinned = !note.pinned;
            await saveAll(list);
            refresh();
          });
        });
      };

      // ─── Char counter ────────────────────────────────────────────────────
      const textarea = container.querySelector('#fme-note-input');
      const charEl   = container.querySelector('#fme-note-chars');

      textarea?.addEventListener('input', () => {
        if (charEl) charEl.textContent = `${textarea.value.length} / 2000 ${t('notes.chars')}`;
      });

      // ─── Add note ────────────────────────────────────────────────────────
      container.querySelector('input[name="add-note"]')?.addEventListener('click', async () => {
        const text = textarea?.value?.trim();
        if (!text) return;

        const list = await getAll();
        list.push({
          id    : Utils.Misc.uid('note'),
          text,
          date  : new Date().toISOString(),
          pinned: false,
        });
        await saveAll(list);
        if (textarea) textarea.value = '';
        if (charEl)   charEl.textContent = `0 / 2000 ${t('notes.chars')}`;
        showMsg(t('notes.saved'));
        refresh();
      }, { signal });

      // ─── Init ────────────────────────────────────────────────────────────
      bindActions();
    }
  };
});