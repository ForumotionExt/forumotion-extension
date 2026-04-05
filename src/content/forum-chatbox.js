/**
 * FME Forum Chatbox
 * Replaces the native Forumotion chatbox with a custom UI.
 * Reads room configuration from chrome.storage.local (fme_chatbox_config).
 * Uses /chatbox/actions API (same-domain) for get/send — no jQuery dependency.
 */

(function () {
  'use strict';

  if (window.__fmeChatboxActive) return;
  window.__fmeChatboxActive = true;

  const STORAGE_KEY  = 'fme_chatbox_config';
  const WIDGET_ID    = 'fme-chatbox-widget';
  const STYLE_ID     = 'fme-cb-styles';
  const POLL_MS      = 3000;
  const MAX_MSGS     = 60;
  const ACTIONS_URL  = '/chatbox/actions';
  const AUTO_REJOIN_MS = 15000; // retry connect every 15s when disconnected

  // ─── State ───────────────────────────────────────────────────────────────────

  let _cfg          = null;
  let _activeTid    = null;
  let _nativeParams = {};   // sid + params grabbed from iframe or page globals
  let _pollTimer    = null;
  let _rejoinTimer  = null;
  let _connected    = false;
  let _autoScroll   = true;
  let _soundEnabled = true;
  let _widget       = null;
  let _charCountEl  = null;

  // ─── Intercept insertChatBoxNew ───────────────────────────────────────────────
  // Forumotion calls insertChatBoxNew(containerId, url) to create the chatbox
  // iframe. We wrap it to record the container id so findNativeChatbox() is exact.

  let _insertCBArgs = null;

  (function hookInsertChatBoxNew() {
    function makeWrapper(orig) {
      return function insertChatBoxNewFME(containerId, url) {
        _insertCBArgs = { containerId: containerId, url: url };
        if (typeof orig === 'function') return orig.apply(this, arguments);
      };
    }
    if (typeof window.insertChatBoxNew === 'function') {
      window.insertChatBoxNew = makeWrapper(window.insertChatBoxNew);
    } else {
      // Not yet defined — set up a property trap
      let _real = undefined;
      Object.defineProperty(window, 'insertChatBoxNew', {
        configurable: true,
        get: function () { return _real; },
        set: function (fn) {
          _real = makeWrapper(fn);
          Object.defineProperty(window, 'insertChatBoxNew',
            { configurable: true, writable: true, value: _real });
        },
      });
    }
  })();

  // ─── Bootstrap ───────────────────────────────────────────────────────────────

  chrome.storage.local.get({ [STORAGE_KEY]: null }, result => {
    const cfg = result[STORAGE_KEY];
    if (!cfg || !cfg.enabled) return;
    _cfg = cfg;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => waitAndInit(cfg));
    } else {
      waitAndInit(cfg);
    }
  });

  // Fetch the chatbox iframe page, parse out `new Chatbox(tid, params)` from
  // the inline script, then init. This is more reliable than accessing
  // iframe.contentWindow which may be restricted or not yet ready.
  async function waitAndInit(cfg) {
    const baseUrl = (_insertCBArgs && _insertCBArgs.url)
      ? _insertCBArgs.url
      : '/chatbox/?page=front&';

    const parsed = await fetchChatboxPageParams(baseUrl);
    if (parsed) {
      Object.assign(_nativeParams, parsed);
    }

    // Also grab any session globals set on the parent page
    if (!_nativeParams.sid && window.sid)   _nativeParams.sid = window.sid;
    if (!_nativeParams.sid && window.u_sid) _nativeParams.sid = window.u_sid;

    init(cfg);
  }

  // Fetch the chatbox page (same-origin, with cookies) and parse the
  // params object from the `new Chatbox(tid, params)` initialisation call.
  async function fetchChatboxPageParams(url) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return null;
      const html = await res.text();

      // Match:  new Chatbox('tid123', {key:'val', key2:123})
      const m = html.match(/new\s+Chatbox\s*\(\s*['"]([^'"]+)['"]\s*,\s*(\{[^}]+\})/);
      if (!m) return null;

      const params = {};
      const objStr = m[2];
      // Parse each key:value pair (handles quoted strings and integers)
      objStr.replace(/['"]?(\w+)['"]?\s*:\s*(?:'([^']*)'|"([^"]*)"|(-?\d+)|(\w+))/g,
        (_, key, sq, dq, num) => {
          params[key] = sq !== undefined ? sq
            : dq !== undefined ? dq
            : num !== undefined ? num
            : undefined;
          if (params[key] === undefined) delete params[key];
        });
      return params;
    } catch (e) {
      console.warn('[FME Chatbox] Could not fetch chatbox params:', e);
      return null;
    }
  }

  // Build GET URL merging native params + extra.
  function buildApiUrl(extra) {
    const p = new URLSearchParams(Object.assign({}, _nativeParams, extra));
    return ACTIONS_URL + '?' + p.toString();
  }

  // Build POST body: native params + any hidden inputs on the page + extra.
  function buildApiPostBody(extra) {
    const p = new URLSearchParams(Object.assign({}, _nativeParams, extra));
    document.querySelectorAll('input[type="hidden"]').forEach(inp => {
      if (inp.name && !p.has(inp.name)) p.set(inp.name, inp.value || '');
    });
    return p;
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────

  function init(cfg) {
    injectStyles();
    _widget = buildWidget(cfg);

    const native = findNativeChatbox();
    if (native) {
      native.style.setProperty('display', 'none', 'important');
      native.parentNode.insertBefore(_widget, native);
    } else {
      const body = document.body;
      const ref  = body.querySelector('div, section, aside, article') || body.firstChild;
      body.insertBefore(_widget, ref);
    }

    startChatbox();
  }

  // ─── Native chatbox detection ─────────────────────────────────────────────────

  function findNativeChatbox() {
    // 1. Use container id captured from insertChatBoxNew hook
    if (_insertCBArgs && _insertCBArgs.containerId) {
      const el = document.getElementById(_insertCBArgs.containerId);
      if (el) return el;
    }

    // 2. Common Forumotion chatbox container ids
    const ids = ['chatbox_top', 'chatbox_bottom', 'chatbox_container',
                  'chatbox2_container', 'chatbox_left', 'chatbox_right'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el;
    }

    // 3. Walk up from #chatbox messages div
    const chatboxDiv = document.getElementById('chatbox');
    if (chatboxDiv) {
      const footerDiv = document.getElementById('chatbox_footer');
      let el = chatboxDiv.parentElement;
      while (el && el !== document.body) {
        if (footerDiv && el.contains(footerDiv)) return el;
        el = el.parentElement;
      }
      return chatboxDiv.parentElement || null;
    }

    // 4. Class-based fallbacks
    const classFallbacks = [
      '.chatbox-wrap', '.chatbox-container', '.chatbox',
    ];
    for (const sel of classFallbacks) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    return null;
  }

  // ─── Room switching ───────────────────────────────────────────────────────────

  async function startChatbox() {
    stopPoll();
    stopRejoin();
    _activeTid  = _nativeParams.tid || null;
    _connected  = false;
    _autoScroll = true;
    clearMessages();
    setStatus('Se conectează...');
    updateFooter(false);

    await doConnect();

    if (_connected) {
      await doGet();
      startPoll();
    } else {
      // Not connected — start auto-rejoin attempts
      setStatus('⚠ Neconectat — se reîncearcă automat...');
      startRejoin();
    }
  }

  function startRejoin() {
    stopRejoin();
    _rejoinTimer = setInterval(async () => {
      if (_connected) { stopRejoin(); return; }
      setStatus('Se reîncearcă conectarea...');
      await doConnect();
      if (_connected) {
        stopRejoin();
        await doGet();
        startPoll();
        clearStatus();
      }
    }, AUTO_REJOIN_MS);
  }

  function stopRejoin() {
    if (_rejoinTimer) { clearInterval(_rejoinTimer); _rejoinTimer = null; }
  }

  // ─── API calls ────────────────────────────────────────────────────────────────

  async function doConnect() {
    try {
      const res = await fetch(
        buildApiUrl({ method: 'connect', tid: _activeTid }),
        { credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest' } }
      );
      if (!res.ok) return;
      const data = await res.json();
      _connected = !!data.connected;
      if (data.messages) renderMessages(data.messages);
      updateFooter(_connected);
      clearStatus();
    } catch (e) {
      console.warn('[FME Chatbox] connect error:', e);
      setStatus('⚠ Conexiune eșuată');
    }
  }

  async function doGet() {
    try {
      const res = await fetch(
        buildApiUrl({ method: 'get', tid: _activeTid }),
        { credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest' } }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.messages) renderMessages(data.messages);
    } catch (e) {
      console.warn('[FME Chatbox] get error:', e);
    }
  }

  async function doSend(text) {
    if (!text.trim() || !_connected) return;

    // Handle local commands
    const trimmed = text.trim();
    if (trimmed === '/clear') {
      clearMessages();
      return;
    }

    const params = buildApiPostBody({
      method:   'send',
      archives: '0',
      tid:      _activeTid,
      message:  trimmed,
    });

    try {
      const res = await fetch(ACTIONS_URL, {
        method:      'POST',
        credentials: 'include',
        headers: {
          'Content-Type':     'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: params.toString(),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.messages) renderMessages(data.messages);
    } catch (e) {
      console.warn('[FME Chatbox] send error:', e);
    }
  }

  // ─── Polling ──────────────────────────────────────────────────────────────────

  function startPoll() {
    _pollTimer = setInterval(() => doGet(), POLL_MS);
  }

  function stopPoll() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  // ─── Message rendering ────────────────────────────────────────────────────────

  function renderMessages(messages) {
    const list = _widget && _widget.querySelector('#fme-cb-messages');
    if (!list) return;

    const atBottom = _autoScroll ||
      (list.scrollHeight - list.scrollTop - list.clientHeight < 50);

    // Sort by msgid ascending — oldest (top) → newest (bottom)
    const sorted = [...messages].sort((a, b) => (a.msgid || 0) - (b.msgid || 0));
    const lastKnown = parseInt(list.dataset.lastMsgId || '0', 10);

    // On initial load (lastKnown=0) show all; afterwards only new messages
    const toAdd = lastKnown === 0
      ? sorted
      : sorted.filter(m => m.msgid > lastKnown);

    if (toAdd.length === 0) return;

    // Play notification sound for new messages (only after initial load)
    if (lastKnown > 0 && toAdd.length > 0 && _soundEnabled) {
      playNotificationSound();
    }

    toAdd.forEach(msg => {
      // Handle server-side deletions
      if (msg.action === 'delete' || msg.action === 'deleted') {
        const existing = list.querySelector('[data-mid="' + msg.msgid + '"]');
        if (existing) existing.remove();
        return;
      }
      list.appendChild(buildMsgEl(msg));
    });

    // Trim oldest messages beyond the cap
    while (list.children.length > MAX_MSGS) {
      list.removeChild(list.firstChild);
    }

    // Update high-water mark
    const allIds = sorted.filter(m => m.msgid).map(m => m.msgid);
    if (allIds.length > 0) {
      list.dataset.lastMsgId = String(Math.max(...allIds));
    }

    if (atBottom) list.scrollTop = list.scrollHeight;
  }

  function buildMsgEl(msg) {
    const row = document.createElement('div');
    row.className = 'fme-cb-row';
    row.dataset.mid = msg.msgid;

    // System / connection messages — no avatar, subtle style
    const isSystem = !msg.username || (msg.action && msg.action !== 'message');
    if (isSystem) {
      row.classList.add('fme-cb-system');
      const ts = escHtml(msg.datetime || '');
      row.innerHTML =
        '<div class="fme-cb-body fme-cb-system-body">' +
          '<span class="fme-cb-text">' + (msg.msg || '') + '</span>' +
        '</div>' +
        '<span class="fme-cb-ts">(' + ts + ')</span>';
      return row;
    }

    const avatar = (msg.user && msg.user.avatar)
      ? '<img class="fme-cb-avatar" src="' + escAttr(msg.user.avatar) + '" alt="" />'
      : '<span class="fme-cb-avatar fme-cb-avatar-ph"></span>';

    const color   = (msg.user && msg.user.color) ? msg.user.color : '#369fcf';
    const isAdmin = msg.user && msg.user.admin;
    const uname   = escHtml(msg.username || '');
    const ts      = escHtml(msg.datetime || '');
    const msgHtml = msg.msg || '';

    row.innerHTML =
      avatar +
      '<div class="fme-cb-body">' +
        '<span class="fme-cb-user" style="color:' + escAttr(color) + ';">' +
          (isAdmin ? '@ ' : '') + uname + ' :' +
        '</span>' +
        '<span class="fme-cb-text">' + msgHtml + '</span>' +
      '</div>' +
      '<span class="fme-cb-ts">(' + ts + ')</span>';

    row.querySelector('.fme-cb-user').addEventListener('click', () => {
      const input = _widget && _widget.querySelector('#fme-cb-input');
      if (input) { input.value += '@' + (msg.username || '') + ' '; input.focus(); }
    });

    return row;
  }

  // ─── Widget DOM ───────────────────────────────────────────────────────────────

  function buildWidget(cfg) {
    const widget = document.createElement('div');
    widget.id = WIDGET_ID;

    const title = escHtml(cfg.title || 'FME Chatbox');

    widget.innerHTML =
      '<div class="fme-cb-header">' +
        '<span class="fme-cb-title">&#128172; ' + title + '</span>' +
        '<div class="fme-cb-hdr-actions">' +
          '<button class="fme-cb-hdr-btn" id="fme-cb-cmds-btn" title="Comenzi disponibile">&#x2318;</button>' +
          '<button class="fme-cb-hdr-btn" id="fme-cb-info-btn" title="Informații">&#x2139;&#xFE0F;</button>' +
          '<button class="fme-cb-hdr-btn" id="fme-cb-settings-btn" title="Setări">&#x2699;&#xFE0F;</button>' +
          '<button class="fme-cb-hdr-btn" id="fme-cb-expand" title="Extinde/Restrânge">&#x2922;</button>' +
        '</div>' +
      '</div>' +
      '<div class="fme-cb-wrap">' +
        '<div id="fme-cb-info-panel" class="fme-cb-panel" style="display:none;"></div>' +
        '<div id="fme-cb-settings-panel" class="fme-cb-panel" style="display:none;"></div>' +
        '<div id="fme-cb-cmds-panel" class="fme-cb-panel" style="display:none;"></div>' +
        '<div id="fme-cb-status" style="display:none;"></div>' +
        '<div id="fme-cb-messages"></div>' +
      '</div>' +
      '<div class="fme-cb-footer">' +
        '<div id="fme-cb-login-area" style="display:none;width:100%;text-align:center;padding:4px 0;">' +
          '<button id="fme-cb-login-btn" class="fme-cb-login-btn">&#x1F511; Conectează-te la chatbox</button>' +
        '</div>' +
        '<div id="fme-cb-input-area" style="display:flex;align-items:center;gap:6px;width:100%;">' +
          '<input type="text" id="fme-cb-input" class="fme-cb-input"' +
            ' placeholder="Scrie un mesaj..." maxlength="500" disabled autocomplete="off" />' +
          '<span id="fme-cb-char-count" style="font-size:10px;color:#bbb;min-width:36px;text-align:right;flex-shrink:0;">0/500</span>' +
          '<button id="fme-cb-send-btn" class="fme-cb-send-btn" disabled>Send</button>' +
        '</div>' +
      '</div>';

    // ── Scroll tracking ──
    const msgList = widget.querySelector('#fme-cb-messages');
    msgList.addEventListener('scroll', () => {
      _autoScroll = (msgList.scrollHeight - msgList.scrollTop - msgList.clientHeight) < 50;
    }, { passive: true });

    // ── Send button ──
    widget.querySelector('#fme-cb-send-btn').addEventListener('click', () => {
      const input = widget.querySelector('#fme-cb-input');
      const text  = input.value.trim();
      if (!text) return;
      input.value = '';
      if (_charCountEl) { _charCountEl.textContent = '0/500'; _charCountEl.style.color = '#bbb'; }
      doSend(text);
    });

    // ── Enter to send ──
    widget.querySelector('#fme-cb-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        widget.querySelector('#fme-cb-send-btn').click();
      }
    });

    // ── Character counter ──
    _charCountEl = widget.querySelector('#fme-cb-char-count');
    widget.querySelector('#fme-cb-input').addEventListener('input', e => {
      const len = e.target.value.length;
      if (_charCountEl) {
        _charCountEl.textContent = len + '/500';
        _charCountEl.style.color = len > 450 ? '#e74c3c' : len > 350 ? '#f39c12' : '#bbb';
      }
    });

    // ── Login button ──
    widget.querySelector('#fme-cb-login-btn').addEventListener('click', () => {
      // Try reconnecting first
      setStatus('Se reîncearcă conectarea...');
      doConnect().then(() => {
        if (_connected) {
          doGet();
          startPoll();
          clearStatus();
          updateFooter(true);
        } else {
          // Open login page in new tab
          window.open(window.location.origin + '/login', '_blank');
        }
      });
    });

    // ── Expand/collapse ──
    let _expanded = false;
    widget.querySelector('#fme-cb-expand').addEventListener('click', () => {
      _expanded = !_expanded;
      const wrap = widget.querySelector('.fme-cb-wrap');
      if (wrap) wrap.style.height = _expanded ? '440px' : '';
    });

    // ── Info panel toggle ──
    widget.querySelector('#fme-cb-info-btn').addEventListener('click', () => {
      const infoP = widget.querySelector('#fme-cb-info-panel');
      const setP  = widget.querySelector('#fme-cb-settings-panel');
      const cmdP  = widget.querySelector('#fme-cb-cmds-panel');
      if (setP) setP.style.display = 'none';
      if (cmdP) cmdP.style.display = 'none';
      const visible = infoP.style.display !== 'none';
      infoP.style.display = visible ? 'none' : 'block';
      if (!visible) updateInfoPanel();
    });

    // ── Settings panel toggle ──
    widget.querySelector('#fme-cb-settings-btn').addEventListener('click', () => {
      const infoP = widget.querySelector('#fme-cb-info-panel');
      const setP  = widget.querySelector('#fme-cb-settings-panel');
      const cmdP  = widget.querySelector('#fme-cb-cmds-panel');
      if (infoP) infoP.style.display = 'none';
      if (cmdP)  cmdP.style.display  = 'none';
      const visible = setP.style.display !== 'none';
      setP.style.display = visible ? 'none' : 'block';
      if (!visible) initSettingsPanel();
    });

    // ── Commands panel toggle ──
    widget.querySelector('#fme-cb-cmds-btn').addEventListener('click', () => {
      const infoP = widget.querySelector('#fme-cb-info-panel');
      const setP  = widget.querySelector('#fme-cb-settings-panel');
      const cmdP  = widget.querySelector('#fme-cb-cmds-panel');
      if (infoP) infoP.style.display = 'none';
      if (setP)  setP.style.display  = 'none';
      const visible = cmdP.style.display !== 'none';
      cmdP.style.display = visible ? 'none' : 'block';
      if (!visible) initCommandsPanel();
    });

    return widget;
  }

  // ─── Panel helpers ────────────────────────────────────────────────────────────

  function updateInfoPanel() {
    const panel = _widget && _widget.querySelector('#fme-cb-info-panel');
    if (!panel) return;
    const msgCount = (_widget.querySelector('#fme-cb-messages')?.children.length) || 0;
    panel.innerHTML =
      '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;">' +
        '<span>Stare: ' + (_connected
          ? '<b style="color:#10b981;">\u25CF Conectat</b>'
          : '<b style="color:#e74c3c;">\u25CB Deconectat</b>') + '</span>' +
        '<span>TID: <code style="background:#eee;padding:0 4px;border-radius:2px;">' +
          escHtml(_activeTid || '\u2014') + '</code></span>' +
        '<span>Mesaje: ' + msgCount + '/' + MAX_MSGS + '</span>' +
        '<span>Polling: ' + (POLL_MS / 1000) + 's</span>' +
      '</div>';
  }

  function initSettingsPanel() {
    const panel = _widget && _widget.querySelector('#fme-cb-settings-panel');
    if (!panel) return;
    panel.innerHTML =
      '<div style="font-weight:600;margin-bottom:6px;font-size:12px;">⚙ Setări chatbox</div>' +
      '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:6px;">' +
        '<input type="checkbox" id="fme-cb-opt-autoscroll"' +
          (_autoScroll ? ' checked' : '') + ' />' +
        '<span>Auto-scroll la mesaje noi</span>' +
      '</label>' +
      '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:6px;">' +
        '<input type="checkbox" id="fme-cb-opt-sound"' +
          (_soundEnabled ? ' checked' : '') + ' />' +
        '<span>Sunet la mesaje noi</span>' +
      '</label>' +
      '<div style="display:flex;gap:6px;margin-top:6px;">' +
        '<button id="fme-cb-clear-msgs" style="padding:3px 12px;font-size:11px;' +
          'cursor:pointer;border:1px solid #ccc;border-radius:3px;background:#fff;">' +
          'Gole\u0219te mesajele</button>' +
        '<button id="fme-cb-reconnect" style="padding:3px 12px;font-size:11px;' +
          'cursor:pointer;border:1px solid #ccc;border-radius:3px;background:#fff;">' +
          '\u21BB Reconectare</button>' +
      '</div>';
    panel.querySelector('#fme-cb-opt-autoscroll')
      .addEventListener('change', e => { _autoScroll = e.target.checked; });
    panel.querySelector('#fme-cb-opt-sound')
      .addEventListener('change', e => { _soundEnabled = e.target.checked; });
    panel.querySelector('#fme-cb-clear-msgs')
      .addEventListener('click', () => clearMessages());
    panel.querySelector('#fme-cb-reconnect')
      .addEventListener('click', () => startChatbox());
  }

  // ─── Commands panel ─────────────────────────────────────────────────────────

  function initCommandsPanel() {
    const panel = _widget && _widget.querySelector('#fme-cb-cmds-panel');
    if (!panel) return;

    const commands = [
      { cmd: '/me <text>',      desc: 'Trimite un mesaj de acțiune (text italic)' },
      { cmd: '/clear',          desc: 'Golește mesajele din chatbox (local)' },
      { cmd: '@utilizator',     desc: 'Menționează un utilizator (click pe nume)' },
      { cmd: '/abs <text>',     desc: 'Text aldin (bold)' },
      { cmd: '/color:cod text', desc: 'Colorează textul (ex: /color:red salut)' },
    ];

    panel.innerHTML =
      '<div style="font-weight:600;margin-bottom:6px;font-size:12px;">⌘ Comenzi disponibile</div>' +
      '<table style="width:100%;font-size:11px;border-collapse:collapse;">' +
        commands.map(c =>
          '<tr style="border-bottom:1px solid #eee;">' +
            '<td style="padding:3px 6px 3px 0;font-family:monospace;color:#5a6572;white-space:nowrap;font-weight:600;">' +
              escHtml(c.cmd) + '</td>' +
            '<td style="padding:3px 0;color:#666;">' + escHtml(c.desc) + '</td>' +
          '</tr>'
        ).join('') +
      '</table>' +
      '<div style="margin-top:8px;font-size:10px;color:#999;">Click pe numele unui utilizator pentru a-l menționa rapid.</div>';
  }

  // ─── State helpers ────────────────────────────────────────────────────────────

  function clearMessages() {
    const list = _widget && _widget.querySelector('#fme-cb-messages');
    if (!list) return;
    list.innerHTML = '';
    list.dataset.lastMsgId = '0';
  }

  function updateFooter(connected) {
    if (!_widget) return;
    const input     = _widget.querySelector('#fme-cb-input');
    const btn       = _widget.querySelector('#fme-cb-send-btn');
    const loginArea = _widget.querySelector('#fme-cb-login-area');
    const inputArea = _widget.querySelector('#fme-cb-input-area');

    if (connected) {
      if (loginArea) loginArea.style.display = 'none';
      if (inputArea) inputArea.style.display = 'flex';
      if (input) { input.disabled = false; input.placeholder = 'Scrie un mesaj...'; }
      if (btn)   btn.disabled = false;
    } else {
      if (loginArea) loginArea.style.display = 'block';
      if (inputArea) inputArea.style.display = 'none';
      if (input) { input.disabled = true; input.placeholder = 'Trebuie să fii autentificat...'; }
      if (btn)   btn.disabled = true;
    }
  }

  function setStatus(msg) {
    const s = _widget && _widget.querySelector('#fme-cb-status');
    if (s) { s.textContent = msg; s.style.display = 'block'; }
  }

  function clearStatus() {
    const s = _widget && _widget.querySelector('#fme-cb-status');
    if (s) s.style.display = 'none';
  }

  // ─── Styles ───────────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#' + WIDGET_ID + ' {',
        'font-family:Arial,Helvetica,sans-serif;font-size:12px;',
        'border:1px solid #c8c8c8;border-radius:3px;overflow:hidden;',
        'background:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.1);margin:8px 0;',
      '}',

      /* Header */
      '.fme-cb-header {',
        'display:flex;align-items:center;',
        'background:#5a6572;color:#fff;',
        'padding:8px 12px;min-height:36px;',
      '}',
      '.fme-cb-title { flex:1;font-weight:700;font-size:13px;letter-spacing:0.2px; }',
      '.fme-cb-hdr-actions { display:flex;align-items:center;gap:4px; }',
      '.fme-cb-hdr-btn {',
        'background:transparent;border:none;color:rgba(255,255,255,0.75);',
        'cursor:pointer;font-size:14px;padding:2px 4px;line-height:1;border-radius:3px;',
      '}',
      '.fme-cb-hdr-btn:hover { color:#fff;background:rgba(255,255,255,0.1); }',
      '.fme-cb-panel {',
        'padding:8px 12px;font-size:11px;color:#555;',
        'border-bottom:1px solid #e8e8e8;background:#f9fafb;flex-shrink:0;',
      '}',

      /* Body wrapper */
      '.fme-cb-wrap { display:flex;flex-direction:column;height:240px;transition:height 0.2s ease;overflow:hidden; }',

      /* Messages area */
      '#fme-cb-messages { flex:1;overflow-y:auto;overflow-x:hidden; }',
      '#fme-cb-status {',
        'padding:6px 12px;font-size:11px;color:#888;',
        'border-bottom:1px solid #f0f0f0;flex-shrink:0;',
      '}',

      /* Message row */
      '.fme-cb-row {',
        'display:flex;align-items:flex-start;',
        'padding:6px 10px;gap:8px;',
        'border-bottom:1px solid #f2f2f2;min-height:40px;',
      '}',
      '.fme-cb-row:nth-child(even) { background:#f9f9f9; }',
      '.fme-cb-row:hover { background:#f5f5f5; }',

      /* Avatar */
      '.fme-cb-avatar {',
        'width:34px;height:34px;border-radius:50%;',
        'object-fit:cover;flex-shrink:0;align-self:flex-start;margin-top:1px;',
      '}',
      '.fme-cb-avatar-ph { display:inline-block;background:#d0d0d0; }',

      /* Message body */
      '.fme-cb-body { flex:1;min-width:0;line-height:1.5;word-break:break-word; }',
      '.fme-cb-user {',
        'font-weight:700;font-size:12px;cursor:pointer;margin-right:3px;',
      '}',
      '.fme-cb-user:hover { text-decoration:underline; }',
      '.fme-cb-text { color:#444;font-size:12px; }',

      /* Timestamp */
      '.fme-cb-ts {',
        'font-size:11px;color:#999;white-space:nowrap;',
        'flex-shrink:0;align-self:center;padding-left:4px;',
      '}',

      /* Footer */
      '.fme-cb-footer {',
        'display:flex;align-items:center;gap:6px;',
        'padding:5px 10px;border-top:1px solid #e0e0e0;',
        'background:#f5f5f5;min-height:36px;flex-shrink:0;',
      '}',
      '.fme-cb-system { padding:3px 10px;min-height:auto;border-bottom:1px solid #f2f2f2; }',
      '.fme-cb-system .fme-cb-body { font-style:italic;color:#999;font-size:11px; }',
      '.fme-cb-system .fme-cb-ts { font-size:10px; }',
      '.fme-cb-system .fme-cb-text { color:#999; }',
      '.fme-cb-system .fme-cb-text a { color:#888; }',      
      '.fme-cb-input {',
        'flex:1;min-width:0;',
        'border:1px solid #ccc;border-radius:3px;',
        'padding:5px 8px;font-size:12px;',
        'outline:none;font-family:inherit;color:#333;background:#fff;',
      '}',
      '.fme-cb-input:focus { border-color:#5a9fd4;box-shadow:0 0 0 2px rgba(90,159,212,0.15); }',
      '.fme-cb-input:disabled { background:#f5f5f5;color:#aaa;cursor:not-allowed; }',
      '.fme-cb-send-btn {',
        'padding:5px 16px;background:#5a6572;color:#fff;',
        'border:none;border-radius:3px;',
        'font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;',
      '}',
      '.fme-cb-send-btn:hover:not(:disabled) { background:#49545f; }',
      '.fme-cb-send-btn:disabled { opacity:0.5;cursor:not-allowed; }',

      /* Login button */
      '.fme-cb-login-btn {',
        'padding:8px 20px;background:#5a6572;color:#fff;',
        'border:none;border-radius:4px;',
        'font-size:12px;font-weight:700;cursor:pointer;',
        'transition:background 0.15s;',
      '}',
      '.fme-cb-login-btn:hover { background:#3d8bfd; }',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ─── Utils ────────────────────────────────────────────────────────────────────

  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escAttr(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Notification sound ────────────────────────────────────────────────────

  function playNotificationSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.value = 0.08;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch (_) { /* AudioContext not available — silently skip */ }
  }

})();
