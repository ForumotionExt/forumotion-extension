'use strict';

import BasePage from './_base.js';

export default BasePage('home', async ({ Utils, FM, t, bus, params }) => {
  const origin = Utils.UrlUtils.origin();
  const tid    = Utils.UrlUtils.param('tid');

  const shortcuts = [
    { icon: 'fa-cog',                  label: t('home.shortcuts.settings'),  color: '#3c9ebf', section: 'settings'   },
    { icon: 'fa-paint-brush',          label: t('home.shortcuts.themes'),    color: '#9b59b6', section: 'themes'     },
    { icon: 'fa-wrench',               label: t('home.shortcuts.advanced'),  color: '#27ae60', section: 'advanced'   },
    { icon: 'fa-users',                label: t('home.shortcuts.community'), color: '#e67e22', href: 'https://github.com/ForumotionExt/forumotion-extension/discussions' },
    { icon: 'fa-github',               label: t('home.shortcuts.github'),    color: '#333',    href: 'https://github.com/ForumotionExt/forumotion-extension'              },
    { icon: 'fa-coffee',               label: t('home.shortcuts.kofi'),      color: '#888',    href: 'https://ko-fi.com/fmestaark'                                        },
    { icon: 'fa-book',                 label: t('home.shortcuts.docs'),      color: '#3c9ebf', href: 'https://github.com/ForumotionExt/forumotion-extension/wiki'         },
    { icon: 'fa-exclamation-triangle', label: t('home.shortcuts.report'),    color: '#e74c3c', href: 'https://github.com/ForumotionExt/forumotion-extension/issues'       },
  ];

  const TYPE_ICONS = {
    announcement      : { icon: 'fa-bullhorn',     color: '#e67e22' },
    'release-candidate': { icon: 'fa-flask',        color: '#8e44ad' },
    development       : { icon: 'fa-code',          color: '#3498db' },
    production        : { icon: 'fa-check-circle',  color: '#27ae60' },
    release           : { icon: 'fa-tag',           color: '#2ecc71' },
    update            : { icon: 'fa-refresh',       color: '#3c9ebf' },
  };

  const cols  = Math.min(shortcuts.length, 4);
  const chunk = (arr, n) => Array.from(
    { length: Math.ceil(arr.length / n) },
    (_, i) => arr.slice(i * n, i * n + n)
  );

  const skeleton = (label) => `
    <p style="text-align:center;padding:16px;color:#bbb;">
      <i class="fa fa-spinner fa-spin"></i>&nbsp;${label}
    </p>
  `;

  const h2    = Utils.DOM.createFragment('h2',        { className: 'fme-home' },   t('home.welcome'));
  const block = Utils.DOM.createFragment('blockquote',{ className: 'block_left' }, `<p class="explain">${t('home.description')}</p>`);

  return {
    html: `
      ${h2}
      ${block}
      <div class="fme-shortcuts" style="margin-bottom:40px;">
        <table cellpadding="0" cellspacing="10" class="${FM.ACP_DOM.CONTENT.TABLE}">
          <tbody>
            ${chunk(shortcuts, cols).map(row => `
              <tr>
                ${row.map(({ icon, label, color, section, href }) => {
                  const url = href ?? FM.ACP_URLS.FME_SECTION(origin, tid ?? '', section);
                  return `
                    <td>
                      <a href="${url}"
                        class  = "fme-shortcut"
                        target = "${href ? '_blank' : '_self'}"
                        style  = "--shortcut-color: ${color}">
                        <i class="fa ${icon}" style="color:${color}"></i>
                        <span>${label}</span>
                      </a>
                    </td>
                  `;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Announcements Skeleton -->
      <div data-section="announcements">
        ${skeleton(t('common.loading'))}
      </div>

      <!-- Statistics Skeleton -->
      <table cellpadding="0" cellspacing="1" border="0" width="100%">
        <tbody>
          <tr valign="top">
            <td width="48%" style="padding-right:10px;">
              <div data-section="stats">
                ${skeleton(t('common.loading'))}
              </div>
            </td>
            <td width="52%">
              <div data-section="changelog">
                ${skeleton(t('common.loading'))}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    `,

    sections: {
      'announcements': async (el, { bus, signal }) => {
        const ann = await bus.request('fetch:announcements');
        if (signal.aborted) return;

        el.innerHTML = `
          <fieldset>
            <legend><i class="fa fa-rss"></i> ${t('home.announcements')}</legend>
            ${!ann?.length
              ? `<p style="text-align:center;padding:16px;color:#aaa;">
                   ${t('home.noAnnouncements')}
                 </p>`
              : `<table class="${FM.ACP_DOM.CONTENT.TABLE}" cellpadding="0" cellspacing="1" width="100%">
                   <tbody>
                     ${ann.map((item, i) => {
                       const rowClass = i % 2 === 0
                         ? FM.ACP_DOM.CONTENT.ROW_ODD
                         : FM.ACP_DOM.CONTENT.ROW_EVEN;
                       const icon = TYPE_ICONS[item.type]
                         ?? { icon: 'fa-info-circle', color: '#7f8c8d' };
                       return `
                         <tr class="${rowClass}">
                           <td>
                             <i class="fa ${icon.icon}" style="color:${icon.color};margin-right:6px;"></i>
                             ${item.url
                               ? `<a href="${item.url}" target="_blank">${Utils.Str.escapeHTML(item.title)}</a>`
                               : Utils.Str.escapeHTML(item.title)}
                             ${item.body
                               ? `<br><small style="color:#888;">${Utils.Str.escapeHTML(item.body)}</small>`
                               : ''}
                           </td>
                           <td style="white-space:nowrap;color:#888;vertical-align:top;width:140px;font-size:0.85em;">
                             ${item.date && !isNaN(Date.parse(item.date))
                               ? new Date(item.date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })
                               : (item.date || '—')}
                           </td>
                         </tr>
                       `;
                     }).join('')}
                   </tbody>
                 </table>`
            }
          </fieldset>
        `;
      },

      'stats': async (el, { bus, signal }) => {
        // Toate requesturile în paralel — nu secvențial
        const [themes, plugins, logs, versionInfo] = await Promise.allSettled([
          bus.request('themes:all'),
          bus.request('plugins:all'),
          bus.request('logs:recent', { limit: 5 }),
          bus.request('fetch:version'),
        ]);

        if (signal.aborted) return;

        // Extragem valorile — fallback la [] / null dacă request a eșuat
        const themesList  = themes.status  === 'fulfilled' ? themes.value  : [];
        const pluginsList = plugins.status === 'fulfilled' ? plugins.value : [];
        const logsList    = logs.status    === 'fulfilled' ? logs.value    : [];
        const version     = versionInfo.status === 'fulfilled' ? versionInfo.value : null;

        // Calcule
        const activeTheme   = themesList.find(t => t.active);
        const activePlugins = pluginsList.filter(p => p.active).length;

        const rows = [
          {
            label: t('home.stats.version', 'Versiune extensie'),
            value: version?.version
              ? `v${Utils.Str.escapeHTML(version.version)}`
              : '—',
          },
          {
            label: t('home.stats.themes', 'Teme instalate'),
            value: themesList.length,
          },
          {
            label: t('home.stats.active_theme', 'Temă activă'),
            value: activeTheme
              ? `<span style="color:#27ae60;">
                  <i class="fa fa-check-circle"></i>
                  ${Utils.Str.escapeHTML(activeTheme.name)}
                </span>`
              : `<span style="color:#aaa;">—</span>`,
          },
          {
            label: t('home.stats.plugins', 'Plugins instalate'),
            value: pluginsList.length,
          },
          {
            label: t('home.stats.plugins_active', 'Plugins active'),
            value: activePlugins > 0
              ? `<span style="color:#27ae60;">
                  <i class="fa fa-plug"></i> ${activePlugins}
                </span>`
              : `<span style="color:#aaa;">0</span>`,
          },
        ];

        el.innerHTML = `
          <fieldset>
            <legend>
              <i class="fa ${FM.ACP_DOM.ICONS.STATS}"></i> ${t('home.statsTitle', 'Statistics')}
            </legend>

            <!-- Tabel statistici principale -->
            <table class="${FM.ACP_DOM.CONTENT.TABLE}" cellpadding="0" cellspacing="1" width="100%">
              <tbody>
                ${rows.map((row, i) => `
                  <tr class="${i % 2 === 0 ? FM.ACP_DOM.CONTENT.ROW_ODD : FM.ACP_DOM.CONTENT.ROW_EVEN}">
                    <td style="color:#666;">${row.label}</td>
                    <td><strong>${row.value}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <!-- Activitate recentă -->
            ${logsList.length ? `
              <div style="margin-top:12px;">
                <div style="font-size:0.8em;color:#999;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">
                  <i class="fa fa-history"></i> ${t('home.stats.recent_activity', 'Activitate recentă')}
                </div>
                <table class="${FM.ACP_DOM.CONTENT.TABLE}" cellpadding="0" cellspacing="1" width="100%">
                  <tbody>
                    ${logsList.map((log, i) => {
                      const rowClass = i % 2 === 0
                        ? FM.ACP_DOM.CONTENT.ROW_ODD
                        : FM.ACP_DOM.CONTENT.ROW_EVEN;

                      const LEVEL_STYLE = {
                        error:   { color: '#e74c3c', icon: 'fa-times-circle'  },
                        warn:    { color: '#e67e22', icon: 'fa-warning'        },
                        info:    { color: '#3498db', icon: 'fa-info-circle'    },
                        success: { color: '#27ae60', icon: 'fa-check-circle'   },
                      };
                      const style = LEVEL_STYLE[log.level] ?? LEVEL_STYLE.info;

                      return `
                        <tr class="${rowClass}">
                          <td style="width:16px;">
                            <i class="fa ${style.icon}" style="color:${style.color};"></i>
                          </td>
                          <td style="font-size:0.88em;">
                            ${Utils.Str.escapeHTML(log.message)}
                          </td>
                          <td style="white-space:nowrap;color:#aaa;font-size:0.8em;width:80px;text-align:right;">
                            ${log.ts
                              ? new Date(log.ts).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}

          </fieldset>
        `;
      },

      'changelog': async (el, { bus, signal }) => {
        const log = await bus.request('fetch:changelog');
        if (signal.aborted) return;

        const SECTION_STYLE = {
          'Added'   : { color: '#27ae60', icon: 'fa-plus-circle'  },
          'Fixed'   : { color: '#e74c3c', icon: 'fa-bug'          },
          'Changed' : { color: '#3498db', icon: 'fa-pencil'       },
          'Removed' : { color: '#95a5a6', icon: 'fa-minus-circle' },
          'Security': { color: '#e67e22', icon: 'fa-shield'       },
        };

        el.innerHTML = `
          <fieldset>
            <legend>
              <i class="fa ${FM.ACP_DOM.ICONS.CHANGELOG}"></i> ${t('home.changelog')}
            </legend>

            ${log.slice(0, 3).map((entry, i) => `
              <div class="fme-changelog-entry" style="margin-bottom:12px;">

                <!-- Header — click pentru expand/collapse -->
                <div class="fme-changelog-toggle"
                    style = "cursor:pointer;display:flex;align-items:center;gap:8px;padding:6px 0;"
                    data-target="changelog-body-${i}">
                  <strong style="font-size:1em;">v${Utils.Str.escapeHTML(entry.version)}</strong>
                  ${entry.date
                    ? `<span style="color:#999;font-size:0.85em;">${Utils.Str.escapeHTML(entry.date)}</span>`
                    : ''}
                  <!-- Badge-uri rezumat -->
                  ${Object.entries(entry.sections ?? {}).map(([type]) => {
                    const s = SECTION_STYLE[type] ?? { color: '#999' };
                    return `<span style="
                      background:${s.color}22;
                      color:${s.color};
                      border:1px solid ${s.color}44;
                      border-radius:3px;
                      padding:1px 6px;
                      font-size:0.75em;
                    ">${Utils.Str.escapeHTML(type)}</span>`;
                  }).join('')}
                  <i class="fa fa-chevron-${i === 0 ? 'up' : 'down'}"
                    style="margin-left:auto;color:#aaa;font-size:0.8em;"
                    id="chevron-${i}"></i>
                </div>

                <!-- Body — prima versiune deschisă, restul colapsate -->
                <div id="changelog-body-${i}"
                    style="display:${i === 0 ? 'block' : 'none'};padding-left:8px;">
                  ${Object.entries(entry.sections ?? {}).map(([type, items]) => {
                    const s = SECTION_STYLE[type] ?? { color: '#999', icon: 'fa-circle' };
                    return `
                      <div style="margin:6px 0;">
                        <span style="color:${s.color};font-weight:bold;font-size:0.85em;">
                          <i class="fa ${s.icon}"></i> ${Utils.Str.escapeHTML(type)}
                        </span>
                        <ul style="margin:4px 0 4px 16px;padding:0;">
                          ${items
                            .filter(item => item !== 'Nothing yet.' && item !== '_Nothing yet_')
                            .map(item => `<li style="font-size:0.9em;color:#555;">${Utils.Str.escapeHTML(item)}</li>`)
                            .join('')}
                        </ul>
                      </div>
                    `;
                  }).join('')}
                </div>

              </div>
              ${i < 2 ? '<hr style="border:none;border-top:1px solid #eee;margin:8px 0;">' : ''}
            `).join('')}

          </fieldset>
        `;

        // Toggle expand/collapse
        el.querySelectorAll('.fme-changelog-toggle').forEach(toggle => {
          toggle.addEventListener('click', () => {
            const bodyId   = toggle.dataset.target;
            const body     = el.querySelector(`#${bodyId}`);
            const chevron  = toggle.querySelector('[id^="chevron"]');
            const isOpen   = body.style.display !== 'none';

            body.style.display = isOpen ? 'none' : 'block';
            chevron.className  = `fa fa-chevron-${isOpen ? 'down' : 'up'}`;
            chevron.style.color = '#aaa';
            chevron.style.fontSize = '0.8em';
            chevron.style.marginLeft = 'auto';
          });
        });
      },
    },
  };
});