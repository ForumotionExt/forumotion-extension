/**
 * Widget: Forum Dark Mode Toggle
 * Target:  forum
 *
 * Adaugă un buton 🌙/☀️ care comută un dark mode de bază pe forum,
 * persisting preferința în localStorage.
 * Utile ca fallback dacă nu ai instalat o temă dark completă.
 */

// ── META ─────────────────────────────────────────────────────────────────────
// Name:        Forum Dark Mode Toggle
// Description: Buton comutare dark/light mode pentru forum
// Target:      forum
// ─────────────────────────────────────────────────────────────────────────────

// CODE ────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  const STORAGE_KEY = 'fme_dark_mode';
  const STYLE_ID    = 'fme-dark-mode-style';
  const BTN_ID      = 'fme-dark-toggle-btn';

  const DARK_CSS = `
    body, .forum, #viewforum, #viewtopic {
      background: #0f172a !important;
      color: #e2e8f0 !important;
    }
    .table1, .table2, .forumbg, .forumbg2 {
      background: #1e293b !important;
      border-color: #334155 !important;
    }
    td, th, .row1, .row2, .row3, .rowbg, .headbg {
      background: #1e293b !important;
      color: #e2e8f0 !important;
      border-color: #334155 !important;
    }
    a { color: #60a5fa !important; }
    a:hover { color: #93c5fd !important; }
    input, textarea, select {
      background: #334155 !important;
      color: #e2e8f0 !important;
      border-color: #475569 !important;
    }
    .maintitle, .titlebg { background: #1e40af !important; }
  `;

  function applyDark(on) {
    let el = document.getElementById(STYLE_ID);
    if (on) {
      if (!el) {
        el = document.createElement('style');
        el.id = STYLE_ID;
        document.head.appendChild(el);
      }
      el.textContent = DARK_CSS;
    } else {
      el?.remove();
    }
    const btn = document.getElementById(BTN_ID);
    if (btn) btn.textContent = on ? '☀️' : '🌙';
  }

  // Stare curentă
  let dark = localStorage.getItem(STORAGE_KEY) === '1';

  // Aplică imediat dacă era activată
  applyDark(dark);

  // Buton toggle
  if (document.getElementById(BTN_ID)) return;
  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.textContent = dark ? '☀️' : '🌙';
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
})();
// ─────────────────────────────────────────────────────────────────────────────
