'use strict';

// ─── DOM ─────────────────────────────────────────────────────────────────────

const DOM = {
  /**
   * querySelector cu fallback array de selectori
   * @param {string[]} selectors
   * @param {Document|Element} ctx
   * @returns {Element|null}
   */
  find(selectors, ctx = document) {
    if (typeof selectors === 'string') return ctx.querySelector(selectors);
    for (const sel of selectors) {
      const el = ctx.querySelector(sel);
      if (el) return el;
    }
    return null;
  },

  fieldset(label, attr = {}, content) {
    const el = document.createElement('fieldset');

    for (const [k, v] of Object.entries(attr)) {
      if (k === 'class' || k === 'className') el.className = v;
      if(k === 'icon') label = `<span>${attr.icon}&nbsp;${label}</span>`;
      else el.setAttribute(k, v);
    }

    el.innerHTML = `
      <legend>${label}</legend>
      ${content}
    `;

    return el.outerHTML;
  },

  /**
   * Creează un element cu atribute și conținut
   * @param {string} tag
   * @param {Object} attrs
   * @param {string|Node|Node[]} content
   * @returns {Element}
   */
  create(tag, attrs = {}, content = '') {
    const el = document.createElement(tag);

    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined) continue;

      switch (k) {
        case 'class':
        case 'className':
          el.className = v;
          break;

        case 'style':
          // style: { color: 'red', marginTop: '1em' }
          typeof v === 'object'
            ? Object.assign(el.style, v)
            : el.setAttribute('style', v);
          break;

        case 'dataset':
          // dataset: { id: 1, foo: 'bar' } → data-id="1" data-foo="bar"
          Object.entries(v).forEach(([dk, dv]) => el.dataset[dk] = dv);
          break;

        default:
          // on* → event listeners: onClick → click
          if (k.startsWith('on') && typeof v === 'function') {
            el.addEventListener(k.slice(2).toLowerCase(), v);
          }
          // boolean attributes: disabled, checked, readonly...
          else if (typeof v === 'boolean') {
            v ? el.setAttribute(k, '') : el.removeAttribute(k);
          }
          else {
            el.setAttribute(k, v);
          }
      }
    }

    // Suportă string HTML, Node singur, sau array de Nodes
    if (typeof content === 'string') {
      el.innerHTML = content;
    } else if (content instanceof Node) {
      el.appendChild(content);
    } else if (Array.isArray(content)) {
      content.forEach(child => child instanceof Node
        ? el.appendChild(child)
        : el.insertAdjacentHTML('beforeend', child)
      );
    }

    return el;
  },

  createFragment(tag, attrs = {}, content = '') {
    return this.create(tag, attrs, content).outerHTML;
  },

  skeleton(label) {
    return `<p style="text-align:center;padding:16px;color:#bbb;">
      <i class="fa fa-spinner fa-spin"></i>&nbsp;${label}
    </p>`;
  },

  normalizeItem(item) {
    return {
      ...item,

      updated:   item.updatedAt ?? item.updated ?? null,

      downloads: item.downloads  ?? 0,
      stars:     item.stars      ?? 0,
      paid:      item.paid       ?? false,

      // State local — vine din storage, nu din API
      installed: false,
      hasUpdate: false,
      changelog: '',
    };
  },

  /**
   * Injectează CSS într-un <style>W tag cu ID unic
   * Re-injectează dacă tag-ul a fost scos din DOM
   * @param {string} id
   * @param {string} css
   */
  injectCSS(id, css) {
    let tag = document.getElementById(id);
    if (!tag) {
      tag = document.createElement('style');
      tag.id = id;
      document.head.appendChild(tag);
    }
    tag.textContent = css;
  },

  /**
   * Inserează un element înainte de un alt element
   * @param {string|Element} target  — selector sau element
   * @param {Element} newEl
   */
  insertBefore(target, newEl) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    el?.parentNode?.insertBefore(newEl, el);
  },

  /**
   * Inserează un element după un alt element
   * @param {string|Element} target
   * @param {Element} newEl
   */
  insertAfter(target, newEl) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    el?.parentNode?.insertBefore(newEl, el.nextSibling);
  },

  /**
   * Golește un element și opțional îl înlocuiește cu HTML nou
   * @param {Element} el
   * @param {string} html
   */
  clear(el, html = '') {
    el.innerHTML = html;
  },

  /**
   * Observă mutații pe un element
   * @param {Element} target
   * @param {MutationCallback} callback
   * @param {MutationObserverInit} options
   * @returns {MutationObserver}
   */
  observe(target, callback, options = { childList: true, subtree: true }) {
    const obs = new MutationObserver(callback);
    obs.observe(target, options);
    return obs;
  },

  waitFor(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const el = this.find(selector);
      if (el) return resolve(el);

      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element not found: ${selector}`));
      }, timeout);

      const observer = new MutationObserver(() => {
        const el = this.find(selector);
        if (el) {
          clearTimeout(timer);
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
};

const UrlUtils = {
  param(key, url = window.location.search) {
    return new URLSearchParams(url).get(key);
  },
  
  origin() {
    return window.location.origin;
  },

  matches(pattern) {
    return pattern instanceof RegExp
      ? pattern.test(window.location.href)
      : window.location.href.includes(pattern);
  },
};

const Runtime = {
  async send(type, payload = {}, { timeout = 5000 } = {}) {
    const message = { type, payload };
    const request = chrome.runtime.sendMessage(message);
    const timer = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('SW timeout')), timeout)
    );

    let res;
    try {
      res = await Promise.race([request, timer]);
    } catch (err) {
      throw new Error(`Runtime error: ${err.message}`);
    }

    if (!res?.ok) {
      throw new Error(res?.error || 'Unknown SW error');
    }

    return res.data ?? res.content ?? null;
  },
};

const Storage = {

  /**
   * chrome.storage.local — get
   * @param {string|string[]} keys
   * @returns {Promise<Object>}
   */
  async get(keys) {
    return chrome.storage.local.get(keys);
  },

  /**
   * chrome.storage.local — set
   * @param {Object} data
   * @returns {Promise<void>}
   */
  async set(data) {
    return chrome.storage.local.set(data);
  },

  /**
   * chrome.storage.local — remove
   * @param {string|string[]} keys
   * @returns {Promise<void>}
   */
  async remove(keys) {
    return chrome.storage.local.remove(keys);
  },

  /**
   * localStorage — get cu JSON parse automat
   * @param {string} key
   * @param {*} fallback
   * @returns {*}
   */
  local(key, fallback = null) {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  },

  /**
   * localStorage — set cu JSON stringify automat
   * @param {string} key
   * @param {*} value
   */
  localSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error('[FME] localStorage set error:', err);
    }
  },

  /**
   * localStorage — remove
   * @param {string} key
   */
  localRemove(key) {
    localStorage.removeItem(key);
  },
};

// ─── String ───────────────────────────────────────────────────────────────────

const Str = {
  /**
   * Trunchiază un string la lungimea dată
   * @param {string} str
   * @param {number} max
   * @param {string} suffix
   * @returns {string}
   */
  truncate(str, max = 100, suffix = '…') {
    return str.length > max ? str.slice(0, max) + suffix : str;
  },

  /**
   * Escape HTML — previne XSS la innerHTML
   * @param {string} str
   * @returns {string}
   */
  escapeHTML(str) {
    return str
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#039;');
  },

  /**
   * Formatează o dată ISO în format lizibil
   * @param {string} iso
   * @returns {string}
   */
  formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('ro-RO', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch {
      return iso;
    }
  },

  ucFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  ucWords(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, c => c.toUpperCase());
  },

  generateChangelogMD(data) {
    const repo = "https://github.com/ForumotionExt/forumotion-extension";

    let md = `# Changelog

  [![Version](https://img.shields.io/github/v/release/ForumotionExt/forumotion-extension)](${repo}/releases)
  [![Downloads](https://img.shields.io/github/downloads/ForumotionExt/forumotion-extension/total)](${repo}/releases)
  [![License](https://img.shields.io/github/license/ForumotionExt/forumotion-extension)](${repo}/blob/main/LICENSE)

  All notable changes to this project will be documented in this file.

  The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)  
  and this project adheres to [Semantic Versioning](https://semver.org/).

  ---

  ## [Unreleased]

  ### Added
  - _Nothing yet_

  ### Changed
  - _Nothing yet_

  ### Fixed
  - _Nothing yet_

  ---

  `;

    const sectionsMap = {
      feature: "Added",
      bugfix: "Fixed",
      other: "Changed"
    };

    // Sort versions DESC (latest first)
    const versions = [...data.changelog].sort((a, b) =>
      b.version.localeCompare(a.version, undefined, { numeric: true })
    );

    versions.forEach((version, index) => {
      md += `## [${version.version}] - ${version.date}\n`;

      if (index === 0 && data.releaseUrl) {
        md += `[Release](${data.releaseUrl})\n`;
      }

      md += `\n`;

      const grouped = {
        Added: [],
        Changed: [],
        Fixed: []
      };

      version.notes.forEach(note => {
        const section = sectionsMap[note.type] || "Changed";
        grouped[section].push(note.text);
      });

      Object.entries(grouped).forEach(([section, items]) => {
        if (items.length) {
          md += `### ${section}\n`;
          items.forEach(item => {
            md += `- ${item}\n`;
          });
          md += `\n`;
        }
      });

      md += `---\n\n`;
    });

    // 🔗 Version links
    md += `## Version Links\n\n`;

    const latestVersion = versions[0]?.version;

    md += `[Unreleased]: ${repo}/compare/v${latestVersion}...HEAD  \n`;

    versions.forEach((version, index) => {
      if (index < versions.length - 1) {
        const next = versions[index + 1];
        md += `[${version.version}]: ${repo}/compare/v${next.version}...v${version.version}  \n`;
      } else {
        md += `[${version.version}]: ${repo}/releases/tag/v${version.version}  \n`;
      }
    });

    return md;
  }
};

// ─── Misc ─────────────────────────────────────────────────────────────────────

const Misc = {

  /**
   * Debounce
   * @param {Function} fn
   * @param {number} delay
   * @returns {Function}
   */
  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  /**
   * Sleep
   * @param {number} ms
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Generează un ID unic simplu
   * @param {string} prefix
   * @returns {string}
   */
  uid(prefix = 'fme') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  },
};

// ─── Toast ────────────────────────────────────────────────────────────────────

const Toast = (() => {
  let _container = null;

  const _css = `
    #fme-toast-container { position:fixed; top:16px; right:16px; z-index:999999;
      display:flex; flex-direction:column; gap:8px; pointer-events:none; }
    #fme-toast-container > .fme-toast { pointer-events:auto; min-width:200px;
      max-width:360px; padding:8px 14px; border-radius:3px;
      box-shadow:0 2px 8px rgba(0,0,0,.25); font-size:.88em;
      transition:opacity .3s; opacity:1; }
  `;

  function _getContainer() {
    if (_container && document.body.contains(_container)) return _container;

    const style = document.getElementById('fme-toast-css');
    if (!style) {
      const s = document.createElement('style');
      s.id = 'fme-toast-css';
      s.textContent = _css;
      document.head.appendChild(s);
    }

    _container = document.createElement('div');
    _container.id = 'fme-toast-container';
    document.body.appendChild(_container);
    return _container;
  }

  function _show(message, cls, duration = 3000) {
    const el = document.createElement('div');
    el.className = `fme-toast ${cls}`;
    el.textContent = message;
    _getContainer().appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 320);
    }, duration);
  }

  return {
    success : (msg, ms) => _show(msg, 'successbox', ms),
    error   : (msg, ms) => _show(msg, 'errorbox',   ms),
    info    : (msg, ms) => _show(msg, 'messagebox', ms),
    warning : (msg, ms) => _show(msg, 'messagebox', ms),
  };
})();

