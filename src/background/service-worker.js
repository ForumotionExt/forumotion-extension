/**
 * FME Service Worker (Background Script)
 * Handles all GitHub API requests to avoid CORS issues from content scripts.
 * Also manages badge updates, update notifications, version warehouse,
 * and skipped-version tracking.
 */

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';
const UPDATE_ALARM_NAME = 'fme-update-check';

// Maximum number of previous versions to keep in the warehouse
const VERSION_WAREHOUSE_MAX = 10;

// Notification IDs
const NOTIF_ID_UPDATE = 'fme-update-available';

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
  chrome.alarms.clear(UPDATE_ALARM_NAME, () => {
    if (!settings.autoCheckUpdates) return;
    const freq = settings.updateNotificationFrequency || '6h';
    if (freq === 'never') return;
    const periodMap = { '6h': 360, '12h': 720, '24h': 1440 };
    const periodInMinutes = periodMap[freq] || 360;
    chrome.alarms.create(UPDATE_ALARM_NAME, { periodInMinutes });
  });
}

async function performUpdateCheck() {
  try {
    const settings = await getSettings();
    const owner = settings.githubOwner || 'ForumotionExt';
    const repo  = settings.githubRepo  || 'forumotion-extension';
    const token = settings.githubToken || null;

    const data = await fetchGitHubFile(owner, repo, 'version.json', token);
    const manifest = chrome.runtime.getManifest();
    const currentVersion = manifest.version;

    // Build / refresh the version warehouse from fetched data
    await buildVersionWarehouse(data, owner, repo);

    const latestVersion = data.version;
    const skippedVersions = settings.skippedVersions || [];
    const isSkipped = skippedVersions.includes(latestVersion);

    if (data && latestVersion && isNewerVersion(latestVersion, currentVersion) && !isSkipped) {
      chrome.action.setBadgeText({ text: 'NEW' });
      chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });

      // Desktop notification (respects frequency / last-notification-time)
      await maybeSendUpdateNotification(settings, latestVersion, data);
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (err) {
    console.error('[FME] Update check failed:', err.message);
  }
}

// ─── Desktop notifications ────────────────────────────────────────────────────

async function maybeSendUpdateNotification(settings, latestVersion, data) {
  const freq = settings.updateNotificationFrequency || '6h';
  if (freq === 'never') return;

  const lastTime = settings.lastNotificationTime ? new Date(settings.lastNotificationTime).getTime() : 0;
  const freqMs = { '6h': 6, '12h': 12, '24h': 24 }[freq] * 60 * 60 * 1000;
  if (Date.now() - lastTime < freqMs) return;

  // Collect top 3 notes for the snippet, preferring feature-type entries
  const latestEntry = (data.changelog || []).find(e => e.version === latestVersion) || {};
  const allNotes = (latestEntry.notes || []).map(n =>
    typeof n === 'string' ? { type: 'other', text: n } : n
  ).filter(n => n.text);
  const featureNotes = allNotes.filter(n => n.type === 'feature');
  const topNotes = featureNotes.length
    ? featureNotes.slice(0, 3)
    : allNotes.slice(0, 3);
  const notes = topNotes.map(n => n.text);

  const message = notes.length
    ? notes.map(n => `• ${n}`).join('\n')
    : 'O versiune noua este disponibila.';

  chrome.notifications.create(NOTIF_ID_UPDATE, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: `Forumotion Extension v${latestVersion} disponibil`,
    message,
    buttons: [
      { title: 'Actualizeaza acum' },
      { title: 'Aminteste-mi mai tarziu' }
    ],
    requireInteraction: false
  });

  chrome.storage.sync.set({ lastNotificationTime: new Date().toISOString() });
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
  if (notifId !== NOTIF_ID_UPDATE) return;
  chrome.notifications.clear(notifId);
  if (btnIdx === 0) {
    // "Actualizeaza acum" — open the GitHub releases page
    getSettings().then(settings => {
      const owner = settings.githubOwner || 'ForumotionExt';
      const repo  = settings.githubRepo  || 'forumotion-extension';
      chrome.tabs.create({ url: `https://github.com/${owner}/${repo}/releases/latest` });
    });
  }
  // btnIdx === 1 means "Remind later" — just dismiss (notification already cleared)
});

chrome.notifications.onClicked.addListener((notifId) => {
  if (notifId !== NOTIF_ID_UPDATE) return;
  chrome.notifications.clear(notifId);
  getSettings().then(settings => {
    const owner = settings.githubOwner || 'ForumotionExt';
    const repo  = settings.githubRepo  || 'forumotion-extension';
    chrome.tabs.create({ url: `https://github.com/${owner}/${repo}/releases/latest` });
  });
});

// ─── Version warehouse ────────────────────────────────────────────────────────

