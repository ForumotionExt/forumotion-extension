/**
 * FME GitHub API wrapper for content scripts.
 * All actual network requests are delegated to the service worker
 * via chrome.runtime.sendMessage to avoid CORS restrictions.
 */

var FMEGitHub = (() => {
  /**
   * Sends a message to the service worker and returns a Promise.
   */
  function sendToBackground(type, payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (!response) {
          return reject(new Error('No response from service worker'));
        }
        if (!response.ok) {
          return reject(new Error(response.error || 'Unknown error'));
        }
        resolve(response.data);
      });
    });
  }

  /**
   * Fetches and parses a JSON file from a GitHub repository.
   * @param {string} owner  - GitHub username or org
   * @param {string} repo   - Repository name
   * @param {string} filePath - Path within the repo (e.g. "themes.json")
   * @param {string} [branch='main']
   * @param {string|null} [token=null] - Optional PAT for higher rate limits
   * @returns {Promise<any>}
   */
  function fetchJSON(owner, repo, filePath, branch = 'main', token = null) {
    return sendToBackground('GITHUB_FETCH', { owner, repo, filePath, branch, token });
  }

  /**
   * Fetches a raw text/CSS file from a GitHub repository.
   * @returns {Promise<string>}
   */
  function fetchRaw(owner, repo, filePath, branch = 'main', token = null) {
    return sendToBackground('GITHUB_FETCH_RAW', { owner, repo, filePath, branch, token });
  }

  /**
   * Triggers the background update check and badge update.
   * @returns {Promise<void>}
   */
  function checkForUpdates() {
    return sendToBackground('CHECK_UPDATE', {});
  }

  /**
   * Gets stored settings from chrome.storage.sync.
   * @returns {Promise<object>}
   */
  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({
        githubToken: '',
        autoCheckUpdates: true,
        githubOwner: 'ForumotionExt',
        githubRepo: 'forumotion-extension',
        themesOwner: 'ForumotionExt',
        themesRepo: 'forumotion-themes',
        templatesOwner: 'ForumotionExt',
        templatesRepo: 'templates'
      }, resolve);
    });
  }

  /**
   * Opens the forum homepage in a new tab and injects the CSS for preview.
   * @param {string} cssText - CSS to inject
   * @param {number} [durationMs=15000] - How long to keep the preview (ms)
   * @param {string} [forumUrl] - Override URL (e.g. with ?tt=1). Defaults to origin + '/'
   */
  function previewOnForum(cssText, durationMs = 15000, forumUrl) {
    return sendToBackground('PREVIEW_FORUM_THEME', {
      cssText,
      forumUrl: forumUrl || (window.location.origin + '/'),
      durationMs
    });
  }

  return { fetchJSON, fetchRaw, checkForUpdates, getSettings, previewOnForum };
})();
