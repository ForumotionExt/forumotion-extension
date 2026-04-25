#!/usr/bin/env node
/**
 * Safari extension build & conversion script.
 * Requires macOS + Xcode with safari-web-extension-converter.
 * Outputs an Xcode project in safari/ ready for signing and distribution.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function run(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', shell: true });
}

// ─── Platform check ───────────────────────────────────────────────────────────
if (os.platform() !== 'darwin') {
  console.error('[safari] Error: Safari extension conversion requires macOS and Xcode.');
  process.exit(1);
}

try {
  execSync('xcrun --find safari-web-extension-converter', { stdio: 'pipe' });
} catch {
  console.error('[safari] Error: safari-web-extension-converter not found.');
  console.error('[safari] Install Xcode from the App Store, then run: xcode-select --install');
  process.exit(1);
}

// ─── 1. Build ─────────────────────────────────────────────────────────────────
console.log('\n[safari] Building extension...');
run('node esbuild.config.js --prod --browser=safari');

// ─── 2. Patch manifest ────────────────────────────────────────────────────────
const manifestPath = path.join(ROOT, 'dist/safari/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

manifest.browser_specific_settings = {
  safari: { strict_min_version: '16.4' },
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('[safari] Manifest patched with safari settings');

// ─── 3. Convert to Safari Web Extension ──────────────────────────────────────
// safari-web-extension-converter sets:
//   App bundle ID:       com.forumotion.ForumotionFME
//   Extension bundle ID: com.forumotion.ForumotionFME.Extension  (auto-appended)
console.log('\n[safari] Running safari-web-extension-converter...');
run(
  'xcrun safari-web-extension-converter dist/safari' +
  ' --project-location ./safari' +
  ' --app-name ForumotionExt' +
  ' --bundle-identifier com.forumotion.ForumotionFME' +
  ' --no-open --force'
);

// ─── 4. Sync manifest to Xcode resources ─────────────────────────────────────
const xcodeResources = path.join(ROOT, 'safari/ForumotionExt/ForumotionExt Extension/Resources');
if (fs.existsSync(xcodeResources)) {
  fs.copyFileSync(manifestPath, path.join(xcodeResources, 'manifest.json'));
  console.log('[safari] Manifest synced → Xcode resources');
} else {
  console.warn('[safari] Xcode resources directory not found — manifest not synced.');
}

const version = manifest.version;
console.log('\n[safari] Done!');
console.log(`  Version      : ${version}`);
console.log('  Xcode project: safari/ForumotionExt/ForumotionExt.xcodeproj');
console.log('\n  Next steps:');
console.log('  1. Open the .xcodeproj in Xcode');
console.log('  2. Set your Apple Developer account under Signing & Capabilities');
console.log('  3. Product → Build (⌘B) to test locally in Safari');
console.log('  4. Product → Archive to submit to the Mac App Store');
