'use strict';

/**
 * @file acp_themes.js
 * @description Pagina Theme Manager — lista temelor instalate.
 */

import BasePage from './_base.js';

export default BasePage('acp_themes', async ({ Utils, FM, t, bus, params }) => {
  const D = FM.ACP_DOM.CONTENT, I = FM.ACP_DOM.ICONS, B = FM.ACP_DOM.BADGE;
  const state = { search: '', filter: 'all' };

  const renderRow = (theme, i) => {
    const cls  = i % 2 === 0 ? D.ROW_ODD : D.ROW_EVEN;
    const tags = theme.meta?.tags ?? [];

    return /* html */`
      <tr class="${cls}" data-id="${Utils.Str.escapeHTML(theme.id)}">

        <td width="3%" style="text-align:center;vertical-align:middle;">
          ${theme.active
            ? `<i class="fa ${I.CHECK}" style="color:#27ae60;"
                  title="${t('themes.active', 'Active')}"></i>`
            : `<i class="fa fa-circle-o" style="color:#ccc;"
                  title="${t('themes.inactive', 'Inactive')}"></i>`}
        </td>

        <td style="vertical-align:middle;">
          <strong>${Utils.Str.escapeHTML(theme.name ?? '')}</strong>
          ${theme.active
            ? `&nbsp;<span class="${B.OK}" style="font-size:0.8em;">
                 ${t('themes.active', 'Active')}
               </span>`
            : ''}
          ${theme.description
            ? `<br><small class="${D.HELP_TEXT}">
                 ${Utils.Str.escapeHTML(Utils.Str.truncate(theme.description, 90))}
               </small>`
            : ''}
          ${tags.length ? `<br><div style="margin-top:3px;">
            ${tags.map(tag => `
              <small style="background:#edf2f6;color:#5a7080;
                     padding:1px 5px;border-radius:3px;margin-right:2px;">
                #${Utils.Str.escapeHTML(tag)}
              </small>`).join('')}
          </div>` : ''}
        </td>

        <td width="8%" style="text-align:center;vertical-align:middle;white-space:nowrap;">
          <code>v${Utils.Str.escapeHTML(theme.version ?? '1.0.0')}</code>
        </td>

        <td width="12%" style="vertical-align:middle;white-space:nowrap;">
          <small>${Utils.Str.escapeHTML(theme.author ?? '—')}</small>
        </td>

        <td width="10%" style="text-align:center;vertical-align:middle;">
          <small class="${D.HELP_TEXT}">
            ${theme.meta?.source === 'marketplace'
              ? `<i class="fa ${I.MARKET}"></i>&nbsp;Marketplace`
              : `<i class="fa fa-pencil"></i>&nbsp;${t('themes.source.local', 'Local')}`}
          </small>
        </td>

        <td width="12%" style="text-align:center;vertical-align:middle;white-space:nowrap;">
          <small class="${D.HELP_TEXT}">
            ${theme.meta?.updated_at ? Utils.Str.formatDate(theme.meta.updated_at) : '—'}
          </small>
        </td>

        <td width="18%" align="right" style="vertical-align:middle;white-space:nowrap;">
          ${theme.active
            ? `<a href="javascript:void(0)" class="fme-theme-action btn-revert"
                  data-id="${Utils.Str.escapeHTML(theme.id)}"
                  title="${t('themes.deactivate', 'Deactivate')}"
                  style="color:#e67e22;margin:0 3px;font-size:1.1em;">
                <i class="fa fa-toggle-on"></i>
               </a>`
            : `<a href="javascript:void(0)" class="fme-theme-action btn-apply"
                  data-id="${Utils.Str.escapeHTML(theme.id)}"
                  title="${t('themes.apply', 'Apply')}"
                  style="color:#27ae60;margin:0 3px;font-size:1.1em;">
                <i class="fa fa-toggle-off"></i>
               </a>`}

          <a href="javascript:void(0)" class="fme-theme-action btn-edit"
             data-id="${Utils.Str.escapeHTML(theme.id)}"
             title="${t('themes.edit', 'Edit')}"
             style="color:#369fcf;margin:0 3px;font-size:1.1em;">
            <i class="fa fa-cog"></i>
          </a>

          <a href="javascript:void(0)" class="fme-theme-action btn-export"
             data-id="${Utils.Str.escapeHTML(theme.id)}"
             title="${t('themes.export', 'Export JSON')}"
             style="color: cornflowerblue; margin:0 3px;font-size:1.1em;">
            <i class="fa fa-download"></i>
          </a>

          <a href="javascript:void(0)" class="fme-theme-action btn-delete"
             data-id="${Utils.Str.escapeHTML(theme.id)}"
             title="${t('themes.delete', 'Delete')}"
             style="color:#e74c3c;margin:0 3px;font-size:1.1em;">
            <i class="fa fa-trash-o"></i>
          </a>
        </td>
      </tr>
    `;
  };

  const renderTable = (container, themes) => {
    let filtered = themes;

    if (state.search) {
      const q = state.search.toLowerCase();
      filtered = filtered.filter(th =>
        th.name?.toLowerCase().includes(q)        ||
        th.description?.toLowerCase().includes(q) ||
        (th.meta?.tags ?? []).some(tag => tag.toLowerCase().includes(q))
      );
    }

    if (state.filter === 'active')   filtered = filtered.filter(th => th.active);
    if (state.filter === 'inactive') filtered = filtered.filter(th => !th.active);

    // Sync controls
    const searchEl = container.querySelector('#fme-themes-search');
    const filterEl = container.querySelector('#fme-themes-filter');
    if (searchEl && document.activeElement !== searchEl) searchEl.value = state.search;
    if (filterEl) filterEl.value = state.filter;

    // Stats
    const statsEl = container.querySelector('#fme-themes-stats');
    if (statsEl) {
      const active = themes.filter(th => th.active).length;
      statsEl.textContent =
        `${themes.length} ${t('themes.stats.total', 'installed')}` +
        (active ? ` · ${active} ${t('themes.stats.active', 'active')}` : '');
    }

    const tbody = container.querySelector('#fme-themes-tbody');
    if (!tbody) return;

    if (!filtered.length) {
      tbody.innerHTML = /* html */`
        <tr class="${D.ROW_ODD}">
          <td colspan="7" style="text-align:center;padding:24px;color:#aaa;">
            <i class="fa fa-paint-brush"></i>&nbsp;
            ${state.search || state.filter !== 'all'
              ? t('themes.empty_filter', 'No themes match your filters.')
              : t('themes.empty', 'No themes installed.')}
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((th, i) => renderRow(th, i)).join('');
  };

  return {
    breadcrumbs: [
      { label: t('nav.themes', 'Themes') },
    ],

    html: /* html */`
      <fieldset>
        <legend>${t('themes.legend', 'Legenda')}</legend>
        <i class="add fa fa-plus" title="${t('themes.actions.add', 'Add Theme')}"></i>
        &nbsp;${t('themes.actions.add', 'Add Theme')}&nbsp;&nbsp;&nbsp;&nbsp;
        <i class="refresh fa fa-toggle-on" title="${t('themes.actions.apply', 'Apply Theme')}"></i>
        &nbsp;${t('themes.actions.apply', 'Apply Theme')}&nbsp;&nbsp;&nbsp;&nbsp;
        <i class="edit fa fa-cog" title="${t('themes.actions.edit', 'Edit Theme')}"></i>
        &nbsp;${t('themes.actions.edit', 'Edit Theme')}&nbsp;&nbsp;&nbsp;&nbsp;
        <i class="export fa fa-download" style="color: cornflowerblue;" title="${t('themes.actions.export', 'Export Theme')}"></i>
        &nbsp;${t('themes.actions.export', 'Export Theme')}&nbsp;&nbsp;&nbsp;&nbsp;
        <i class="delete fa fa-trash" style="color: #d9534f;" title="${t('themes.actions.delete', 'Delete Theme')}"></i>
        &nbsp;${t('themes.actions.delete', 'Delete Theme')}
      </fieldset>

      <fieldset>
        <legend>${t('themes.list_title', 'Installed Themes')}</legend>
        <table class="${D.TABLE}" cellspacing="1" cellpadding="5"
               width="100%" style="margin-bottom:8px;">
          <tr class="${D.ROW_ODD}">
            <td width="12%">
              <label for="fme-themes-search">${t('common.search', 'Search')}</label>
            </td>
            <td>
              <input type="text" id="fme-themes-search" style="width:200px"
                     placeholder="${t('themes.search', 'Search themes…')}" />
            </td>
            <td width="12%" align="right">
              <label for="fme-themes-filter">${t('common.filter', 'Filter')}</label>
            </td>
            <td width="18%">
              <select id="fme-themes-filter">
                <option value="all">     ${t('themes.filter.all',      'All themes')}</option>
                <option value="active">  ${t('themes.filter.active',   'Active only')}</option>
                <option value="inactive">${t('themes.filter.inactive', 'Inactive only')}</option>
              </select>
            </td>
          </tr>
        </table>
        <table class="${D.TABLE}" cellspacing="1" cellpadding="4" width="100%">
          <thead>
            <tr>
              <th class="thbg" width="3%"></th>
              <th class="thbg" align="left">${t('common.name',       'Name')}</th>
              <th class="thbg" width="8%"> ${t('common.version',     'Version')}</th>
              <th class="thbg" width="12%">${t('common.author',      'Author')}</th>
              <th class="thbg" width="10%">${t('themes.col.source',  'Source')}</th>
              <th class="thbg" width="12%">${t('themes.col.updated', 'Updated')}</th>
              <th class="thbg" width="18%" align="right">
                ${t('common.actions', 'Actions')}
              </th>
            </tr>
          </thead>
          <tbody id="fme-themes-tbody">
            <tr class="${D.ROW_ODD}">
              <td colspan="7" style="text-align:center;padding:20px;">
                <i class="fa fa-spinner fa-spin"></i>&nbsp;
                ${t('common.loading', 'Loading…')}
              </td>
            </tr>
          </tbody>
        </table>

        <div style="padding:4px 2px;">
          <small class="${D.HELP_TEXT}" id="fme-themes-stats"></small>
        </div>
      </fieldset>

      <div class="div_btns" style="text-align: center; margin-top:12px;">
        <button class="btn icon_ok" id="btn-theme-new">
          ${t('themes.actions.add', 'Add Theme')}
        </button>
        <button class="btn" id="btn-themes-export-all">
          ${t('themes.actions.export_all', 'Export All')}
        </button>
        <button class="btn" id="btn-theme-import">
          ${t('themes.actions.import', 'Import Theme')}
        </button>
      </div>

      <input type="file" id="fme-themes-import-file"
             accept=".json" style="display:none;" />
    `,

    sections: {
      'fme-themes-tbody': async (el, { bus, signal }) => {
        const themes = await bus.request('themes:all');
        if (signal.aborted) return;
        const container = el.closest('.fme-page') ?? el.closest('[class*="panel"]') ?? document.body;
        renderTable(container, themes);
      },
    },

    async onMount(container, { signal, bus }) {
      let themes = [];

      const reload = async () => {
        try {
          themes = await bus.request('themes:all');
          renderTable(container, themes);
        } catch (err) { Utils.Toast?.error(err.message); }
      };

      // Broadcast din SW → reload automat
      bus.on('themes:updated', reload);

      // Search
      container.querySelector('#fme-themes-search')
        ?.addEventListener('input', Utils.Misc.debounce(e => {
          state.search = e.target.value;
          renderTable(container, themes);
        }, 200), { signal });

      // Filter
      container.querySelector('#fme-themes-filter')
        ?.addEventListener('change', e => {
          state.filter = e.target.value;
          renderTable(container, themes);
        }, { signal });

      // Toolbar
      container.querySelector('#btn-theme-new')
        ?.addEventListener('click', () => {
          bus.emit('fme:navigate', { section: 'theme_editor', params: { id: 'new' } });
        }, { signal });

      container.querySelector('#btn-themes-export-all')
        ?.addEventListener('click', async () => {
          try {
            const json = await bus.request('themes:export', {});
            _download(json, `fme-themes-${Date.now()}.json`);
          } catch (err) { Utils.Toast?.error(err.message); }
        }, { signal });

      container.querySelector('#btn-theme-import')
        ?.addEventListener('click', () => {
          container.querySelector('#fme-themes-import-file')?.click();
        }, { signal });

      container.querySelector('#fme-themes-import-file')
        ?.addEventListener('change', async e => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            const json     = await file.text();
            const imported = await bus.request('themes:import', { json });
            Utils.Toast?.success(
              `${imported.length} ${t('themes.imported', 'theme(s) imported.')}`
            );
          } catch (err) {
            Utils.Toast?.error(`${t('themes.import_error', 'Import failed')}: ${err.message}`);
          }
          e.target.value = '';
        }, { signal });

      // Tabel clicks
      container.addEventListener('click', async e => {
        const btn = e.target.closest('.fme-theme-action');
        if (!btn) return;

        const id   = btn.dataset.id;
        const orig = btn.innerHTML;
        const setL = () => { btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>'; btn.style.pointerEvents = 'none'; };
        const setR = () => { btn.innerHTML = orig; btn.style.pointerEvents = ''; };

        if (btn.classList.contains('btn-apply')) {
          setL();
          try {
            await bus.request('themes:apply', { id });
            await reload();
            Utils.Toast?.success(t('themes.applied', 'Theme applied.'));
          } catch (err) { setR(); Utils.Toast?.error(err.message); }
          return;
        }

        if (btn.classList.contains('btn-revert')) {
          setL();
          try {
            await bus.request('themes:revert', { id });
            await reload();
            Utils.Toast?.success(t('themes.reverted', 'Theme deactivated.'));
          } catch (err) { setR(); Utils.Toast?.error(err.message); }
          return;
        }

        if (btn.classList.contains('btn-edit')) {
          bus.emit('fme:navigate', { section: 'theme_editor', params: { id } });
          return;
        }

        if (btn.classList.contains('btn-export')) {
          try {
            const json  = await bus.request('themes:export', { id });
            const theme = themes.find(th => th.id === id);
            _download(json, `fme-theme-${theme?.name?.replace(/\s+/g, '-') ?? id}.json`);
          } catch (err) { Utils.Toast?.error(err.message); }
          return;
        }

        if (btn.classList.contains('btn-delete')) {
          const theme = themes.find(th => th.id === id);
          const ok = await (
            Utils.Modal?.confirm(
              `${t('themes.delete_confirm', 'Delete')} "${Utils.Str.escapeHTML(theme?.name ?? id)}"?`,
              { confirmClass: 'icon_cancel', confirmLabel: t('common.delete', 'Delete') }
            ) ?? Promise.resolve(
              window.confirm(`${t('themes.delete_confirm', 'Delete')} "${theme?.name ?? id}"?`)
            )
          );
          if (!ok) return;

          setL();
          try {
            await bus.request('themes:remove', { id });
            await reload();
            Utils.Toast?.success(t('themes.deleted', 'Theme deleted.'));
          } catch (err) { setR(); Utils.Toast?.error(err.message); }
          return;
        }
      }, { signal });

      await reload();
    },
  };
});

function _download(content, filename) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}