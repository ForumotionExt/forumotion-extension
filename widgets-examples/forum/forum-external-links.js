/**
 * Widget: Forum External Links New Tab
 * Target:  forum
 *
 * Deschide automat toate linkurile externe (care nu aparțin domeniului forumului)
 * într-un tab nou, fără a modifica linkurile interne.
 */

// ── META ─────────────────────────────────────────────────────────────────────
// Name:        Forum External Links New Tab
// Description: Linkuri externe → deschis în tab nou automat
// Target:      forum
// ─────────────────────────────────────────────────────────────────────────────

// CODE ────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  const host = window.location.hostname;

  function processLinks(root) {
    root.querySelectorAll('a[href]').forEach(a => {
      if (a.dataset.fmeExternal) return;
      a.dataset.fmeExternal = '1';

      try {
        const url = new URL(a.href, window.location.href);
        // Link extern dacă hostname-ul diferă (ignoră subdomenii ale aceluiași forum)
        if (url.hostname && url.hostname !== host && url.protocol.startsWith('http')) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        }
      } catch (_) {
        // href invalid — ignorăm
      }
    });
  }

  processLinks(document.body);

  // Și pentru conținut încărcat dinamic (ex: postări noi via AJAX)
  const obs = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1) processLinks(node);
      });
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();
// ─────────────────────────────────────────────────────────────────────────────
