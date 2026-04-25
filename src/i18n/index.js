'use strict';

import ro from './ro.js';
import en from './en.js';
import fr from './fr.js';

export const LANGUAGES = {
  ro: { label: 'Română',  data: ro },
  en: { label: 'English', data: en },
  fr: { label: 'Français',data: fr },
};

export const DEFAULT_LANG = 'en';
const STORAGE_KEY          = 'fme_language';

let _currentLang = DEFAULT_LANG;
let _strings     = en;

export const initLanguage = async () => {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const saved  = result[STORAGE_KEY];
    if (saved && LANGUAGES[saved]) {
      _currentLang = saved;
      _strings     = LANGUAGES[saved].data;
    }
  } catch {
    // storage indisponibil (ex: în content script izolat) — rămânem pe default
  }
};

export const setLanguage = async (lang) => {
  if (!LANGUAGES[lang]) {
    console.warn(`[FME i18n] Limba necunoscută: "${lang}"`);
    return;
  }
  _currentLang = lang;
  _strings     = LANGUAGES[lang].data;

  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: lang });
  } catch {
    
  }
};


export const t = (key, fallbackOrReplace = '', replace = {}) => {
  let fallback     = '';
  let replacements = {};

  if (typeof fallbackOrReplace === 'object' && fallbackOrReplace !== null) {
    replacements = fallbackOrReplace;
    fallback     = key; // fallback implicit = cheia în sine
  } else {
    fallback     = fallbackOrReplace;
    replacements = replace;
  }

  const result = _resolve(key, _strings)
    ?? (DEFAULT_LANG !== _currentLang ? _resolve(key, LANGUAGES[DEFAULT_LANG].data) : null)
    ?? fallback
    ?? key;

  if (result === key && !fallback) {
    console.warn(`[FME i18n] Missing key: "${key}" (lang: ${_currentLang})`);
  }

  if (typeof result === 'string' && Object.keys(replacements).length) {
    return result.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      // Suportă nested: {{user.name}}
      const value = path.split('.').reduce((obj, k) => obj?.[k], replacements);
      return value !== undefined ? value : match;
    });
  }

  return result;
};

// ── Helpers publici ───────────────────────────────────────────────────────────

export const getCurrentLanguage = () => _currentLang;

export const getAvailableLanguages = () =>
  Object.entries(LANGUAGES).map(([code, { label }]) => ({ code, label }));

// ── _resolve — navighează nested object cu dot-notation ──────────────────────

const _resolve = (key, strings) => {
  const result = key.split('.').reduce((obj, part) => obj?.[part], strings);
  return result !== undefined ? result : null;
};