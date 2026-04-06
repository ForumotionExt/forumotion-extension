/**
 * FME Panel (Page mode)
 * Injects a native "FME" tab into the Forumotion ACP top navigation bar and
 * renders a full-page replacement of the main content area when active.
 *
 * Public API (var name kept for popup.js compatibility):
 *   FMEPanel.mount()              — inject FME nav tab (idempotent)
 *   FMEPanel.show(section?)       — show FME page, optionally jump to section
 *   FMEPanel.hide()               — restore native ACP content
 *   FMEPanel.setUpdateBadge(bool) — toggle update indicator dot
 */

var FMEPanel = (() => {
  'use strict';

  const PAGE_ID      = 'fme-page-root content';
  const NAV_TAB_ID   = 'fme-nav-tab';
  const STORAGE_KEY  = 'fme_active_section';

  const SECTIONS = [
    // ── Acasă ─────────────────────────────────────────────────────────────────
    { id: 'home',      label: 'Acasă',           icon: '<i class="fa fa-home"></i>',          group: 'FME' },
    // ── Conținut ────────────────────────────────────────────────────────────────
    { id: 'themes',    label: 'Teme',           icon: '<i class="fa fa-paint-brush"></i>',  group: 'Conținut' },
    { id: 'templates', label: 'Template-uri',   icon: '<i class="fa fa-file-code-o"></i>',  group: 'Conținut' },
    { id: 'plugins',   label: 'Plugins',         icon: '<i class="fa fa-plug"></i>',          group: 'Conținut' },
    // ── CSS & JS ─────────────────────────────────────────────────────────────
    { id: 'acp-css',   label: 'ACP Styles',     icon: '<i class="fa fa-magic"></i>',          group: 'CSS & JS' },
    { id: 'forum-css', label: 'Forum CSS',       icon: '<i class="fa fa-css3"></i>',           group: 'CSS & JS' },
    { id: 'widgets',   label: 'Widgets JS',      icon: '<i class="fa fa-code"></i>',           group: 'CSS & JS' },
    { id: 'chatbox',   label: 'Chatbox',         icon: '<i class="fa fa-comments"></i>',       group: 'CSS & JS' },
    // ── Utile ────────────────────────────────────────────────────────────────
    { id: 'stats',     label: 'Statistici',      icon: '<i class="fa fa-bar-chart"></i>',      group: 'Utile' },
    { id: 'seo',       label: 'SEO Tools',        icon: '<i class="fa fa-search"></i>',         group: 'Utile' },
    { id: 'notes',     label: 'Notițe',          icon: '<i class="fa fa-sticky-note-o"></i>',  group: 'Utile' },
    { id: 'activity',  label: 'Jurnal',           icon: '<i class="fa fa-history"></i>',        group: 'Utile' },
    { id: 'backup',    label: 'Backup',           icon: '<i class="fa fa-database"></i>',        group: 'Utile' },
    // ── Meta ─────────────────────────────────────────────────────────────────
    { id: 'updates',   label: 'Actualizări',     icon: '<i class="fa fa-refresh"></i>',         group: 'Meta' },
    { id: 'settings',  label: 'Setări',          icon: '<i class="fa fa-cog"></i>',             group: 'Meta' },
  ];

  let _pageRoot       = null;   // #fme-page-root element
  let _contentArea    = null;   // #fme-page-content element
  let _navTab         = null;   // <li id="fme-nav-tab"> element
  let _nativeWrapper  = null;   // the ACP main content wrapper we hide/show
  let _prevActiveTab  = null;   // native <li id="activetab"> saved before FME activates
  let _activeSection  = 'home';
  let _visible        = false;
  let _updateBadge    = false;
  let _tid            = '';
  let _acpMode        = false;
  let _savedMenuHTML  = null;
  let _savedMainHTML  = null;

  // ─── Public API ─────────────────────────────────────────────────────────────

  function mount() {
    if (document.getElementById(NAV_TAB_ID)) return; // already mounted

    _activeSection = sessionStorage.getItem(STORAGE_KEY) || 'home';
    _tid = extractTid();

    const topNav = findTopNav();
    if (!topNav) {
      console.warn('[FME] Could not locate ACP top navigation. Tab not injected.');
      return;
    }

    injectNavTab(topNav);

    // Wire up nav click delegation via content.js helper
    if (typeof window.__fmeBindNavClicks === 'function') {
      window.__fmeBindNavClicks(_navTab, topNav);
    }

    // Auto-activate if URL indicates FME page
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('part') === 'fme') {
      const sub = urlParams.get('sub');
      if (sub && SECTIONS.some(s => s.id === sub)) _activeSection = sub;
      show(_activeSection);
    }
  }

  function show(section) {
    if (section) _activeSection = section;

    if (!_visible) {
      // Try ACP-integrated mode: take over native #menu and #main-content
      const acpMenu = document.getElementById('menu');
      const acpMainContent = document.getElementById('main-content');

      if (acpMenu && acpMainContent) {
        _acpMode = true;
        _savedMenuHTML = acpMenu.innerHTML;
        _savedMainHTML = acpMainContent.innerHTML;

        acpMenu.innerHTML = buildAcpSidebar();
        acpMainContent.innerHTML = '';
        _contentArea = acpMainContent;

        bindAcpSidebarEvents(acpMenu);
      } else {
        // Fallback to overlay mode
        _acpMode = false;
        if (!_pageRoot) buildPage();
        if (!_pageRoot) return;

        _nativeWrapper = _nativeWrapper || findContentWrapper();
        if (_nativeWrapper) _nativeWrapper.style.display = 'none';

        _pageRoot.style.display = 'flex';
        _contentArea = _pageRoot.querySelector('#fme-page-content');
      }
    } else if (_acpMode) {
      // Already visible in ACP mode — update sidebar active state
      const acpMenu = document.getElementById('menu');
      if (acpMenu) {
        acpMenu.querySelectorAll('.submenu').forEach(sub => {
          const a = sub.querySelector('a[data-fme-section]');
          if (a) sub.classList.toggle('fme-submenu-active', a.dataset.fmeSection === _activeSection);
        });
      }
    }

    // Swap activetab id
    if (_navTab) {
      _prevActiveTab = document.getElementById('activetab');
      if (_prevActiveTab && _prevActiveTab !== _navTab) _prevActiveTab.removeAttribute('id');
      _navTab.id = 'activetab';
    }

    _visible = true;
    activateSection(_activeSection, true);
  }

  function hide() {
    if (!_visible) return;
    _visible = false;

    if (_acpMode) {
      const acpMenu = document.getElementById('menu');
      const acpMainContent = document.getElementById('main-content');
      if (acpMenu && _savedMenuHTML !== null) {
        acpMenu.innerHTML = _savedMenuHTML;
        _savedMenuHTML = null;
      }
      if (acpMainContent && _savedMainHTML !== null) {
        acpMainContent.innerHTML = _savedMainHTML;
        _savedMainHTML = null;
      }
      _acpMode = false;
      _contentArea = null;
    } else {
      if (_pageRoot) _pageRoot.style.display = 'none';
      if (_nativeWrapper) _nativeWrapper.style.display = '';
    }

    // Restore activetab id
    if (_navTab) {
      _navTab.id = NAV_TAB_ID;
      if (_prevActiveTab) _prevActiveTab.id = 'activetab';
      _prevActiveTab = null;
    }
  }

  function setUpdateBadge(show) {
    _updateBadge = show;
    const dot = document.querySelector('#fme-nav-tab .fme-update-dot');
    if (dot) dot.style.display = show ? 'inline' : 'none';

    // Also update the sidebar dot if the page is built
    const sidebarDot = _pageRoot
      ? _pageRoot.querySelector('.fme-nav-cat[data-section="updates"] .fme-update-dot')
      : null;
    if (sidebarDot) sidebarDot.style.display = show ? 'inline' : 'none';
  }

  // ─── URL & ACP integration ──────────────────────────────────────────────────

  function extractTid() {
    const params = new URLSearchParams(window.location.search);
    return params.get('tid') || '';
  }

  function buildFmeUrl(section) {
    let url = '/admin/?part=fme';
    if (section) url += '&sub=' + encodeURIComponent(section);
    if (_tid) url += '&tid=' + encodeURIComponent(_tid);
    return url;
  }

  function buildAcpSidebar() {
    const GROUP_ICONS = {
      'Conținut': 'fa-paint-brush',
      'CSS & JS': 'fa-code',
      'Utile':    'fa-wrench',
      'Meta':     'fa-cog',
      'FME':      'fa-home',
    };

    let html = '<div class="header">&nbsp;FME Extension</div>';

    const groups = [];
    let current = null;
    for (const s of SECTIONS) {
      if (!current || current.name !== s.group) {
        current = { name: s.group, items: [] };
        groups.push(current);
      }
      current.items.push(s);
    }

    for (const g of groups) {
      const icon = GROUP_ICONS[g.name] || 'fa-folder';
      const escapedName = g.name.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      html +=
        '<div class="coins-top">' +
          '<div class="left-top">&nbsp;&nbsp;<i class="fa ' + icon + '"></i>&nbsp;' +
            escapedName + '</div>' +
        '</div>' +
        '<br clear="all">' +
        '<div class="coins-border">';

      for (const s of g.items) {
        const active = s.id === _activeSection ? ' fme-submenu-active' : '';
        html +=
          '<div class="submenu' + active + '">' +
            '<a href="' + buildFmeUrl(s.id) + '" data-fme-section="' + s.id + '">' +
              '<span>' + s.icon + ' ' + s.label +
                (s.id === 'updates' && _updateBadge
                  ? ' <span class="fme-update-dot" style="color:#e74c3c;font-size:9px;">●</span>'
                  : '') +
              '</span>' +
            '</a>' +
          '</div>';
      }
      html += '</div><br clear="all"><br>';
    }

    return html;
  }

  function bindAcpSidebarEvents(menuEl) {
    menuEl.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-fme-section]');
      if (!link) return;
      e.preventDefault();

      const section = link.dataset.fmeSection;
      if (!section || section === _activeSection) return;

      _activeSection = section;
      sessionStorage.setItem(STORAGE_KEY, section);

      // Update URL without reload
      history.replaceState(null, '', buildFmeUrl(section));

      // Update sidebar active state
      menuEl.querySelectorAll('.submenu').forEach(sub => {
        const a = sub.querySelector('a[data-fme-section]');
        if (a) sub.classList.toggle('fme-submenu-active', a.dataset.fmeSection === section);
      });

      activateSection(section, true);
    });
  }

  // ─── Nav tab injection ───────────────────────────────────────────────────────

  function findTopNav() {
    // Strategy 1: explicit admin menu containers
    const explicit = [
      document.querySelector('#tabs ul'),          // Forumotion ACP exact selector
      document.querySelector('#admin_menu ul'),
      document.querySelector('.nav_admin ul'),
      document.querySelector('ul.nav'),
      document.querySelector('#header ul'),
      document.querySelector('#top_menu ul'),
      document.querySelector('.top_nav ul'),
      document.querySelector('nav ul'),
    ];
    for (const el of explicit) {
      if (el && el.querySelectorAll('li').length > 0) return el;
    }

    // Strategy 2: find a <ul> whose <a> elements link to /admin paths
    const allUls = Array.from(document.querySelectorAll('ul'));
    for (const ul of allUls) {
      const links = ul.querySelectorAll('a[href]');
      const adminLinks = Array.from(links).filter(a =>
        /\/admin/.test(a.getAttribute('href'))
      );
      if (adminLinks.length >= 2) return ul;
    }

    // Strategy 3: largest <ul> in the header/top area (heuristic)
    const headerContainers = document.querySelectorAll('header, #header, .header, #top, .top');
    for (const container of headerContainers) {
      const uls = container.querySelectorAll('ul');
      if (uls.length > 0) return uls[0];
    }

    return null;
  }

  function injectNavTab(topNavUl) {
    _navTab = document.createElement('li');
    _navTab.id = NAV_TAB_ID;

    const link = document.createElement('a');
    link.href = buildFmeUrl();

    // Wrap text in <span> to match native tab structure: <a><span>Label</span></a>
    const labelSpan = document.createElement('span');
    labelSpan.textContent = 'FME';
    link.appendChild(labelSpan);

    // Update dot (hidden by default)
    const dot = document.createElement('span');
    dot.className = 'fme-update-dot';
    dot.textContent = '\u25CF'; // filled circle
    dot.style.display = _updateBadge ? 'inline' : 'none';
    link.appendChild(dot);

    _navTab.appendChild(link);

    // Insert before #admin_search (the search box li) so FME stays in the nav flow
    const adminSearch = topNavUl.querySelector('#admin_search');
    if (adminSearch) {
      topNavUl.insertBefore(_navTab, adminSearch);
    } else {
      topNavUl.appendChild(_navTab);
    }
  }

  // ─── Page DOM construction ───────────────────────────────────────────────────

  function findContentWrapper() {
    const candidates = [
      document.querySelector('#admin_content'),
      document.querySelector('.admin_content'),
      document.querySelector('#right_col'),
      document.querySelector('.right_col'),
      document.querySelector('#content_admin'),
      document.querySelector('#main_content'),
      document.querySelector('.main_content'),
      document.querySelector('div.content'),
      document.querySelector('#content'),
      document.querySelector('.content'),
    ];

    const found = candidates.find(el => el !== null);
    if (found) return found;

    // Heuristic fallback: find the largest <div> that is a sibling of
    // a nav/sidebar element and likely holds the page body.
    const body = document.body;
    const divs = Array.from(body.querySelectorAll('div')).filter(d => {
      const rect = d.getBoundingClientRect();
      return rect.width > 400 && rect.height > 200;
    });
    // Sort by area descending, skip elements that contain the nav tab
    divs.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (rb.width * rb.height) - (ra.width * ra.height);
    });
    for (const d of divs) {
      if (!d.contains(_navTab) && !d.querySelector('#admin_menu')) {
        return d;
      }
    }

    return null;
  }

  function findNativeSidebar() {
    const candidates = [
      document.querySelector('#left_col'),
      document.querySelector('.left_col'),
      document.querySelector('#nav_admin'),
      document.querySelector('#admin_nav'),
      document.querySelector('.admin_left'),
      document.querySelector('#menu_admin'),
    ];
    return candidates.find(el => el !== null) || null;
  }

  function buildPage() {
    // Locate the native content wrapper early so we can insert next to it
    _nativeWrapper = findContentWrapper();

    _pageRoot = document.createElement('div');
    _pageRoot.id = PAGE_ID;
    _pageRoot.style.display = 'none'; // hidden until show() is called

    _pageRoot.innerHTML = buildPageHTML();

    // Insert adjacent to native content, or fall back to body
    if (_nativeWrapper && _nativeWrapper.parentNode) {
      _nativeWrapper.parentNode.insertBefore(_pageRoot, _nativeWrapper.nextSibling);
    } else {
      document.body.appendChild(_pageRoot);
    }

    _contentArea = _pageRoot.querySelector('#fme-page-content');

    // Match native sidebar width dynamically
    const nativeSidebar = findNativeSidebar();
    if (nativeSidebar) {
      const w = nativeSidebar.offsetWidth;
      if (w > 50) {
        const sidebar = _pageRoot.querySelector('#fme-page-sidebar');
        if (sidebar) { sidebar.style.width = w + 'px'; sidebar.style.minWidth = w + 'px'; }
      }
    }

    bindPageEvents();
  }

  function buildPageHTML() {
    let items    = '';
    let lastGroup = null;

    for (const s of SECTIONS) {
      if (s.group && s.group !== lastGroup) {
        lastGroup = s.group;
        items += `<li class="fme-nav-group-label">${s.group}</li>`;
      }
      items += `
        <li class="fme-nav-item">
          <a href="#" class="fme-nav-cat${s.id === _activeSection ? ' fme-nav-cat--active' : ''}"
             data-section="${s.id}">
            <span class="fme-nav-icon">${s.icon}</span>
            <span class="fme-nav-label">${s.label}</span>
            ${s.id === 'updates'
              ? `<span class="fme-update-dot" style="display:${_updateBadge ? 'inline' : 'none'}">●</span>`
              : ''}
          </a>
        </li>
      `;
    }

    return `
      <div id="fme-page-sidebar">
        <p class="fme-nav-section-title">FME</p>
        <ul class="fme-nav-list">
          ${items}
        </ul>
      </div>
      <div id="fme-page-content"></div>
    `;
  }

  // ─── Events ──────────────────────────────────────────────────────────────────

  function bindPageEvents() {
    // Sidebar link clicks
    _pageRoot.querySelector('#fme-page-sidebar').addEventListener('click', (e) => {
      e.preventDefault();
      const a = e.target.closest('.fme-nav-cat');
      if (!a) return;
      const section = a.dataset.section;
      if (section && section !== _activeSection) {
        activateSection(section, true);
      }
    });

    // Escape key hides the FME page
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _visible) hide();
    });
  }

  // ─── Section rendering ────────────────────────────────────────────────────────

  function activateSection(sectionId, doRender) {
    _activeSection = sectionId;
    sessionStorage.setItem(STORAGE_KEY, sectionId);

    // Update sidebar active state
    if (_pageRoot) {
      _pageRoot.querySelectorAll('.fme-nav-cat').forEach(a => {
        a.classList.toggle('fme-nav-cat--active', a.dataset.section === sectionId);
      });
    }

    if (!doRender || !_contentArea) return;

    // Always re-render dynamic tabs; lazy-render everything else
    const ALWAYS_RERENDER = new Set(['home', 'updates', 'stats', 'notes', 'backup', 'activity', 'seo', 'plugins']);
    const alreadyRendered = _contentArea.dataset.renderedSection === sectionId;
    if (alreadyRendered && !ALWAYS_RERENDER.has(sectionId)) return;

    renderSection(sectionId);
    _contentArea.dataset.renderedSection = sectionId;
  }

  function renderSection(sectionId) {
    // Scroll content area back to top
    if (_contentArea) _contentArea.scrollTop = 0;

    switch (sectionId) {
      case 'home':
        renderHomePage(_contentArea);
        break;
      case 'themes':
        if (typeof FMEThemesTab !== 'undefined') {
          FMEThemesTab.render(_contentArea);
        } else {
          showMissingModule(_contentArea, 'FMEThemesTab');
        }
        break;
      case 'templates':
        if (typeof FMETemplatesTab !== 'undefined') {
          FMETemplatesTab.render(_contentArea);
        } else {
          showMissingModule(_contentArea, 'FMETemplatesTab');
        }
        break;
      case 'updates':
        if (typeof FMEUpdatesTab !== 'undefined') {
          FMEUpdatesTab.render(_contentArea);
        } else {
          showMissingModule(_contentArea, 'FMEUpdatesTab');
        }
        break;
      case 'acp-css':
        if (typeof FMEAcpCssTab !== 'undefined') FMEAcpCssTab.render(_contentArea);
        else showMissingModule(_contentArea, 'FMEAcpCssTab');
        break;
      case 'forum-css':
        if (typeof FMEForumCssTab !== 'undefined') FMEForumCssTab.render(_contentArea);
        else showMissingModule(_contentArea, 'FMEForumCssTab');
        break;
      case 'widgets':
        if (typeof FMEWidgetsTab !== 'undefined') FMEWidgetsTab.render(_contentArea);
        else showMissingModule(_contentArea, 'FMEWidgetsTab');
        break;
      case 'chatbox':
        if (typeof FMEChatboxTab !== 'undefined') FMEChatboxTab.render(_contentArea);
        else showMissingModule(_contentArea, 'FMEChatboxTab');
        break;
      case 'plugins':
        if (typeof FMEPluginsTab !== 'undefined') FMEPluginsTab.render(_contentArea);
        else showMissingModule(_contentArea, 'FMEPluginsTab');
        break;
      case 'stats':
        if (typeof FMEStatsTab !== 'undefined') FMEStatsTab.render(_contentArea);
        else showMissingModule(_contentArea, 'FMEStatsTab');
        break;
      case 'notes':
        if (typeof FMENotesTab !== 'undefined') FMENotesTab.render(_contentArea);
        else showMissingModule(_contentArea, 'FMENotesTab');
        break;
      case 'backup':
        if (typeof FMEBackupTab !== 'undefined') FMEBackupTab.render(_contentArea);
        else showMissingModule(_contentArea, 'FMEBackupTab');
        break;
      case 'settings':
        if (typeof FMESettingsTab !== 'undefined') FMESettingsTab.render(_contentArea);
        else showMissingModule(_contentArea, 'FMESettingsTab');
        break;
      case 'activity':
        if (typeof FMEActivityLog !== 'undefined') FMEActivityLog.render(_contentArea);
        else showMissingModule(_contentArea, 'FMEActivityLog');
        break;
      case 'seo':
        if (typeof FMESeoTab !== 'undefined') FMESeoTab.render(_contentArea);
        else showMissingModule(_contentArea, 'FMESeoTab');
        break;
      default:
        _contentArea.innerHTML = '';
    }
  }

  function showMissingModule(container, moduleName) {
    container.innerHTML = `
      <div class="fme-alert fme-alert-error">
        Modulul <strong>${moduleName}</strong> nu a fost incarcat.
      </div>
    `;
  }

  // ─── Home page ────────────────────────────────────────────────────────────────

  function renderHomePage(container) {
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'main-content';
    wrapper.id        = 'main-content';
    wrapper.style.fontSize = '12px';

    // Header
    wrapper.innerHTML = `
      <div class="fme-section-header">
        <h2 class="fme-section-title">FME</h2>
        <ul class="h2-breadcrumb clearfix"><li class="first">Acasă</li></ul>
        <blockquote class="block_left">
          <p class="explain">
            <strong>Forumotion Manager Extension</strong> — extensie Chrome open-source pentru administrarea avansată a forumurilor Forumotion.
          </p>
        </blockquote>
      </div>
    `;

    // ── Quick Stats + Download/Update cards ─────────────────────────────────
    const statsSection = document.createElement('div');
    statsSection.innerHTML = `
      <fieldset style="margin:0 12px 12px 12px;">
        <legend><i class="fa fa-dashboard"></i> Privire de ansamblu</legend>
        <div id="fme-home-stats" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:10px;">
          <div class="fme-stat-card" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#16a34a;" id="fme-stat-widgets">—</div>
            <div style="font-size:11px;color:#666;margin-top:2px;"><i class="fa fa-code"></i> Widgets instalate</div>
          </div>
          <div class="fme-stat-card" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#2563eb;" id="fme-stat-published">—</div>
            <div style="font-size:11px;color:#666;margin-top:2px;"><i class="fa fa-globe"></i> Publicate pe forum</div>
          </div>
          <div class="fme-stat-card" style="background:#fefce8;border:1px solid #fde68a;border-radius:6px;padding:12px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ca8a04;" id="fme-stat-themes">—</div>
            <div style="font-size:11px;color:#666;margin-top:2px;"><i class="fa fa-paint-brush"></i> Teme disponibile</div>
          </div>
          <div class="fme-stat-card" style="background:#fdf2f8;border:1px solid #fbcfe8;border-radius:6px;padding:12px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#db2777;" id="fme-stat-version">—</div>
            <div style="font-size:11px;color:#666;margin-top:2px;"><i class="fa fa-tag"></i> Versiune FME</div>
          </div>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;">
          <a href="https://github.com/ForumotionExt/forumotion-extension/releases/latest" target="_blank" rel="noopener noreferrer"
             style="display:inline-flex;align-items:center;gap:6px;background:#2563eb;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">
            <i class="fa fa-download"></i> Download ultima versiune
          </a>
          <a href="https://github.com/ForumotionExt/forumotion-extension/releases" target="_blank" rel="noopener noreferrer"
             style="display:inline-flex;align-items:center;gap:6px;background:#16a34a;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">
            <i class="fa fa-refresh"></i> Verifică actualizări
          </a>
          <a href="https://github.com/ForumotionExt/forumotion-extension" target="_blank" rel="noopener noreferrer"
             style="display:inline-flex;align-items:center;gap:6px;background:#24292e;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">
            <i class="fa fa-github"></i> GitHub repo
          </a>
        </div>
      </fieldset>
    `;
    wrapper.appendChild(statsSection);

    // Load quick stats async
    loadQuickStats();

    // ── Features overview ────────────────────────────────────────────────────
    const aboutSection = document.createElement('div');
    aboutSection.innerHTML = `
      <fieldset style="margin:0 12px 12px 12px;">
        <legend><i class="fa fa-info-circle"></i> Ce face extensia?</legend>
        <table class="table1 forumline" cellspacing="1" style="margin-bottom:0;">
          <tbody>
            <tr>
              <td class="row1" style="width:30%;vertical-align:top;">
                <span class="gen" style="font-weight:bold;"><i class="fa fa-paint-brush"></i> Teme & CSS</span>
              </td>
              <td class="row2">
                <span class="gen">Browse, instalare și preview teme CSS din catalog GitHub. Editor CSS pentru ACP și Forum cu preseturi.</span>
              </td>
            </tr>
            <tr>
              <td class="row1" style="vertical-align:top;">
                <span class="gen" style="font-weight:bold;"><i class="fa fa-file-code-o"></i> Template-uri</span>
              </td>
              <td class="row2">
                <span class="gen">Editare directă a template-urilor Forumotion (overall_header, overall_footer, etc.) cu preview live.</span>
              </td>
            </tr>
            <tr>
              <td class="row1" style="vertical-align:top;">
                <span class="gen" style="font-weight:bold;"><i class="fa fa-code"></i> Widgets JS</span>
              </td>
              <td class="row2">
                <span class="gen">Manager de snippet-uri JavaScript custom cu execuție pe ACP și/sau Forum. Catalog built-in inclus. Publicare directă pe forum.</span>
              </td>
            </tr>
            <tr>
              <td class="row1" style="vertical-align:top;">
                <span class="gen" style="font-weight:bold;"><i class="fa fa-comments"></i> Chatbox</span>
              </td>
              <td class="row2">
                <span class="gen">Chatbox custom care înlocuiește chatbox-ul nativ Forumotion cu UI modern și butoane funcționale.</span>
              </td>
            </tr>
            <tr>
              <td class="row1" style="vertical-align:top;">
                <span class="gen" style="font-weight:bold;"><i class="fa fa-bar-chart"></i> Statistici & SEO</span>
              </td>
              <td class="row2">
                <span class="gen">Dashboard statistici forum, analiză SEO cu meta tags, heading-uri, sitemap și audit complet.</span>
              </td>
            </tr>
            <tr>
              <td class="row1" style="vertical-align:top;">
                <span class="gen" style="font-weight:bold;"><i class="fa fa-database"></i> Backup & Jurnal</span>
              </td>
              <td class="row2">
                <span class="gen">Backup/restore complet al configurației FME în format JSON. Jurnal automat al tuturor acțiunilor.</span>
              </td>
            </tr>
          </tbody>
        </table>
      </fieldset>
    `;
    wrapper.appendChild(aboutSection);

    // Changelog section — fetch version.json
    const changelogSection = document.createElement('div');
    changelogSection.style.marginTop = '4px';
    changelogSection.innerHTML = `
      <fieldset style="margin:0 12px 12px 12px;">
        <legend><i class="fa fa-list-alt"></i> Ultimul Changelog</legend>
        <div id="fme-home-changelog">
          <p style="color:#888;font-size:11px;"><i class="fa fa-spinner fa-spin"></i> Se încarcă changelog-ul...</p>
        </div>
      </fieldset>
    `;
    wrapper.appendChild(changelogSection);

    // Roadmap section
    const roadmapSection = document.createElement('div');
    roadmapSection.style.marginTop = '4px';
    roadmapSection.innerHTML = `
      <fieldset style="margin:0 12px 12px 12px;">
        <legend><i class="fa fa-road"></i> Roadmap — Funcționalități viitoare</legend>
        <div id="fme-home-roadmap">
          <p style="color:#888;font-size:11px;"><i class="fa fa-spinner fa-spin"></i> Se încarcă roadmap-ul...</p>
        </div>
      </fieldset>
    `;
    wrapper.appendChild(roadmapSection);

    // Support section
    const supportSection = document.createElement('div');
    supportSection.style.marginTop = '4px';
    supportSection.innerHTML = `
      <fieldset class="fme-support-box">
        <legend>&#128155; Susține proiectul FME</legend>
        <p class="fme-support-copy">
          FME (Forumotion Manager Extension) este un proiect open-source gratuit.<br/>
          Dacă îți este util, poți susține dezvoltarea continuă printr-o donație simbolică. Mulțumim!
        </p>
        <div class="fme-support-links" style="margin:10px auto 10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;align-items:stretch;">
          <a href="https://ko-fi.com/fmestaark" target="_blank" rel="noopener noreferrer" class="fme-support-link fme-support-link--kofi"
             style="display:grid;grid-template-columns:22px minmax(0,1fr);align-items:center;gap:10px;min-height:60px;padding:10px 12px;background:color-mix(in srgb, #ff5e5b 16%, var(--fme-card, var(--fme-ui-card, #1a1f2e)));color:color-mix(in srgb, #ffb3b1 75%, var(--fme-text, var(--fme-ui-text, #e2e8f0)));border:1px solid color-mix(in srgb, #ff5e5b 45%, var(--fme-border, var(--fme-ui-border, #2d3748)));border-radius:10px;text-decoration:none;font-size:11px;font-weight:700;line-height:1.15;">
            <span class="fme-support-link-icon" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;font-size:15px;line-height:1;">&#9749;</span>
            <span class="fme-support-link-text" style="display:flex;flex-direction:column;gap:2px;min-width:0;">
              <span class="fme-support-link-title" style="font-size:11px;font-weight:700;color:inherit;">Ko-fi</span>
              <span class="fme-support-link-subtitle" style="font-size:10px;font-weight:500;color:var(--fme-muted, var(--fme-ui-muted, #94a3b8));">Donație rapidă</span>
            </span>
          </a>
          <a href="https://github.com/sponsors" target="_blank" rel="noopener noreferrer" class="fme-support-link fme-support-link--sponsor"
             style="display:grid;grid-template-columns:22px minmax(0,1fr);align-items:center;gap:10px;min-height:60px;padding:10px 12px;background:color-mix(in srgb, #db2777 14%, var(--fme-card, var(--fme-ui-card, #1a1f2e)));color:color-mix(in srgb, #ff8fc6 78%, var(--fme-text, var(--fme-ui-text, #e2e8f0)));border:1px solid color-mix(in srgb, #db2777 42%, var(--fme-border, var(--fme-ui-border, #2d3748)));border-radius:10px;text-decoration:none;font-size:11px;font-weight:700;line-height:1.15;">
            <span class="fme-support-link-icon" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;font-size:15px;line-height:1;">&#10084;&#65039;</span>
            <span class="fme-support-link-text" style="display:flex;flex-direction:column;gap:2px;min-width:0;">
              <span class="fme-support-link-title" style="font-size:11px;font-weight:700;color:inherit;">GitHub Sponsors</span>
              <span class="fme-support-link-subtitle" style="font-size:10px;font-weight:500;color:var(--fme-muted, var(--fme-ui-muted, #94a3b8));">Susținere lunară</span>
            </span>
          </a>
          <a href="https://github.com/ForumotionExt/forumotion-extension" target="_blank" rel="noopener noreferrer" class="fme-support-link fme-support-link--github"
             style="display:grid;grid-template-columns:22px minmax(0,1fr);align-items:center;gap:10px;min-height:60px;padding:10px 12px;background:color-mix(in srgb, #4a7ebf 14%, var(--fme-card, var(--fme-ui-card, #1a1f2e)));color:color-mix(in srgb, #8bb6ee 80%, var(--fme-text, var(--fme-ui-text, #e2e8f0)));border:1px solid color-mix(in srgb, #4a7ebf 42%, var(--fme-border, var(--fme-ui-border, #2d3748)));border-radius:10px;text-decoration:none;font-size:11px;font-weight:700;line-height:1.15;">
            <span class="fme-support-link-icon" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;font-size:15px;line-height:1;">&#11088;</span>
            <span class="fme-support-link-text" style="display:flex;flex-direction:column;gap:2px;min-width:0;">
              <span class="fme-support-link-title" style="font-size:11px;font-weight:700;color:inherit;">Star pe GitHub</span>
              <span class="fme-support-link-subtitle" style="font-size:10px;font-weight:500;color:var(--fme-muted, var(--fme-ui-muted, #94a3b8));">Sprijin gratuit</span>
            </span>
          </a>
        </div>
        <p class="fme-support-note">
          Ai o sugestie sau ai găsit un bug? <a href="https://github.com/ForumotionExt/forumotion-extension/issues" target="_blank" rel="noopener">Deschide un issue pe GitHub</a>.
        </p>
      </fieldset>
    `;
    wrapper.appendChild(supportSection);

    container.appendChild(wrapper);

    // Load changelog from version.json bundled with the extension
    loadChangelog(changelogSection.querySelector('#fme-home-changelog'));
    loadRoadmap(roadmapSection.querySelector('#fme-home-roadmap'));
  }

  async function loadQuickStats() {
    // Version
    try {
      const verUrl = chrome.runtime.getURL('version.json');
      const verRes = await fetch(verUrl);
      if (verRes.ok) {
        const verData = await verRes.json();
        const el = document.getElementById('fme-stat-version');
        if (el) el.textContent = 'v' + (verData.version || '?');
      }
    } catch (_) {}

    // Widgets count
    try {
      chrome.storage.local.get({ fme_widgets: [] }, result => {
        const widgets = Array.isArray(result.fme_widgets) ? result.fme_widgets : [];
        const total = widgets.length;
        const published = widgets.filter(w => w.published).length;
        const elW = document.getElementById('fme-stat-widgets');
        const elP = document.getElementById('fme-stat-published');
        if (elW) elW.textContent = total;
        if (elP) elP.textContent = published;
      });
    } catch (_) {}

    // Themes count (load from the actual GitHub catalog)
    try {
      const el = document.getElementById('fme-stat-themes');
      if (el) el.textContent = '...';

      let count = null;
      if (typeof FMEGitHub !== 'undefined' && FMEGitHub.getSettings && FMEGitHub.fetchJSON) {
        const settings = await FMEGitHub.getSettings();
        const catalog = await FMEGitHub.fetchJSON(
          settings.themesOwner,
          settings.themesRepo,
          'index.json',
          'main',
          settings.githubToken || null
        );
        if (catalog && Array.isArray(catalog.themes)) {
          count = catalog.themes.length;
        }
      }

      if (count == null) {
        chrome.storage.local.get({ fme_installed_themes: {} }, result => {
          const installed = result.fme_installed_themes && typeof result.fme_installed_themes === 'object'
            ? Object.keys(result.fme_installed_themes).length
            : 0;
          if (el) el.textContent = installed;
        });
      } else if (el) {
        el.textContent = count;
      }
    } catch (_) {
      const el = document.getElementById('fme-stat-themes');
      if (el) el.textContent = '0';
    }
  }

  async function loadRoadmap(target) {
    try {
      const url = chrome.runtime.getURL('version.json');
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      const items = data.roadmap || data.futures || [];
      if (!items.length) {
        target.innerHTML = '<p style="color:#888;font-size:11px;">Niciun element în roadmap.</p>';
        return;
      }

      const STATUS_STYLE = {
        planned:     { icon: '&#128203;', color: '#3498db', label: 'Planificat' },
        'in-progress': { icon: '&#9881;&#65039;', color: '#e67e22', label: 'În lucru' },
        done:        { icon: '&#9989;', color: '#27ae60', label: 'Finalizat' },
      };

      let html = '<table class="table1 forumline" cellspacing="1" style="margin:0;">' +
        '<thead><tr>' +
          '<th class="thbg" style="width:150px;">Status</th>' +
          '<th class="thbg">Funcționalitate</th>' +
        '</tr></thead><tbody>';

      items.forEach((item, i) => {
        const s = STATUS_STYLE[item.status] || STATUS_STYLE.planned;
        const rowClass = i % 2 === 0 ? 'row1' : 'row2';
        html += '<tr>' +
          '<td class="' + rowClass + '" style="text-align:center;">' +
            '<span style="background:' + s.color + ';color:#fff;padding:3px 6px;border-radius:3px;font-size:10px;font-weight:600;">' +
              s.icon + ' ' + s.label + '</span>' +
          '</td>' +
          '<td class="' + rowClass + '">' +
            '<span class="gen" style="font-weight:600;">' + escHtml(item.title) + '</span>' +
            '<br/><span class="gen" style="font-size:11px;color:#666;">' + escHtml(item.description) + '</span>' +
          '</td>' +
        '</tr>';
      });

      html += '</tbody></table>';
      target.innerHTML = html;
    } catch (e) {
      console.warn('[FME] Failed to load roadmap:', e);
      target.innerHTML = '<p style="color:#e74c3c;font-size:11px;">Nu s-a putut încărca roadmap-ul.</p>';
    }
  }

  async function loadChangelog(target) {
    try {
      const url = chrome.runtime.getURL('version.json');
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      const latest = (data.changelog && data.changelog[0]) || null;
      if (!latest) {
        target.innerHTML = '<p style="color:#888;font-size:11px;">Nu s-a găsit changelog.</p>';
        return;
      }

      const TYPE_ICONS = {
        feature: { icon: '&#10024;', color: '#27ae60', label: 'Nou' },
        bugfix:  { icon: '&#128295;', color: '#e74c3c', label: 'Fix' },
        other:   { icon: '&#128196;', color: '#3498db', label: 'Altele' },
      };

      let html = '<div style="margin-bottom:6px;">' +
        '<strong style="font-size:13px;">v' + escHtml(latest.version) + '</strong>' +
        '<span style="color:#888;font-size:11px;margin-left:8px;">' + escHtml(latest.date) + '</span>';
      if (data.releaseUrl) {
        html += ' <a href="' + escAttr(data.releaseUrl) + '" target="_blank" rel="noopener" ' +
          'style="font-size:11px;margin-left:6px;">Vezi pe GitHub &rarr;</a>';
      }
      html += '</div>';

      html += '<table class="table1 forumline" cellspacing="1" style="margin:0;">' +
        '<thead><tr>' +
          '<th class="thbg" style="width:120px;">Tip</th>' +
          '<th class="thbg">Descriere</th>' +
        '</tr></thead><tbody>';

      (latest.notes || []).forEach((note, i) => {
        const t = TYPE_ICONS[note.type] || TYPE_ICONS.other;
        const rowClass = i % 2 === 0 ? 'row1' : 'row2';
        html += '<tr>' +
          '<td class="' + rowClass + '" style="text-align:center;">' +
            '<span style="background:' + t.color + ';color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;">' +
              t.icon + ' ' + t.label + '</span>' +
          '</td>' +
          '<td class="' + rowClass + '"><span class="gen">' + escHtml(note.text) + '</span></td>' +
        '</tr>';
      });

      html += '</tbody></table>';

      // older versions summary
      if (data.changelog.length > 1) {
        html += '<details style="margin-top:8px;font-size:11px;cursor:pointer;">' +
          '<summary style="color:#3c9ebf;font-weight:600;">Versiuni anterioare (' + (data.changelog.length - 1) + ')</summary>';
        for (let v = 1; v < data.changelog.length; v++) {
          const entry = data.changelog[v];
          html += '<div style="margin:6px 0 2px 0;font-weight:600;">v' + escHtml(entry.version) +
            ' <span style="color:#888;font-weight:normal;">(' + escHtml(entry.date) + ')</span></div>' +
            '<ul style="margin:0 0 0 16px;padding:0;">';
          (entry.notes || []).forEach(n => {
            const t = TYPE_ICONS[n.type] || TYPE_ICONS.other;
            html += '<li style="margin:2px 0;">' +
              '<span style="color:' + t.color + ';font-size:10px;">' + t.icon + '</span> ' +
              escHtml(n.text) + '</li>';
          });
          html += '</ul>';
        }
        html += '</details>';
      }

      target.innerHTML = html;
    } catch (e) {
      console.warn('[FME] Failed to load changelog:', e);
      target.innerHTML = '<p style="color:#e74c3c;font-size:11px;">Nu s-a putut încărca changelog-ul.</p>';
    }
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escAttr(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Exports ──────────────────────────────────────────────────────────────────

  return { mount, show, hide, setUpdateBadge };
})();
