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

    // About section
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
                <span class="gen">Manager de snippet-uri JavaScript custom cu execuție pe ACP și/sau Forum. Catalog built-in inclus.</span>
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
                <span class="gen" style="font-weight:bold;"><i class="fa fa-wrench"></i> Utile</span>
              </td>
              <td class="row2">
                <span class="gen">Statistici forum, notițe locale, backup/restore complet al configurației FME în format JSON.</span>
              </td>
            </tr>
          </tbody>
        </table>
      </fieldset>
    `;
    wrapper.appendChild(aboutSection);

    // ACP Quick Links section
    const linksSection = document.createElement('div');
    linksSection.style.marginTop = '4px';
    const tid = _tid ? '&tid=' + encodeURIComponent(_tid) : '';
    const ACP_LINKS = [
      { icon: 'fa-sitemap',      label: 'Categorii & Forumuri', href: '/admin/?part=general&sub=forum_01' + tid },
      { icon: 'fa-users',        label: 'Utilizatori',          href: '/admin/?part=users&sub=users' + tid },
      { icon: 'fa-shield',       label: 'Permisiuni',           href: '/admin/?part=general&sub=groups' + tid },
      { icon: 'fa-puzzle-piece', label: 'Module',               href: '/admin/?part=modules' + tid },
      { icon: 'fa-picture-o',    label: 'Imagini & Culori',     href: '/admin/?part=themes&sub=logos' + tid },
      { icon: 'fa-css3',         label: 'CSS (Colors)',         href: '/admin/?part=themes&sub=css' + tid },
      { icon: 'fa-smile-o',      label: 'Smilies',              href: '/admin/?part=general&sub=smilies' + tid },
      { icon: 'fa-star',         label: 'Ranguri',              href: '/admin/?part=general&sub=ranks' + tid },
      { icon: 'fa-ban',          label: 'Ban / IP',             href: '/admin/?part=users&sub=ban' + tid },
      { icon: 'fa-envelope',     label: 'Mesaje private',       href: '/admin/?part=general&sub=pm' + tid },
      { icon: 'fa-globe',        label: 'Pagina de index',      href: '/', target: '_blank' },
      { icon: 'fa-bookmark',     label: 'Chatbox',              href: '/chatbox/', target: '_blank' },
    ];
    let linksRows = '';
    ACP_LINKS.forEach((lnk, i) => {
      const rowClass = i % 2 === 0 ? 'row1' : 'row2';
      const tgt = lnk.target ? ' target="' + lnk.target + '"' : '';
      linksRows += '<tr>' +
        '<td class="' + rowClass + '" style="width:30px;text-align:center;">' +
          '<i class="fa ' + lnk.icon + '" style="color:var(--fme-accent,#3c9ebf);"></i></td>' +
        '<td class="' + rowClass + '">' +
          '<a href="' + escAttr(lnk.href) + '"' + tgt + ' class="gen" style="font-weight:bold;">' +
          escHtml(lnk.label) + '</a></td>' +
      '</tr>';
    });
    linksSection.innerHTML = `
      <fieldset style="margin:0 12px 12px 12px;">
        <legend><i class="fa fa-link"></i> Linkuri rapide ACP</legend>
        <table class="table1 forumline" cellspacing="1" style="margin-bottom:0;">
          <tbody>${linksRows}</tbody>
        </table>
      </fieldset>
    `;
    wrapper.appendChild(linksSection);

    // Changelog section — fetch version.json
    const changelogSection = document.createElement('div');
    changelogSection.style.marginTop = '4px';
    changelogSection.innerHTML = `
      <fieldset style="margin:0 12px 12px 12px;">
        <legend><i class="fa fa-list-alt"></i> Ultimul Changelog</legend>
        <div id="fme-home-changelog">
          <p style="color:var(--fme-muted,#888);font-size:11px;"><i class="fa fa-spinner fa-spin"></i> Se încarcă changelog-ul...</p>
        </div>
      </fieldset>
    `;
    wrapper.appendChild(changelogSection);

    // Support section
    const supportSection = document.createElement('div');
    supportSection.style.marginTop = '4px';
    supportSection.innerHTML = `
      <fieldset style="margin:0 12px 12px 12px;border-color:var(--fme-warn,#f39c12);background:var(--fme-card,#fffdf5);">
        <legend style="color:var(--fme-warn,#e67e22);font-weight:600;">&#128155; Susține proiectul FME</legend>
        <p style="margin:4px 0 10px 0;color:var(--fme-muted,#555);font-size:11px;line-height:1.6;">
          FME (Forumotion Manager Extension) este un proiect open-source gratuit.<br/>
          Dacă îți este util, poți susține dezvoltarea continuă printr-o donație simbolică. Mulțumim!
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <a href="https://ko-fi.com" target="_blank" rel="noopener noreferrer"
             style="display:inline-flex;align-items:center;gap:6px;background:#FF5E5B;color:#fff;padding:7px 14px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">
            &#9749; Ko-fi
          </a>
          <a href="https://github.com/sponsors" target="_blank" rel="noopener noreferrer"
             style="display:inline-flex;align-items:center;gap:6px;background:#24292e;color:#fff;padding:7px 14px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">
            &#10084;&#65039; GitHub Sponsors
          </a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer"
             style="display:inline-flex;align-items:center;gap:6px;background:#4a7ebf;color:#fff;padding:7px 14px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">
            &#11088; GitHub
          </a>
        </div>
        <p style="margin:10px 0 0 0;font-size:10px;color:var(--fme-muted,#aaa);">
          Ai o sugestie sau ai găsit un bug? Deschide un issue pe GitHub.
        </p>
      </fieldset>
    `;
    wrapper.appendChild(supportSection);

    container.appendChild(wrapper);

    // Load changelog from version.json bundled with the extension
    loadChangelog(changelogSection.querySelector('#fme-home-changelog'));
  }

  async function loadChangelog(target) {
    try {
      const url = chrome.runtime.getURL('version.json');
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      const latest = (data.changelog && data.changelog[0]) || null;
      if (!latest) {
        target.innerHTML = '<p style="color:var(--fme-muted,#888);font-size:11px;">Nu s-a găsit changelog.</p>';
        return;
      }

      const TYPE_ICONS = {
        feature: { icon: '&#10024;', color: '#27ae60', label: 'Nou' },
        bugfix:  { icon: '&#128295;', color: '#e74c3c', label: 'Fix' },
        other:   { icon: '&#128196;', color: '#3498db', label: 'Altele' },
      };

      let html = '<div style="margin-bottom:6px;">' +
        '<strong style="font-size:13px;">v' + escHtml(latest.version) + '</strong>' +
        '<span style="color:var(--fme-muted,#888);font-size:11px;margin-left:8px;">' + escHtml(latest.date) + '</span>';
      if (data.releaseUrl) {
        html += ' <a href="' + escAttr(data.releaseUrl) + '" target="_blank" rel="noopener" ' +
          'style="font-size:11px;margin-left:6px;">Vezi pe GitHub &rarr;</a>';
      }
      html += '</div>';

      html += '<table class="table1 forumline" cellspacing="1" style="margin:0;">' +
        '<thead><tr>' +
          '<th class="thbg" style="width:60px;">Tip</th>' +
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
          '<summary style="color:var(--fme-accent,#3c9ebf);font-weight:600;">Versiuni anterioare (' + (data.changelog.length - 1) + ')</summary>';
        for (let v = 1; v < data.changelog.length; v++) {
          const entry = data.changelog[v];
          html += '<div style="margin:6px 0 2px 0;font-weight:600;">v' + escHtml(entry.version) +
            ' <span style="color:var(--fme-muted,#888);font-weight:normal;">(' + escHtml(entry.date) + ')</span></div>' +
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
      target.innerHTML = '<p style="color:var(--fme-error,#e74c3c);font-size:11px;">Nu s-a putut încărca changelog-ul.</p>';
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
