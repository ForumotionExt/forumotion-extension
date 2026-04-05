/**
 * FME Forum CSS Tab
 * Manage custom CSS injected into the forum front-end pages (non-ACP).
 * The CSS is stored in chrome.storage.local and applied by forum-injector.js
 * on every non-admin forum page load.
 */

var FMEForumCssTab = (() => {
  'use strict';

  const STORAGE_KEY  = 'fme_forum_custom_css';
  const STYLE_TAG_ID = 'fme-forum-custom-style';

  /* ─── Built-in preset: Forum Dark 2026 ───────────────────────────────────── */
  const PRESET_FORUM_DARK = `/* =================================================
   FME Forum Dark 2026
   Dark theme for the Forumotion forum front-end.
   Applied on forum pages (not ACP) by FME Extension.
   Adjust variables below to customise colours.
   ================================================= */

:root {
  --fme-f-bg:      #0f1117;
  --fme-f-surface: #171923;
  --fme-f-card:    #1a1f2e;
  --fme-f-border:  #252d3d;
  --fme-f-accent:  #6c63ff;
  --fme-f-text:    #e2e8f0;
  --fme-f-muted:   #64748b;
  --fme-f-link:    #58a6ff;
  --fme-f-success: #10b981;
  --fme-f-radius:  6px;
}

/* === GLOBAL === */
body {
  background: var(--fme-f-bg) !important;
  color: var(--fme-f-text) !important;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif !important;
}

/* === HEADER === */
#header, .header, #page-header, .top-bar {
  background: var(--fme-f-surface) !important;
  border-bottom: 1px solid var(--fme-f-border) !important;
  box-shadow: 0 2px 12px rgba(0,0,0,0.3) !important;
}

/* === NAVIGATION === */
#nav, .nav, .menu-nav, #menu, ul.nav {
  background: var(--fme-f-surface) !important;
  border-color: var(--fme-f-border) !important;
}
#nav a, .nav a, ul.nav a {
  color: var(--fme-f-muted) !important;
  transition: color 0.2s !important;
}
#nav a:hover, .nav a:hover, ul.nav a:hover {
  color: var(--fme-f-accent) !important;
  text-decoration: none !important;
}

/* === CATEGORIES / FORUM LIST === */
.forum-cat, .cat-title, .catRow, table.forumline thead tr,
.category, .cat_title {
  background: var(--fme-f-card) !important;
  border-color: var(--fme-f-border) !important;
}
.forumRow, .forum-row, table.forumline tbody tr {
  background: var(--fme-f-surface) !important;
  border-bottom: 1px solid var(--fme-f-border) !important;
}
.forumRow:hover, .forum-row:hover, table.forumline tbody tr:hover {
  background: rgba(108,99,255,0.06) !important;
}

/* === TOPICS / POSTS === */
.topicRow, table.forumline tr.row1 { background: var(--fme-f-surface) !important; }
.topicRow, table.forumline tr.row2 { background: var(--fme-f-card) !important; }

/* Post blocks */
table.tablebg, .postbody, .post, .post-body {
  background: var(--fme-f-card) !important;
  border: 1px solid var(--fme-f-border) !important;
}
td.postbody { background: var(--fme-f-card) !important; }
td.postdetails, .postdetails {
  background: var(--fme-f-surface) !important;
  border-right: 1px solid var(--fme-f-border) !important;
}

/* === TABLES === */
table { border-color: var(--fme-f-border) !important; }
td, th { color: var(--fme-f-text) !important; }
th { background: var(--fme-f-card) !important; }
tr.row1 { background: var(--fme-f-surface) !important; }
tr.row2 { background: var(--fme-f-card) !important; }

/* === LINKS === */
a, a:link, a:visited { color: var(--fme-f-link) !important; }
a:hover { color: var(--fme-f-accent) !important; }

/* === FORMS === */
input:not([type="submit"]):not([type="button"]):not([type="radio"]):not([type="checkbox"]),
select, textarea {
  background: var(--fme-f-surface) !important;
  border: 1px solid var(--fme-f-border) !important;
  color: var(--fme-f-text) !important;
  border-radius: var(--fme-f-radius) !important;
}
input:focus, textarea:focus, select:focus {
  border-color: var(--fme-f-accent) !important;
  outline: none !important;
  box-shadow: 0 0 0 3px rgba(108,99,255,0.15) !important;
}
input[type="submit"], input[type="button"], button, .button {
  background: var(--fme-f-accent) !important;
  border: none !important;
  color: #fff !important;
  border-radius: var(--fme-f-radius) !important;
  cursor: pointer !important;
}
input[type="submit"]:hover, input[type="button"]:hover, button:hover, .button:hover {
  filter: brightness(1.12) !important;
}

/* === BREADCRUMB === */
.breadcrumb, #breadcrumb, .nav-path {
  background: transparent !important;
  color: var(--fme-f-muted) !important;
}
.breadcrumb a, #breadcrumb a { color: var(--fme-f-link) !important; }

/* === PAGINATION === */
.pagination a, .pages a, .paginacion a {
  background: var(--fme-f-card) !important;
  border: 1px solid var(--fme-f-border) !important;
  color: var(--fme-f-link) !important;
  border-radius: 4px !important;
}
.pagination a:hover, .pages a:hover {
  background: var(--fme-f-accent) !important;
  color: #fff !important;
  border-color: var(--fme-f-accent) !important;
}
.pagination strong, .pages strong {
  background: var(--fme-f-accent) !important;
  color: #fff !important;
  border-radius: 4px !important;
  padding: 1px 5px !important;
  border: none !important;
}

/* === FOOTER === */
#footer, .footer, #page-footer {
  background: var(--fme-f-surface) !important;
  border-top: 1px solid var(--fme-f-border) !important;
  color: var(--fme-f-muted) !important;
}
#footer a, .footer a { color: var(--fme-f-muted) !important; }

/* === SCROLLBAR === */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--fme-f-bg); }
::-webkit-scrollbar-thumb { background: var(--fme-f-border); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--fme-f-accent); }

/* === SELECTION === */
::selection { background: rgba(108,99,255,0.35); color: #fff; }`;

  let _container  = null;
  let _currentCss = '';
  let _guardActive = false;

  /* ─── CSS Snippet Catalog ────────────────────────────────────────────────── */
  const CSS_SNIPPETS = [
    {
      id: 'glow-avatars',
      name: 'Glow Avatars',
      desc: 'Efect de strălucire pe avatare la hover',
      css: `/* FME Snippet: Glow Avatars */
.postdetails img, .user-avatar img, .postprofile img {
  border-radius: 50% !important;
  transition: box-shadow 0.3s ease, transform 0.3s ease !important;
}
.postdetails img:hover, .user-avatar img:hover, .postprofile img:hover {
  box-shadow: 0 0 15px rgba(108,99,255,0.6), 0 0 30px rgba(108,99,255,0.3) !important;
  transform: scale(1.05) !important;
}`,
    },
    {
      id: 'sticky-navbar',
      name: 'Sticky Navbar',
      desc: 'Bara de navigare rămâne fixă la scroll',
      css: `/* FME Snippet: Sticky Navbar */
#nav, .nav, #menu, .menu-nav, ul.nav, #page-header {
  position: sticky !important;
  top: 0 !important;
  z-index: 999 !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
}`,
    },
    {
      id: 'hide-ads',
      name: 'Ascunde reclame',
      desc: 'Ascunde reclamele Forumotion de pe forum',
      css: `/* FME Snippet: Hide Ads */
iframe[src*="ads"], iframe[src*="pub"],
div[id*="ad_"], div[class*="ad_banner"],
div[id*="google_ads"], .adsbygoogle,
#fa_toolbar, #fa_icon, #fa_right,
.social_share, #fa_share,
td[class="ad_"] { display: none !important; }`,
    },
    {
      id: 'custom-scrollbar',
      name: 'Custom Scrollbar',
      desc: 'Scrollbar slim și modern',
      css: `/* FME Snippet: Custom Scrollbar */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #f1f1f1; }
::-webkit-scrollbar-thumb { background: #888; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #555; }
* { scrollbar-width: thin; scrollbar-color: #888 #f1f1f1; }`,
    },
    {
      id: 'smooth-transitions',
      name: 'Tranziții Smooth',
      desc: 'Adaugă tranziții subtile la link-uri și butoane',
      css: `/* FME Snippet: Smooth Transitions */
a, button, input[type="submit"], input[type="button"], .button {
  transition: all 0.2s ease !important;
}
a:hover { opacity: 0.85 !important; }
button:hover, input[type="submit"]:hover, .button:hover {
  transform: translateY(-1px) !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
}`,
    },
    {
      id: 'rounded-corners',
      name: 'Border Radius Global',
      desc: 'Colțuri rotunjite pe blocuri, postări, tabel',
      css: `/* FME Snippet: Rounded Corners */
table.forumline, .forumline, fieldset,
.post, .postbody, table.tablebg,
.catRow, .forumRow, .topicRow, .catHead {
  border-radius: 8px !important;
  overflow: hidden !important;
}`,
    },
    {
      id: 'post-separator',
      name: 'Post Separator',
      desc: 'Separator vizual elegant între postări',
      css: `/* FME Snippet: Post Separator */
.post, table.tablebg, tr.post {
  margin-bottom: 12px !important;
  border-bottom: 3px solid rgba(108,99,255,0.2) !important;
  padding-bottom: 12px !important;
}`,
    },
    {
      id: 'topic-hover',
      name: 'Topic Hover Effect',
      desc: 'Efect de highlight la hover pe topicuri',
      css: `/* FME Snippet: Topic Hover */
tr.row1:hover, tr.row2:hover,
.forumRow:hover, .topicRow:hover {
  background: rgba(60,158,191,0.08) !important;
  transition: background 0.2s ease !important;
}`,
    },
  ];

  // ─── Public API ──────────────────────────────────────────────────────────────

  function render(container) {
    _container = container;
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'fme-forum-css-wrapper main-content';
    wrapper.id = 'main-content';
    wrapper.style.fontSize = '12px';

    wrapper.innerHTML = `
      <div class="fme-section-header">
        <h2 class="fme-section-title">FME</h2>
        <ul class="h2-breadcrumb clearfix"><li class="first">Forum CSS</li></ul>
        <blockquote class="block_left">
          <p class="explain">CSS personalizat aplicat pe paginile forumului (nu ACP). Se injectează automat la fiecare vizită pe forum.</p>
        </blockquote>
      </div>

      <fieldset class="fieldset_left">
        <legend>CSS personalizat forum</legend>
        <dl>
            <textarea id="fme-fcss-editor"
              style="height:380px;font-family:Consolas,'Cascadia Code','Fira Code',monospace;font-size:12px;line-height:1.6;padding:12px;border:1px solid #252d3d;border-radius:6px;resize:vertical;background:#efefef;color:#2a2a2a;tab-size:2;box-sizing:border-box;"
              placeholder="/* CSS pentru paginile forumului */&#10;body { background: #0f1117 !important; }"></textarea>
        </dl>

        <div class="div_btns" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">
          <input type="button" id="fme-fcss-save"     value="Salveaza"              class="icon_ok" />
          <input type="button" id="fme-fcss-upload"   value="Incarca fisier .css"   class="btn" />
          <input type="button" id="fme-fcss-preset"   value="&#10022; Forum Dark 2026" class="btn" />
          <input type="button" id="fme-fcss-preview"  value="&#9654; Deschide forumul" class="btn" />
          <input type="button" id="fme-fcss-clear"    value="Sterge tot"            class="icon_cancel" />
          <input type="file"   id="fme-fcss-file"     accept=".css,text/css" style="display:none;" />
        </div>

        <div style="display:flex;align-items:center;gap:12px;margin-top:6px;flex-wrap:wrap;">
          <span id="fme-fcss-status" style="font-size:11px;font-weight:600;min-width:140px;"></span>
          <span id="fme-fcss-info"   style="font-size:11px;font-family:Consolas,monospace;color:#64748b;"></span>
        </div>

        <div style="margin-top:8px;padding:8px 10px;background:#f0f8fc;border:1px solid #b3d9ec;border-radius:4px;font-size:11px;color:#2c6e8a;">
          <strong>ℹ</strong> CSS-ul este aplicat de <em>Forum Injector</em> pe toate paginile forumului (non-ACP). Nu se poate previzualiza direct din ACP — deschide forumul pentru a vedea efectele.
        </div>
      </fieldset>

      <fieldset class="fieldset_left" style="margin-top:14px;">
        <legend>Catalog Snippet CSS</legend>
        <div style="padding:4px 0 8px;font-size:11px;color:#64748b;">
          Snippet-uri rapide pe care le poți adăuga la CSS-ul tău. Click pe <strong>Adaugă</strong> pentru a insera codul în editor.
        </div>
        <table class="forumline" width="100%" cellspacing="1" cellpadding="4">
          <tr>
            <th class="thHead" colspan="3" style="text-align:left;">Snippet-uri disponibile</th>
          </tr>
          ${CSS_SNIPPETS.map((s, i) => `
          <tr class="${i % 2 === 0 ? 'row1' : 'row2'}">
            <td style="width:160px;font-weight:600;">${s.name}</td>
            <td style="font-size:11px;color:#555;">${s.desc}</td>
            <td style="width:80px;text-align:center;">
              <input type="button" class="btn fme-snippet-add" data-snippet-id="${s.id}" value="Adaug\u0103" />
            </td>
          </tr>`).join('')}
        </table>
      </fieldset>
    `;

    container.appendChild(wrapper);
    bindEvents(wrapper);
    bindSnippetEvents(wrapper);
    loadSaved(wrapper);
  }

  // ─── Load saved ───────────────────────────────────────────────────────────────

  function loadSaved(wrapper) {
    chrome.storage.local.get({ [STORAGE_KEY]: '' }, result => {
      const css = result[STORAGE_KEY] || '';
      wrapper.querySelector('#fme-fcss-editor').value = css;
      updateInfo(wrapper, css);
    });
  }

  // ─── Events ───────────────────────────────────────────────────────────────────

  function bindEvents(wrapper) {
    const editor    = wrapper.querySelector('#fme-fcss-editor');
    const saveBtn   = wrapper.querySelector('#fme-fcss-save');
    const uploadBtn = wrapper.querySelector('#fme-fcss-upload');
    const presetBtn = wrapper.querySelector('#fme-fcss-preset');
    const previewBtn= wrapper.querySelector('#fme-fcss-preview');
    const clearBtn  = wrapper.querySelector('#fme-fcss-clear');
    const fileInput = wrapper.querySelector('#fme-fcss-file');
    const statusEl  = wrapper.querySelector('#fme-fcss-status');

    // Tab key → 2 spaces
    editor.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = editor.selectionStart, en = editor.selectionEnd;
        editor.value = editor.value.substring(0, s) + '  ' + editor.value.substring(en);
        editor.selectionStart = editor.selectionEnd = s + 2;
      }
    });

    editor.addEventListener('input', () => updateInfo(wrapper, editor.value));

    saveBtn.addEventListener('click', () => {
      const css = editor.value.trim();
      chrome.storage.local.set({ [STORAGE_KEY]: css }, () => {
        updateInfo(wrapper, css);
        setStatus(statusEl, 'Salvat ✓', '#10b981');
        if (typeof FMEActivityLog !== 'undefined') FMEActivityLog.log('css-forum-save', 'CSS forum salvat (' + css.split('\n').length + ' linii)');
      });
    });

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const existing  = editor.value.trim();
        const sep       = existing ? `\n\n/* ─── ${file.name} ─── */\n` : `/* ${file.name} */\n`;
        editor.value    = existing ? existing + sep + ev.target.result : ev.target.result;
        updateInfo(wrapper, editor.value);
        setStatus(statusEl, `${file.name} încărcat!`, '#6c63ff');
      };
      reader.readAsText(file);
      fileInput.value = '';
    });

    presetBtn.addEventListener('click', () => {
      if (editor.value.trim() && !confirm('Înlocuiești CSS-ul curent cu presetul Forum Dark 2026?')) return;
      editor.value = PRESET_FORUM_DARK;
      updateInfo(wrapper, PRESET_FORUM_DARK);
      setStatus(statusEl, 'Forum Dark 2026 încărcat!', '#6c63ff');
    });

    previewBtn.addEventListener('click', () => {
      window.open(window.location.origin + '/', '_blank');
    });

    clearBtn.addEventListener('click', () => {
      if (!editor.value.trim()) return;
      if (!confirm('Ștergi tot CSS-ul de forum?')) return;
      editor.value = '';
      chrome.storage.local.set({ [STORAGE_KEY]: '' }, () => {
        updateInfo(wrapper, '');
        setStatus(statusEl, 'Șters.', '#f43f5e');
      });
    });
  }

  // ─── Snippet catalog events ──────────────────────────────────────────────────

  function bindSnippetEvents(wrapper) {
    const editor   = wrapper.querySelector('#fme-fcss-editor');
    const statusEl = wrapper.querySelector('#fme-fcss-status');

    wrapper.querySelectorAll('.fme-snippet-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const snippet = CSS_SNIPPETS.find(s => s.id === btn.dataset.snippetId);
        if (!snippet) return;
        const existing = editor.value.trim();
        editor.value = existing ? existing + '\n\n' + snippet.css : snippet.css;
        updateInfo(wrapper, editor.value);
        setStatus(statusEl, `Snippet "${snippet.name}" adăugat!`, '#6c63ff');
        editor.scrollTop = editor.scrollHeight;
      });
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function updateInfo(wrapper, css) {
    const info = wrapper.querySelector('#fme-fcss-info');
    if (!info) return;
    if (!css || !css.trim()) { info.textContent = 'Niciun CSS salvat.'; return; }
    const lines = css.split('\n').length;
    const kb    = (new Blob([css]).size / 1024).toFixed(1);
    info.textContent = `${lines} linii · ${kb} KB · aplicat automat pe forum`;
  }

  function setStatus(el, msg, color) {
    el.style.color  = color || '#10b981';
    el.textContent  = msg;
    setTimeout(() => { el.textContent = ''; }, 3000);
  }

  // ─── Auto-apply on forum pages (guard for forum-injector.js) ─────────────────
  // (Injector reads STORAGE_KEY directly; no autoApply needed in this tab)

  return { render };
})();