// ─── Export ───────────────────────────────────────────────────────────────────

const GitHubMD = (() => {
  const escapeHtml = (str) =>
    str.replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;");

  const renderCodeBlocks = (md) =>
    md.replace(/```([\s\S]*?)```/g, (_, code) =>
      `<pre class="gh-code"><code>${escapeHtml(code)}</code></pre>`
    );

  const renderBadges = (md) =>
    md.replace(
      /!\[(.*?)\]\((https:\/\/img\.shields\.io\/.*?)\)/g,
      `<img class="gh-badge" alt="$1" src="$2" />`
    );

  const renderHeadings = (md) =>
    md
      .replace(/^### (.*)$/gm, "<h3>$1</h3>")
      .replace(/^## (.*)$/gm, "<h2>$1</h2>")
      .replace(/^# (.*)$/gm, "<h1>$1</h1>");

  const renderInline = (md) =>
    md
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.*?)`/g, "<code class='gh-inline'>$1</code>");

  const renderLinks = (md) =>
    md.replace(
      /\[(.*?)\]\((.*?)\)/g,
      `<a href="$2" target="_blank" class="gh-link">$1</a>`
    );

  // 🔥 FIX IMPORTANT: lists grouped correctly
  const renderLists = (md) => {
    return md.replace(/(^|\n)(- .*(\n- .*)*)/g, (match) => {
      const items = match
        .split("\n")
        .filter(l => l.startsWith("- "))
        .map(l => `<li>${l.replace("- ", "")}</li>`)
        .join("");

      return `<ul>${items}</ul>`;
    });
  };

  const cleanParagraphs = (html) => {
    // 🔥 CRITICAL FIX: DO NOT wrap block elements in <p>
    return html
      .replace(/<p>\s*(<(h[1-6]|ul|ol|pre|table)[\s\S]*?>)\s*<\/p>/g, "$1")
      .replace(/<p><\/p>/g, "");
  };

  const parse = (md) => {
    let html = md;

    html = escapeHtml(html);
    html = renderCodeBlocks(html);
    html = renderBadges(html);
    html = renderHeadings(html);
    html = renderLists(html);
    html = renderLinks(html);
    html = renderInline(html);

    // NO paragraph wrapping anymore (important fix)
    html = html.replace(/\n/g, "<br>");

    html = cleanParagraphs(html);

    return html;
  };

  return { parse };
})();

const parseVersion = (v) => {
  // Separă "1.45.3 RC1" → { parts: [1, 45, 3], pre: 1 }
  // Fără sufix pre = Infinity (release stabil e întotdeauna mai mare)
  const [semver, ...rest] = v.trim().split(' ');
  const parts = semver.split('.').map(Number);
  const pre   = rest.length ? parseFloat(rest[0].replace(/[^0-9]/g, '')) : Infinity;
  return { parts, pre };
};

const isNewer = (a, b) => {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  const len = Math.max(va.parts.length, vb.parts.length);

  for (let i = 0; i < len; i++) {
    const diff = (va.parts[i] ?? 0) - (vb.parts[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }

  // Versiunile numerice sunt egale — compară pre-release
  // Infinity (stable) > orice număr RC
  return va.pre > vb.pre;
};
export { isNewer };
export default { DOM, UrlUtils, Runtime, Storage, Str, Misc, GitHubMD, Toast };