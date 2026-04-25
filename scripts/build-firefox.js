#!/usr/bin/env node
/**
 * Firefox extension build & package script.
 * Outputs a .zip to releases/ ready for AMO submission or manual install.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function run(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', shell: true });
}

// ─── 1. Build ─────────────────────────────────────────────────────────────────
console.log('\n[firefox] Building extension...');
run('node esbuild.config.js --prod --browser=firefox');

// ─── 2. Patch manifest ────────────────────────────────────────────────────────
const manifestPath = path.join(ROOT, 'dist/firefox/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

manifest.browser_specific_settings = {
  gecko: {
    id: 'fme@forumotion.ext',
    strict_min_version: '128.0',
  },
};

// Remove Chrome-only use_dynamic_url
if (Array.isArray(manifest.web_accessible_resources)) {
  manifest.web_accessible_resources = manifest.web_accessible_resources.map(
    ({ use_dynamic_url, ...rest }) => rest
  );
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest));
console.log('[firefox] Manifest patched with gecko settings');

// ─── 3. Package ───────────────────────────────────────────────────────────────
const version = manifest.version;
const releasesDir = path.join(ROOT, 'releases');
fs.mkdirSync(releasesDir, { recursive: true });

const outName = `fme-firefox-v${version}.zip`;
const outFile = path.join(releasesDir, outName);
if (fs.existsSync(outFile)) fs.unlinkSync(outFile);

console.log(`\n[firefox] Packaging → releases/${outName}`);

try {
  run(`cd dist/firefox && zip -r -q "../../releases/${outName}" . -x "*.DS_Store"`);
} catch {
  console.error('[firefox] zip failed. On Windows: use 7-Zip or PowerShell Compress-Archive.');
  process.exit(1);
}

console.log('\n[firefox] Done!');
console.log(`  Package : releases/${outName}`);
console.log('  Install : about:debugging → Load Temporary Add-on');
console.log('  Submit  : https://addons.mozilla.org/developers/');
