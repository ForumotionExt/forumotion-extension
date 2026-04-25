'use strict';

// ─── Domenii suportate ────────────────────────────────────────────────────────
// Sursa unică pentru toate verificările de domeniu și pattern-urile manifest.
// NOTĂ: manifest.json trebuie actualizat manual dacă se adaugă domenii noi.

export const DOMAINS = [
  'forumgratuit.ro',
  'forumotion.com',
  'forumotion.net',
  'forumotion.eu',
  'forum.st',
  'forumz.ro',
];

export const DOMAIN_PATTERNS = {
  admin: DOMAINS.map(d => `*://*.${d}/admin*`),
  all:   DOMAINS.map(d => `*://*.${d}/*`),
};

// ─── GitHub ───────────────────────────────────────────────────────────────────

export const GITHUB = {
  API_BASE:         'https://api.github.com',
  RAW_BASE:         'https://raw.githubusercontent.com',
  OWNER:            'ForumotionExt',
  REPO:             'forumotion-extension',
  MARKETPLACE_REPO: 'marketplace',
  BRANCH:           'main',
};

const _raw  = `${GITHUB.RAW_BASE}/${GITHUB.OWNER}`;
const _repo = `${_raw}/${GITHUB.REPO}/refs/heads/${GITHUB.BRANCH}`;
const _mkt  = `${_raw}/${GITHUB.MARKETPLACE_REPO}/refs/heads/${GITHUB.BRANCH}`;

export const GITHUB_URLS = {
  MARKETPLACE_BASE:  _mkt,
  MARKETPLACE_INDEX: `${_mkt}/index.json`,
  EXT_MANIFEST:      `${_repo}/manifest.json`,
};

// ─── Cache TTL ────────────────────────────────────────────────────────────────
// Toate valorile sunt în milisecunde, cu excepția UPDATE_CHECK_SEC.

export const CACHE_TTL = {
  MARKETPLACE:      60 * 60 * 1000,  // 1h  — index marketplace
  EXT_MANIFEST:     60 * 60 * 1000,  // 1h  — version.json / manifest.json extensie
  GITHUB_FILE:      10 * 60 * 1000,  // 10m — fișiere raw din repo
  GITHUB_RELEASE:    5 * 60 * 1000,  // 5m  — latest release via API
  MEM_SHORT:         5 * 60 * 1000,  // 5m  — layer memory din SWCache
  SW_DEFAULT:        3600_000,        // 1h  — fallback SWCache.fetchWithCache
  SW_MEM_DEFAULT:      300_000,       // 5m  — fallback memTtl SWCache
  UPDATE_CHECK_SEC:       3600,       // 1h  — interval în secunde (settings UI)
};

// ─── Limite și timeout-uri ────────────────────────────────────────────────────

export const LIMITS = {
  AUDIT_LOG_MAX:       500,    // intrări maxime păstrate în audit log
  AUDIT_RECENT_DAYS:     7,    // zile considerate "recente" în UI
  FETCH_TIMEOUT_MS:  10_000,   // timeout fetch plugin din marketplace
  BRIDGE_TIMEOUT_MS:  5_000,   // timeout bridge content ↔ page world
  RUNTIME_SEND_MS:    5_000,   // timeout Utils.Runtime.send
  WAITFOR_TIMEOUT_MS: 10_000,  // timeout Utils.DOM.waitFor
};

// ─── Limite resurse ───────────────────────────────────────────────────────────

export const RESOURCE_LIMITS = {
  PLUGINS_ACP:    5,   // plugin-uri active simultan în contextul ACP
  PLUGINS_FORUM: 10,   // plugin-uri active simultan în contextul forum
  ACP_THEMES:    10,   // teme salvate în Theme Builder
  ACP_WIDGETS:   10,   // widget-uri configurate în ACP Widgets
};
