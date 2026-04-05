/**
 * Widget: Forum Post Word Count
 * Target:  forum
 *
 * Afișează numărul de cuvinte și caractere sub textarea de redactare a postărilor.
 * Avertizează dacă postarea depășește o limită configurabilă.
 */

// ── META ─────────────────────────────────────────────────────────────────────
// Name:        Forum Post Word Count
// Description: Contor cuvinte/caractere la scrierea postărilor
// Target:      forum
// ─────────────────────────────────────────────────────────────────────────────

// CODE ────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  // ── Configurare ────────────────────────────────────────────────────────────
  const MAX_CHARS = 5000;  // 0 = fără limită
  // ───────────────────────────────────────────────────────────────────────────

  function attachCounter(ta) {
    if (ta.dataset.fmePostCounter) return;
    ta.dataset.fmePostCounter = '1';

    const counter = document.createElement('div');
    counter.style.cssText =
      'font-size:11px;margin-top:4px;padding:2px 4px;' +
      'border-radius:3px;font-family:sans-serif;text-align:right;';

    function update() {
      const val   = ta.value;
      const chars = val.length;
      const words = val.trim() === '' ? 0 : val.trim().split(/\s+/).length;

      const overLimit = MAX_CHARS > 0 && chars > MAX_CHARS;
      counter.style.color      = overLimit ? '#e74c3c' : '#888';
      counter.style.background = overLimit ? '#fef2f2' : 'transparent';
      counter.textContent = MAX_CHARS > 0
        ? `${chars} / ${MAX_CHARS} caractere · ${words} cuvinte`
        : `${chars} caractere · ${words} cuvinte`;
    }

    update();
    ta.addEventListener('input', update);
    ta.parentNode.insertBefore(counter, ta.nextSibling);
  }

  // Forumotion folosește fie textarea simplă, fie iframe pentru editor rich-text.
  // Atașăm la toate textarea-urile care par a fi editori de postare (> 3 rânduri).
  function hookEditors(root) {
    root.querySelectorAll('textarea').forEach(ta => {
      const rows = parseInt(ta.getAttribute('rows') || '0', 10);
      if (rows > 3 || ta.offsetHeight > 80) attachCounter(ta);
    });
  }

  hookEditors(document);

  const obs = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1) hookEditors(node);
      });
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();
// ─────────────────────────────────────────────────────────────────────────────
