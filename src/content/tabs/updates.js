/**
 * FME Updates Tab
 * Checks the extension's GitHub repo for a newer version.json and
 * displays the changelog and update badge.
 *
 * Expected version.json format:
 * {
 *   "version": "1.2.0",
 *   "releaseDate": "2026-03-15",
 *   "releaseUrl": "https://github.com/ForumotionExt/forumotion-extension/releases/tag/v1.2.0",
 *   "changelog": [
 *     { "version": "1.2.0", "date": "2026-03-15", "notes": ["Added theme import/export", "Fixed CSP issue"] },
 *     { "version": "1.1.0", "date": "2026-02-01", "notes": ["Templates tab", "Settings persistence"] }
 *   ]
 * }
 */

var FMEUpdatesTab = (() => {
  let _container = null;
  let _settings = null;

  // ─── Public API ─────────────────────────────────────────────────────────────

  async function render(container) {
    _container = container;
    container.innerHTML = '';

    const manifest = chrome.runtime.getManifest();
    const currentVersion = manifest.version;

    const wrapper = document.createElement('div');
    wrapper.className = 'fme-updates-wrapper';
    wrapper.id = 'main-content';
    wrapper.innerHTML = `
      <div class="fme-section-header">
        <h2 class="fme-section-title">FME</h2>
        <ul class="h2-breadcrumb clearfix"><li class="first">Updates</li></ul>
        <blockquote class="block_left">
          <p class="explain">Keep your Forumotion Extension up to date.</p>
        </blockquote>
      </div>

      <fieldset class="fieldset_left">
        <legend>Versiune instalata</legend>
        <dl>
          <dt>
            <label>Versiune instalata&nbsp;:</label>
          </dt>
          <dd><span style="font-weight: bold; font-size: 12px">v${escHtml(currentVersion)}</span></dd>
        </dl>

        <div class="div_btns">
          <input type="button" id="fme-check-updates" name="fme-check-updates" value="Verifica actualizari" class="icon_ok" />
        </div>
      </fieldset>

      <fieldset>
        <legend>Changelog</legend>
        <div id="fme-changelog-section"></div>
      </fieldset>

      <div id="warning" class="warning-navbar"><h3>Avertizare</h3><p>
        <div id="fme-update-result"></div>
      </p></div>
    `;

    container.appendChild(wrapper);
    bindEvents(wrapper, currentVersion);

    // Auto-check on tab open
    await checkUpdates(wrapper, currentVersion);
  }

  // ─── Update check ─────────────────────────────────────────────────────────────

  async function checkUpdates(wrapper, currentVersion) {
    const resultEl = wrapper.querySelector('#fme-update-result');
    const changelogEl = wrapper.querySelector('#fme-changelog-section');
    const btn = wrapper.querySelector('#fme-check-updates');

    resultEl.innerHTML = '<div class="fme-loading fme-loading-inline"><div class="fme-spinner fme-spinner-sm"></div><span>Checking GitHub for updates…</span></div>';
    changelogEl.innerHTML = '';

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Checking…';
    }

    try {
      _settings = await FMEGitHub.getSettings();

      const data = await FMEGitHub.fetchJSON(
        _settings.githubOwner,
        _settings.githubRepo,
        'version.json',
        'main',
        _settings.githubToken || null
      );

      const latestVersion = data.version;
      const hasUpdate = isNewerVersion(latestVersion, currentVersion);

      // Update the badge in the background
      chrome.runtime.sendMessage({
        type: 'SET_BADGE',
        payload: hasUpdate
          ? { text: 'NEW', color: '#e74c3c' }
          : { text: '' }
      });

      if (hasUpdate) {
        resultEl.innerHTML = `
          <div class="fme-alert fme-alert-update">
            <strong>Versiune noua disponibila: v${escHtml(latestVersion)}</strong>
            ${data.releaseDate ? ` &mdash; ${escHtml(data.releaseDate)}` : ''}
            <br>
            ${data.releaseUrl
              ? `<a href="${escHtml(data.releaseUrl)}" target="_blank" rel="noopener">Vezi release-ul pe GitHub &rarr;</a>`
              : ''
            }
          </div>
        `;
      } else {
        resultEl.innerHTML = `
          Esti pe ultima versiune (v${escHtml(currentVersion)}).
        `;
      }

      // Render changelog regardless
      if (data.changelog && Array.isArray(data.changelog)) {
        renderChangelog(changelogEl, data.changelog, currentVersion);
      }

    } catch (err) {
      resultEl.innerHTML = `
        <div class="fme-alert fme-alert-error">
          <p><strong>Could not check for updates.</strong></p>
          <p class="fme-error-msg">${escHtml(err.message)}</p>
          <p class="fme-error-hint">Verify your network connection and GitHub settings. If you've exceeded the API rate limit, add a token in Settings.</p>
        </div>
      `;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.value = 'Verifica actualizari';
      }
    }
  }

  // ─── Changelog renderer ───────────────────────────────────────────────────────

  function renderChangelog(el, changelog, currentVersion) {
    if (!changelog.length) return;

    //el.innerHTML = `<h4 style="margin:16px 0 8px;font-size:13px;font-weight:bold;border-bottom:1px solid #ddd;padding-bottom:4px;">Changelog</h4>`;

    changelog.forEach((entry) => {
      const isInstalled = entry.version === currentVersion;
      const item = document.createElement('div');
      item.style.cssText = `padding:8px 10px;border:1px solid ${isInstalled ? '#3c9ebf' : '#ddd'};background:${isInstalled ? '#f0f8fc' : '#fafafa'};margin-bottom:6px;`;

      const notes = (entry.notes || [])
        .map(n => `<li>${escHtml(n)}</li>`)
        .join('');

      item.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
          <strong>v${escHtml(entry.version)}</strong>
          ${entry.date ? `<span style="font-size:11px;color:#888;">${escHtml(entry.date)}</span>` : ''}
          ${isInstalled ? '<span class="fme-badge fme-badge-installed">Instalata</span>' : ''}
        </div>
        ${notes ? `<ul style="margin:0;padding-left:18px;">${notes}</ul>` : ''}
      `;

      el.appendChild(item);
    });
  }

  // ─── Event binding ─────────────────────────────────────────────────────────────

  function bindEvents(wrapper, currentVersion) {
    wrapper.querySelector('#fme-check-updates').addEventListener('click', () => {
      checkUpdates(wrapper, currentVersion);
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

  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { render };
})();
