#!/usr/bin/env node
/**
 * Release script — buildează și pacheteaza extensia pentru toate browserele.
 * Rulează cu: npm run release:all
 *
 * Output în releases/:
 *   fme-chrome-v{version}.zip
 *   fme-firefox-v{version}.zip
 *   fme-opera-v{version}.zip
 *   (Safari → proiect Xcode în safari/, necesită build manual din Xcode)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, '..');
const RELEASES   = path.join(ROOT, 'releases');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function run(cmd) {
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', shell: true });
}

function log(browser, msg) {
  console.log(`\n[${browser}] ${msg}`);
}

function readManifest(browser) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, `dist/${browser}/manifest.json`), 'utf8'));
}

function zip(srcDir, outFile) {
  if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
  const rel = path.relative(ROOT, outFile);
  run(`cd "${srcDir}" && zip -r -q "${outFile}" . -x "*.DS_Store"`);
  console.log(`    → ${rel}`);
}

// ─── Chrome ───────────────────────────────────────────────────────────────────

function buildChrome() {
  log('chrome', 'Building...');
  run('node esbuild.config.js --prod --browser=chrome');

  const manifest = readManifest('chrome');
  const outName  = `fme-chrome-v${manifest.version}.zip`;
  zip(path.join(ROOT, 'dist/chrome'), path.join(RELEASES, outName));

  return { version: manifest.version, file: outName };
}

// ─── Firefox ──────────────────────────────────────────────────────────────────

function buildFirefox() {
  log('firefox', 'Building...');
  run('node esbuild.config.js --prod --browser=firefox');

  const manifestPath = path.join(ROOT, 'dist/firefox/manifest.json');
  const manifest     = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  manifest.browser_specific_settings = {
    gecko: { id: 'fme@forumotion.ext', strict_min_version: '128.0' },
  };

  if (Array.isArray(manifest.web_accessible_resources)) {
    manifest.web_accessible_resources = manifest.web_accessible_resources.map(
      ({ use_dynamic_url, ...rest }) => rest
    );
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  const outName = `fme-firefox-v${manifest.version}.zip`;
  zip(path.join(ROOT, 'dist/firefox'), path.join(RELEASES, outName));

  return { version: manifest.version, file: outName };
}

// ─── Opera ────────────────────────────────────────────────────────────────────

function buildOpera() {
  log('opera', 'Building...');
  run('node esbuild.config.js --prod --browser=opera');

  const manifest = readManifest('opera');
  const outName  = `fme-opera-v${manifest.version}.zip`;
  zip(path.join(ROOT, 'dist/opera'), path.join(RELEASES, outName));

  return { version: manifest.version, file: outName };
}

// ─── Safari ───────────────────────────────────────────────────────────────────

function buildSafari() {
  if (os.platform() !== 'darwin') {
    log('safari', 'Skip — necesită macOS.');
    return null;
  }

  try {
    execSync('xcrun --find safari-web-extension-converter', { stdio: 'pipe' });
  } catch {
    log('safari', 'Skip — safari-web-extension-converter nu a fost găsit (instalează Xcode).');
    return null;
  }

  log('safari', 'Building...');
  run('node scripts/build-safari.js');

  const manifest = readManifest('safari');
  return { version: manifest.version, file: 'safari/ForumotionExt/ForumotionExt.xcodeproj' };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════╗');
console.log('║      FME — Release Builder           ║');
console.log('╚══════════════════════════════════════╝');

fs.mkdirSync(RELEASES, { recursive: true });

const results = {};
const errors  = {};

for (const [browser, buildFn] of [
  ['chrome',  buildChrome],
  ['firefox', buildFirefox],
  ['opera',   buildOpera],
  ['safari',  buildSafari],
]) {
  try {
    results[browser] = buildFn();
  } catch (err) {
    errors[browser] = err.message;
    console.error(`\n[${browser}] FAILED:`, err.message);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n╔══════════════════════════════════════╗');
console.log('║             Release Summary          ║');
console.log('╚══════════════════════════════════════╝');

for (const [browser, result] of Object.entries(results)) {
  if (!result) continue;
  const status = errors[browser] ? '✗' : '✓';
  const label  = browser.padEnd(8);
  const file   = result.file ?? '—';
  console.log(`  ${status} ${label} v${result.version}  →  ${file}`);
}

for (const [browser, msg] of Object.entries(errors)) {
  console.log(`  ✗ ${browser.padEnd(8)} FAILED: ${msg}`);
}

const hasErrors = Object.keys(errors).length > 0;

console.log('\n  Packages: releases/');
if (results.safari) {
  console.log('  Safari  : deschide .xcodeproj în Xcode → Product → Archive');
}

console.log('');
process.exit(hasErrors ? 1 : 0);
