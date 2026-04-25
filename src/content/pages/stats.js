'use strict';
import BasePage from './_base.js';

export default BasePage('stats', async ({ Utils, FM, t, bus, params }) => {
  const stored = await Utils.Storage.get(['fme_stats']);
  const stats  = stored.fme_stats ?? {};

  const D = FM.ACP_DOM.CONTENT;
  const I = FM.ACP_DOM.ICONS;

  const row = (label, value, cls) => `
    <tr class="${cls}">
      <td width="40%"><strong>${label}</strong></td>
      <td>${value ?? '<em>—</em>'}</td>
    </tr>
  `;

  const overviewTable = `
    <table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <tbody>
        ${row(t('stats.members'),    stats.members,    D.ROW_ODD)}
        ${row(t('stats.topics'),     stats.topics,     D.ROW_EVEN)}
        ${row(t('stats.posts'),      stats.posts,      D.ROW_ODD)}
        ${row(t('stats.online'),     stats.online,     D.ROW_EVEN)}
      </tbody>
    </table>
  `;

  const activityTable = `
    <table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <tbody>
        ${row(t('stats.postsToday'), stats.postsToday, D.ROW_ODD)}
        ${row(t('stats.newMembers'), stats.newMembers, D.ROW_EVEN)}
        ${row(t('stats.newTopics'),  stats.newTopics,  D.ROW_ODD)}
        ${row(t('stats.lastPost'),
          stats.lastPost ? Utils.Str.formatDate(stats.lastPost) : '—',
          D.ROW_EVEN
        )}
      </tbody>
    </table>
    <p class="${D.HELP_TEXT}">${t('stats.hint')}</p>
  `;

  return `
    ${!Object.keys(stats).length
      ? `<p class="${D.HELP_TEXT}">${t('stats.noData')}</p>`
      : ''
    }
    ${Utils.DOM.fieldset(
      `<i class="fa ${I.STATS}"></i>&nbsp;${t('stats.groups.overview')}`,
      { class: D.GROUP },
      overviewTable
    )}
    ${Utils.DOM.fieldset(
      `<i class="fa ${I.LOG}"></i>&nbsp;${t('stats.groups.activity')}`,
      { class: D.GROUP },
      activityTable
    )}
  `;
});