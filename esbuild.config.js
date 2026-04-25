import esbuild from 'esbuild';
import fs from 'fs';
import { execSync } from 'child_process';

const isProd   = process.argv.includes('--prod');
const isWatch  = process.argv.includes('--watch');
const isMinify = process.argv.includes('--minify') || isProd;
const browser  = process.argv.find(a => a.startsWith('--browser='))?.split('=')[1] ?? 'chrome';

const gitHash = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch { return `local-${new Date().toISOString().slice(0, 10)}`; }
})();

const BUILD_FILE = './build.json';
const buildMeta  = fs.existsSync(BUILD_FILE)
  ? JSON.parse(fs.readFileSync(BUILD_FILE, 'utf8'))
  : { number: 0 };

if (isProd) buildMeta.number += 1;
fs.writeFileSync(BUILD_FILE, JSON.stringify(buildMeta, null, 2));

const buildVersion = `1.4.${buildMeta.number}`;

const baseManifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));

const manifest = {
  ...baseManifest,
  version      : buildVersion,
  version_name : `1.4-build.${buildMeta.number} (${gitHash})`,
  build        : {
    date   : new Date().toISOString().slice(0, 10),
    hash   : gitHash,
    number : buildMeta.number,
    env    : isProd ? 'production' : 'development',
    display: `1.4-build.${buildMeta.number}`,
  },
  icons: {
    "16" : "icons/icon16.png",
    "48" : "icons/icon48.png",
    "128": "icons/icon128.png",
  },

  action: {
    default_popup: "popup/popup.html",
    default_title: "Forumotion Extension (FME)",
    default_icon : {
      "16" : "icons/icon16.png",
      "48" : "icons/icon48.png",
      "128": "icons/icon128.png",
    }
  },

  background: browser === 'firefox'
    ? { scripts: ["background/service-worker.js"] }
    : { service_worker: "background/service-worker.js", type: "module" },

  content_scripts: [
    {
      matches: baseManifest.content_scripts[0].matches,
      js     : ["content/bundle.js"],
      css    : ["styles/panel.css", "styles/sections.css", "styles/dark-mode.css"],
      run_at : "document_idle"
    },
    {
      matches         : baseManifest.content_scripts[1].matches,
      exclude_matches : baseManifest.content_scripts[1].exclude_matches,
      js              : ["forum/bundle.js"],
      run_at          : "document_idle"
    }
  ],

  web_accessible_resources: [{
    resources: [
      "icons/icon16.png",
      "icons/icon48.png",
      "icons/icon128.png",
      "content/bridge.main.js",
    ],
    matches        : ["<all_urls>"],
    use_dynamic_url: false,
  }],
};

if (browser === 'firefox' || browser === 'safari') delete manifest.version_name;
if (browser === 'chrome'  || browser === 'opera')  delete manifest.build;

if (browser === 'safari') {
  manifest.web_accessible_resources = manifest.web_accessible_resources.map(r => {
    const { use_dynamic_url, ...rest } = r;
    return rest;
  });
}

fs.mkdirSync(`dist/${browser}`, { recursive: true });
fs.writeFileSync(
  `dist/${browser}/manifest.json`,
  JSON.stringify(manifest, null, isProd ? 0 : 2)
);

console.log(`[manifest] v${buildVersion} (${gitHash}) → dist/${browser}/manifest.json`);

const TARGET = {
  chrome : ['chrome88'],
  firefox: ['firefox109'],
  opera  : ['chrome88'],
  safari : ['safari16'],
};

const sharedConfig = {
  bundle   : true,
  minify   : isMinify,
  sourcemap: !isMinify,
  platform : 'browser',
  format   : 'iife',
  target   : TARGET[browser] ?? TARGET.chrome,
  define   : {
    __DEV__          : JSON.stringify(!isProd),
    __BROWSER__      : JSON.stringify(browser),
    __BUILD_DATE__   : JSON.stringify(manifest.build.date),
    __BUILD_NUMBER__ : JSON.stringify(buildMeta.number),
    __BUILD_HASH__   : JSON.stringify(gitHash),
    __VERSION__      : JSON.stringify(buildVersion),
  },
  alias: {
    '@core'       : './src/content/core',
    '@shared'     : './src/content/shared',
    '@forumotion' : './src/content/forumotion',
    '@pages'      : './src/content/pages',
  }
};

const entries = [
  { entryPoints: ['src/content/bootstrap.js'],   outfile: `dist/${browser}/content/bundle.js`      },
  { entryPoints: ['src/content/forum.js'],       outfile: `dist/${browser}/forum/bundle.js`        },
  { entryPoints: ['src/content/bridge.main.js'], outfile: `dist/${browser}/content/bridge.main.js` },
];

// Firefox nu suportă background.service_worker — bundlăm SW-ul ca IIFE script
if (browser === 'firefox') {
  entries.push({
    entryPoints: ['src/background/service-worker.js'],
    outfile     : `dist/firefox/background/service-worker.js`,
    format      : 'iife',
  });
}

for (const entry of entries) {
  const ctx = await esbuild.context({ ...sharedConfig, ...entry });
  if (isWatch) {
    await ctx.watch();
    console.log(`[esbuild] Watching ${entry.entryPoints[0]} for ${browser}...`);
  } else {
    await ctx.rebuild();
    ctx.dispose();
  }
}

const copy = (src, dest) => {
  try {
    fs.mkdirSync(dest.substring(0, dest.lastIndexOf('/')), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`[copy] ${src} → ${dest}`);
  } catch (err) {
    console.warn(`[copy] ⚠️  ${src} → ${err.message}`);
  }
};

const copyDir = (src, dest) => {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = `${src}/${entry.name}`;
    const destPath = `${dest}/${entry.name}`;
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      try {
        fs.copyFileSync(srcPath, destPath);
        console.log(`[copy] ${srcPath} → ${destPath}`);
      } catch (err) {
        console.warn(`[copy] ⚠️  ${srcPath} → ${err.message}`);
      }
    }
  }
};

copyDir('src/background', `dist/${browser}/background`);
copyDir('icons', `dist/${browser}/icons`);
copyDir('src/styles', `dist/${browser}/styles`);
copyDir('src/popup', `dist/${browser}/popup`);
copyDir('src/dashboard', `dist/${browser}/src/dashboard`);
copyDir('src/content/shared', `dist/${browser}/content/shared`);
copy('src/config.js', `dist/${browser}/config.js`);
copy('version.json', `dist/${browser}/version.json`);
copy('announcements.json', `dist/${browser}/announcements.json`);

// Copy bridge.main.js to root-level content/ so source-loaded Chrome extensions
// (loaded from project root) can access it at the same path as built extensions.
if (browser === 'chrome') {
  copy(`dist/chrome/content/bridge.main.js`, 'content/bridge.main.js');
}

console.log(`[esbuild] Build complet pentru ${browser} (${isProd ? 'prod' : 'dev'}) — v${buildVersion} (${gitHash})`);