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
    { id: 'themes',    label: 'Teme',          icon: '<i class="fa fa-gears"></i>' },
    { id: 'templates', label: 'Template-uri',  icon: '<i class="fa fa-file-code-o"></i>' },
    { id: 'updates',   label: 'Actualizări',    icon: '<i class="fa fa-refresh"></i>' },
    { id: 'settings',  label: 'Setări',         icon: '<i class="fa fa-cog"></i>' },
  ];

  let _pageRoot       = null;   // #fme-page-root element
  let _contentArea    = null;   // #fme-page-content element
  let _navTab         = null;   // <li id="fme-nav-tab"> element
  let _nativeWrapper  = null;   // the ACP main content wrapper we hide/show
  let _prevActiveTab  = null;   // native <li id="activetab"> saved before FME activates
  let _activeSection  = 'themes';
  let _visible        = false;
  let _updateBadge    = false;

  // ─── Public API ─────────────────────────────────────────────────────────────

  function mount() {
    if (document.getElementById(NAV_TAB_ID)) return; // already mounted

    _activeSection = sessionStorage.getItem(STORAGE_KEY) || 'themes';

    const topNav = findTopNav();
    if (!topNav) {
      console.warn('[FME] Could not locate ACP top navigation. Tab not injected.');
      return;
    }

    injectNavTab(topNav);
    buildPage();

    // Wire up nav click delegation via content.js helper
    if (typeof window.__fmeBindNavClicks === 'function') {
      window.__fmeBindNavClicks(_navTab, topNav);
    }
  }

  function show(section) {
    if (!_pageRoot) mount();
    if (!_pageRoot) return; // mount failed (no nav found)

    if (section) _activeSection = section;

    // Hide native content
    _nativeWrapper = _nativeWrapper || findContentWrapper();
    if (_nativeWrapper) _nativeWrapper.style.display = 'none';

    // Swap activetab id: remove from native active tab, give to FME tab
    if (_navTab) {
      _prevActiveTab = document.getElementById('activetab');
      if (_prevActiveTab) _prevActiveTab.removeAttribute('id');
      _navTab.id = 'activetab';
    }

    // Show FME page
    _pageRoot.style.display = 'flex';
    _visible = true;

    activateSection(_activeSection, true);
  }

  function hide() {
    if (!_visible) return;

    _visible = false;

    if (_pageRoot) _pageRoot.style.display = 'none';

    // Restore activetab id: give back to native tab, restore fme-nav-tab id
    if (_navTab) {
      _navTab.id = 'fme-nav-tab';
      if (_prevActiveTab) _prevActiveTab.id = 'activetab';
      _prevActiveTab = null;
    }

    // Restore native content
    if (_nativeWrapper) _nativeWrapper.style.display = '';
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
    link.href = '#';

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
    const items = SECTIONS.map(s => `
      <li class="fme-nav-item">
        <a href="#" class="fme-nav-cat${s.id === _activeSection ? ' fme-nav-cat--active' : ''}"
           data-section="${s.id}">
          <span class="fme-nav-icon">${s.icon}</span>
          <span class="fme-nav-label">${s.label}</span>
          ${s.id === 'updates'
            ? `<span class="fme-update-dot" style="display:${_updateBadge ? 'inline' : 'none'}">\u25CF</span>`
            : ''}
        </a>
      </li>
    `).join('');

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

    // Always re-render updates; lazy-render everything else
    const alreadyRendered = _contentArea.dataset.renderedSection === sectionId;
    if (alreadyRendered && sectionId !== 'updates') return;

    renderSection(sectionId);
    _contentArea.dataset.renderedSection = sectionId;
  }

  function renderSection(sectionId) {
    // Scroll content area back to top
    if (_contentArea) _contentArea.scrollTop = 0;

    switch (sectionId) {
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
      case 'settings':
        if (typeof FMESettingsTab !== 'undefined') {
          FMESettingsTab.render(_contentArea);
        } else {
          showMissingModule(_contentArea, 'FMESettingsTab');
        }
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

  // ─── Exports ──────────────────────────────────────────────────────────────────

  return { mount, show, hide, setUpdateBadge };
})();
