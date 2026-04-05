/**
 * FME Updates Tab
 * Checks the extension's GitHub repo for a newer version.json and
 * displays the changelog with categorization, skip-version support,
 * version warehouse / rollback links, and notification controls.
 *
 * Supported version.json note formats (backward-compatible):
 *   - Plain string:  "Fixed CSP issue"
 *   - Typed object:  { "type": "bugfix", "text": "Fixed CSP issue" }
 *
 * Type auto-detection from plain strings:
 *   Prefixes "Fix:", "fix:", "Bug:", "bug:", "🐛"  → bugfix
 *   Prefixes "Add:", "New:", "Feature:", "✨", "🆕" → feature
 *   Anything else                                   → other
 */

var FMEUpdatesTab = (() => {
  let _container = null;
  let _settings  = null;

  const TYPE_META = {
    feature: { icon: '✨', label: 'Features',  badgeClass: 'fme-cl-badge-feature' },
    bugfix:  { icon: '🐛', label: 'Bugfixes',  badgeClass: 'fme-cl-badge-bugfix'  },
    other:   { icon: '📝', label: 'Other',     badgeClass: 'fme-cl-badge-other'   }
  };

  // ─── Public API ─────────────────────────────────────────────────────────────

  async function render(container) {
    _container = container;
    container.innerHTML = '';

    const manifest       = chrome.runtime.getManifest();
    const currentVersion = manifest.version;

    const wrapper = document.createElement('div');
    wrapper.className = 'fme-updates-wrapper';
    wrapper.id = 'main-content';
    wrapper.innerHTML = `
      <div class="fme-section-header">
        <h2 class="fme-section-title">FME</h2>
        <ul class="h2-breadcrumb clearfix"><li class="first">Actualizari</li></ul>
        <blockquote class="block_left">
          <p class="explain">Mentine Forumotion Extension la zi.</p>
        </blockquote>
      </div>

      <fieldset class="fieldset_left">
        <legend>Versiune instalata</legend>
        <dl>
          <dt><label>Versiune instalata&nbsp;:</label></dt>
          <dd><span style="font-weight:bold;font-size:12px">v${escHtml(currentVersion)}</span></dd>
        </dl>
        <div class="div_btns" style="display:flex;gap:6px;flex-wrap:wrap;">
          <input type="button" id="fme-check-updates"    value="Verifica actualizari"   class="icon_ok" />
          <input type="button" id="fme-notif-settings"   value="⚙ Notificari"           class="icon_ok" />
          <input type="button" id="fme-clear-skipped"    value="Sterge versiuni ignorate" class="icon_ok" style="display:none;" />
        </div>
      </fieldset>

      <div id="fme-update-result"></div>

      <fieldset id="fme-versions-fieldset" style="display:none;">
        <legend>Versiuni disponibile</legend>
        <div id="fme-versions-section"></div>
      </fieldset>

      <fieldset>
        <legend>Changelog</legend>
        <div id="fme-changelog-section"></div>
      </fieldset>
    `;

    container.appendChild(wrapper);
    bindEvents(wrapper, currentVersion);

    // Auto-check on tab open
    await checkUpdates(wrapper, currentVersion);
  }

  // ─── Update check ─────────────────────────────────────────────────────────────

  async function checkUpdates(wrapper, currentVersion) {
    const resultEl    = wrapper.querySelector('#fme-update-result');
    const changelogEl = wrapper.querySelector('#fme-changelog-section');
    const versionsEl  = wrapper.querySelector('#fme-versions-section');
    const vFieldset   = wrapper.querySelector('#fme-versions-fieldset');
    const btn         = wrapper.querySelector('#fme-check-updates');

    resultEl.innerHTML   = '<div class="fme-loading fme-loading-inline"><div class="fme-spinner fme-spinner-sm"></div><span>Se verifica actualizarile…</span></div>';
    changelogEl.innerHTML = '';
    versionsEl.innerHTML  = '';
    vFieldset.style.display = 'none';

    if (btn) { btn.disabled = true; btn.value = 'Se verifica…'; }

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

      // Load skipped versions
      const skippedResp = await sendMsg('GET_SKIPPED_VERSIONS');
      const skipped = (skippedResp && skippedResp.ok) ? (skippedResp.skippedVersions || []) : [];

      const isSkipped  = skipped.includes(latestVersion);
      const hasUpdate  = isNewerVersion(latestVersion, currentVersion) && !isSkipped;
      const rawUpdate  = isNewerVersion(latestVersion, currentVersion);

      // Update badge
      chrome.runtime.sendMessage({
        type: 'SET_BADGE',
        payload: hasUpdate ? { text: 'NEW', color: '#e74c3c' } : { text: '' }
      });

      // Show/hide "clear skipped" button
      const clearBtn = wrapper.querySelector('#fme-clear-skipped');
      if (clearBtn) clearBtn.style.display = skipped.length ? 'inline-block' : 'none';

      if (rawUpdate && isSkipped) {
        resultEl.innerHTML = `
          <div class="fme-alert fme-alert-warning">
            <strong>v${escHtml(latestVersion)}</strong> este disponibila dar este marcata ca ignorata.
            <br><small>Foloseste butonul de mai jos pentru a sterge versiunile ignorate.</small>
          </div>`;
      } else if (hasUpdate) {
        const counts = countNotesByType((data.changelog || []).find(e => e.version === latestVersion));
        resultEl.innerHTML = `
          <div class="fme-alert fme-alert-update">
            <strong>Versiune noua disponibila: v${escHtml(latestVersion)}</strong>
            ${data.releaseDate ? ` &mdash; ${escHtml(data.releaseDate)}` : ''}
            <br>
            ${counts.feature ? `✨ +${counts.feature} feature${counts.feature > 1 ? 's' : ''}` : ''}
            ${counts.bugfix  ? ` &nbsp; 🐛 +${counts.bugfix} bugfix${counts.bugfix   > 1 ? 'es' : ''}` : ''}
            ${counts.other   ? ` &nbsp; 📝 +${counts.other} other` : ''}
            <br style="margin-bottom:4px;">
            ${data.releaseUrl
              ? `<a href="${escHtml(data.releaseUrl)}" target="_blank" rel="noopener">Vezi release-ul pe GitHub &rarr;</a>`
              : ''}
          </div>
        `;
      } else {
        resultEl.innerHTML = `
          <div class="fme-alert fme-alert-success">
            Esti pe ultima versiune (v${escHtml(currentVersion)}).
          </div>`;
      }

      // Render version warehouse (previous versions for rollback)
      const whResp = await sendMsg('GET_VERSION_WAREHOUSE');
      const warehouse = (whResp && whResp.ok) ? (whResp.warehouse || []) : [];
      if (warehouse.length) {
        vFieldset.style.display = '';
        renderVersionWarehouse(versionsEl, warehouse, currentVersion, latestVersion, skipped);
      }

      // Render changelog
      if (data.changelog && Array.isArray(data.changelog)) {
        renderChangelog(changelogEl, data.changelog, currentVersion);
      }

    } catch (err) {
      resultEl.innerHTML = `
        <div class="fme-alert fme-alert-error">
          <p><strong>Nu s-au putut verifica actualizarile.</strong></p>
          <p class="fme-error-msg">${escHtml(err.message)}</p>
          <p class="fme-error-hint">Verifica conexiunea si setarile GitHub. Daca ai depasit limita API, adauga un token in Setari.</p>
        </div>
      `;
    } finally {
      if (btn) { btn.disabled = false; btn.value = 'Verifica actualizari'; }
    }
  }

  // ─── Changelog renderer ───────────────────────────────────────────────────────

  function renderChangelog(el, changelog, currentVersion) {
    if (!changelog.length) return;

    changelog.forEach(entry => {
      const isInstalled = entry.version === currentVersion;
      const item        = document.createElement('div');
      item.style.cssText = `padding:10px 12px;border:1px solid ${isInstalled ? '#3c9ebf' : '#ddd'};background:${isInstalled ? '#f0f8fc' : '#fafafa'};margin-bottom:8px;`;

      const notes    = (entry.notes || []).map(normalizeNote);
      const features = notes.filter(n => n.type === 'feature');
      const bugfixes = notes.filter(n => n.type === 'bugfix');
      const others   = notes.filter(n => n.type === 'other');

      let notesHtml = '';
      if (features.length || bugfixes.length || others.length) {
        notesHtml = renderNotesGroups(features, bugfixes, others);
      }

      item.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
          <strong>v${escHtml(entry.version)}</strong>
          ${entry.date ? `<span style="font-size:11px;color:#888;">${escHtml(entry.date)}</span>` : ''}
          ${isInstalled ? '<span class="fme-badge fme-badge-installed">Instalata</span>' : ''}
        </div>
        ${notesHtml}
      `;

      el.appendChild(item);
    });
  }

  function renderNotesGroups(features, bugfixes, others) {
    let html = '';
    if (features.length) {
      html += `<div style="margin-bottom:6px;">
        <div class="${TYPE_META.feature.badgeClass}">${TYPE_META.feature.icon} FEATURES</div>
        <ul style="margin:0;padding-left:18px;">${features.map(n => `<li style="font-size:11px;">${escHtml(n.text)}</li>`).join('')}</ul>
      </div>`;
    }
    if (bugfixes.length) {
      html += `<div style="margin-bottom:6px;">
        <div class="${TYPE_META.bugfix.badgeClass}">${TYPE_META.bugfix.icon} BUGFIXES</div>
        <ul style="margin:0;padding-left:18px;">${bugfixes.map(n => `<li style="font-size:11px;">${escHtml(n.text)}</li>`).join('')}</ul>
      </div>`;
    }
    if (others.length) {
      html += `<div style="margin-bottom:6px;">
        <div class="${TYPE_META.other.badgeClass}">${TYPE_META.other.icon} OTHER</div>
        <ul style="margin:0;padding-left:18px;">${others.map(n => `<li style="font-size:11px;">${escHtml(n.text)}</li>`).join('')}</ul>
      </div>`;
    }
    return html;
  }

  // ─── Version warehouse / rollback ─────────────────────────────────────────────

  function renderVersionWarehouse(el, warehouse, currentVersion, latestVersion, skipped) {
    el.innerHTML = '';

    warehouse.forEach((entry) => {
      const isInstalled   = entry.version === currentVersion;
      const isLatest      = entry.version === latestVersion;
      const isSkippedVer  = skipped.includes(entry.version);

      const notes   = (entry.notes || []).map(normalizeNote);
      const counts  = { feature: 0, bugfix: 0, other: 0 };
      notes.forEach(n => { if (counts[n.type] !== undefined) counts[n.type]++; });

      const card = document.createElement('div');
      card.style.cssText = `padding:10px 12px;border:1px solid ${isInstalled ? '#3c9ebf' : (isLatest ? '#f0ad4e' : '#ddd')};background:${isInstalled ? '#f0f8fc' : '#fafafa'};margin-bottom:6px;`;

      const badgeHtml = isLatest
        ? '<span class="fme-badge fme-badge-update">🆕 Noua versiune</span>'
        : (isInstalled ? '<span class="fme-badge fme-badge-installed">Instalata</span>' : '');

      const skippedBadge = isSkippedVer
        ? '<span class="fme-badge" style="background:#fff3e0;border-color:#ffcc80;color:#8a6d3b;">Ignorata</span>'
        : '';

      const countHtml = [
        counts.feature ? `✨ +${counts.feature}` : '',
        counts.bugfix  ? `🐛 +${counts.bugfix}`  : '',
        counts.other   ? `📝 +${counts.other}`   : ''
      ].filter(Boolean).join(' &nbsp; ');

      // Action buttons
      let actionsHtml = '';
      if (isLatest && isNewerVersion(latestVersion, currentVersion)) {
        actionsHtml += `<input type="button" data-action="update" data-version="${escHtml(entry.version)}" data-url="${escHtml(entry.releaseUrl || '')}" value="Actualizeaza" class="icon_ok" style="margin-right:4px;" />`;
        if (isSkippedVer) {
          actionsHtml += `<input type="button" data-action="unskip" data-version="${escHtml(entry.version)}" value="Nu mai ignora" class="icon_ok" />`;
        } else {
          actionsHtml += `<input type="button" data-action="skip" data-version="${escHtml(entry.version)}" value="Ignora versiunea" class="icon_ok" />`;
        }
      } else if (!isInstalled) {
        actionsHtml += `<input type="button" data-action="rollback" data-version="${escHtml(entry.version)}" data-url="${escHtml(entry.releaseUrl || '')}" value="Restaureaza" class="icon_ok" />`;
      }
      if (entry.releaseUrl) {
        actionsHtml += ` <a href="${escHtml(entry.releaseUrl)}" target="_blank" rel="noopener" style="font-size:11px;">Detalii &rarr;</a>`;
      }

      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">
          <strong>v${escHtml(entry.version)}</strong>
          ${entry.date ? `<span style="font-size:11px;color:#888;">${escHtml(entry.date)}</span>` : ''}
          ${badgeHtml} ${skippedBadge}
        </div>
        ${countHtml ? `<div style="font-size:11px;color:#666;margin-bottom:6px;">${countHtml}</div>` : ''}
        ${actionsHtml ? `<div class="div_btns" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">${actionsHtml}</div>` : ''}
      `;

      el.appendChild(card);
    });

    // Bind warehouse action buttons
    el.addEventListener('click', e => {
      const btn = e.target.closest('input[data-action]');
      if (!btn) return;
      const action  = btn.dataset.action;
      const version = btn.dataset.version;
      const url     = btn.dataset.url;
      if (action === 'update' && url)     { chrome.tabs.create({ url }); }
      if (action === 'rollback' && url)   { handleRollback(btn, version, url); }
      if (action === 'skip')              { handleSkip(btn, version); }
      if (action === 'unskip')            { handleUnskip(btn, version); }
    });
  }

  function handleRollback(btn, version, releaseUrl) {
    if (!confirm(`Esti sigur ca vrei sa restaurezi versiunea v${version}?\n\nVei fi redirectionat la pagina de release de pe GitHub unde poti descarca arhiva si o poti incarca manual in Chrome (Load unpacked).`)) return;
    chrome.tabs.create({ url: releaseUrl });
  }

  async function handleSkip(btn, version) {
    const resp = await sendMsg('SKIP_VERSION', { version });
    if (resp && resp.ok) {
      // Re-run check to refresh UI
      const currentVersion = chrome.runtime.getManifest().version;
      const wrapper = _container && _container.querySelector('.fme-updates-wrapper');
      if (wrapper) await checkUpdates(wrapper, currentVersion);
    }
  }

  async function handleUnskip(btn, version) {
    const resp = await sendMsg('UNSKIP_VERSION', { version });
    if (resp && resp.ok) {
      const currentVersion = chrome.runtime.getManifest().version;
      const wrapper = _container && _container.querySelector('.fme-updates-wrapper');
      if (wrapper) await checkUpdates(wrapper, currentVersion);
    }
  }

  // ─── Event binding ─────────────────────────────────────────────────────────────

  function bindEvents(wrapper, currentVersion) {
    wrapper.querySelector('#fme-check-updates').addEventListener('click', () => {
      checkUpdates(wrapper, currentVersion);
    });

    wrapper.querySelector('#fme-notif-settings').addEventListener('click', () => {
      // Navigate to settings tab
      const settingsLink = document.querySelector('[data-section="settings"]');
      if (settingsLink) settingsLink.click();
    });

    wrapper.querySelector('#fme-clear-skipped').addEventListener('click', async () => {
      await sendMsg('CLEAR_SKIPPED_VERSIONS');
      await checkUpdates(wrapper, currentVersion);
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Normalise a note to { type, text }.
   * Handles both plain strings and typed objects.
   */
  function normalizeNote(note) {
    if (typeof note === 'string') {
      return { type: detectType(note), text: note };
    }
    const type = ['feature', 'bugfix', 'other'].includes(note.type) ? note.type : detectType(note.text || '');
    return { type, text: note.text || '' };
  }

  function detectType(text) {
    if (/^(fix|bug|🐛|fixed)/i.test(text))       return 'bugfix';
    if (/^(add|new|feature|✨|🆕|added)/i.test(text)) return 'feature';
    return 'other';
  }

  function countNotesByType(entry) {
    const counts = { feature: 0, bugfix: 0, other: 0 };
    if (!entry) return counts;
    (entry.notes || []).map(normalizeNote).forEach(n => { if (counts[n.type] !== undefined) counts[n.type]++; });
    return counts;
  }

  function sendMsg(type, payload = {}) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage({ type, payload }, resp => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          resolve(resp);
        });
      } catch (_) { resolve(null); }
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
