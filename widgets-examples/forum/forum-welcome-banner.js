/**
 * Widget: Forum Welcome Banner
 * Target:  forum
 *
 * Afișează un banner personalizat de bun-venit pentru vizitatori
 * (utilizatori nelogați) în partea de sus a forumului.
 * Banner-ul poate fi închis și nu mai apare (salvat în localStorage).
 */

// ── META ─────────────────────────────────────────────────────────────────────
// Name:        Forum Welcome Banner
// Description: Banner de bun-venit pentru vizitatori, cu buton de închidere
// Target:      forum
// ─────────────────────────────────────────────────────────────────────────────

// CODE ────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  // ── Configurare ────────────────────────────────────────────────────────────
  const STORAGE_KEY  = 'fme_welcome_banner_dismissed';
  const BANNER_TEXT  = 'Bun venit pe forum! 👋 Înregistrează-te pentru a participa la discuții.';
  const BUTTON_TEXT  = 'Înregistrează-te';
  const BUTTON_URL   = '/register'; // Schimbă cu URL-ul real de înregistrare
  const BG_COLOR     = '#3b82f6';
  const TEXT_COLOR   = '#ffffff';
  // ───────────────────────────────────────────────────────────────────────────

  // Nu afișa dacă utilizatorul a închis deja banner-ul
  if (localStorage.getItem(STORAGE_KEY)) return;

  // Nu afișa dacă utilizatorul pare logat (heuristică: link de logout prezent)
  if (document.querySelector('a[href*="logout"], a[href*="deconnexion"]')) return;

  const banner = document.createElement('div');
  banner.id = 'fme-welcome-banner';
  banner.style.cssText = [
    `background:${BG_COLOR}`, `color:${TEXT_COLOR}`,
    'padding:10px 16px',
    'display:flex', 'align-items:center', 'gap:12px', 'flex-wrap:wrap',
    'font-family:sans-serif', 'font-size:13px',
    'position:relative', 'z-index:9990',
    'box-shadow:0 2px 6px rgba(0,0,0,0.15)',
  ].join(';');

  banner.innerHTML = `
    <span style="flex:1;min-width:200px;">${BANNER_TEXT}</span>
    <a href="${BUTTON_URL}"
       style="background:#fff;color:${BG_COLOR};padding:5px 14px;
              border-radius:4px;font-weight:600;text-decoration:none;
              font-size:12px;white-space:nowrap;">
      ${BUTTON_TEXT}
    </a>
    <button id="fme-welcome-close"
       style="background:transparent;border:none;color:rgba(255,255,255,0.8);
              font-size:18px;line-height:1;cursor:pointer;padding:0 4px;"
       title="Închide">&times;</button>
  `;

  // Inserează la începutul body
  document.body.insertBefore(banner, document.body.firstChild);

  banner.querySelector('#fme-welcome-close').addEventListener('click', () => {
    banner.remove();
    localStorage.setItem(STORAGE_KEY, '1');
  });
})();
// ─────────────────────────────────────────────────────────────────────────────
