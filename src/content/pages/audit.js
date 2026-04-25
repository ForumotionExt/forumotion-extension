'use strict';
import BasePage from './_base.js';
import Storage  from '../shared/storage.js';

const ENTRIES_PER_PAGE = 50;
const ARCHIVE_DAYS = 30;

export default BasePage('audit', async ({ Utils, FM, t, params, bus }) => {
  const log = await Storage.AuditLog.get(),
        D = FM.ACP_DOM.CONTENT,
        I = FM.ACP_DOM.ICONS;

  // ── Type badge ────────────────────────────────────────────────────────────
  const TYPE_STYLE = {
    action  : 'background:#e8f4fd;color:#1565c0',
    error   : 'background:#fdecea;color:#b71c1c',
    warning : 'background:#fff8e1;color:#e65100',
    info    : 'background:#f1f3f4;color:#546e7a',
  };

  const typeBadge = (type = 'action') => {
    const style = TYPE_STYLE[type] ?? TYPE_STYLE.action;
    const label = t(`audit.types.${type}`, type);
    return `<span style="${style};padding:1px 7px;border-radius:3px;font-size:.8em;white-space:nowrap;">${Utils.Str.escapeHTML(label)}</span>`;
  };

  // ── Statistics ─────────────────────────────────────────────────────────────
  const calcStats = (entries) => {
    const stats = {
      total: entries.length,
      action: entries.filter(e => (e.type ?? 'action') === 'action').length,
      error: entries.filter(e => (e.type ?? 'action') === 'error').length,
      warning: entries.filter(e => (e.type ?? 'action') === 'warning').length,
      info: entries.filter(e => (e.type ?? 'action') === 'info').length,
    };
    return stats;
  };

  const stats = calcStats(log);
  const statsHtml = `
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0;">
      <div style="padding:12px;background:#e8f4fd;border-radius:4px;text-align:center;">
        <strong>${stats.total}</strong><br/><small>Total</small>
      </div>
      <div style="padding:12px;background:#c8e6c9;border-radius:4px;text-align:center;">
        <strong>${stats.action}</strong><br/><small>Actions</small>
      </div>
      <div style="padding:12px;background:#fdecea;border-radius:4px;text-align:center;">
        <strong>${stats.error}</strong><br/><small>Errors</small>
      </div>
      <div style="padding:12px;background:#fff8e1;border-radius:4px;text-align:center;">
        <strong>${stats.warning}</strong><br/><small>Warnings</small>
      </div>
      <div style="padding:12px;background:#f1f3f4;border-radius:4px;text-align:center;">
        <strong>${stats.info}</strong><br/><small>Info</small>
      </div>
    </div>
  `;

  // ── Filter bar ────────────────────────────────────────────────────────────
  const filterGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.INFO}"></i>&nbsp;${t('audit.groups.filters')}`,
    { class: D.GROUP },
    `
    <table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <tr class="${D.ROW_ODD}">
        <td width="15%"><label for="fme-audit-filter">${t('common.filter')}</label></td>
        <td>
          <select id="fme-audit-filter" style="margin-right:6px;padding: 5px 8px;vertical-align: unset;">
            <option value="all"  >${t('audit.filterAll')}</option>
            <option value="today">${t('audit.filterToday')}</option>
            <option value="week" >${t('audit.filterWeek')}</option>
            <option value="month">${t('audit.filterMonth', 'This Month')}</option>
          </select>
          <select id="fme-audit-type" style="margin-right:6px;padding: 5px 8px;vertical-align: unset;">
            <option value="all"    >${t('audit.typeAll', 'All types')}</option>
            <option value="action" >${t('audit.types.action',  'Action')}</option>
            <option value="warning">${t('audit.types.warning', 'Warning')}</option>
            <option value="error"  >${t('audit.types.error',   'Error')}</option>
            <option value="info"   >${t('audit.types.info',    'Info')}</option>
          </select>
          <input
            type="text"
            id="fme-audit-search"
            placeholder="${t('common.search')}..."
            style="width:180px"
          />
        </td>
        <td align="right" style="white-space:nowrap;">
          <input type="button" class="btn icon_link" name="export-csv" value="CSV" style="margin-right:4px;" />
          <input type="button" class="btn icon_add" name="export-json" value="JSON" style="margin-right:4px;" />
          <input type="button" class="btn icon_delete" name="archive-log" value="Archive" style="margin-right:4px;" />
          <input type="button" class="btn icon_delete" name="clear-log"  value="Clear" />
        </td>
      </tr>
    </table>`
  );

  const renderLog = (entries) => {
    if (!entries.length) {
      return `<p class="${D.HELP_TEXT}" style="padding:8px 0;">${t('audit.noEntries')}</p>`;
    }
    return `
      <table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
        <thead>
          <tr class="${D.ROW_ODD}">
            <th align="left" width="1%"><input type="checkbox" id="fme-audit-select-all" /></th>
            <th align="left" width="17%">${t('audit.timestamp', 'Timestamp')}</th>
            <th align="left" width="8%" >${t('audit.type',      'Type')}</th>
            <th align="left" width="15%">${t('audit.page',      'Page')}</th>
            <th align="left" width="27%">${t('audit.action',    'Action')}</th>
            <th align="left" width="27%">${t('audit.details',   'Details')}</th>
            <th align="center" width="5%">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map((entry, i) => `
            <tr class="${i % 2 === 0 ? D.ROW_ODD : D.ROW_EVEN}" data-entry-ts="${entry.ts}">
              <td><input type="checkbox" class="fme-audit-check" value="${entry.ts}" /></td>
              <td><small>${Utils.Str.formatDate(entry.ts)}</small></td>
              <td>${typeBadge(entry.type)}</td>
              <td><code>${Utils.Str.escapeHTML(entry.page ?? '—')}</code></td>
              <td>${Utils.Str.escapeHTML(entry.action ?? '—')}</td>
              <td><small class="${D.HELP_TEXT}">${Utils.Str.escapeHTML(entry.details ?? '')}</small></td>
              <td align="center">
                <a href="#" class="fme-audit-delete" title="Delete" data-ts="${entry.ts}" style="color:red;">
                  <i class="fa ${I.TRASH}"></i>
                </a>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const logGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.AUDIT}"></i>&nbsp;${t('audit.groups.log', { count: log.length })}`,
    { class: D.GROUP },
    `<div id="fme-audit-list">${renderLog([...log].reverse())}</div>`
  );

  return {
    html: `<div id="fme-audit-page">${statsHtml}${filterGroup}${logGroup}</div>`,

    onMount: (container, { signal, bus: mountBus }) => {
      const isToday = (iso) => {
        const d = new Date(iso), n = new Date();
        return d.getFullYear() === n.getFullYear()
          && d.getMonth()  === n.getMonth()
          && d.getDate()   === n.getDate();
      };
      const isThisWeek = (iso) => (Date.now() - new Date(iso)) / 86400000 <= 7;
      const isThisMonth = (iso) => {
        const d = new Date(iso), n = new Date();
        return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
      };

      const applyFilter = async () => {
        const filter = container.querySelector('#fme-audit-filter')?.value ?? 'all';
        const type   = container.querySelector('#fme-audit-type')?.value   ?? 'all';
        const search = container.querySelector('#fme-audit-search')?.value?.toLowerCase() ?? '';
        const all    = await Storage.AuditLog.get();

        let list = [...all].reverse();
        if (filter === 'today') list = list.filter(e => isToday(e.ts));
        if (filter === 'week')  list = list.filter(e => isThisWeek(e.ts));
        if (filter === 'month') list = list.filter(e => isThisMonth(e.ts));
        if (type !== 'all')     list = list.filter(e => (e.type ?? 'action') === type);
        if (search)             list = list.filter(e =>
          [e.page, e.action, e.details].some(v => v?.toLowerCase().includes(search))
        );

        container.querySelector('#fme-audit-list').innerHTML  = renderLog(list);
        bindActions();
      };

      const bindActions = () => {
        // Select all
        container.querySelector('#fme-audit-select-all')?.addEventListener('change', (e) => {
          container.querySelectorAll('.fme-audit-check').forEach(cb => cb.checked = e.target.checked);
        }, { signal });

        // Delete individual entry
        container.querySelectorAll('.fme-audit-delete').forEach(el => {
          el.addEventListener('click', async (e) => {
            e.preventDefault();
            const ts = el.dataset.ts;
            if (!confirm('Delete this entry?')) return;
            const all = await Storage.AuditLog.get();
            const idx = all.findIndex(entry => String(entry.ts) === String(ts));
            if (idx !== -1) {
              all.splice(idx, 1);
              await Storage.AuditLog.set(all);
              applyFilter();
            }
          }, { signal });
        });
      };

      container.querySelector('#fme-audit-filter')?.addEventListener('change', applyFilter, { signal });
      container.querySelector('#fme-audit-type')  ?.addEventListener('change', applyFilter, { signal });
      container.querySelector('#fme-audit-search') ?.addEventListener('input',
        Utils.Misc.debounce(applyFilter, 300), { signal }
      );

      // Export CSV
      container.querySelector('[name="export-csv"]')?.addEventListener('click', async () => {
        const all = await Storage.AuditLog.get();
        const csv = [
          ['timestamp', 'type', 'page', 'action', 'details'].join(','),
          ...all.map(e => ['ts', 'type', 'page', 'action', 'details']
            .map(k => `"${(e[k] ?? '').replace(/"/g, '""')}"`)
            .join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `fme-audit-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }, { signal });

      // Export JSON
      container.querySelector('[name="export-json"]')?.addEventListener('click', async () => {
        const all = await Storage.AuditLog.get();
        const json = JSON.stringify(all, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `fme-audit-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }, { signal });

      // Archive old entries
      container.querySelector('[name="archive-log"]')?.addEventListener('click', async () => {
        const cutoff = Date.now() - (ARCHIVE_DAYS * 86400000);
        const all = await Storage.AuditLog.get();
        const kept = all.filter(e => new Date(e.ts).getTime() > cutoff);
        const archived = all.length - kept.length;
        
        if (archived === 0) {
          alert(`No entries older than ${ARCHIVE_DAYS} days`);
          return;
        }

        if (!confirm(`Archive ${archived} old entries?`)) return;
        await Storage.AuditLog.set(kept);
        applyFilter();
      }, { signal });

      // Clear all
      container.querySelector('[name="clear-log"]')?.addEventListener('click', async () => {
        if (!confirm(t('audit.confirmClear'))) return;
        await Storage.AuditLog.clear();
        applyFilter();
      }, { signal });

      // Live-update when a new audit entry is appended
      mountBus.on('fme:audit:new', () => applyFilter());

      bindActions();
      applyFilter();
    },
  };
});
