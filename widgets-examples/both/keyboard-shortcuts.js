/**
 * Widget: Keyboard Shortcuts
 * Target:  both
 *
 * Adaugă scurtături de tastatură globale.
 * Apasă `?` pentru a vedea lista cu toate scurtăturile disponibile.
 *
 * Scurtături implicite:
 *   ?          — afișează/ascunde lista scurtăturilor
 *   Alt+H      — mergi la pagina principală (/)
 *   Alt+T      — mergi sus (scroll to top)
 *   Alt+B      — mergi jos (scroll to bottom)
 */

// ── META ─────────────────────────────────────────────────────────────────────
// Name:        Keyboard Shortcuts
// Description: Scurtături tastatură globale cu help overlay (? = help)
// Target:      both
// ─────────────────────────────────────────────────────────────────────────────

// CODE ────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  if (window.__fmeShortcuts) return;
  window.__fmeShortcuts = true;

  const SHORTCUTS = [
    {
      key: '?', alt: false, shift: true,
      label: '? (Shift+/)',
      desc: 'Afișează/ascunde această fereastră',
      action: () => toggleHelp(),
    },
    {
      key: 'h', alt: true, shift: false,
      label: 'Alt + H',
      desc: 'Pagina principală',
      action: () => { window.location.href = '/'; },
    },
    {
      key: 't', alt: true, shift: false,
      label: 'Alt + T',
      desc: 'Scroll la început (top)',
      action: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    },
    {
      key: 'b', alt: true, shift: false,
      label: 'Alt + B',
      desc: 'Scroll la sfârșit (bottom)',
      action: () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }),
    },
  ];

  // ── Help overlay ─────────────────────────────────────────────────────────

  const OVERLAY_ID = 'fme-shortcuts-overlay';

  function buildOverlay() {
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483639',
      'background:rgba(0,0,0,0.55)',
      'display:flex', 'align-items:center', 'justify-content:center',
    ].join(';');

    const box = document.createElement('div');
    box.style.cssText = [
      'background:#1e293b', 'color:#e2e8f0',
      'border-radius:8px', 'padding:24px',
      'min-width:300px', 'max-width:440px', 'width:90%',
      'font-family:sans-serif', 'font-size:13px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.4)',
    ].join(';');

    const rows = SHORTCUTS.map(s => `
      <tr>
        <td style="padding:5px 12px 5px 0;">
          <kbd style="background:#334155;border:1px solid #475569;border-radius:4px;
                      padding:2px 7px;font-family:monospace;font-size:12px;
                      color:#f8fafc;">${s.label}</kbd>
        </td>
        <td style="padding:5px 0;color:#94a3b8;">${s.desc}</td>
      </tr>
    `).join('');

    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;
                  margin-bottom:16px;">
        <strong style="font-size:14px;">⌨️ Scurtături tastatură</strong>
        <button id="fme-shortcuts-close"
          style="background:transparent;border:none;color:#94a3b8;
                 font-size:20px;cursor:pointer;line-height:1;">&times;</button>
      </div>
      <table style="border-collapse:collapse;width:100%;">
        ${rows}
      </table>
      <p style="margin-top:14px;font-size:11px;color:#475569;text-align:right;">
        FME Widgets
      </p>
    `;

    overlay.appendChild(box);
    overlay.addEventListener('click', e => { if (e.target === overlay) toggleHelp(); });
    box.querySelector('#fme-shortcuts-close').addEventListener('click', toggleHelp);
    return overlay;
  }

  function toggleHelp() {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) { existing.remove(); return; }
    document.body.appendChild(buildOverlay());
  }

  // ── Keyboard listener ─────────────────────────────────────────────────────

  document.addEventListener('keydown', e => {
    // Nu intercepta când utilizatorul scrie într-un câmp de input
    const tag = document.activeElement?.tagName?.toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (document.activeElement?.isContentEditable) return;

    for (const s of SHORTCUTS) {
      const keyMatch   = e.key.toLowerCase() === s.key.toLowerCase();
      const altMatch   = !!e.altKey  === s.alt;
      const shiftMatch = !!e.shiftKey === s.shift;
      if (keyMatch && altMatch && shiftMatch) {
        e.preventDefault();
        s.action();
        return;
      }
    }
  });
})();
// ─────────────────────────────────────────────────────────────────────────────
