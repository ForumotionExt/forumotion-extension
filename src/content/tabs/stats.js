/**
 * FME Stats Tab
 * Shows a dashboard of FME extension usage stats (from chrome.storage)
 * and optionally tries to fetch forum stats from the public forum index page.
 */

var FMEStatsTab = (() => {
  'use strict';

  let _container = null;

  // ─── Public API ──────────────────────────────────────────────────────────────

  async function render(container) {
    _container = container;
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'fme-stats-wrapper main-content';
    wrapper.id = 'main-content';
    wrapper.style.fontSize = '12px';

    wrapper.innerHTML = `
      <div class="fme-section-header">
        <h2 class="fme-section-title">FME</h2>
        <ul class="h2-breadcrumb clearfix"><li class="first">Statistici</li></ul>
        <blockquote class="block_left">
          <p class="explain">Prezentare generală a datelor stocate de extensie și statistici opționale ale forumului.</p>
        </blockquote>
      </div>
      <div id="fme-stats-content">
        <div class="fme-loading"><div class="fme-spinner"></div><span>Se încarcă...</span></div>
      </div>
    `;

    container.appendChild(wrapper);
    await loadStats(wrapper);
  }

  // ─── Load & render ────────────────────────────────────────────────────────────

  async function loadStats(wrapper) {
    const content = wrapper.querySelector('#fme-stats-content');

    const [local, sync] = await Promise.all([
      new Promise(r => chrome.storage.local.get(null, r)),
      new Promise(r => chrome.storage.sync.get(null, r)),
    ]);

    const manifest = chrome.runtime.getManifest();

    // ── Extension stats ──────────────────────────────────────────────────

    const installedThemes = Object.keys(local.fme_installed_themes || {});
    const acpCss          = local.fme_acp_custom_css   || '';
    const forumCss        = local.fme_forum_custom_css || '';
    const widgets         = local.fme_widgets || [];
    const notes           = local.fme_notes   || [];
    const skipped         = sync.skippedVersions || [];

    const extCards = [
      { icon: '🎨', label: 'Teme instalate',   value: installedThemes.length,                          sub: installedThemes.map(id => id).slice(0, 3).join(', ') + (installedThemes.length > 3 ? '…' : '') },
      { icon: '✏️',  label: 'CSS ACP',          value: acpCss.trim() ? `${acpCss.split('\n').length} linii` : 'Gol', sub: acpCss.trim() ? `${(new Blob([acpCss]).size / 1024).toFixed(1)} KB` : '' },
      { icon: '🌐', label: 'CSS Forum',         value: forumCss.trim() ? `${forumCss.split('\n').length} linii` : 'Gol', sub: forumCss.trim() ? `${(new Blob([forumCss]).size / 1024).toFixed(1)} KB` : '' },
      { icon: '⚡', label: 'Widget-uri',        value: `${widgets.filter(w => w.enabled).length} active`, sub: `${widgets.length} total` },
      { icon: '📝', label: 'Notițe',            value: `${notes.filter(n => (n.content || '').trim()).length} cu conținut`, sub: `${notes.length} total` },
      { icon: '🔖', label: 'Versiuni ignorate', value: skipped.length || 0,                             sub: skipped.slice(0, 3).join(', ') || '—' },
    ];

    // ── Storage usage ────────────────────────────────────────────────────

    const localJson  = JSON.stringify(local);
    const syncJson   = JSON.stringify(sync);
    const localKb    = (new Blob([localJson]).size / 1024).toFixed(1);
    const syncKb     = (new Blob([syncJson]).size  / 1024).toFixed(1);

    // ── Build HTML ───────────────────────────────────────────────────────

    content.innerHTML = `
      <fieldset class="fieldset_left">
        <legend>Extensie — v${escHtml(manifest.version)}</legend>
        <div style="display:flex;flex-wrap:wrap;gap:8px;padding:6px 0;">
          ${extCards.map(c => statCard(c)).join('')}
        </div>
      </fieldset>

      <fieldset style="margin-top:10px;">
        <legend>Stocare Chrome</legend>
        <div style="display:flex;flex-wrap:wrap;gap:8px;padding:6px 0;">
          ${statCard({ icon: '💾', label: 'Local storage',  value: `${localKb} KB`, sub: `${Object.keys(local).length} chei` })}
          ${statCard({ icon: '☁️',  label: 'Sync storage',   value: `${syncKb} KB`,  sub: `${Object.keys(sync).length} chei` })}
        </div>
      </fieldset>

      <fieldset style="margin-top:10px;" id="fme-stats-forum-fieldset">
        <legend>Statistici forum</legend>
        <div id="fme-stats-forum-content">
          <p style="font-size:11px;color:#666;padding:4px 0;">Statistici publice extrase din pagina principală a forumului.</p>
          <div class="div_btns" style="margin-top:6px;">
            <input type="button" id="fme-stats-load-forum" value="Încarcă statistici forum" class="btn" />
          </div>
        </div>
      </fieldset>

      <div class="div_btns" style="margin-top:10px;">
        <input type="button" id="fme-stats-refresh" value="Reîncarcă" class="icon_ok" />
        <span style="font-size:10px;color:#999;margin-left:8px;">Actualizat la ${new Date().toLocaleTimeString('ro-RO')}</span>
      </div>
    `;

    wrapper.querySelector('#fme-stats-refresh').addEventListener('click', () => {
      content.innerHTML = '<div class="fme-loading"><div class="fme-spinner"></div><span>Se reîncarcă...</span></div>';
      loadStats(wrapper);
    });

    wrapper.querySelector('#fme-stats-load-forum').addEventListener('click', () => loadForumStats(wrapper));
  }

  // ─── Forum stats fetch ────────────────────────────────────────────────────────

  async function loadForumStats(wrapper) {
    const forumContent = wrapper.querySelector('#fme-stats-forum-content');
    forumContent.innerHTML = '<div class="fme-loading"><div class="fme-spinner"></div><span>Se accesează pagina forumului...</span></div>';

    try {
      const res = await fetch(window.location.origin + '/', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const doc  = new DOMParser().parseFromString(html, 'text/html');

      const stats = extractForumStats(doc);

      if (!stats.length) {
        forumContent.innerHTML = `
          <p style="font-size:11px;color:#888;padding:6px 0;">
            Nu s-au putut identifica statistici în structura forumului. Forumotion nu expune statistici în format standard pe pagina principală.
          </p>
          <div class="div_btns">
            <input type="button" id="fme-forum-open" value="Deschide forumul" class="btn" />
          </div>
        `;
        forumContent.querySelector('#fme-forum-open').addEventListener('click', () => {
          window.open(window.location.origin + '/', '_blank');
        });
        return;
      }

      forumContent.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:8px;padding:6px 0;">
          ${stats.map(s => statCard(s)).join('')}
        </div>
        <div class="div_btns" style="margin-top:6px;">
          <input type="button" id="fme-stats-reload-forum" value="Reîncarcă" class="btn" />
        </div>
      `;
      forumContent.querySelector('#fme-stats-reload-forum').addEventListener('click', () => loadForumStats(wrapper));

    } catch (err) {
      forumContent.innerHTML = `
        <div class="fme-alert fme-alert-error" style="margin:6px 0;">
          <strong>Eroare:</strong> ${escHtml(err.message)}
        </div>
        <div class="div_btns">
          <input type="button" id="fme-stats-retry-forum" value="Reîncearcă" class="btn" />
        </div>
      `;
      forumContent.querySelector('#fme-stats-retry-forum').addEventListener('click', () => loadForumStats(wrapper));
    }
  }

  // ─── Forum stats parser ───────────────────────────────────────────────────────

  function extractForumStats(doc) {
    const stats = [];

    // Forumotion-specific: look for table cells / spans with numeric content
    // near keywords
    const keywords = {
      members:  /\b(membri|members|utilisateurs|inscrits)\b/i,
      posts:    /\b(postari|posts|messages)\b/i,
      topics:   /\b(subiecte|topics|sujets)\b/i,
      online:   /\b(online|conectati|connectes)\b/i,
    };

    const iconMap = {
      members: '👥',
      posts:   '💬',
      topics:  '📋',
      online:  '🟢',
    };

    const labelMap = {
      members: 'Membri',
      posts:   'Postări',
      topics:  'Subiecte',
      online:  'Online',
    };

    // Search for number-like text near keyword text
    const allText = Array.from(doc.querySelectorAll('td, span, div, li, p'))
      .map(el => ({ el, text: el.textContent.trim() }))
      .filter(({ text }) => text.length > 0 && text.length < 200);

    for (const [key, regex] of Object.entries(keywords)) {
      for (const { el, text } of allText) {
        if (!regex.test(text)) continue;

        // Try to find a number in this element or a sibling
        const numMatch = text.match(/[\d][,.\d]*/);
        if (numMatch) {
          stats.push({
            icon:  iconMap[key],
            label: labelMap[key],
            value: numMatch[0].replace(/,/g, '').replace(/\./g, ''),
            sub:   '',
          });
          break;
        }

        // Look in adjacent elements
        const parent = el.parentElement;
        if (parent) {
          const siblingNum = Array.from(parent.querySelectorAll('*'))
            .map(c => c.textContent.trim())
            .find(t => /^\d[\d,.]*$/.test(t));
          if (siblingNum) {
            stats.push({
              icon:  iconMap[key],
              label: labelMap[key],
              value: siblingNum,
              sub:   '',
            });
            break;
          }
        }
      }
    }

    return stats;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function statCard({ icon, label, value, sub }) {
    return `
      <div style="background:#f7f7f7;border:1px solid #ddd;border-radius:6px;padding:10px 16px;text-align:center;min-width:110px;max-width:160px;flex:1;">
        <div style="font-size:20px;margin-bottom:2px;">${icon || ''}</div>
        <div style="font-size:18px;font-weight:700;color:#369fcf;">${escHtml(String(value))}</div>
        <div style="font-size:11px;color:#666;margin-top:3px;">${escHtml(label)}</div>
        ${sub ? `<div style="font-size:10px;color:#aaa;margin-top:2px;">${escHtml(sub)}</div>` : ''}
      </div>
    `;
  }

  function escHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { render };
})();
