/**
 * FME Widgets JS Tab
 * Manage named JavaScript snippets that run automatically on ACP and/or forum pages.
 *
 * Widget structure:
 *   { id, name, description, target, enabled, code, createdAt }
 *   target: 'acp' | 'forum' | 'both'
 *
 * ACP widgets are executed by content.js (via FMEWidgetsTab.runAcpWidgets).
 * Forum widgets are executed by forum-injector.js.
 */

var FMEWidgetsTab = (() => {
  'use strict';

  const STORAGE_KEY = 'fme_widgets';

  // Markers used to wrap published widget code in the Forumotion JS page
  const MARKER_START = id => `/* [FME-WIDGET:${id}] START */`;
  const MARKER_END   = id => `/* [FME-WIDGET:${id}] END */`;

  const TARGET_LABELS = {
    acp:   { text: 'ACP',         badge: 'fme-badge-version'   },
    forum: { text: 'Forum',       badge: 'fme-badge-installed' },
    both:  { text: 'ACP + Forum', badge: 'fme-badge-update'    },
  };

  let _container = null;
  let _widgets   = [];
  let _editIdx   = null;  // null = new widget; number = editing existing index

  // ─── Built-in Catalog ────────────────────────────────────────────────────────

  const BUILTIN_WIDGETS = [
    {
      id:          'fme-builtin-acp-clock',
      name:        'ACP Clock',
      description: 'Ceas live în bara de top a ACP',
      target:      'acp',
      code: `(function () {
  'use strict';
  const CLOCK_ID = 'fme-widget-clock';
  if (document.getElementById(CLOCK_ID)) return;
  const clock = document.createElement('span');
  clock.id = CLOCK_ID;
  clock.style.cssText = [
    'position:fixed', 'top:6px', 'right:12px', 'z-index:9999',
    'background:rgba(0,0,0,0.55)', 'color:#fff',
    'font-size:12px', 'font-family:monospace',
    'padding:3px 8px', 'border-radius:4px',
    'pointer-events:none', 'user-select:none',
  ].join(';');
  document.body.appendChild(clock);
  function tick() { clock.textContent = new Date().toLocaleTimeString('ro-RO'); }
  tick();
  setInterval(tick, 1000);
})();`,
    },
    {
      id:          'fme-builtin-acp-word-counter',
      name:        'ACP Word Counter',
      description: 'Afișează nr. caractere & cuvinte sub fiecare textarea din ACP',
      target:      'acp',
      code: `(function () {
  'use strict';
  function attachCounter(ta) {
    if (ta.dataset.fmeCounter) return;
    ta.dataset.fmeCounter = '1';
    const counter = document.createElement('div');
    counter.style.cssText = 'font-size:11px;color:#888;margin-top:3px;text-align:right;font-family:sans-serif;';
    function update() {
      const val = ta.value;
      const chars = val.length;
      const words = val.trim() === '' ? 0 : val.trim().split(/\\s+/).length;
      counter.textContent = chars + ' caractere · ' + words + ' cuvinte';
    }
    update();
    ta.addEventListener('input', update);
    ta.parentNode.insertBefore(counter, ta.nextSibling);
  }
  document.querySelectorAll('textarea').forEach(attachCounter);
  const obs = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'TEXTAREA') attachCounter(node);
        node.querySelectorAll && node.querySelectorAll('textarea').forEach(attachCounter);
      });
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();`,
    },
    {
      id:          'fme-builtin-acp-confirm-dangerous',
      name:        'ACP Confirm Dangerous Actions',
      description: 'Cere confirmare înainte de submit-urile cu acțiuni periculoase',
      target:      'acp',
      code: `(function () {
  'use strict';
  const DANGER_PATTERNS = [
    /\\bdelete\\b/i, /\\bpurge\\b/i, /\\bban\\b/i,
    /\\breset\\b/i, /\\btruncate\\b/i, /\\bsterge\\b/i,
    /\\bsupprime\\b/i, /\\belimina\\b/i,
  ];
  function isDangerous(text) { return DANGER_PATTERNS.some(p => p.test(text)); }
  function hookForm(form) {
    if (form.dataset.fmeHooked) return;
    form.dataset.fmeHooked = '1';
    form.addEventListener('submit', e => {
      const action = form.getAttribute('action') || '';
      const btnText = document.activeElement
        ? (document.activeElement.value || document.activeElement.textContent || '') : '';
      if (isDangerous(action) || isDangerous(btnText)) {
        const ok = confirm('\\u26a0\\ufe0f FME \\u2014 Ac\\u021biune periculoas\\u0103 detectat\\u0103!\\n\\nE\\u0219ti sigur c\\u0103 vrei s\\u0103 continui?\\n\\nAc\\u021biune: ' + (btnText.trim() || action));
        if (!ok) e.preventDefault();
      }
    }, true);
  }
  document.querySelectorAll('form').forEach(hookForm);
  const obs = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'FORM') hookForm(node);
        node.querySelectorAll && node.querySelectorAll('form').forEach(hookForm);
      });
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();`,
    },
    {
      id:          'fme-builtin-acp-quick-search',
      name:        'ACP Quick Filter',
      description: 'Câmp de filtrare rapidă deasupra tabelelor mari din ACP',
      target:      'acp',
      code: `(function () {
  'use strict';
  function attachSearch(table) {
    if (table.dataset.fmeSearch) return;
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    if (rows.length < 6) return;
    table.dataset.fmeSearch = '1';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:6px;';
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = '\\ud83d\\udd0d Filtrare rapid\\u0103...';
    input.style.cssText = 'width:260px;padding:4px 8px;font-size:12px;border:1px solid #ccc;border-radius:3px;';
    const counter = document.createElement('span');
    counter.style.cssText = 'margin-left:10px;font-size:11px;color:#888;font-family:sans-serif;';
    wrap.appendChild(input);
    wrap.appendChild(counter);
    table.parentNode.insertBefore(wrap, table);
    function filter() {
      const term = input.value.toLowerCase().trim();
      let visible = 0;
      rows.forEach(row => {
        const match = !term || row.textContent.toLowerCase().includes(term);
        row.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      counter.textContent = term ? (visible + ' / ' + rows.length + ' r\\u00e2nduri') : '';
    }
    input.addEventListener('input', filter);
  }
  function hookTables() { document.querySelectorAll('table').forEach(attachSearch); }
  hookTables();
  const obs = new MutationObserver(hookTables);
  obs.observe(document.body, { childList: true, subtree: true });
})();`,
    },
    {
      id:          'fme-builtin-acp-back-to-top',
      name:        'ACP Back to Top',
      description: 'Buton flotant de scroll la îinceputul paginii în ACP',
      target:      'acp',
      code: `(function () {
  'use strict';
  const BTN_ID = 'fme-widget-back-to-top';
  if (document.getElementById(BTN_ID)) return;
  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.textContent = '\\u2191';
  btn.title = 'Sus';
  btn.style.cssText = [
    'position:fixed', 'bottom:20px', 'right:20px', 'z-index:9998',
    'width:36px', 'height:36px',
    'border-radius:50%', 'border:none',
    'background:#555', 'color:#fff',
    'font-size:18px', 'line-height:1', 'cursor:pointer',
    'opacity:0', 'transition:opacity 0.25s',
    'box-shadow:0 2px 6px rgba(0,0,0,0.3)',
  ].join(';');
  document.body.appendChild(btn);
  window.addEventListener('scroll', () => {
    btn.style.opacity = window.scrollY > 300 ? '0.85' : '0';
  }, { passive: true });
  btn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
})();`,
    },
    {
      id:          'fme-builtin-forum-welcome-banner',
      name:        'Forum Welcome Banner',
      description: 'Banner de bun venit pentru vizitatori neînregistrați',
      target:      'forum',
      code: `(function _fmeWidget() {
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', _fmeWidget); return; }
  const STORAGE_KEY = 'fme_welcome_banner_dismissed';
  const BANNER_TEXT = 'Bun venit pe forum! \\ud83d\\udc4b \\u00cenregistreaz\\u0103-te pentru a participa la discu\\u021bii.';
  const BUTTON_TEXT = '\\u00cenregistreaz\\u0103-te';
  const BUTTON_URL  = '/register';
  const BG_COLOR    = '#3b82f6';
  const TEXT_COLOR  = '#ffffff';
  if (localStorage.getItem(STORAGE_KEY)) return;
  if (document.querySelector('a[href*="logout"], a[href*="deconnexion"]')) return;
  const banner = document.createElement('div');
  banner.id = 'fme-welcome-banner';
  banner.style.cssText = [
    'background:' + BG_COLOR, 'color:' + TEXT_COLOR,
    'padding:10px 16px',
    'display:flex', 'align-items:center', 'gap:12px', 'flex-wrap:wrap',
    'font-family:sans-serif', 'font-size:13px',
    'position:relative', 'z-index:9990',
    'box-shadow:0 2px 6px rgba(0,0,0,0.15)',
  ].join(';');
  banner.innerHTML =
    '<span style="flex:1;min-width:200px;">' + BANNER_TEXT + '</span>' +
    '<a href="' + BUTTON_URL + '" style="background:#fff;color:' + BG_COLOR + ';padding:5px 14px;border-radius:4px;font-weight:600;text-decoration:none;font-size:12px;white-space:nowrap;">' + BUTTON_TEXT + '</a>' +
    '<button id="fme-welcome-close" style="background:transparent;border:none;color:rgba(255,255,255,0.8);font-size:18px;line-height:1;cursor:pointer;padding:0 4px;" title="\\u00cenchide">&times;</button>';
  document.body.prepend(banner);
  banner.querySelector('#fme-welcome-close').addEventListener('click', () => {
    banner.remove();
    localStorage.setItem(STORAGE_KEY, '1');
  });
})();`,
    },
    {
      id:          'fme-builtin-forum-back-to-top',
      name:        'Forum Back to Top',
      description: 'Buton flotant animat de scroll la îinceputul paginii pe forum',
      target:      'forum',
      code: `(function _fmeWidget() {
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', _fmeWidget); return; }
  const BTN_ID = 'fme-forum-back-to-top';
  if (document.getElementById(BTN_ID)) return;
  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.textContent = '\\u2191';
  btn.title = '\\u00cenapoi sus';
  btn.style.cssText = [
    'position:fixed', 'bottom:24px', 'right:24px', 'z-index:9990',
    'width:40px', 'height:40px',
    'border-radius:50%', 'border:none',
    'background:#3b82f6', 'color:#fff',
    'font-size:20px', 'line-height:1', 'cursor:pointer',
    'opacity:0', 'transition:opacity 0.3s, transform 0.3s',
    'box-shadow:0 3px 8px rgba(0,0,0,0.25)',
    'transform:translateY(10px)',
  ].join(';');
  document.body.appendChild(btn);
  window.addEventListener('scroll', () => {
    const show = window.scrollY > 400;
    btn.style.opacity   = show ? '1' : '0';
    btn.style.transform = show ? 'translateY(0)' : 'translateY(10px)';
  }, { passive: true });
  btn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
})();`,
    },
    {
      id:          'fme-builtin-forum-external-links',
      name:        'Forum External Links',
      description: 'Deschide linkurile externe în tab nou și adaugă rel=noopener',
      target:      'forum',
      code: `(function _fmeWidget() {
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', _fmeWidget); return; }
  const host = window.location.hostname;
  function processLinks(root) {
    root.querySelectorAll('a[href]').forEach(a => {
      if (a.dataset.fmeExternal) return;
      a.dataset.fmeExternal = '1';
      try {
        const url = new URL(a.href, window.location.href);
        if (url.hostname && url.hostname !== host && url.protocol.startsWith('http')) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        }
      } catch (_) {}
    });
  }
  processLinks(document.body);
  const obs = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => { if (node.nodeType === 1) processLinks(node); });
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();`,
    },
    {
      id:          'fme-builtin-forum-announce-ticker',
      name:        'Forum Announce Ticker',
      description: 'Ticker cu mesaje de anunț defilante pe pagina principală',
      target:      'forum',
      code: `(function _fmeWidget() {
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', _fmeWidget); return; }
  const MESSAGES = [
    '\\ud83d\\udce2 Bun venit pe forum! Citi\\u021bi regulamentul \\u00eenainte de a posta.',
    '\\ud83c\\udf89 Eveniment nou: Concurs de var\\u0103 \\u2014 participa\\u021bi p\\u00e2n\\u0103 pe 30 iulie!',
    '\\ud83d\\udd14 Serverele vor fi \\u00een mentenan\\u021b\\u0103 duminic\\u0103, 02:00\\u201304:00.',
  ];
  const SPEED_PX_PER_SEC = 60;
  const BG_COLOR   = '#1e293b';
  const TEXT_COLOR = '#f1f5f9';
  const TICKER_ID = 'fme-ticker';
  if (document.getElementById(TICKER_ID)) return;
  const joined = MESSAGES.join('   \\u2022   ');
  const ticker = document.createElement('div');
  ticker.id = TICKER_ID;
  ticker.style.cssText = [
    'background:' + BG_COLOR, 'color:' + TEXT_COLOR,
    'overflow:hidden', 'white-space:nowrap',
    'padding:6px 0', 'font-size:12px', 'font-family:sans-serif',
    'position:relative', 'z-index:9989',
  ].join(';');
  const inner = document.createElement('span');
  inner.textContent = joined;
  inner.style.cssText = 'display:inline-block;padding-left:100%;will-change:transform;';
  ticker.appendChild(inner);
  document.body.prepend(ticker);
  function startAnimation() {
    const totalWidth = inner.scrollWidth + ticker.clientWidth;
    const duration = totalWidth / SPEED_PX_PER_SEC;
    if (!document.getElementById('fme-ticker-style')) {
      const style = document.createElement('style');
      style.id = 'fme-ticker-style';
      style.textContent = '@keyframes fme-ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-' + totalWidth + 'px); } }';
      document.head.appendChild(style);
    }
    inner.style.animation = 'fme-ticker-scroll ' + duration + 's linear infinite';
  }
  if (document.readyState === 'complete') { startAnimation(); }
  else { window.addEventListener('load', startAnimation, { once: true }); }
})();`,
    },
    {
      id:          'fme-builtin-forum-post-word-count',
      name:        'Forum Post Word Count',
      description: 'Contor de caractere/cuvinte sub editorul de postare',
      target:      'forum',
      code: `(function _fmeWidget() {
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', _fmeWidget); return; }
  const MAX_CHARS = 5000;
  function attachCounter(ta) {
    if (ta.dataset.fmePostCounter) return;
    ta.dataset.fmePostCounter = '1';
    const counter = document.createElement('div');
    counter.style.cssText = 'font-size:11px;margin-top:4px;padding:2px 4px;border-radius:3px;font-family:sans-serif;text-align:right;';
    function update() {
      const val = ta.value;
      const chars = val.length;
      const words = val.trim() === '' ? 0 : val.trim().split(/\\s+/).length;
      const overLimit = MAX_CHARS > 0 && chars > MAX_CHARS;
      counter.style.color      = overLimit ? '#e74c3c' : '#888';
      counter.style.background = overLimit ? '#fef2f2' : 'transparent';
      counter.textContent = MAX_CHARS > 0
        ? (chars + ' / ' + MAX_CHARS + ' caractere \\u00b7 ' + words + ' cuvinte')
        : (chars + ' caractere \\u00b7 ' + words + ' cuvinte');
    }
    update();
    ta.addEventListener('input', update);
    ta.parentNode.insertBefore(counter, ta.nextSibling);
  }
  function hookEditors(root) {
    root.querySelectorAll('textarea').forEach(ta => {
      const rows = parseInt(ta.getAttribute('rows') || '0', 10);
      if (rows > 3 || ta.offsetHeight > 80) attachCounter(ta);
    });
  }
  hookEditors(document);
  const obs = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => { if (node.nodeType === 1) hookEditors(node); });
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();`,
    },
    {
      id:          'fme-builtin-forum-reading-progress',
      name:        'Forum Reading Progress',
      description: 'Bară de progres de citire fixată în topul paginii',
      target:      'forum',
      code: `(function _fmeWidget() {
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', _fmeWidget); return; }
  const BAR_HEIGHT = '3px';
  const BAR_COLOR  = '#3b82f6';
  const BAR_ID = 'fme-reading-progress';
  if (document.getElementById(BAR_ID)) return;
  const bar = document.createElement('div');
  bar.id = BAR_ID;
  bar.style.cssText = [
    'position:fixed', 'top:0', 'left:0',
    'height:' + BAR_HEIGHT,
    'background:' + BAR_COLOR,
    'width:0%', 'z-index:9991',
    'transition:width 0.1s linear',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(bar);
  function update() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const percent = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
    bar.style.width = percent + '%';
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
})();`,
    },
    {
      id:          'fme-builtin-forum-dark-mode',
      name:        'Forum Dark Mode Toggle',
      description: 'Buton flotant pentru comutare Dark/Light mode pe forum',
      target:      'forum',
      code: `(function _fmeWidget() {
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', _fmeWidget); return; }
  const STORAGE_KEY = 'fme_dark_mode';
  const STYLE_ID    = 'fme-dark-mode-style';
  const BTN_ID      = 'fme-dark-toggle-btn';
  const DARK_CSS = [
    'body, .forum, #viewforum, #viewtopic { background: #0f172a !important; color: #e2e8f0 !important; }',
    '.table1, .table2, .forumbg, .forumbg2 { background: #1e293b !important; border-color: #334155 !important; }',
    'td, th, .row1, .row2, .row3, .rowbg, .headbg { background: #1e293b !important; color: #e2e8f0 !important; border-color: #334155 !important; }',
    'a { color: #60a5fa !important; } a:hover { color: #93c5fd !important; }',
    'input, textarea, select { background: #334155 !important; color: #e2e8f0 !important; border-color: #475569 !important; }',
    '.maintitle, .titlebg { background: #1e40af !important; }',
  ].join(' ');
  function applyDark(on) {
    let el = document.getElementById(STYLE_ID);
    if (on) {
      if (!el) { el = document.createElement('style'); el.id = STYLE_ID; document.head.appendChild(el); }
      el.textContent = DARK_CSS;
    } else { el && el.remove(); }
    const btn = document.getElementById(BTN_ID);
    if (btn) btn.textContent = on ? '\\u2600\\ufe0f' : '\\ud83c\\udf19';
  }
  let dark = localStorage.getItem(STORAGE_KEY) === '1';
  applyDark(dark);
  if (document.getElementById(BTN_ID)) return;
  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.textContent = dark ? '\\u2600\\ufe0f' : '\\ud83c\\udf19';
  btn.title = 'Comutare Dark/Light mode';
  btn.style.cssText = [
    'position:fixed', 'bottom:24px', 'left:24px', 'z-index:9990',
    'width:38px', 'height:38px', 'border-radius:50%', 'border:none',
    'background:#1e293b', 'font-size:18px', 'cursor:pointer',
    'box-shadow:0 2px 6px rgba(0,0,0,0.3)',
    'transition:transform 0.2s',
    'display:flex', 'align-items:center', 'justify-content:center',
  ].join(';');
  btn.addEventListener('click', () => {
    dark = !dark;
    localStorage.setItem(STORAGE_KEY, dark ? '1' : '0');
    applyDark(dark);
  });
  document.body.appendChild(btn);
})();`,
    },
    {
      id:          'fme-builtin-toast-notifications',
      name:        'FME Toast Notifications',
      description: 'API global window.FMEToast.show() pentru notificări toast',
      target:      'both',
      code: `(function _fmeWidget() {
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', _fmeWidget); return; }
  if (window.FMEToast) return;
  const COLORS = {
    success: { bg: '#16a34a', icon: '\\u2713' },
    error:   { bg: '#dc2626', icon: '\\u2715' },
    warning: { bg: '#d97706', icon: '\\u26a0' },
    info:    { bg: '#2563eb', icon: '\\u2139' },
  };
  const container = document.createElement('div');
  container.id = 'fme-toast-container';
  container.style.cssText = [
    'position:fixed', 'top:16px', 'right:16px', 'z-index:2147483640',
    'display:flex', 'flex-direction:column', 'gap:8px', 'pointer-events:none',
  ].join(';');
  document.body.appendChild(container);
  function show(message, type, durationMs) {
    type = type || 'info';
    durationMs = durationMs === undefined ? 3500 : durationMs;
    const c = COLORS[type] || COLORS.info;
    const toast = document.createElement('div');
    toast.style.cssText = [
      'background:' + c.bg, 'color:#fff',
      'padding:10px 14px', 'border-radius:6px',
      'display:flex', 'align-items:center', 'gap:10px',
      'font-family:sans-serif', 'font-size:13px',
      'box-shadow:0 3px 10px rgba(0,0,0,0.25)',
      'max-width:320px', 'min-width:180px', 'pointer-events:auto',
      'opacity:0', 'transform:translateX(20px)',
      'transition:opacity 0.25s, transform 0.25s',
    ].join(';');
    toast.innerHTML =
      '<span style="font-size:16px;flex-shrink:0;">' + c.icon + '</span>' +
      '<span style="flex:1;line-height:1.4;">' + message + '</span>' +
      '<button style="background:transparent;border:none;color:rgba(255,255,255,0.7);font-size:16px;cursor:pointer;padding:0;line-height:1;flex-shrink:0;" title="\\u00cenchide">&times;</button>';
    container.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(0)'; });
    function dismiss() {
      toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)';
      setTimeout(function() { toast.remove(); }, 300);
    }
    toast.querySelector('button').addEventListener('click', dismiss);
    if (durationMs > 0) setTimeout(dismiss, durationMs);
  }
  window.FMEToast = { show: show };
})();`,
    },
    {
      id:          'fme-builtin-keyboard-shortcuts',
      name:        'Keyboard Shortcuts',
      description: 'Scurtături tastatură globale cu help overlay (? = help)',
      target:      'both',
      code: `(function _fmeWidget() {
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', _fmeWidget); return; }
  if (window.__fmeShortcuts) return;
  window.__fmeShortcuts = true;
  const SHORTCUTS = [
    { key: '?', alt: false, shift: true,  label: '? (Shift+/)', desc: 'Afi\\u0219eaz\\u0103/ascunde aceast\\u0103 fereastr\\u0103', action: function() { toggleHelp(); } },
    { key: 'h', alt: true,  shift: false, label: 'Alt + H',     desc: 'Pagina principal\\u0103',                                  action: function() { window.location.href = '/'; } },
    { key: 't', alt: true,  shift: false, label: 'Alt + T',     desc: 'Scroll la \\u00eenceput (top)',                            action: function() { window.scrollTo({ top: 0, behavior: 'smooth' }); } },
    { key: 'b', alt: true,  shift: false, label: 'Alt + B',     desc: 'Scroll la sf\\u00e2r\\u0219it (bottom)',                   action: function() { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); } },
  ];
  const OVERLAY_ID = 'fme-shortcuts-overlay';
  function buildOverlay() {
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483639;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#1e293b;color:#e2e8f0;border-radius:8px;padding:24px;min-width:300px;max-width:440px;width:90%;font-family:sans-serif;font-size:13px;box-shadow:0 8px 32px rgba(0,0,0,0.4);';
    const rows = SHORTCUTS.map(function(s) {
      return '<tr><td style="padding:5px 12px 5px 0;"><kbd style="background:#334155;border:1px solid #475569;border-radius:4px;padding:2px 7px;font-family:monospace;font-size:12px;color:#f8fafc;">' + s.label + '</kbd></td><td style="padding:5px 0;color:#94a3b8;">' + s.desc + '</td></tr>';
    }).join('');
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;"><strong style="font-size:14px;">\\u2328\\ufe0f Scurt\\u0103turi tastatur\\u0103</strong><button id="fme-shortcuts-close" style="background:transparent;border:none;color:#94a3b8;font-size:20px;cursor:pointer;line-height:1;">&times;</button></div>' +
      '<table style="border-collapse:collapse;width:100%;">' + rows + '</table>' +
      '<p style="margin-top:14px;font-size:11px;color:#475569;text-align:right;">FME Widgets</p>';
    overlay.appendChild(box);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) toggleHelp(); });
    box.querySelector('#fme-shortcuts-close').addEventListener('click', toggleHelp);
    return overlay;
  }
  function toggleHelp() {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) { existing.remove(); return; }
    document.body.appendChild(buildOverlay());
  }
  document.addEventListener('keydown', function(e) {
    const tag = document.activeElement && document.activeElement.tagName && document.activeElement.tagName.toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (document.activeElement && document.activeElement.isContentEditable) return;
    for (var i = 0; i < SHORTCUTS.length; i++) {
      const s = SHORTCUTS[i];
      if (e.key.toLowerCase() === s.key.toLowerCase() && !!e.altKey === s.alt && !!e.shiftKey === s.shift) {
        e.preventDefault(); s.action(); return;
      }
    }
  });
})();`,
    },
  ];

  // ─── Public API ──────────────────────────────────────────────────────────────

  async function render(container) {
    _container = container;
    container.innerHTML = '';
    _editIdx = null;

    const wrapper = document.createElement('div');
    wrapper.className = 'fme-widgets-wrapper main-content';
    wrapper.id = 'main-content';
    wrapper.style.fontSize = '12px';

    wrapper.innerHTML = `
      <div class="fme-section-header">
        <h2 class="fme-section-title">FME</h2>
        <ul class="h2-breadcrumb clearfix"><li class="first">Widgets JS</li></ul>
        <blockquote class="block_left">
          <p class="explain">Script-uri JavaScript personalizate rulând automat pe paginile ACP și/sau forum. Fiecare widget poate fi activat/dezactivat individual.</p>
        </blockquote>
      </div>
      <div id="fme-widgets-area"></div>
    `;

    container.appendChild(wrapper);
    await loadWidgets();
    renderAll(wrapper);
  }

  /**
   * Called from content.js on every ACP page load.
   * Runs all enabled widgets targeting 'acp' or 'both'.
   */
  /**
   * Sends widget code to the service worker for execution via chrome.scripting,
   * which bypasses both the extension's MV3 CSP and the page's own CSP.
   */
  function execWidget(code, name) {
    chrome.runtime.sendMessage({ type: 'EXEC_WIDGET', payload: { code, name } });
  }

  function runAcpWidgets() {
    chrome.storage.local.get({ [STORAGE_KEY]: [] }, result => {
      const widgets = result[STORAGE_KEY] || [];
      widgets
        .filter(w => w.enabled && (w.target === 'acp' || w.target === 'both'))
        .forEach(w => execWidget(w.code, w.name));
    });
  }

  // ─── Load ─────────────────────────────────────────────────────────────────────

  async function loadWidgets() {
    return new Promise(resolve => {
      chrome.storage.local.get({ [STORAGE_KEY]: [] }, result => {
        _widgets = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
        resolve();
      });
    });
  }

  // ─── Full render (catalog + custom + support) ─────────────────────────────────

  function renderAll(wrapper) {
    const area = wrapper.querySelector('#fme-widgets-area');
    if (!area) return;

    area.innerHTML = '';

    // 1. Catalog section
    area.appendChild(buildCatalogSection(wrapper));

    // 2. Custom widgets section
    const customSection = document.createElement('div');
    customSection.id = 'fme-custom-section';
    customSection.style.marginTop = '10px';
    area.appendChild(customSection);
    renderList(wrapper);

    // 3. Editor area
    const editorArea = document.createElement('div');
    editorArea.id = 'fme-widget-editor-area';
    editorArea.style.marginTop = '10px';
    area.appendChild(editorArea);

    // 4. Support section
    area.appendChild(buildSupportSection());
  }

  // ─── Catalog ──────────────────────────────────────────────────────────────────

  function buildCatalogSection(wrapper) {
    const section = document.createElement('div');
    section.id = 'fme-catalog-section';

    const rowsHtml = BUILTIN_WIDGETS.map(bw => {
      const tm = TARGET_LABELS[bw.target] || TARGET_LABELS.acp;
      const installed = !!_widgets.find(w => w.id === bw.id);
      return `
        <tr data-builtin-id="${escHtml(bw.id)}">
          <td><strong>${escHtml(bw.name)}</strong></td>
          <td style="color:#666;">${escHtml(bw.description)}</td>
          <td><span class="fme-badge ${tm.badge}">${tm.text}</span></td>
          <td style="width:150px;white-space:nowrap;">
            ${installed
              ? `<span class="fme-badge fme-badge-installed" style="margin-right:6px;">&#10003; Instalat</span>
                 <input type="button" class="fme-builtin-remove" data-id="${escHtml(bw.id)}" value="Dezinstalează" />`
              : `<input type="button" class="fme-builtin-install" data-id="${escHtml(bw.id)}" value="Instalează" />`
            }
          </td>
        </tr>
      `;
    }).join('');

    section.innerHTML = `
      <div class="panel-menu">
        <br/>
        <fieldset style="margin:0 12px 12px 12px;border-color:#4a7ebf;">
          <legend style="color:#4a7ebf;font-weight:600;">&#128230; Catalog widget-uri</legend>
          <p style="margin:4px 0 8px 0;color:#666;font-size:11px;">Widget-uri predefinite gata de instalare. Instalarea adaugă widget-ul în lista ta unde îl poți activa/dezactiva sau edita.</p>
          <table class="fme-table">
            <thead>
              <tr>
                <th>Nume</th>
                <th>Descriere</th>
                <th>Target</th>
                <th style="width:150px;">Acțiune</th>
              </tr>
            </thead>
            <tbody id="fme-catalog-tbody">
              ${rowsHtml}
            </tbody>
          </table>
        </fieldset>
      </div>
    `;

    section.querySelectorAll('.fme-builtin-install').forEach(btn => {
      btn.addEventListener('click', () => {
        const bw = BUILTIN_WIDGETS.find(b => b.id === btn.dataset.id);
        if (bw) installBuiltin(bw, wrapper);
      });
    });

    section.querySelectorAll('.fme-builtin-remove').forEach(btn => {
      btn.addEventListener('click', () => removeBuiltin(btn.dataset.id, wrapper));
    });

    return section;
  }

  async function installBuiltin(bw, wrapper) {
    if (_widgets.find(w => w.id === bw.id)) return;
    const widget = {
      id:          bw.id,
      name:        bw.name,
      description: bw.description,
      target:      bw.target,
      enabled:     true,
      code:        bw.code,
      published:   false,
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
    };
    _widgets.push(widget);
    if (typeof FMEActivityLog !== 'undefined') FMEActivityLog.log('widget-create', 'Widget builtin instalat: ' + bw.name);

    // Auto-publish forum/both widgets to the Forumotion JS page
    if (bw.target === 'forum' || bw.target === 'both') {
      const tid = typeof FMEForumAPI !== 'undefined' && FMEForumAPI.getTid();
      const jsTitle = 'FME: ' + bw.name;
      if (tid) {
        try {
          const saved = await FMEForumAPI.saveJsPlugin(tid, widget.code, 'all', true, jsTitle);
          if (saved) {
            widget.published = true;
            if (typeof FMEActivityLog !== 'undefined') FMEActivityLog.log('widget-publish', 'Auto-publicat pe forum: ' + bw.name);
          }
        } catch (e) {
          console.warn('[FME Widgets] Auto-publish failed:', e);
        }
      }
    }

    saveWidgets(() => renderAll(wrapper));
  }

  async function removeBuiltin(id, wrapper) {
    const bw = BUILTIN_WIDGETS.find(b => b.id === id);
    const name = bw ? bw.name : id;
    if (!confirm(`Dezinstalezi widget-ul "${name}"?\nAcesta va fi eliminat din lista ta de widget-uri.`)) return;

    // Auto-unpublish from Forumotion JS page if published — disable the entry
    const existing = _widgets.find(w => w.id === id);
    if (existing && existing.published) {
      const tid = typeof FMEForumAPI !== 'undefined' && FMEForumAPI.getTid();
      if (tid) {
        try {
          const jsTitle = 'FME: ' + name;
          await FMEForumAPI.saveJsPlugin(tid, existing.code, 'all', false, jsTitle);
          if (typeof FMEActivityLog !== 'undefined') FMEActivityLog.log('widget-publish', 'Dezactivat pe forum: ' + name);
        } catch (e) {
          console.warn('[FME Widgets] Auto-unpublish failed:', e);
        }
      }
    }

    _widgets = _widgets.filter(w => w.id !== id);
    if (typeof FMEActivityLog !== 'undefined') FMEActivityLog.log('widget-delete', 'Widget builtin dezinstalat: ' + name);
    saveWidgets(() => renderAll(wrapper));
  }

  // ─── List view (custom widgets) ───────────────────────────────────────────────

  function renderList(wrapper) {
    const area = wrapper.querySelector('#fme-custom-section');
    if (!area) return;

    const activeCount = _widgets.filter(w => w.enabled).length;

    const rowsHtml = _widgets.length
      ? `<table class="fme-table">
          <thead>
            <tr>
              <th style="width:24px;">On</th>
              <th>Nume</th>
              <th>Descriere</th>
              <th>Target</th>
              <th style="width:180px;">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            ${_widgets.map((w, i) => {
              const tm = TARGET_LABELS[w.target] || TARGET_LABELS.acp;
              const isBuiltin = w.id && w.id.startsWith('fme-builtin-');
              return `
                <tr data-widget-idx="${i}">
                  <td style="text-align:center;">
                    <input type="checkbox" class="fme-widget-toggle" data-idx="${i}" ${w.enabled ? 'checked' : ''} />
                  </td>
                  <td>
                    <strong>${escHtml(w.name)}</strong>
                    ${isBuiltin ? '<span class="fme-badge fme-badge-version" style="margin-left:4px;font-size:10px;">built-in</span>' : ''}
                  </td>
                  <td style="color:#666;">${escHtml(w.description || '—')}</td>
                  <td><span class="fme-badge ${tm.badge}">${tm.text}</span>${w.published ? ' <span class="fme-badge fme-badge-installed" style="font-size:10px;">🌐 publicat</span>' : ''}</td>
                  <td>
                    <input type="button" class="fme-widget-edit"   data-idx="${i}" value="Editează" />
                    <input type="button" class="fme-widget-delete" data-idx="${i}" value="Șterge" style="margin-left:4px;" />
                    ${(w.target === 'forum' || w.target === 'both')
                      ? `<input type="button" class="fme-widget-publish" data-idx="${i}" value="${w.published ? '↩ Retrage' : '🌐 Publică'}" style="margin-left:4px;" title="${w.published ? 'Retrage din pagina JS a forumului' : 'Publică în pagina JS a forumului (vizibil pentru toți)'}" />`
                      : ''
                    }
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>`
      : `<div class="fme-empty" style="padding:20px;text-align:center;color:#999;">Nu există widget-uri. Instalează din catalog sau apasă „Adaugă widget" pentru a crea unul personalizat.</div>`;

    area.innerHTML = `
      <div class="panel-menu">
        <br/>
        <fieldset style="margin:0 12px 12px 12px;">
          <legend>Widget-urile mele (${activeCount} active / ${_widgets.length} total)</legend>
          ${rowsHtml}
          <div class="div_btns" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
            <input type="button" id="fme-widget-add" value="+ Adaugă widget personalizat" class="icon_ok" />
          </div>
        </fieldset>
      </div>
    `;

    // Toggle enable/disable
    area.querySelectorAll('.fme-widget-toggle').forEach(cb => {
      cb.addEventListener('change', () => {
        const idx = +cb.dataset.idx;
        _widgets[idx].enabled = cb.checked;
        if (typeof FMEActivityLog !== 'undefined') FMEActivityLog.log('widget-toggle', (cb.checked ? 'Activat' : 'Dezactivat') + ' widget: ' + _widgets[idx].name);
        saveWidgets(() => renderList(wrapper));
      });
    });

    area.querySelectorAll('.fme-widget-edit').forEach(btn => {
      btn.addEventListener('click', () => openEditor(wrapper, +btn.dataset.idx));
    });

    area.querySelectorAll('.fme-widget-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteWidget(wrapper, +btn.dataset.idx));
    });

    area.querySelectorAll('.fme-widget-publish').forEach(btn => {
      btn.addEventListener('click', () => togglePublish(wrapper, +btn.dataset.idx));
    });

    area.querySelector('#fme-widget-add').addEventListener('click', () => openEditor(wrapper, null));
  }

  // ─── Support section ──────────────────────────────────────────────────────────

  function buildSupportSection() {
    const section = document.createElement('div');
    section.style.marginTop = '10px';
    section.innerHTML = `
      <div class="panel-menu">
        <br/>
        <fieldset class="fme-support-box">
          <legend>&#128155; Susține proiectul FME</legend>
          <p class="fme-support-copy">
            FME (Forumotion Manager Extension) este un proiect open-source gratuit.<br/>
            Dacă îți este util, poți susține dezvoltarea continuă printr-o donație simbolică. Mulțumim!
          </p>
          <div class="fme-support-links" style="margin:10px auto 10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;align-items:stretch;">
            <a href="https://ko-fi.com/fmestaark" target="_blank" rel="noopener noreferrer" class="fme-support-link fme-support-link--kofi"
               style="display:grid;grid-template-columns:22px minmax(0,1fr);align-items:center;gap:10px;min-height:60px;padding:10px 12px;background:color-mix(in srgb, #ff5e5b 16%, var(--fme-card, var(--fme-ui-card, #1a1f2e)));color:color-mix(in srgb, #ffb3b1 75%, var(--fme-text, var(--fme-ui-text, #e2e8f0)));border:1px solid color-mix(in srgb, #ff5e5b 45%, var(--fme-border, var(--fme-ui-border, #2d3748)));border-radius:10px;text-decoration:none;font-size:11px;font-weight:700;line-height:1.15;">
              <span class="fme-support-link-icon" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;font-size:15px;line-height:1;">&#9749;</span>
              <span class="fme-support-link-text" style="display:flex;flex-direction:column;gap:2px;min-width:0;">
                <span class="fme-support-link-title" style="font-size:11px;font-weight:700;color:inherit;">Ko-fi</span>
                <span class="fme-support-link-subtitle" style="font-size:10px;font-weight:500;color:var(--fme-muted, var(--fme-ui-muted, #94a3b8));">Donație rapidă</span>
              </span>
            </a>
            <a href="https://github.com/sponsors" target="_blank" rel="noopener noreferrer" class="fme-support-link fme-support-link--sponsor"
               style="display:grid;grid-template-columns:22px minmax(0,1fr);align-items:center;gap:10px;min-height:60px;padding:10px 12px;background:color-mix(in srgb, #db2777 14%, var(--fme-card, var(--fme-ui-card, #1a1f2e)));color:color-mix(in srgb, #ff8fc6 78%, var(--fme-text, var(--fme-ui-text, #e2e8f0)));border:1px solid color-mix(in srgb, #db2777 42%, var(--fme-border, var(--fme-ui-border, #2d3748)));border-radius:10px;text-decoration:none;font-size:11px;font-weight:700;line-height:1.15;">
              <span class="fme-support-link-icon" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;font-size:15px;line-height:1;">&#10084;&#65039;</span>
              <span class="fme-support-link-text" style="display:flex;flex-direction:column;gap:2px;min-width:0;">
                <span class="fme-support-link-title" style="font-size:11px;font-weight:700;color:inherit;">GitHub Sponsors</span>
                <span class="fme-support-link-subtitle" style="font-size:10px;font-weight:500;color:var(--fme-muted, var(--fme-ui-muted, #94a3b8));">Susținere lunară</span>
              </span>
            </a>
            <a href="https://github.com/ForumotionExt/forumotion-extension" target="_blank" rel="noopener noreferrer" class="fme-support-link fme-support-link--github"
               style="display:grid;grid-template-columns:22px minmax(0,1fr);align-items:center;gap:10px;min-height:60px;padding:10px 12px;background:color-mix(in srgb, #4a7ebf 14%, var(--fme-card, var(--fme-ui-card, #1a1f2e)));color:color-mix(in srgb, #8bb6ee 80%, var(--fme-text, var(--fme-ui-text, #e2e8f0)));border:1px solid color-mix(in srgb, #4a7ebf 42%, var(--fme-border, var(--fme-ui-border, #2d3748)));border-radius:10px;text-decoration:none;font-size:11px;font-weight:700;line-height:1.15;">
              <span class="fme-support-link-icon" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;font-size:15px;line-height:1;">&#11088;</span>
              <span class="fme-support-link-text" style="display:flex;flex-direction:column;gap:2px;min-width:0;">
                <span class="fme-support-link-title" style="font-size:11px;font-weight:700;color:inherit;">GitHub</span>
                <span class="fme-support-link-subtitle" style="font-size:10px;font-weight:500;color:var(--fme-muted, var(--fme-ui-muted, #94a3b8));">Sprijin gratuit</span>
              </span>
            </a>
          </div>
          <p class="fme-support-note">
            Ai o sugestie sau ai găsit un bug? <a href="https://github.com/ForumotionExt/forumotion-extension/issues" target="_blank" rel="noopener noreferrer">Deschide un issue pe GitHub</a>.
          </p>
        </fieldset>
      </div>
    `;
    return section;
  }

  // ─── Editor ───────────────────────────────────────────────────────────────────

  function openEditor(wrapper, idx) {
    _editIdx = idx;
    const isNew = idx === null;
    const w = isNew
      ? { name: '', description: '', target: 'acp', enabled: true, code: '// Codul tău JS aici\n' }
      : { ..._widgets[idx] };

    const editorArea = wrapper.querySelector('#fme-widget-editor-area');
    if (!editorArea) return;

    editorArea.innerHTML = `
      <fieldset style="background:#f9f9ff;border-color:#9b8fcc;">
        <legend>${isNew ? 'Widget nou' : `Editează: ${escHtml(w.name)}`}</legend>
        <dl>
          <dt><label for="fme-widget-name">Nume *:</label></dt>
          <dd><input type="text" id="fme-widget-name" value="${escHtml(w.name)}" style="width:60%;" maxlength="80" placeholder="Ex: Auto-expand textarea" /></dd>
        </dl>
        <dl>
          <dt><label for="fme-widget-desc">Descriere:</label></dt>
          <dd><input type="text" id="fme-widget-desc" value="${escHtml(w.description || '')}" style="width:80%;" maxlength="200" placeholder="Scurtă descriere opțională" /></dd>
        </dl>
        <dl>
          <dt><label for="fme-widget-target">Se execută pe:</label></dt>
          <dd>
            <select id="fme-widget-target">
              <option value="acp"   ${w.target === 'acp'   ? 'selected' : ''}>ACP (Panou de administrare)</option>
              <option value="forum" ${w.target === 'forum' ? 'selected' : ''}>Forum (pagini publice)</option>
              <option value="both"  ${w.target === 'both'  ? 'selected' : ''}>ACP + Forum (ambele)</option>
            </select>
          </dd>
        </dl>
        <dl>
          <dt><label for="fme-widget-enabled">Activat:</label></dt>
          <dd><input type="checkbox" id="fme-widget-enabled" ${w.enabled ? 'checked' : ''} /></dd>
        </dl>
        <dl>
          <dt><label for="fme-widget-code">Cod JavaScript *:</label></dt>
          <dd>
            <textarea id="fme-widget-code"
              style="width:100%;height:260px;font-family:Consolas,'Cascadia Code',monospace;font-size:12px;line-height:1.6;padding:10px;border:1px solid #9b8fcc;border-radius:4px;resize:vertical;background:#0f1117;color:#e2e8f0;tab-size:2;"
              placeholder="// Codul rulează la fiecare încărcare de pagină (în contextul content script)&#10;// document, window, și fetch sunt disponibile&#10;document.title = '★ ' + document.title;"
            >${escHtml(w.code)}</textarea>
            <small style="color:#888;">Rulează la fiecare încărcare a paginii vizate. Poți folosi <code>document</code>, <code>window</code>, <code>fetch</code>.</small>
          </dd>
        </dl>
        <div class="div_btns" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <input type="button" id="fme-widget-save"   value="Salvează widget" class="icon_ok" />
          <input type="button" id="fme-widget-cancel" value="Anulează"        class="icon_cancel" style="margin-left:4px;" />
          <span id="fme-widget-editor-status" style="font-size:11px;font-weight:600;"></span>
        </div>
      </fieldset>
    `;

    // Tab key in code editor
    const codeArea = editorArea.querySelector('#fme-widget-code');
    codeArea.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = codeArea.selectionStart, en = codeArea.selectionEnd;
        codeArea.value = codeArea.value.substring(0, s) + '  ' + codeArea.value.substring(en);
        codeArea.selectionStart = codeArea.selectionEnd = s + 2;
      }
    });

    editorArea.querySelector('#fme-widget-save').addEventListener('click', () => saveEditorWidget(wrapper, w.id));
    editorArea.querySelector('#fme-widget-cancel').addEventListener('click', () => {
      editorArea.innerHTML = '';
      _editIdx = null;
    });

    // Scroll to editor
    editorArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function saveEditorWidget(wrapper, existingId) {
    const editorArea = wrapper.querySelector('#fme-widget-editor-area');
    const statusEl   = editorArea.querySelector('#fme-widget-editor-status');

    const name    = editorArea.querySelector('#fme-widget-name').value.trim();
    const desc    = editorArea.querySelector('#fme-widget-desc').value.trim();
    const target  = editorArea.querySelector('#fme-widget-target').value;
    const enabled = editorArea.querySelector('#fme-widget-enabled').checked;
    const code    = editorArea.querySelector('#fme-widget-code').value;

    if (!name) {
      statusEl.style.color = '#c00';
      statusEl.textContent  = 'Numele este obligatoriu.';
      return;
    }
    if (!code.trim()) {
      statusEl.style.color = '#c00';
      statusEl.textContent  = 'Codul JS este obligatoriu.';
      return;
    }

    const widget = {
      id:          existingId || uid(),
      name, desc, description: desc, target, enabled, code,
      createdAt:   _editIdx !== null ? (_widgets[_editIdx]?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
    };

    if (_editIdx !== null) {
      _widgets[_editIdx] = widget;
    } else {
      _widgets.push(widget);
    }
    if (typeof FMEActivityLog !== 'undefined') FMEActivityLog.log('widget-create', (_editIdx !== null ? 'Actualizat' : 'Creat') + ' widget: ' + widget.name);

    saveWidgets(() => {
      editorArea.innerHTML = '';
      _editIdx = null;
      renderAll(wrapper);
    });
  }

  // ─── Publish / Unpublish to Forumotion JS page ─────────────────────────────

  /**
   * Publishes or unpublishes a widget to the Forumotion JS management page.
   * Published widgets are wrapped with FME markers so they can be identified and removed.
   */
  async function togglePublish(wrapper, idx) {
    const w = _widgets[idx];
    if (!w) return;

    const tid = typeof FMEForumAPI !== 'undefined' && FMEForumAPI.getTid();
    if (!tid) {
      alert('Nu s-a putut determina Theme ID (tid). Navighează pe o pagină ACP cu tid în URL.');
      return;
    }

    const action = w.published ? 'retrage' : 'publică';
    if (!confirm(`${w.published ? 'Retragi' : 'Publici'} widget-ul "${w.name}" ${w.published ? 'de pe' : 'pe'} pagina de JavaScript a forumului?\n\n${w.published ? 'Codul va fi eliminat din pagina JS globală.' : 'Codul va fi vizibil și va rula pentru toți vizitatorii forumului.'}`)) return;

    // Show status
    const area = wrapper.querySelector('#fme-custom-section');
    const statusEl = document.createElement('div');
    statusEl.style.cssText = 'padding:8px 12px;margin:8px 12px;background:#f0f7ff;border:1px solid #b3d4fc;border-radius:4px;font-size:11px;color:#333;';
    statusEl.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Se ${action} widget-ul "${escHtml(w.name)}"...`;
    area.prepend(statusEl);

    try {
      const jsTitle = 'FME: ' + w.name;

      if (w.published) {
        // ─── UNPUBLISH: disable the widget's JS entry ───
        const saved = await FMEForumAPI.saveJsPlugin(tid, w.code, 'all', false, jsTitle);
        if (!saved) throw new Error('Dezactivarea a eșuat');
      } else {
        // ─── PUBLISH: save/enable the widget's JS entry ───
        const saved = await FMEForumAPI.saveJsPlugin(tid, w.code, 'all', true, jsTitle);
        if (!saved) throw new Error('Salvarea a eșuat');
      }

      // Update widget state
      _widgets[idx].published = !w.published;
      if (typeof FMEActivityLog !== 'undefined') {
        FMEActivityLog.log('widget-publish', (w.published ? 'Retras de pe forum' : 'Publicat pe forum') + ': ' + w.name);
      }

      saveWidgets(() => {
        statusEl.remove();
        renderAll(wrapper);
      });
    } catch (e) {
      console.warn('[FME Widgets] Publish error:', e);
      statusEl.style.background = '#fff0f0';
      statusEl.style.borderColor = '#f5c6cb';
      statusEl.innerHTML = `<span style="color:#c00;">✕ Eroare la ${action}: ${escHtml(e.message)}</span>`;
      setTimeout(() => statusEl.remove(), 5000);
    }
  }

  function deleteWidget(wrapper, idx) {
    const w = _widgets[idx];
    if (!w) return;
    if (w.published) {
      alert('Retrage mai întâi widget-ul de pe forum înainte de a-l șterge.');
      return;
    }
    if (!confirm(`Ștergi widget-ul "${w.name}"?`)) return;
    if (typeof FMEActivityLog !== 'undefined') FMEActivityLog.log('widget-delete', 'Șters widget: ' + w.name);
    _widgets.splice(idx, 1);
    saveWidgets(() => {
      if (_editIdx === idx) _editIdx = null;
      renderAll(wrapper);
    });
  }

  // ─── Persist ─────────────────────────────────────────────────────────────────

  function saveWidgets(cb) {
    chrome.storage.local.set({ [STORAGE_KEY]: _widgets }, cb || (() => {}));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function escHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  return { render, runAcpWidgets };
})();
