/**
 * FME Service Worker (Background Script)
 * Handles all GitHub API requests to avoid CORS issues from content scripts.
 * Also manages badge updates for available extension updates.
 */

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';
const UPDATE_ALARM_NAME = 'fme-update-check';

// ─── Alarm setup for periodic update checks ──────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  migrateSettings().then(() => scheduleUpdateCheck());
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM_NAME) {
    performUpdateCheck();
  }
});

async function scheduleUpdateCheck() {
  const settings = await getSettings();
  if (settings.autoCheckUpdates) {
    chrome.alarms.create(UPDATE_ALARM_NAME, {
      periodInMinutes: 60 * 6 // every 6 hours
    });
  }
}

async function performUpdateCheck() {
  try {
    const settings = await getSettings();
    const owner = settings.githubOwner || 'ForumotionExt';
    const repo = settings.githubRepo || 'forumotion-extension';
    const token = settings.githubToken || null;

    const data = await fetchGitHubFile(owner, repo, 'version.json', token);
    const manifest = chrome.runtime.getManifest();
    const currentVersion = manifest.version;

    if (data && data.version && isNewerVersion(data.version, currentVersion)) {
      chrome.action.setBadgeText({ text: 'NEW' });
      chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (err) {
    console.error('[FME] Update check failed:', err.message);
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  switch (message.type) {
    case 'GITHUB_FETCH':
      handleGitHubFetch(message.payload)
        .then(result => sendResponse({ ok: true, data: result }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true; // keep channel open for async response

    case 'GITHUB_FETCH_RAW':
      handleGitHubFetchRaw(message.payload)
        .then(result => sendResponse({ ok: true, data: result }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true;

    case 'CHECK_UPDATE':
      performUpdateCheck()
        .then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true;

    case 'SET_BADGE':
      if (message.payload && message.payload.text !== undefined) {
        chrome.action.setBadgeText({ text: message.payload.text });
        if (message.payload.color) {
          chrome.action.setBadgeBackgroundColor({ color: message.payload.color });
        }
      }
      sendResponse({ ok: true });
      return false;

    case 'RESCHEDULE_ALARM':
      chrome.alarms.clear(UPDATE_ALARM_NAME, () => scheduleUpdateCheck());
      sendResponse({ ok: true });
      return false;

    case 'PREVIEW_FORUM_THEME':
      handleForumPreview(message.payload)
        .then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true;

    default:
      return false;
  }
});

// ─── GitHub API helpers ───────────────────────────────────────────────────────

/**
 * Fetches a JSON file from a GitHub repo via the raw content CDN.
 * Falls back to the Contents API if needed.
 */
async function fetchGitHubFile(owner, repo, filePath, token = null, branch = 'main') {
  const rawUrl = `${GITHUB_RAW_BASE}/${owner}/${repo}/${branch}/${filePath}`;
  const headers = buildHeaders(token);

  const res = await fetch(rawUrl, { headers });
  if (!res.ok) {
    throw new Error(`GitHub raw fetch failed: ${res.status} ${res.statusText} for ${rawUrl}`);
  }
  return res.json();
}

/**
 * Fetches a raw text/CSS file from GitHub raw CDN.
 */
async function fetchGitHubRaw(owner, repo, filePath, token = null, branch = 'main') {
  const rawUrl = `${GITHUB_RAW_BASE}/${owner}/${repo}/${branch}/${filePath}`;
  const headers = buildHeaders(token);

  const res = await fetch(rawUrl, { headers });
  if (!res.ok) {
    throw new Error(`GitHub raw fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/**
 * Calls the GitHub REST API (json response).
 */
async function callGitHubAPI(endpoint, token = null) {
  const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API_BASE}${endpoint}`;
  const headers = buildHeaders(token);

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub API error ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function buildHeaders(token) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ─── Message payload handlers ─────────────────────────────────────────────────

async function handleGitHubFetch(payload) {
  const { owner, repo, filePath, branch = 'main', token = null } = payload;
  return fetchGitHubFile(owner, repo, filePath, token, branch);
}

async function handleGitHubFetchRaw(payload) {
  const { owner, repo, filePath, branch = 'main', token = null } = payload;
  return fetchGitHubRaw(owner, repo, filePath, token, branch);
}

// ─── Forum theme preview ──────────────────────────────────────────────────────

async function handleForumPreview({ cssText, forumUrl, durationMs = 15000 }) {
  const tab = await chrome.tabs.create({ url: forumUrl, active: true });

  await new Promise((resolve) => {
    function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });

  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    css: cssText
  });

  setTimeout(async () => {
    try {
      await chrome.scripting.removeCSS({ target: { tabId: tab.id }, css: cssText });
    } catch (_) { /* tab may be closed */ }
  }, durationMs);
}

// ─── Settings helper ──────────────────────────────────────────────────────────

const SETTINGS_DEFAULTS = {
  githubToken: '',
  autoCheckUpdates: true,
  githubOwner: 'ForumotionExt',
  githubRepo: 'forumotion-extension',
  themesOwner: 'ForumotionExt',
  themesRepo: 'forumotion-themes',
  templatesOwner: 'ForumotionExt',
  templatesRepo: 'templates'
};

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(SETTINGS_DEFAULTS, resolve);
  });
}

/**
 * Fixes stale defaults that may have been cached in storage from older versions.
 */
async function migrateSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(SETTINGS_DEFAULTS, (stored) => {
      const updates = {};
      if (stored.themesOwner === 'staark-dev') updates.themesOwner = 'ForumotionExt';
      if (Object.keys(updates).length > 0) {
        chrome.storage.sync.set(updates, resolve);
      } else {
        resolve();
      }
    });
  });
}

// ─── Version comparison ───────────────────────────────────────────────────────

function isNewerVersion(remote, local) {
  const parse = v => v.replace(/^v/, '').split('.').map(Number);
  const r = parse(remote);
  const l = parse(local);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] || 0;
    const lv = l[i] || 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}
