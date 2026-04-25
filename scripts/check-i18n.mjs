/**
 * i18n key audit script
 * Usage: node scripts/check-i18n.mjs
 *
 * Scans all JS source files for t('key') / t("key") calls,
 * then checks which keys are missing from en.js, ro.js, fr.js.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { pathToFileURL } from 'url';

// ── 1. Load language files ────────────────────────────────────────────────────

const ROOT     = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const I18N_DIR = join(ROOT, 'src', 'i18n');

const LANGS = ['en', 'ro', 'fr'];

async function loadLang(lang) {
  const filePath = join(I18N_DIR, `${lang}.js`);
  // Strip `export default` so we can eval it as plain JS object
  let src = readFileSync(filePath, 'utf8');
  src = src.replace(/^export\s+default\s+/, '');
  // Remove trailing semicolon if present
  src = src.trimEnd().replace(/;$/, '');
  // Use Function constructor to evaluate
  return Function(`"use strict"; return (${src})`)();
}

// Flatten nested object to dot-notation keys: { 'audit.type': 'Type', ... }
function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

// ── 2. Scan source files for t('...') calls ────────────────────────────────

function walkDir(dir, exts = ['.js']) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkDir(full, exts));
    } else if (exts.some(e => full.endsWith(e))) {
      // Skip i18n files themselves
      if (!full.includes(`src${/win/.test(process.platform) ? '\\' : '/'}i18n`)) {
        files.push(full);
      }
    }
  }
  return files;
}

// Match: t('some.key'), t("some.key"), t(`some.key`)
// Also: t('some.key', 'fallback') — we capture only the key
const T_RE = /\bt\(\s*['"`]([\w.]+)['"`]/g;

function extractKeys(src) {
  const keys = new Set();
  let m;
  while ((m = T_RE.exec(src)) !== null) {
    keys.add(m[1]);
  }
  return keys;
}

// ── 3. Main ───────────────────────────────────────────────────────────────────

const langs = {};
for (const lang of LANGS) {
  langs[lang] = flatten(await loadLang(lang));
}

const srcDir   = join(ROOT, 'src');
const allFiles = walkDir(srcDir);

const usedKeys  = new Set();
const keyUsages = {}; // key → [files]

for (const file of allFiles) {
  const src  = readFileSync(file, 'utf8');
  const keys = extractKeys(src);
  for (const k of keys) {
    usedKeys.add(k);
    (keyUsages[k] ??= []).push(relative(ROOT, file));
  }
}

// ── 4. Report ─────────────────────────────────────────────────────────────────

const BOLD  = '\x1b[1m';
const RED   = '\x1b[31m';
const YEL   = '\x1b[33m';
const GRN   = '\x1b[32m';
const CYAN  = '\x1b[36m';
const DIM   = '\x1b[2m';
const RESET = '\x1b[0m';

console.log(`\n${BOLD}═══════════════════════════════════════════════════════════`);
console.log(`  FME i18n Key Audit`);
console.log(`═══════════════════════════════════════════════════════════${RESET}\n`);

console.log(`${DIM}Source files scanned : ${allFiles.length}${RESET}`);
console.log(`${DIM}Unique keys found    : ${usedKeys.size}${RESET}\n`);

// Keys defined in en but not used in code (orphaned)
const enKeys      = new Set(Object.keys(langs.en));
const orphanedEn  = [...enKeys].filter(k => !usedKeys.has(k));

// Keys used in code but missing from each lang
const missing = {};
for (const lang of LANGS) {
  const defined = new Set(Object.keys(langs[lang]));
  missing[lang] = [...usedKeys].filter(k => !defined.has(k)).sort();
}

// ── Missing per language ──────────────────────────────────────────────────────
let anyMissing = false;
for (const lang of LANGS) {
  const list = missing[lang];
  if (!list.length) {
    console.log(`${GRN}✓ ${lang.toUpperCase()} — all keys present${RESET}`);
    continue;
  }
  anyMissing = true;
  console.log(`\n${RED}${BOLD}✗ ${lang.toUpperCase()} — ${list.length} missing key(s):${RESET}`);
  for (const k of list) {
    const files = (keyUsages[k] ?? []).slice(0, 3).join(', ');
    const more  = (keyUsages[k]?.length ?? 0) > 3 ? ` +${keyUsages[k].length - 3} more` : '';
    console.log(`  ${RED}• ${BOLD}${k}${RESET}${DIM}  ← ${files}${more}${RESET}`);
  }
}

// ── Keys in en.js not used anywhere ──────────────────────────────────────────
if (orphanedEn.length) {
  console.log(`\n${YEL}${BOLD}⚠ en.js has ${orphanedEn.length} key(s) not found in source code:${RESET}`);
  for (const k of orphanedEn.sort()) {
    console.log(`  ${YEL}• ${k}${RESET}`);
  }
} else {
  console.log(`\n${GRN}✓ No orphaned keys in en.js${RESET}`);
}

// ── Cross-language consistency ────────────────────────────────────────────────
// Keys in en but not in ro or fr
console.log(`\n${CYAN}${BOLD}── Cross-language diff (vs en.js) ──────────────────────────${RESET}`);
for (const lang of ['ro', 'fr']) {
  const inEnNotLang = [...enKeys].filter(k => !langs[lang][k]).sort();
  if (!inEnNotLang.length) {
    console.log(`${GRN}✓ ${lang.toUpperCase()} covers all en.js keys${RESET}`);
    continue;
  }
  console.log(`\n${YEL}${lang.toUpperCase()} missing ${inEnNotLang.length} en.js key(s):${RESET}`);
  for (const k of inEnNotLang) {
    console.log(`  ${YEL}• ${k}${RESET}`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${BOLD}═══════════════════════════════════════════════════════════${RESET}`);
for (const lang of LANGS) {
  const n = missing[lang].length;
  const icon = n === 0 ? `${GRN}✓` : `${RED}✗`;
  console.log(`  ${icon} ${lang.toUpperCase()}${RESET}: ${n} missing`);
}
console.log(`${BOLD}═══════════════════════════════════════════════════════════${RESET}\n`);
