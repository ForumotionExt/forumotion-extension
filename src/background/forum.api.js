'use strict';

/**
 * @file forum.api.js
 * @description Client HTTP pentru panoul de administrare Forumotion.
 * Rulează exclusiv în context de content script (are acces la DOM și cookies).
 */
class ForumotionAPI {

  // ─── URL builders ─────────────────────────────────────────────────────────

  #url = {
    template: {
      get    : (id, cat) => `/admin/?part=themes&sub=templates&mode=edit_main&t=${id}&l=${cat}&extended_admin=1&tid=${this.#tid()}`,
      save   : ()        => `/admin/?part=themes&sub=templates&mode=edit_main&extended_admin=1&tid=${this.#tid()}`,
      delete : (id, cat) => `/admin/?del=1&extended_admin=1&l=${cat}&main_mode=edit&mode=edit_main&part=themes&sub=templates&t=${id}&tid=${this.#tid()}&_tc=${this.#ts()}`,
      publish: (id, cat) => `/admin/?part=themes&sub=templates&mode=edit_main&main_mode=edit&extended_admin=1&_t=${this.#ts()}&t=${id}&l=${cat}&pub=1&tid=${this.#tid()}`,
    },

    engine: {
      page: () => `/admin/?part=themes&sub=styles&mode=version&extended_admin=1&tid=${this.#tid()}&_t=${this.#ts()}`,
    },

    css: {
      get        : () => `/admin/?mode=css&part=themes&sub=logos&tid=${this.#tid()}&_tc=${this.#ts()}`,
      save       : () => `/admin/?part=themes&sub=logos&mode=css&extended_admin=1&tid=${this.#tid()}&_t=${this.#ts()}`,
      options    : () => `/admin/?part=themes&sub=logos&mode=css&extended_admin=1&tid=${this.#tid()}&_t=${this.#ts()}`,
      saveOptions: () => `/admin/?part=themes&sub=logos&mode=css&extended_admin=1&tid=${this.#tid()}&_t=${this.#ts()}`,
    },
  };

  #engineList = [
    { value: 'subsilver', label: 'phpBB2'    },
    { value: 'prosilver', label: 'phpBB3'    },
    { value: 'punbb',     label: 'PunBB'     },
    { value: 'invision',  label: 'Invision'  },
    { value: 'modernbb',  label: 'ModernBB'  },
    { value: 'awesomebb', label: 'AwesomeBB' },
  ];

  #cssProps = {
    content        : 'edit_code',
    allow_css_perso: 'allow_css_perso',
    css_base       : 'css_base',
    optimize_css   : 'optimize_css',
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Unix timestamp curent (pentru cache-busting) */
  #ts() { return Math.floor(Date.now() / 1000); }

  /**
   * Extrage TID-ul din URL sau din primul link care îl conține.
   * @returns {string|null}
   */
  #tid() {
    // 1. URL curent
    const fromUrl = new URLSearchParams(window.location.search).get('tid');
    if (fromUrl) return fromUrl;

    // 2. Primul <a href> cu tid=
    const link = document.querySelector('a[href*="tid="]');
    if (link) {
      const fromLink = new URLSearchParams(link.getAttribute('href').split('?')[1]).get('tid');
      if (fromLink) return fromLink;
    }

    return null;
  }

  async #fetch(url, options = {}) {
    const response = await fetch(url, { credentials: 'include', ...options });

    if (!response.ok) {
      throw new Error(`[ForumAPI] ${response.status} ${response.statusText} — ${url}`);
    }

    return response;
  }

  async #fetchDoc(url) {
    const html = await this.#fetch(url).then(r => r.text());
    return new DOMParser().parseFromString(html, 'text/html');
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  async loadTemplate(templateId, category) {
    const doc      = await this.#fetchDoc(this.#url.template.get(templateId, category));
    const textarea = doc.querySelector('textarea[name="template"]');

    if (!textarea) throw new Error(`[ForumAPI] Template content not found (id=${templateId}, cat=${category})`);
    return textarea.value;
  }

  async saveTemplate(content) {
    return this.#fetch(this.#url.template.save(), {
      method : 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body   : new URLSearchParams({ template: content, submit: 'Save' }),
    });
  }

  async deleteTemplate(templateId, category) {
    return this.#fetch(this.#url.template.delete(templateId, category), { method: 'POST' });
  }

  async publishTemplate(templateId, category) {
    return this.#fetch(this.#url.template.publish(templateId, category), { method: 'POST' });
  }

  // ─── Engine ───────────────────────────────────────────────────────────────

  async getEngine() {
    const doc = await this.#fetchDoc(this.#url.engine.page());

    return this.#engineList.find(e =>
      doc.querySelector(`input[name="tpl"][value="${e.value}"]`)?.checked
    ) ?? null;
  }

  async setEngine(engineValue) {
    const engine = this.#engineList.find(e => e.value === engineValue);
    if (!engine) throw new Error(`[ForumAPI] Unknown engine: "${engineValue}"`);

    const body = new FormData();
    body.append('tpl', engine.value);
    body.append('form_version', '');
    body.append('change_version', 'Save');

    return this.#fetch(this.#url.engine.page(), { method: 'POST', body });
  }

  // ─── CSS ──────────────────────────────────────────────────────────────────

  async loadCSS() {
    const doc = await this.#fetchDoc(this.#url.css.get());
    return doc.querySelector(`textarea[name="${this.#cssProps.content}"]`)?.value ?? null;
  }

  async saveCSS(content) {
    return this.#fetch(this.#url.css.save(), {
      method : 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body   : new URLSearchParams({ [this.#cssProps.content]: content, submit: 'Save' }),
    });
  }

  async loadCSSOptions() {
    const doc = await this.#fetchDoc(this.#url.css.options());

    return {
      allowPersonal: doc.querySelector(`input[name="${this.#cssProps.allow_css_perso}"]`)?.checked ?? false,
      cssBase      : doc.querySelector(`select[name="${this.#cssProps.css_base}"]`)?.value ?? null,
      optimizeCSS  : doc.querySelector(`input[name="${this.#cssProps.optimize_css}"]`)?.checked ?? false,
    };
  }

  async saveCSSOptions({ allowPersonal, cssBase, optimizeCSS }) {
    return this.#fetch(this.#url.css.saveOptions(), {
      method : 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body   : new URLSearchParams({
        [this.#cssProps.allow_css_perso]: allowPersonal ? '1' : '0',
        [this.#cssProps.css_base]       : cssBase ?? '',
        [this.#cssProps.optimize_css]   : optimizeCSS ? '1' : '0',
      }),
    });
  }
}

export default ForumotionAPI;