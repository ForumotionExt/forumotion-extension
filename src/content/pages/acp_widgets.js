'use strict';
import BasePage from './_base.js';
import { buildBtns } from '../shared/adapter.js';

const STORAGE_KEY = 'fme_acp_widgets';

const BUILTIN_WIDGETS = [
  {
    id      : 'quick-stats',
    label   : 'Quick Stats',
    desc    : 'Shows post/member counts in the sidebar.',
    icon    : 'fa-bar-chart',
    default : true,
  },
  {
    id      : 'forum-status',
    label   : 'Forum Status',
    desc    : 'Displays current online users and server status.',
    icon    : 'fa-signal',
    default : true,
  },
  {
    id      : 'recent-posts',
    label   : 'Recent Posts',
    desc    : 'Lists the last 5 posts made on the forum.',
    icon    : 'fa-comments',
    default : false,
  },
  {
    id      : 'admin-notes-widget',
    label   : 'Admin Notes Widget',
    desc    : 'Shows pinned admin notes directly in the dashboard.',
    icon    : 'fa-sticky-note-o',
    default : false,
  },
];

export default BasePage('acp_widgets', async ({ Utils, FM, t, bus, params }) => {
  const stored  = await Utils.Storage.get([STORAGE_KEY]);
  const cfg     = stored[STORAGE_KEY] ?? {};

  const D = FM.ACP_DOM.CONTENT;
  const I = FM.ACP_DOM.ICONS;

  const widgets = BUILTIN_WIDGETS.map(w => ({
    ...w,
    enabled: cfg[w.id]?.enabled ?? w.default,
    order  : cfg[w.id]?.order   ?? 99,
  })).sort((a, b) => a.order - b.order);

  const active   = widgets.filter(w =>  w.enabled);
  const inactive = widgets.filter(w => !w.enabled);

  const renderRow = (w, i, cls) => `
    <tr class="${cls}" data-widget-id="${w.id}">
      <td width="5%"><i class="fa ${w.icon}"></i></td>
      <td width="35%"><strong>${w.label}</strong></td>
      <td><small class="${D.HELP_TEXT}">${w.desc}</small></td>
      <td align="right" style="white-space:nowrap">
        <a href="#" class="fme-widget-toggle" data-id="${w.id}" data-enabled="${w.enabled}">
          ${w.enabled
            ? `<i class="fa ${I.TIMES}"></i>&nbsp;${t('acp_widgets.disable')}`
            : `<i class="fa ${I.CHECK}"></i>&nbsp;${t('acp_widgets.enable')}`
          }
        </a>
      </td>
    </tr>
  `;

  const activeGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.CHECK}"></i>&nbsp;${t('acp_widgets.groups.active')} (${active.length})`,
    { class: D.GROUP },
    `<table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <tbody id="fme-widgets-active">
        ${active.length
          ? active.map((w, i) => renderRow(w, i, i % 2 === 0 ? D.ROW_ODD : D.ROW_EVEN)).join('')
          : `<tr class="${D.ROW_ODD}"><td colspan="4"><em>${t('acp_widgets.noWidgets')}</em></td></tr>`
        }
      </tbody>
    </table>
    <p class="${D.HELP_TEXT}"><i class="fa ${I.INFO}"></i>&nbsp;${t('acp_widgets.hint')}</p>`
  );

  const availableGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.PLUS}"></i>&nbsp;${t('acp_widgets.groups.available')}`,
    { class: D.GROUP },
    `<table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <tbody id="fme-widgets-available">
        ${inactive.length
          ? inactive.map((w, i) => renderRow(w, i, i % 2 === 0 ? D.ROW_ODD : D.ROW_EVEN)).join('')
          : `<tr class="${D.ROW_ODD}"><td colspan="4"><em>—</em></td></tr>`
        }
      </tbody>
    </table>`
  );

  const html = `
    <div id="fme-acp-widgets-page">
      ${activeGroup}
      ${availableGroup}
      <div id="fme-widget-msg" style="display:none"></div>
    </div>
  `;

  return {
    html,
    onMount: (container, { signal }) => {
      const showMsg = (msg, isError = false) => {
        const el = container.querySelector('#fme-widget-msg');
        if (!el) return;
        el.textContent   = msg;
        el.className     = isError ? FM.ACP_DOM.MESSAGES.ERROR : FM.ACP_DOM.MESSAGES.SUCCESS;
        el.style.display = '';
        setTimeout(() => { el.style.display = 'none'; }, 2500);
      };

      const toggleWidget = async (id, enable) => {
        const s   = await Utils.Storage.get([STORAGE_KEY]);
        const cur = s[STORAGE_KEY] ?? {};
        cur[id]   = { ...cur[id], enabled: enable };
        await Utils.Storage.set({ [STORAGE_KEY]: cur });
        showMsg(t('acp_widgets.saved'));
        location.reload();
      };

      container.querySelectorAll('.fme-widget-toggle').forEach(el => {
        el.addEventListener('click', async (e) => {
          e.preventDefault();
          const id      = el.dataset.id;
          const enabled = el.dataset.enabled === 'true';
          await toggleWidget(id, !enabled);
        }, { signal });
      });
    }
  };
});
