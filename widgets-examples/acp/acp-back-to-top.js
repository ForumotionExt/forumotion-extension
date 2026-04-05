/**
 * Widget: ACP Back to Top Button
 * Target:  acp
 *
 * Afișează un buton „↑" în colțul din dreapta-jos al paginilor ACP lungi,
 * care apare după scroll și revine la top la click.
 */

// ── META ─────────────────────────────────────────────────────────────────────
// Name:        ACP Back to Top
// Description: Buton flotant „↑ Sus" pe paginile ACP lungi
// Target:      acp
// ─────────────────────────────────────────────────────────────────────────────

// CODE ────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  const BTN_ID = 'fme-widget-back-to-top';
  if (document.getElementById(BTN_ID)) return;

  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.textContent = '↑';
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

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
// ─────────────────────────────────────────────────────────────────────────────
