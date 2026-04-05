/**
 * Widget: ACP Clock
 * Target:  acp
 *
 * Adaugă un ceas live (HH:MM:SS) în bara de navigare a ACP.
 * Se poziționează în dreapta meniului de top, lângă butonul de logout.
 */

// ── META ─────────────────────────────────────────────────────────────────────
// Name:        ACP Clock
// Description: Ceas live în bara de top a ACP
// Target:      acp
// ─────────────────────────────────────────────────────────────────────────────

// CODE ────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  const CLOCK_ID = 'fme-widget-clock';
  if (document.getElementById(CLOCK_ID)) return; // deja injectat

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

  function tick() {
    clock.textContent = new Date().toLocaleTimeString('ro-RO');
  }
  tick();
  setInterval(tick, 1000);
})();
// ─────────────────────────────────────────────────────────────────────────────
