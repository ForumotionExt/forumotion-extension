/**
 * FME Forum API — v1.2.0
 * Direct-fetch helpers for reading and writing Forumotion admin templates.
 * No dependencies on other FME modules — uses only window.location, fetch, DOMParser.
 */

var FMEForumAPI = (() => {
  'use strict';

  // ─── getTid ────────────────────────────────────────────────────────────────

  /**
   * Extracts the Forumotion theme ID (tid) from the current page.
   * Tries three sources in order:
   *   1. ?tid= / &tid= in the current URL's query string
   *   2. First <a> on the page whose href contains tid=
   *   3. _tc= param in the current URL's query string
   * @returns {string|null}
   */
  function getTid() {
    // 1. Current URL query string
    const m = window.location.search.match(/[?&]tid=([a-f0-9]+)/i);
    if (m) return m[1];

    // 2. First link on the page with tid= in href
    const a = document.querySelector('a[href*="tid="]');
    if (a) {
      const lm = a.getAttribute('href').match(/[?&]tid=([a-f0-9]+)/i);
      if (lm) return lm[1];
    }

    // 3. _tc= fallback
    const tc = window.location.search.match(/[?&]_tc=([a-f0-9]+)/i);
    if (tc) return tc[1];

    return null;
  }

  // ─── fetchPage ─────────────────────────────────────────────────────────────

  /**
   * Fetches a URL with credentials and parses the response as an HTML document.
   * @param {string} url
   * @returns {Promise<Document>}
   * @throws {Error} on non-OK HTTP status
   */
  async function fetchPage(url) {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const html = await res.text();
    return new DOMParser().parseFromString(html, 'text/html');
  }

  // ─── loadTemplateContent ───────────────────────────────────────────────────

  /**
   * Fetches a template edit page and extracts the form data needed to save it.
   *
   * Returns:
   *   content       — current textarea content
   *   formAction    — absolute URL for form POST
   *   hiddenFields  — Array<{ name, value }> of all hidden inputs in the form
   *   textareaName  — name attribute of the main textarea
   *   resetUrl      — href of reset/delete link (or null)
   *   submitField   — { name, value } of the submit button (or null)
   *
   * @param {string} editUrl
   * @returns {Promise<object>}
   */
  async function loadTemplateContent(editUrl) {
    const doc = await fetchPage(editUrl);

    // Find largest textarea (first by rows attr, then by content length)
    const textareas = Array.from(doc.querySelectorAll('textarea'));
    if (textareas.length === 0) throw new Error('Nu s-a gasit niciun textarea pe pagina de editare.');

    let bestTextarea = textareas[0];
    let bestScore = -1;
    for (const ta of textareas) {
      const rows = parseInt(ta.getAttribute('rows') || '0', 10);
      const len  = (ta.textContent || '').length;
      // Primary sort: rows desc; secondary: content length desc
      const score = rows * 100000 + len;
      if (score > bestScore) {
        bestScore = score;
        bestTextarea = ta;
      }
    }

    const content      = bestTextarea.value || bestTextarea.textContent || '';
    const textareaName = bestTextarea.name || bestTextarea.getAttribute('name') || '';

    // Find the parent form
    let form = bestTextarea.closest('form');
    if (!form) {
      // Fallback: first form on the page that contains a textarea
      form = doc.querySelector('form');
    }
    if (!form) throw new Error('Nu s-a gasit formularul de editare.');

    // Resolve form action to absolute URL
    const rawAction  = form.getAttribute('action') || editUrl;
    const formAction = resolveUrl(rawAction, editUrl);

    // Collect all hidden inputs
    const hiddenFields = Array.from(form.querySelectorAll('input[type="hidden"]')).map(inp => ({
      name:  inp.name  || inp.getAttribute('name')  || '',
      value: inp.value || inp.getAttribute('value') || '',
    }));

    // Find reset / delete link
    const resetPatterns = /reset|delete|sterge|implicit|restore|default/i;
    const allLinks = Array.from(form.querySelectorAll('a[href]'));
    let resetUrl = null;
    for (const link of allLinks) {
      const href = link.getAttribute('href') || '';
      const text = (link.textContent || '').trim();
      if (resetPatterns.test(href) || resetPatterns.test(text)) {
        resetUrl = resolveUrl(href, editUrl);
        break;
      }
    }

    // Find submit button (prefer input[type=submit][name] then button[name])
    let submitField = null;
    const submitInput = form.querySelector('input[type="submit"][name]');
    if (submitInput) {
      submitField = {
        name:  submitInput.name  || submitInput.getAttribute('name')  || '',
        value: submitInput.value || submitInput.getAttribute('value') || '',
      };
    } else {
      const submitBtn = form.querySelector('button[name]');
      if (submitBtn) {
        submitField = {
          name:  submitBtn.name  || submitBtn.getAttribute('name')  || '',
          value: submitBtn.value || submitBtn.getAttribute('value') || '',
        };
      }
    }

    return { content, formAction, hiddenFields, textareaName, resetUrl, submitField };
  }

  // ─── saveTemplate ──────────────────────────────────────────────────────────

  /**
   * POSTs new template content to the Forumotion admin form.
   * @param {string}   formAction    — absolute URL
   * @param {Array}    hiddenFields  — Array<{ name, value }>
   * @param {string}   textareaName  — name of the textarea field
   * @param {string}   newContent    — new content to save
   * @param {object|null} submitField — { name, value } or null
   * @throws {Error} on non-OK HTTP status
   */
  async function saveTemplate(formAction, hiddenFields, textareaName, newContent, submitField) {
    const params = new URLSearchParams();
    for (const f of hiddenFields) {
      if (f.name) params.append(f.name, f.value || '');
    }
    if (textareaName) params.append(textareaName, newContent || '');
    if (submitField && submitField.name) {
      params.append(submitField.name, submitField.value || '');
    }

    const res = await fetch(formAction, {
      method:      'POST',
      headers:     { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:        params.toString(),
      credentials: 'include',
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} saving template to ${formAction}`);
  }

  // ─── findTemplateEditUrl ───────────────────────────────────────────────────

  /**
   * Locates the edit URL for a specific template on the current forum.
   *
   * Strategy:
   *   1. Try a direct edit URL using the template ID.
   *   2. Verify the page has a textarea (i.e., it is an actual edit page).
   *   3. If not, fetch the category list page and scan table rows for a
   *      name match, then return the edit link href.
   *
   * @param {string}      tid        — forum theme ID
   * @param {string}      templateId — template identifier (e.g. "header")
   * @param {string|null} category   — template category / mode (e.g. "main")
   * @returns {Promise<string|null>}
   */
  async function findTemplateEditUrl(tid, templateId, category) {
    const origin = window.location.origin;

    // 1. Direct edit URL attempt
    const directUrl = `${origin}/admin/?part=themes&sub=templates&action=edit&id=${encodeURIComponent(templateId)}&extended_admin=1&tid=${encodeURIComponent(tid)}`;

    try {
      const doc = await fetchPage(directUrl);
      if (doc.querySelector('textarea')) {
        return directUrl;
      }
    } catch (_) {
      // fall through to list-page scan
    }

    // 2. Fetch the template list page for the given category
    const listUrl = `${origin}/admin/?part=themes&sub=templates&mode=${encodeURIComponent(category || 'main')}&extended_admin=1&tid=${encodeURIComponent(tid)}`;

    try {
      const doc = await fetchPage(listUrl);

      // Normalise string for comparison: lowercase, remove non-alphanumeric
      const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const normTarget = norm(templateId);

      const rows = Array.from(doc.querySelectorAll('table tr'));
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length === 0) continue;

        // Check all cell text content for a name match
        let nameMatch = false;
        for (const cell of cells) {
          if (norm(cell.textContent) === normTarget) {
            nameMatch = true;
            break;
          }
        }

        if (nameMatch) {
          // Find edit link in this row
          const editLink = row.querySelector('a[href*="action=edit"]');
          if (editLink) {
            return resolveUrl(editLink.getAttribute('href'), listUrl);
          }
        }
      }
    } catch (_) {
      // fall through
    }

    return null;
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Resolves a potentially relative URL against a base URL.
   * @param {string} href
   * @param {string} base
   * @returns {string}
   */
  function resolveUrl(href, base) {
    try {
      return new URL(href, base).href;
    } catch (_) {
      return href;
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  return { getTid, fetchPage, loadTemplateContent, saveTemplate, findTemplateEditUrl };
})();
