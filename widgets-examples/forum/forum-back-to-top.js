/**
 * Widget: Forum Back to Top Button
 * Target:  forum
 *
 * Buton flotant „↑" care apare după scroll pe orice pagină de forum.
 * Identic cu varianta ACP dar cu culori adaptate pentru forum.
 */

// ── META ─────────────────────────────────────────────────────────────────────
// Name:        Forum Back to Top
// Description: Buton flotant „↑ Sus" pe paginile de forum
// Target:      forum
// ─────────────────────────────────────────────────────────────────────────────

// CODE ────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  const BTN_ID = 'fme-forum-back-to-top';
  if (document.getElementById(BTN_ID)) return;

  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.textContent = '↑';
  btn.title = 'Înapoi sus';
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
    btn.style.opacity    = show ? '1'           : '0';
    btn.style.transform  = show ? 'translateY(0)' : 'translateY(10px)';
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
// ─────────────────────────────────────────────────────────────────────────────
