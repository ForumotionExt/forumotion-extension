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
   * Forumotion ACP edit URL pattern:
   *   /admin/?part=themes&sub=templates&mode=edit_{category}&t={numericId}&l={category}&extended_admin=1&tid={tid}
   *
   * Strategy:
   *   1. If templateId is numeric, try direct edit URL.
   *   2. Fetch the category list page and scan table rows for a
   *      name match. Match by templateId key and optional label text.
   *
   * @param {string}      tid        — forum theme ID
   * @param {string}      templateId — template identifier (e.g. "overall_header" or "101")
   * @param {string}      category   — template category (e.g. "main", "post", "mod")
   * @param {string|null} label      — optional display label for matching (e.g. "Antetul forumului")
   * @returns {Promise<string|null>}
   */
  async function findTemplateEditUrl(tid, templateId, category, label) {
    const origin = window.location.origin;
    category = category || 'main';
    const mode = 'edit_' + category;

    // 1. If templateId is numeric, try direct edit URL
    if (/^\d+$/.test(String(templateId))) {
      const directUrl = `${origin}/admin/?part=themes&sub=templates&mode=${mode}&t=${templateId}&l=${encodeURIComponent(category)}&extended_admin=1&tid=${encodeURIComponent(tid)}`;
      try {
        const doc = await fetchPage(directUrl);
        if (doc.querySelector('textarea')) {
          return directUrl;
        }
      } catch (_) {
        // fall through to list-page scan
      }
    }

    // 2. Fetch the template list page for the given category
    const listUrl = `${origin}/admin/?part=themes&sub=templates&mode=${mode}&extended_admin=1&tid=${encodeURIComponent(tid)}`;

    try {
      const doc = await fetchPage(listUrl);

      // Normalise string for comparison: lowercase, remove non-alphanumeric
      const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const normTarget = norm(templateId);

      // Also prepare label-based match (strip [bracketed] suffixes)
      const cleanLabel = label ? label.replace(/\s*\[.*\]\s*$/, '').trim() : '';
      const normLabel  = norm(cleanLabel);

      const rows = Array.from(doc.querySelectorAll('table tr'));
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length === 0) continue;

        // Check all cell text content for a match
        let nameMatch = false;
        for (const cell of cells) {
          const cellNorm = norm(cell.textContent);
          // Exact match by template key
          if (cellNorm === normTarget) { nameMatch = true; break; }
          // Exact match by label
          if (normLabel && cellNorm === normLabel) { nameMatch = true; break; }
          // Contains match (cell text contains the template key)
          if (normTarget.length >= 4 && cellNorm.includes(normTarget)) { nameMatch = true; break; }
        }

        if (nameMatch) {
          // Find edit link in this row — prefer href with &t= or mode=edit_
          const editLink = row.querySelector('a[href*="&t="]') ||
                           row.querySelector('a[href*="mode=edit"]') ||
                           row.querySelector('a[href*="action=edit"]');
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

  // ─── resetTemplate ─────────────────────────────────────────────────────────

  /**
   * Resets a modified template back to default by visiting the delete URL.
   * URL pattern: /admin/?del=1&extended_admin=1&l={category}&main_mode=edit&mode=edit_{category}&part=themes&sub=templates&t={numericId}&tid={tid}
   *
   * Since we may not have the numeric ID, we first find the reset/delete URL
   * by loading the template edit page and extracting the reset link.
   *
   * @param {string}      tid         — forum theme ID
   * @param {string}      templateId  — template identifier
   * @param {string}      category    — template category
   * @param {string|null} label       — optional display label
   * @returns {Promise<boolean>} true if reset succeeded
   */
  async function resetTemplate(tid, templateId, category, label) {
    category = category || 'main';
    const editUrl = await findTemplateEditUrl(tid, templateId, category, label);
    if (!editUrl) return false;

    try {
      const formData = await loadTemplateContent(editUrl);
      if (formData.resetUrl) {
        // Visit the reset/delete URL to restore default template
        const res = await fetch(formData.resetUrl, { credentials: 'include' });
        return res.ok;
      }
    } catch (_) {}

    return false;
  }

  // ─── saveJsPlugin ─────────────────────────────────────────────────────────

  /**
   * Saves a JavaScript plugin/widget via the Forumotion JS management page.
   * URL: /admin/?part=modules&sub=html&mode=js_edit&extended_admin=1&tid={tid}
   *
   * @param {string} tid       — forum theme ID
   * @param {string} jsCode    — the JavaScript code to save
   * @param {string} placement — "all" (all pages), "index", "topics", etc.
   * @param {boolean} enabled  — whether the JS block is active
   * @returns {Promise<boolean>} true if saved successfully
   */
  async function saveJsPlugin(tid, jsCode, placement, enabled) {
    const origin = window.location.origin;
    placement = placement || 'all';
    const editUrl = `${origin}/admin/?part=modules&sub=html&mode=js_edit&extended_admin=1&tid=${encodeURIComponent(tid)}`;

    try {
      const doc = await fetchPage(editUrl);

      // Find the main form
      const form = doc.querySelector('form');
      if (!form) throw new Error('Form not found on JS edit page');

      const formAction = resolveUrl(form.getAttribute('action') || editUrl, editUrl);

      // Collect hidden fields
      const hiddenFields = Array.from(form.querySelectorAll('input[type="hidden"]')).map(inp => ({
        name:  inp.name  || '',
        value: inp.value || '',
      }));

      // Find the textarea for JS code
      const textarea = form.querySelector('textarea');
      if (!textarea) throw new Error('Textarea not found on JS edit page');
      const textareaName = textarea.name || textarea.getAttribute('name') || '';

      // Build POST body
      const params = new URLSearchParams();
      for (const f of hiddenFields) {
        if (f.name) params.append(f.name, f.value || '');
      }
      if (textareaName) params.append(textareaName, jsCode || '');

      // Placement field
      const placementSel = form.querySelector('select[name*="placement"]');
      if (placementSel) {
        params.append(placementSel.name, 'js_placement_' + placement);
      }

      // Disabled field
      const disabledInput = form.querySelector('input[name*="disabled"], select[name*="disabled"]');
      if (disabledInput) {
        params.append(disabledInput.name, enabled ? 'false' : 'true');
      }

      // Mode field
      params.append('mode', 'save');

      // Submit
      const submitBtn = form.querySelector('input[type="submit"]');
      if (submitBtn && submitBtn.name) {
        params.append(submitBtn.name, submitBtn.value || '');
      }

      const res = await fetch(formAction, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:        params.toString(),
        credentials: 'include',
      });

      return res.ok;
    } catch (e) {
      console.warn('[FME ForumAPI] saveJsPlugin error:', e);
      return false;
    }
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

  return { getTid, fetchPage, loadTemplateContent, saveTemplate, findTemplateEditUrl, resetTemplate, saveJsPlugin };
})();
