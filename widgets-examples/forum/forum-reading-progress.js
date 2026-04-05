/**
 * Widget: Forum Reading Progress Bar
 * Target:  forum
 *
 * Afișează o bară de progres subțire la topul paginii, care indică
 * poziția curentă de scroll (cât din pagină a citit utilizatorul).
 */

// ── META ─────────────────────────────────────────────────────────────────────
// Name:        Forum Reading Progress Bar
// Description: Bară de progres scroll pe paginile de subiecte
// Target:      forum
// ─────────────────────────────────────────────────────────────────────────────

// CODE ────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  // ── Configurare ────────────────────────────────────────────────────────────
  const BAR_HEIGHT = '3px';
  const BAR_COLOR  = '#3b82f6';
  // ───────────────────────────────────────────────────────────────────────────

  const BAR_ID = 'fme-reading-progress';
  if (document.getElementById(BAR_ID)) return;

  const bar = document.createElement('div');
  bar.id = BAR_ID;
  bar.style.cssText = [
    'position:fixed', 'top:0', 'left:0',
    `height:${BAR_HEIGHT}`,
    `background:${BAR_COLOR}`,
    'width:0%',
    'z-index:9991',
    'transition:width 0.1s linear',
    'pointer-events:none',
  ].join(';');

  document.body.appendChild(bar);

  function update() {
    const scrollTop  = window.scrollY;
    const docHeight  = document.documentElement.scrollHeight - window.innerHeight;
    const percent    = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
    bar.style.width  = percent + '%';
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
})();
// ─────────────────────────────────────────────────────────────────────────────
