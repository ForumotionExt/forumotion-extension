/**
 * Widget: ACP Confirm Dangerous Actions
 * Target:  acp
 *
 * Interceptează submit-ul formularelor care conțin cuvinte-cheie periculoase
 * (delete, purge, ban, reset etc.) și cere confirmare înainte de trimitere.
 * Util pentru a evita ștergeri accidentale în ACP.
 */

// ── META ─────────────────────────────────────────────────────────────────────
// Name:        ACP Confirm Dangerous Actions
// Description: Cere confirmare înainte de submit-urile cu acțiuni periculoase
// Target:      acp
// ─────────────────────────────────────────────────────────────────────────────

// CODE ────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  // Cuvinte-cheie pe buton sau în acțiunea formularului care cer confirmare
  const DANGER_PATTERNS = [
    /\bdelete\b/i,
    /\bpurge\b/i,
    /\bban\b/i,
    /\breset\b/i,
    /\btruncate\b/i,
    /\bsterge\b/i,
    /\bsupprime\b/i,
    /\belimina\b/i,
  ];

  function isDangerous(text) {
    return DANGER_PATTERNS.some(p => p.test(text));
  }

  function hookForm(form) {
    if (form.dataset.fmeHooked) return;
    form.dataset.fmeHooked = '1';

    form.addEventListener('submit', e => {
      const action  = form.getAttribute('action') || '';
      const btnText = document.activeElement
        ? (document.activeElement.value || document.activeElement.textContent || '')
        : '';

      if (isDangerous(action) || isDangerous(btnText)) {
        const ok = confirm(
          '⚠️ FME — Acțiune periculoasă detectată!\n\n' +
          'Ești sigur că vrei să continui?\n\n' +
          'Acțiune: ' + (btnText.trim() || action)
        );
        if (!ok) e.preventDefault();
      }
    }, true);
  }

  document.querySelectorAll('form').forEach(hookForm);

  const obs = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'FORM') hookForm(node);
        node.querySelectorAll?.('form').forEach(hookForm);
      });
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();
// ─────────────────────────────────────────────────────────────────────────────
