/**
 * Widget: ACP Word Counter
 * Target:  acp
 *
 * Afișează numărul de caractere și cuvinte sub orice <textarea> din ACP
 * (ex: editare template, editare regulament, descriere categorie etc.)
 */

// ── META ─────────────────────────────────────────────────────────────────────
// Name:        ACP Word Counter
// Description: Afișează nr. caractere & cuvinte sub fiecare textarea din ACP
// Target:      acp
// ─────────────────────────────────────────────────────────────────────────────

// CODE ────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  function attachCounter(ta) {
    if (ta.dataset.fmeCounter) return;
    ta.dataset.fmeCounter = '1';

    const counter = document.createElement('div');
    counter.style.cssText =
      'font-size:11px;color:#888;margin-top:3px;text-align:right;font-family:sans-serif;';

    function update() {
      const val   = ta.value;
      const chars = val.length;
      const words = val.trim() === '' ? 0 : val.trim().split(/\s+/).length;
      counter.textContent = `${chars} caractere · ${words} cuvinte`;
    }
    update();

    ta.addEventListener('input', update);
    ta.parentNode.insertBefore(counter, ta.nextSibling);
  }

  // Attach to all current textareas
  document.querySelectorAll('textarea').forEach(attachCounter);

  // Also watch for dynamically added textareas (ACP loads some pages via AJAX)
  const obs = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'TEXTAREA') attachCounter(node);
        node.querySelectorAll?.('textarea').forEach(attachCounter);
      });
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();
// ─────────────────────────────────────────────────────────────────────────────