async function buildVersionWarehouse(data, owner, repo) {
  if (!data || !Array.isArray(data.changelog)) return;

  const repoOwner = owner || 'ForumotionExt';
  const repoName  = repo  || 'forumotion-extension';

  const warehouse = data.changelog.slice(0, VERSION_WAREHOUSE_MAX).map(entry => ({
    version:    entry.version  || '',
    date:       entry.date     || '',
    releaseUrl: entry.version === data.version
      ? (data.releaseUrl || `https://github.com/${repoOwner}/${repoName}/releases/tag/v${entry.version}`)
      : `https://github.com/${repoOwner}/${repoName}/releases/tag/v${entry.version}`,
    notes: (entry.notes || []).map(n => (typeof n === 'string' ? { type: 'other', text: n } : n))
  }));

  return new Promise(resolve => {
    chrome.storage.local.set({ fme_versionWarehouse: warehouse }, resolve);
  });
}

function getVersionWarehouse() {
  return new Promise(resolve => {
    chrome.storage.local.get({ fme_versionWarehouse: [] }, r => resolve(r.fme_versionWarehouse));
  });
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
      scheduleUpdateCheck().then(() => sendResponse({ ok: true }));
      return true;

    case 'PREVIEW_FORUM_THEME':
      handleForumPreview(message.payload)
        .then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true;

    case 'EXEC_WIDGET': {
      // Execute user widget code via chrome.scripting which bypasses both
      // the extension's MV3 CSP (no unsafe-eval) and the page's own CSP.
      const tabId = sender.tab && sender.tab.id;
      if (!tabId) { sendResponse({ ok: false, error: 'No tab ID' }); return false; }
      const { code, name } = message.payload || {};
      if (!code) { sendResponse({ ok: true }); return false; }
      chrome.scripting.executeScript({
        target: { tabId },
        world:  'MAIN',
        func:   (widgetCode, widgetName) => {
          try {
            // indirect eval — runs in global scope, not function scope
            (0, eval)(widgetCode); // eslint-disable-line no-eval
          } catch (e) {
            console.warn(`[FME Widget "${widgetName}"]`, e.message);
          }
        },
        args: [code, name || ''],
      })
        .then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true;
    }

    // ── Skip-version helpers ──────────────────────────────────────────────────
    case 'SKIP_VERSION': {
      const ver = message.payload && message.payload.version;
      if (!ver) { sendResponse({ ok: false, error: 'No version provided' }); return false; }
      getSettings().then(settings => {
        const skipped = Array.from(new Set([...(settings.skippedVersions || []), ver]));
        chrome.storage.sync.set({ skippedVersions: skipped }, () => {
          // Clear badge if the skipped version was the one triggering "NEW"
          chrome.action.setBadgeText({ text: '' });
          sendResponse({ ok: true, skippedVersions: skipped });
        });
      });
      return true;
    }

    case 'UNSKIP_VERSION': {
      const ver = message.payload && message.payload.version;
      if (!ver) { sendResponse({ ok: false, error: 'No version provided' }); return false; }
      getSettings().then(settings => {
        const skipped = (settings.skippedVersions || []).filter(v => v !== ver);
        chrome.storage.sync.set({ skippedVersions: skipped }, () => {
          sendResponse({ ok: true, skippedVersions: skipped });
        });
      });
      return true;
    }

    case 'GET_SKIPPED_VERSIONS':
      getSettings().then(settings => {
        sendResponse({ ok: true, skippedVersions: settings.skippedVersions || [] });
      });
      return true;

    case 'CLEAR_SKIPPED_VERSIONS':
      chrome.storage.sync.set({ skippedVersions: [] }, () => {
        sendResponse({ ok: true });
      });
      return true;

    // ── Version warehouse ─────────────────────────────────────────────────────
    case 'GET_VERSION_WAREHOUSE':
      getVersionWarehouse().then(warehouse => {
        sendResponse({ ok: true, warehouse });
      });
      return true;

    case 'REFRESH_VERSION_WAREHOUSE':
      getSettings().then(async settings => {
        try {
          const owner = settings.githubOwner || 'ForumotionExt';
          const repo  = settings.githubRepo  || 'forumotion-extension';
          const data = await fetchGitHubFile(
            owner,
            repo,
            'version.json',
            settings.githubToken || null
          );
          await buildVersionWarehouse(data, owner, repo);
          const warehouse = await getVersionWarehouse();
          sendResponse({ ok: true, warehouse });
        } catch (err) {
          sendResponse({ ok: false, error: err.message });
        }
      });
      return true;

    default:
      return false;
  }
});

// ─── GitHub API helpers ───────────────────────────────────────────────────────

/**
 * Fetches a JSON file from a GitHub repo via the raw content CDN.
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
  templatesRepo: 'templates',
  skippedVersions: [],
  updateNotificationFrequency: '6h',
  lastNotificationTime: null
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
      // Ensure new fields exist for users upgrading from older versions
      if (!Array.isArray(stored.skippedVersions)) updates.skippedVersions = [];
      if (stored.updateNotificationFrequency === undefined) updates.updateNotificationFrequency = '6h';
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
