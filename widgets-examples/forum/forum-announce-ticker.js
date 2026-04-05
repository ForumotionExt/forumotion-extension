/**
 * Widget: Forum Announce Ticker
 * Target:  forum
 *
 * Adaugă un ticker (text defilant) la începutul paginii principale a forumului
 * cu un mesaj de anunț personalizabil. Poate afișa mai multe mesaje în rotație.
 */

// ── META ─────────────────────────────────────────────────────────────────────
// Name:        Forum Announce Ticker
// Description: Ticker cu mesaje de anunț defilante pe pagina principală
// Target:      forum
// ─────────────────────────────────────────────────────────────────────────────

// CODE ────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  // ── Configurare ────────────────────────────────────────────────────────────
  const MESSAGES = [
    '📢 Bun venit pe forum! Citiți regulamentul înainte de a posta.',
    '🎉 Eveniment nou: Concurs de vară — participați până pe 30 iulie!',
    '🔔 Serverele vor fi în mentenanță duminică, 02:00–04:00.',
  ];
  const SPEED_PX_PER_SEC = 60; // viteza defilare (pixeli/secundă)
  const BG_COLOR         = '#1e293b';
  const TEXT_COLOR       = '#f1f5f9';
  // ───────────────────────────────────────────────────────────────────────────

  const TICKER_ID = 'fme-ticker';
  if (document.getElementById(TICKER_ID)) return;

  const joined = MESSAGES.join('   •   ');

  const ticker = document.createElement('div');
  ticker.id = TICKER_ID;
  ticker.style.cssText = [
    `background:${BG_COLOR}`, `color:${TEXT_COLOR}`,
    'overflow:hidden', 'white-space:nowrap',
    'padding:6px 0', 'font-size:12px',
    'font-family:sans-serif',
    'position:relative', 'z-index:9989',
  ].join(';');

  const inner = document.createElement('span');
  inner.textContent = joined;
  inner.style.cssText = [
    'display:inline-block',
    'padding-left:100%',  // pornește din afara dreptei
    'will-change:transform',
  ].join(';');
  ticker.appendChild(inner);
  document.body.insertBefore(ticker, document.body.firstChild);

  // Calculăm durata animației în funcție de lățime și viteză
  function startAnimation() {
    const totalWidth = inner.scrollWidth + ticker.clientWidth;
    const duration   = totalWidth / SPEED_PX_PER_SEC;

    inner.style.animation   = 'none';
    inner.style.transform   = '';

    // Definim keyframes inline o singură dată
    if (!document.getElementById('fme-ticker-style')) {
      const style = document.createElement('style');
      style.id = 'fme-ticker-style';
      style.textContent = `
        @keyframes fme-ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-${totalWidth}px); }
        }
      `;
      document.head.appendChild(style);
    }

    inner.style.animation = `fme-ticker-scroll ${duration}s linear infinite`;
  }

  // Wait for fonts/layout to be ready before measuring
  if (document.readyState === 'complete') {
    startAnimation();
  } else {
    window.addEventListener('load', startAnimation, { once: true });
  }
})();
// ─────────────────────────────────────────────────────────────────────────────
