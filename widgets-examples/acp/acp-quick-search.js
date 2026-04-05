/**
 * Widget: ACP Quick Search Highlight
 * Target:  acp
 *
 * Adaugă un câmp de căutare rapidă în paginile ACP cu tabeluri mari.
 * Filtrează rândurile vizibile pe măsură ce utilizatorul tastează,
 * fără a trimite date la server.
 */

// ── META ─────────────────────────────────────────────────────────────────────
// Name:        ACP Quick Search
// Description: Câmp de filtrare locală a rândurilor din tabeluri ACP
// Target:      acp
// ─────────────────────────────────────────────────────────────────────────────

// CODE ────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  // Inserează un câmp de search deasupra fiecărui tabel cu > 5 rânduri
  function attachSearch(table) {
    if (table.dataset.fmeSearch) return;
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    if (rows.length < 6) return;
    table.dataset.fmeSearch = '1';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:6px;';

    const input = document.createElement('input');
    input.type        = 'search';
    input.placeholder = '🔍 Filtrare rapidă...';
    input.style.cssText =
      'width:260px;padding:4px 8px;font-size:12px;border:1px solid #ccc;border-radius:3px;';

    const counter = document.createElement('span');
    counter.style.cssText =
      'margin-left:10px;font-size:11px;color:#888;font-family:sans-serif;';

    wrap.appendChild(input);
    wrap.appendChild(counter);
    table.parentNode.insertBefore(wrap, table);

    function filter() {
      const term = input.value.toLowerCase().trim();
      let visible = 0;
      rows.forEach(row => {
        const match = !term || row.textContent.toLowerCase().includes(term);
        row.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      counter.textContent = term
        ? `${visible} / ${rows.length} rânduri`
        : '';
    }

    input.addEventListener('input', filter);
  }

  function hookTables() {
    document.querySelectorAll('table').forEach(attachSearch);
  }

  hookTables();

  const obs = new MutationObserver(hookTables);
  obs.observe(document.body, { childList: true, subtree: true });
})();
// ─────────────────────────────────────────────────────────────────────────────
