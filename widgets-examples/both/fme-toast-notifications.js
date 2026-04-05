/**
 * Widget: ACP & Forum Notification Toast
 * Target:  both
 *
 * Expune o funcție globală `FMEToast.show(msg, type, duration)` utilizabilă
 * din alți widgets sau CSS pentru a afișa notificări toast temporare.
 *
 * Tipuri: 'success' | 'error' | 'info' | 'warning'
 */

// ── META ─────────────────────────────────────────────────────────────────────
// Name:        FME Toast Notifications
// Description: Sistem de notificări toast reutilizabil (ACP + Forum)
// Target:      both
// ─────────────────────────────────────────────────────────────────────────────

// CODE ────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  if (window.FMEToast) return; // deja injectat

  const COLORS = {
    success: { bg: '#16a34a', icon: '✓' },
    error:   { bg: '#dc2626', icon: '✕' },
    warning: { bg: '#d97706', icon: '⚠' },
    info:    { bg: '#2563eb', icon: 'ℹ' },
  };

  // Container fix în colțul din dreapta-sus
  const container = document.createElement('div');
  container.id = 'fme-toast-container';
  container.style.cssText = [
    'position:fixed', 'top:16px', 'right:16px', 'z-index:2147483640',
    'display:flex', 'flex-direction:column', 'gap:8px',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(container);

  /**
   * Afișează un toast.
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} [type='info']
   * @param {number} [durationMs=3500]
   */
  function show(message, type = 'info', durationMs = 3500) {
    const { bg, icon } = COLORS[type] || COLORS.info;

    const toast = document.createElement('div');
    toast.style.cssText = [
      `background:${bg}`, 'color:#fff',
      'padding:10px 14px',
      'border-radius:6px',
      'display:flex', 'align-items:center', 'gap:10px',
      'font-family:sans-serif', 'font-size:13px',
      'box-shadow:0 3px 10px rgba(0,0,0,0.25)',
      'max-width:320px', 'min-width:180px',
      'pointer-events:auto',
      'opacity:0', 'transform:translateX(20px)',
      'transition:opacity 0.25s, transform 0.25s',
    ].join(';');

    toast.innerHTML = `
      <span style="font-size:16px;flex-shrink:0;">${icon}</span>
      <span style="flex:1;line-height:1.4;">${message}</span>
      <button style="background:transparent;border:none;color:rgba(255,255,255,0.7);
                     font-size:16px;cursor:pointer;padding:0;line-height:1;flex-shrink:0;"
              title="Închide">&times;</button>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity   = '1';
      toast.style.transform = 'translateX(0)';
    });

    function dismiss() {
      toast.style.opacity   = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }

    toast.querySelector('button').addEventListener('click', dismiss);
    if (durationMs > 0) setTimeout(dismiss, durationMs);
  }

  window.FMEToast = { show };

  // Demo la prima încărcare (opțional — comentează linia de mai jos în producție)
  // window.FMEToast.show('FME Toast activ!', 'success', 2500);
})();
// ─────────────────────────────────────────────────────────────────────────────
