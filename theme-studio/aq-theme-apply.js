/**
 * Theme Studio — apply layer (UI Kit).
 * Tokens + structural chrome remount + layout CSS modules.
 * Exposes window.AQTheme
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'aqhub.activeThemeCache';
  var LAYOUT_LINK_ID = 'aq-theme-layout-module';
  var LAYOUT_LINK_ATTR = 'data-aq-layout-module';
  var DOCK_ID = 'aq-chrome-dock';
  var SOFT_RAIL_ID = 'aq-soft-rail';
  var SOFT_ASIDE_ID = 'aq-soft-aside';
  var SOFT_ANALYTICS_ID = 'aq-soft-analytics';
  var appliedId = null;
  var softDnDInstalled = false;
  /** @type {{selector:string,classes:string[]}[]} */
  var appliedClassEntries = [];
  var DENSITY_MULT = { compact: 0.85, comfortable: 1, spacious: 1.2 };

  /** Built-in shell / UI Kit presets */
  var SHELL_PRESETS = {
    'jarvis-default': {
      nav: 'top',
      cardDensity: 'comfortable',
      buttonHierarchy: 'primary-end',
      overlay: 'sheet',
      bottomBar: false,
      grid: 'default',
      cssModule: 'theme-studio/layouts/jarvis-default.css'
    },
    'side-rail-ops': {
      nav: 'side',
      cardDensity: 'compact',
      buttonHierarchy: 'primary-start',
      overlay: 'drawer',
      bottomBar: false,
      grid: 'default',
      cssModule: 'theme-studio/layouts/side-rail-ops.css'
    },
    'crextio-airy': {
      nav: 'top-pill',
      cardDensity: 'spacious',
      buttonHierarchy: 'primary-end',
      overlay: 'sheet',
      bottomBar: false,
      grid: 'modular',
      cssModule: 'theme-studio/layouts/crextio-airy.css'
    },
    'neon-glass-rail': {
      nav: 'side-icon',
      cardDensity: 'comfortable',
      buttonHierarchy: 'stacked',
      overlay: 'drawer',
      bottomBar: false,
      grid: 'mosaic',
      cssModule: 'theme-studio/layouts/neon-glass-rail.css'
    },
    'clay-dock': {
      nav: 'side',
      cardDensity: 'comfortable',
      buttonHierarchy: 'primary-start',
      overlay: 'sheet',
      bottomBar: true,
      grid: 'soft',
      cssModule: 'theme-studio/layouts/clay-dock.css'
    },
    'soft-ui-interactive': {
      nav: 'soft-dual',
      cardDensity: 'spacious',
      buttonHierarchy: 'primary-end',
      overlay: 'sheet',
      bottomBar: false,
      analyticsPanel: true,
      grid: 'soft',
      cssModule: 'theme-studio/layouts/soft-ui-interactive.css'
    }
  };

  function root() { return document.documentElement; }

  function setVar(name, value) {
    if (value == null || value === '') return;
    var key = String(name);
    if (key.charAt(0) !== '-') key = '--' + key;
    root().style.setProperty(key, String(value));
  }

  function applyCssVariables(map) {
    if (!map || typeof map !== 'object') return;
    Object.keys(map).forEach(function (k) { setVar(k, map[k]); });
  }

  function applySpacing(spacing) {
    if (!spacing) return;
    if (spacing.unit) setVar('--aq-space-unit', spacing.unit);
    var scale = spacing.scale || {};
    Object.keys(scale).forEach(function (k) {
      setVar('--aq-space-' + k, scale[k]);
    });
  }

  function resolveStudioBase() {
    try {
      var scripts = document.getElementsByTagName('script');
      for (var i = 0; i < scripts.length; i++) {
        var src = scripts[i].src || '';
        var m = src.match(/^(.*\/)?theme-studio\/aq-theme-apply\.js/i);
        if (m) {
          var prefix = m[1] || '';
          return prefix.replace(/theme-studio\/?$/, '') || './';
        }
      }
    } catch (e0) {}
    return './';
  }

  function normalizeModuleHref(mod, base) {
    var s = String(mod || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s) || s.charAt(0) === '/') return s;
    if (s.indexOf('theme-studio/') === 0) return base + s;
    if (s.indexOf('layouts/') === 0) return base + 'theme-studio/' + s;
    return base + s;
  }

  function clearLayoutStylesheets() {
    document.querySelectorAll('link[' + LAYOUT_LINK_ATTR + ']').forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    var legacy = document.getElementById(LAYOUT_LINK_ID);
    if (legacy && legacy.parentNode && !legacy.hasAttribute(LAYOUT_LINK_ATTR)) {
      legacy.parentNode.removeChild(legacy);
    }
  }

  function currentLayoutHrefs() {
    var nodes = document.querySelectorAll('link[' + LAYOUT_LINK_ATTR + ']');
    if (nodes.length) {
      return Array.prototype.map.call(nodes, function (n) { return n.getAttribute('href') || ''; });
    }
    var legacy = document.getElementById(LAYOUT_LINK_ID);
    return legacy ? [legacy.getAttribute('href') || ''] : [];
  }

  /** Load every declared cssModules entry (order preserved). */
  function ensureLayoutStylesheets(hrefs) {
    var wanted = (hrefs || []).map(function (h) { return String(h || '').trim(); }).filter(Boolean);
    var current = currentLayoutHrefs();
    if (current.length === wanted.length && current.every(function (h, i) { return h === wanted[i]; })) {
      return;
    }
    clearLayoutStylesheets();
    wanted.forEach(function (href, i) {
      var link = document.createElement('link');
      if (i === 0) link.id = LAYOUT_LINK_ID;
      link.setAttribute(LAYOUT_LINK_ATTR, String(i));
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    });
  }

  /** @deprecated single-href helper — prefer ensureLayoutStylesheets */
  function ensureLayoutStylesheet(href) {
    ensureLayoutStylesheets(href ? [href] : []);
  }

  function ensureSharedLayoutsCss(base) {
    if (document.querySelector('link[href*="aq-theme-layouts.css"]')) return;
    var shared = document.createElement('link');
    shared.rel = 'stylesheet';
    shared.href = base + 'theme-studio/aq-theme-layouts.css';
    shared.setAttribute('data-aq-layouts-auto', '1');
    document.head.appendChild(shared);
  }

  function clearAppliedClassMap() {
    appliedClassEntries.forEach(function (entry) {
      var nodes;
      try { nodes = document.querySelectorAll(entry.selector); } catch (e0) { return; }
      for (var i = 0; i < nodes.length; i++) {
        for (var j = 0; j < entry.classes.length; j++) {
          try { nodes[i].classList.remove(entry.classes[j]); } catch (e1) {}
        }
      }
    });
    appliedClassEntries = [];
  }

  function applyClassMap(classMap) {
    clearAppliedClassMap();
    if (!classMap || typeof classMap !== 'object') return;
    Object.keys(classMap).forEach(function (selector) {
      var cls = classMap[selector];
      if (!cls) return;
      var nodes;
      try { nodes = document.querySelectorAll(selector); } catch (e1) { return; }
      var parts = String(cls).split(/\s+/).filter(Boolean);
      if (!parts.length) return;
      appliedClassEntries.push({ selector: selector, classes: parts.slice() });
      for (var i = 0; i < nodes.length; i++) {
        for (var j = 0; j < parts.length; j++) {
          try { nodes[i].classList.add(parts[j]); } catch (e2) {}
        }
      }
    });
  }

  function findShell() {
    return document.querySelector('.shell, .app, .aqts-shell') || document.body;
  }

  function markChromeRegions() {
    var shell = findShell();
    if (!shell) return null;
    var nav = shell.querySelector('[data-aq-chrome="nav"], .top, header.top, .aqts-top');
    if (nav) nav.setAttribute('data-aq-chrome', 'nav');
    if (nav) {
      var actions = nav.querySelector('[data-aq-chrome="actions"], .top-actions, .actions, .aqts-row');
      if (actions) actions.setAttribute('data-aq-chrome', 'actions');
    }
    var grid = shell.querySelector('#systemsGrid, .grid, .aqts-grid');
    if (grid) grid.setAttribute('data-aq-chrome', 'grid');
    var hero = shell.querySelector('.hero');
    if (hero) hero.setAttribute('data-aq-chrome', 'hero');
    return { shell: shell, nav: nav };
  }

  function removeDock() {
    var dock = document.getElementById(DOCK_ID);
    if (dock && dock.parentNode) dock.parentNode.removeChild(dock);
  }

  function ensureDock(theme) {
    var existing = document.getElementById(DOCK_ID);
    if (existing) return existing;
    var dock = document.createElement('div');
    dock.id = DOCK_ID;
    dock.className = 'aq-chrome-dock';
    dock.setAttribute('data-aq-chrome', 'dock');
    var name = (theme && theme.meta && theme.meta.name) || 'AQHub';
    var primary = document.querySelector('.top-actions .btn.primary, [data-aq-chrome="actions"] .btn.primary, .actions .btn.primary');
    var href = primary && primary.getAttribute('href') ? primary.getAttribute('href') : './board.html';
    var label = primary && (primary.textContent || '').trim() ? primary.textContent.trim() : 'Explore';
    dock.innerHTML =
      '<span class="aq-dock-label">' + String(name).replace(/[<>&]/g, '') + ' · UI Kit skin</span>' +
      '<a class="btn primary" href="' + href + '">' + String(label).replace(/[<>&]/g, '') + '</a>';
    document.body.appendChild(dock);
    return dock;
  }

  function pageFile() {
    try {
      var parts = String(location.pathname || '').split('/');
      return (parts[parts.length - 1] || 'index.html').toLowerCase() || 'index.html';
    } catch (e0) {
      return 'index.html';
    }
  }

  function softSvg(paths) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>';
  }

  function removeSoftChrome() {
    [SOFT_RAIL_ID, SOFT_ASIDE_ID, SOFT_ANALYTICS_ID].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    root().removeAttribute('data-aq-soft-chrome');
    root().removeAttribute('data-aq-soft-analytics');
    document.querySelectorAll('.aq-drag-ghost, .aq-drag-lift-clone').forEach(function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });
  }

  function markSoftActive(rootEl, page) {
    if (!rootEl) return;
    rootEl.querySelectorAll('[data-soft-page]').forEach(function (a) {
      var key = a.getAttribute('data-soft-page') || '';
      var on = key === page || (key === 'index.html' && (page === '' || page === '/'));
      if (key === 'eisenhower.html' && page.indexOf('eisenhower') === 0) on = true;
      if (key === 'board.html' && page.indexOf('board') === 0) on = true;
      if (key === 'themes.html' && page.indexOf('themes') === 0) on = true;
      a.classList.toggle('on', !!on);
    });
  }

  function ensureSoftChrome(theme, chrome) {
    var host = findShell();
    if (!host) return;
    var page = pageFile();
    var showAnalytics = !!(chrome && chrome.analyticsPanel !== false);
    if (page.indexOf('themes') === 0) showAnalytics = false;
    root().setAttribute('data-aq-soft-chrome', '1');
    root().setAttribute('data-aq-soft-analytics', showAnalytics ? '1' : '0');

    var rail = document.getElementById(SOFT_RAIL_ID);
    if (!rail) {
      rail = document.createElement('aside');
      rail.id = SOFT_RAIL_ID;
      rail.className = 'aq-soft-rail';
      rail.setAttribute('data-aq-chrome', 'soft-rail');
      rail.setAttribute('aria-label', 'شريط التنقل');
      rail.innerHTML =
        '<a class="aq-soft-logo" href="./index.html" title="AQHub">AQ</a>' +
        '<nav class="aq-soft-rail-nav">' +
          '<a href="./index.html" data-soft-page="index.html" title="الرئيسية">' + softSvg('<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/>') + '</a>' +
          '<a href="./eisenhower.html" data-soft-page="eisenhower.html" title="وارد">' + softSvg('<path d="M4 7h16M4 12h16M4 17h10"/><rect x="3" y="4" width="18" height="16" rx="3"/>') + '</a>' +
          '<a href="./board.html" data-soft-page="board.html" title="اللوحة">' + softSvg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>') + '</a>' +
          '<a href="./themes.html" data-soft-page="themes.html" title="ثيم">' + softSvg('<circle cx="12" cy="12" r="3"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M5 19l1.8-1.8"/>') + '</a>' +
        '</nav>' +
        '<div class="aq-soft-rail-foot">' +
          '<a href="./wizard.html" data-soft-page="wizard.html" title="إعدادات" style="width:44px;height:44px;margin-inline:auto;border-radius:14px;display:grid;place-items:center;color:var(--aq-text-muted);text-decoration:none">' +
            softSvg('<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>') +
          '</a>' +
        '</div>';
      host.insertBefore(rail, host.firstChild);
    }

    var aside = document.getElementById(SOFT_ASIDE_ID);
    if (!aside) {
      aside = document.createElement('aside');
      aside.id = SOFT_ASIDE_ID;
      aside.className = 'aq-soft-aside';
      aside.setAttribute('data-aq-chrome', 'soft-aside');
      aside.setAttribute('aria-label', 'لوحة المشروع');
      aside.innerHTML =
        '<div class="aq-soft-profile">' +
          '<div class="aq-soft-avatar" aria-hidden="true">T</div>' +
          '<div><strong>Tawfeeq</strong><span>AQHub · Pro</span></div>' +
        '</div>' +
        '<label class="aq-soft-search">' +
          '<span aria-hidden="true">⌕</span>' +
          '<input type="search" placeholder="بحث في اللوحة…" data-aq-soft-search="1" />' +
        '</label>' +
        '<nav class="aq-soft-nav-tree" aria-label="تبويبات AQHub">' +
          '<div class="lab">Project Board</div>' +
          '<a href="./eisenhower.html" data-soft-page="eisenhower.html"><i></i>وارد</a>' +
          '<a href="./eisenhower.html" data-soft-page="eisenhower.html" data-soft-tab="matrix"><i></i>مصفوفة</a>' +
          '<a href="./board.html" data-soft-page="board.html" data-soft-tab="focus"><i></i>تركيز</a>' +
          '<a href="./themes.html" data-soft-page="themes.html"><i></i>ثيم</a>' +
          '<a href="./wizard.html" data-soft-page="wizard.html"><i></i>إعدادات</a>' +
        '</nav>' +
        '<div>' +
          '<div class="lab" style="font-size:.72rem;font-weight:700;color:var(--aq-text-faint);margin:4px 2px 8px">Member in board</div>' +
          '<div class="aq-soft-members" aria-hidden="true"><span>A</span><span>M</span><span>S</span><span class="more">+3</span></div>' +
        '</div>' +
        '<div class="aq-soft-cta">' +
          '<a class="plus" href="./board.html" title="مهمة جديدة">+</a>' +
          '<p>Add New Project · مهمة جديدة</p>' +
        '</div>';
      if (rail.nextSibling) host.insertBefore(aside, rail.nextSibling);
      else host.appendChild(aside);

      var search = aside.querySelector('[data-aq-soft-search]');
      if (search) {
        search.addEventListener('keydown', function (ev) {
          if (ev.key !== 'Enter') return;
          var q = String(search.value || '').trim();
          var boardQ = document.getElementById('q');
          if (boardQ) {
            boardQ.value = q;
            try { boardQ.dispatchEvent(new Event('input', { bubbles: true })); } catch (e1) {}
            return;
          }
          if (q) location.href = './board.html';
        });
      }
    }

    if (showAnalytics) {
      var analytics = document.getElementById(SOFT_ANALYTICS_ID);
      if (!analytics) {
        analytics = document.createElement('aside');
        analytics.id = SOFT_ANALYTICS_ID;
        analytics.className = 'aq-soft-analytics';
        analytics.setAttribute('data-aq-chrome', 'soft-analytics');
        analytics.setAttribute('aria-label', 'ملخص');
        analytics.innerHTML =
          '<div class="aq-soft-ring" style="--aq-soft-ring-pct:72%"><div><b>72%</b><small>Overall</small></div></div>' +
          '<div class="aq-soft-stats">' +
            '<div><strong data-aq-soft-stat="total">—</strong><span>Total</span></div>' +
            '<div><strong data-aq-soft-stat="done">—</strong><span>Completed</span></div>' +
            '<div><strong data-aq-soft-stat="doing">—</strong><span>In Progress</span></div>' +
            '<div><strong data-aq-soft-stat="wait">—</strong><span>Waiting</span></div>' +
          '</div>' +
          '<div class="aq-soft-cal"><b>اليوم</b><span>Focus · Inbox · Board</span></div>' +
          '<div class="aq-soft-msg"><b>Theme Studio</b><span>Soft UI Interactive نشط</span></div>';
        host.appendChild(analytics);
      }
      syncSoftAnalytics();
    } else {
      var oldA = document.getElementById(SOFT_ANALYTICS_ID);
      if (oldA && oldA.parentNode) oldA.parentNode.removeChild(oldA);
    }

    markSoftActive(host, page);
    installSoftDnD();
  }

  function syncSoftAnalytics() {
    var map = {
      total: document.getElementById('statTotal'),
      doing: document.getElementById('statDoing'),
      done: document.getElementById('statDone'),
      hot: document.getElementById('statHot')
    };
    var set = function (key, val) {
      var node = document.querySelector('[data-aq-soft-stat="' + key + '"]');
      if (node) node.textContent = val == null || val === '' ? '—' : String(val);
    };
    if (map.total) {
      set('total', map.total.textContent);
      set('doing', map.doing ? map.doing.textContent : '—');
      set('done', map.done ? map.done.textContent : '—');
      set('wait', map.hot ? map.hot.textContent : '—');
      return;
    }
    var cards = document.querySelectorAll('.card, article.card');
    var total = cards.length;
    var done = document.querySelectorAll('.card.done, article.card.done').length;
    set('total', total || '—');
    set('done', total ? done : '—');
    set('doing', total ? Math.max(0, total - done) : '—');
    set('wait', '—');
  }

  function clearSoftDragArtifacts(card) {
    if (!card) return;
    card.classList.remove('aq-drag-source', 'aq-drag-lift');
    if (card._aqGhost && card._aqGhost.parentNode) card._aqGhost.parentNode.removeChild(card._aqGhost);
    if (card._aqClone && card._aqClone.parentNode) card._aqClone.parentNode.removeChild(card._aqClone);
    card._aqGhost = null;
    card._aqClone = null;
  }

  function installSoftDnD() {
    if (softDnDInstalled) return;
    softDnDInstalled = true;

    document.addEventListener('dragstart', function (e) {
      if (root().getAttribute('data-aq-shell') !== 'soft-ui-interactive') return;
      var card = e.target && e.target.closest ? e.target.closest('.card, article.card') : null;
      if (!card || !e.dataTransfer) return;

      clearSoftDragArtifacts(card);

      var ghost = document.createElement('div');
      ghost.className = 'aq-drag-ghost';
      ghost.style.height = Math.max(56, card.offsetHeight) + 'px';
      if (card.parentNode) card.parentNode.insertBefore(ghost, card);
      card._aqGhost = ghost;
      card.classList.add('aq-drag-source');

      try {
        var clone = card.cloneNode(true);
        clone.classList.add('aq-drag-lift', 'aq-drag-lift-clone');
        clone.classList.remove('dragging', 'dragging-group', 'aq-drag-source', 'selected');
        clone.setAttribute('aria-hidden', 'true');
        clone.style.position = 'absolute';
        clone.style.top = '-9999px';
        clone.style.left = '-9999px';
        clone.style.width = card.offsetWidth + 'px';
        clone.style.pointerEvents = 'none';
        clone.style.opacity = '1';
        document.body.appendChild(clone);
        card._aqClone = clone;
        var ox = typeof e.offsetX === 'number' ? e.offsetX : Math.round(card.offsetWidth / 3);
        var oy = typeof e.offsetY === 'number' ? e.offsetY : 24;
        e.dataTransfer.setDragImage(clone, ox, oy);
      } catch (e2) {}

      try { e.dataTransfer.effectAllowed = e.dataTransfer.effectAllowed || 'move'; } catch (e3) {}
    }, true);

    document.addEventListener('dragend', function (e) {
      if (root().getAttribute('data-aq-shell') !== 'soft-ui-interactive') return;
      var card = e.target && e.target.closest ? e.target.closest('.card, article.card') : null;
      clearSoftDragArtifacts(card);
      document.querySelectorAll('.aq-drag-ghost, .aq-drag-lift-clone').forEach(function (n) {
        if (n.parentNode) n.parentNode.removeChild(n);
      });
      document.querySelectorAll('.aq-drag-source').forEach(function (n) {
        n.classList.remove('aq-drag-source');
      });
      setTimeout(syncSoftAnalytics, 40);
    }, true);
  }

  /**
   * Remount application chrome markers / dock for structural skins.
   * Does not destroy page content — relocates chrome affordances via attrs + optional dock.
   */
  function remountChrome(chrome, theme) {
    markChromeRegions();
    root().setAttribute('data-aq-grid', chrome.grid || 'default');
    if (chrome.bottomBar) ensureDock(theme);
    else removeDock();
    if (chrome.shellPreset === 'soft-ui-interactive') ensureSoftChrome(theme, chrome);
    else removeSoftChrome();
    applyClassMap(chrome.classMap);
    if (chrome.shellPreset === 'soft-ui-interactive') {
      setTimeout(syncSoftAnalytics, 80);
      setTimeout(syncSoftAnalytics, 400);
    }
  }

  function mergeChrome(theme) {
    var layout = theme.layout || {};
    var chrome = theme.chrome || {};
    var patch = theme.layoutPatch || {};
    var presetId = chrome.shellPreset || layout.shellPreset || patch.shellPreset || 'jarvis-default';
    var preset = SHELL_PRESETS[presetId] || SHELL_PRESETS['jarvis-default'];
    var nav = chrome.nav || layout.navPosition || patch.nav || preset.nav;
    // Normalize aliases
    if (nav === 'top-pill') nav = 'top-pill';
    else if (nav === 'side-icon' || nav === 'icon-rail') nav = 'side-icon';
    else if (nav === 'side-bottom') nav = 'side';
    return {
      shellPreset: presetId,
      nav: nav,
      cardDensity: chrome.cardDensity || layout.cardDensity || patch.cardDensity || preset.cardDensity,
      buttonHierarchy: chrome.buttonHierarchy || layout.buttonHierarchy || patch.buttonHierarchy || preset.buttonHierarchy,
      overlay: chrome.overlay || chrome.overlayMode || layout.overlayMode || patch.overlay || preset.overlay,
      bottomBar: !!(chrome.bottomBar != null ? chrome.bottomBar : (patch.bottomBar != null ? patch.bottomBar : preset.bottomBar)),
      analyticsPanel: !!(chrome.analyticsPanel != null ? chrome.analyticsPanel : (patch.analyticsPanel != null ? patch.analyticsPanel : preset.analyticsPanel)),
      grid: chrome.grid || layout.grid || patch.grid || preset.grid || 'default',
      classMap: chrome.classMap || patch.classMap || patch.htmlClassMap || {},
      cssModules: chrome.cssModules || patch.cssModules || (preset.cssModule ? [preset.cssModule] : []),
      buttonPrimaryStyle: (theme.components && theme.components.button && theme.components.button.primaryStyle) || null
    };
  }

  function navAttr(nav) {
    if (nav === 'top-pill') return 'top';
    if (nav === 'side-icon') return 'side';
    if (nav === 'soft-dual') return 'soft-dual';
    return nav || 'top';
  }

  function applyChrome(theme) {
    var c = mergeChrome(theme || {});
    root().setAttribute('data-aq-shell', c.shellPreset || 'jarvis-default');
    root().setAttribute('data-aq-nav', navAttr(c.nav));
    root().setAttribute('data-aq-nav-style', c.nav || 'top');
    root().setAttribute('data-aq-card-density', c.cardDensity || 'comfortable');
    root().setAttribute('data-aq-btn-hierarchy', c.buttonHierarchy || 'primary-end');
    root().setAttribute('data-aq-overlay', c.overlay || 'sheet');
    root().setAttribute('data-aq-bottom-bar', c.bottomBar ? '1' : '0');
    if (c.buttonPrimaryStyle) root().setAttribute('data-aq-btn-style', c.buttonPrimaryStyle);
    else root().removeAttribute('data-aq-btn-style');

    setVar('--aq-shell-preset', c.shellPreset);
    setVar('--aq-nav-position', c.nav);
    setVar('--aq-card-density', c.cardDensity);
    setVar('--aq-btn-hierarchy', c.buttonHierarchy);
    setVar('--aq-overlay-mode', c.overlay);

    var base = resolveStudioBase();
    ensureSharedLayoutsCss(base);
    var modules = c.cssModules || [];
    ensureLayoutStylesheets(modules.map(function (mod) {
      return normalizeModuleHref(mod, base);
    }));
    remountChrome(c, theme);
    return c;
  }

  function applyLayout(layout) {
    if (!layout) return;
    var density = layout.density || 'comfortable';
    root().setAttribute('data-aq-density', density);
    setVar('--aq-density', density);
    setVar('--aq-density-mult', String(DENSITY_MULT[density] || 1));
    setVar('--aq-shell-max', layout.shellMaxWidth);
    setVar('--aq-shell-pad', layout.shellPadding);
    setVar('--aq-section-gap', layout.sectionGap);
    setVar('--aq-card-pad', layout.cardPadding);
    setVar('--aq-grid-gap', layout.gridGap);
    setVar('--aq-sidebar-width', layout.sidebarWidth);
  }

  function applyHud(hud) {
    if (!hud) return;
    root().setAttribute('data-aq-hud', '1');
    setVar('--aq-hud-glow-strength', hud.glowStrength);
    setVar('--aq-hud-glow-spread', hud.glowSpread);
    setVar('--aq-hud-scanline', hud.scanlineOpacity);
    setVar('--aq-hud-grid', hud.gridOpacity);
    root().setAttribute('data-aq-hud-pulse', hud.accentPulse ? '1' : '0');
  }

  function applyIconography(ico) {
    if (!ico) return;
    root().setAttribute('data-aq-icon-style', ico.style || 'line');
    setVar('--aq-icon-stroke', ico.strokeWidth);
    setVar('--aq-icon-sm', ico.sizeSm);
    setVar('--aq-icon-md', ico.sizeMd);
    setVar('--aq-icon-lg', ico.sizeLg);
  }

  function applyComponents(comp) {
    if (!comp || typeof comp !== 'object') return;
    Object.keys(comp).forEach(function (name) {
      var recipe = comp[name];
      if (!recipe || typeof recipe !== 'object') return;
      Object.keys(recipe).forEach(function (prop) {
        var val = recipe[prop];
        if (val == null || val === '') return;
        var slug = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        setVar('--aq-comp-' + name + '-' + slug, val);
      });
    });
  }

  function applyStructured(theme) {
    if (!theme) return;
    var c = theme.color || {};
    var t = theme.typography || {};
    var s = theme.shape || {};
    var e = theme.elevation || {};
    var m = theme.motion || {};
    var scale = t.scale || {};

    var pairs = [
      ['--aq-bg', c.bg],
      ['--aq-bg-secondary', c.bgSecondary],
      ['--aq-surface', c.surface],
      ['--aq-surface-elevated', c.surfaceElevated],
      ['--aq-border', c.border],
      ['--aq-border-strong', c.borderStrong],
      ['--aq-text', c.text],
      ['--aq-text-muted', c.textMuted],
      ['--aq-text-faint', c.textFaint],
      ['--aq-accent', c.accent],
      ['--aq-accent-2', c.accent2],
      ['--aq-accent-3', c.accent3],
      ['--aq-success', c.success],
      ['--aq-warning', c.warning],
      ['--aq-danger', c.danger],
      ['--aq-glow', c.glow],
      ['--aq-font', t.fontFamily],
      ['--aq-font-mono', t.monoFamily],
      ['--aq-fs-xs', scale.xs],
      ['--aq-fs-sm', scale.sm],
      ['--aq-fs-md', scale.md],
      ['--aq-fs-lg', scale.lg],
      ['--aq-fs-xl', scale.xl],
      ['--aq-lh', t.lineHeight],
      ['--aq-tracking', t.letterSpacing],
      ['--aq-radius-sm', s.radiusSm],
      ['--aq-radius-md', s.radiusMd],
      ['--aq-radius-lg', s.radiusLg],
      ['--aq-radius-pill', s.radiusPill],
      ['--aq-border-width', s.borderWidth],
      ['--aq-shadow-sm', e.shadowSm],
      ['--aq-shadow-md', e.shadowMd],
      ['--aq-shadow-lg', e.shadowLg],
      ['--aq-glow-blur', e.glowBlur],
      ['--aq-motion-fast', m.fast],
      ['--aq-motion-normal', m.normal],
      ['--aq-motion-slow', m.slow],
      ['--aq-easing', m.easing],
      ['--aq-hover-lift', m.hoverLift],
      ['--bg', c.bg],
      ['--bg0', c.bg],
      ['--bg1', c.bgSecondary],
      ['--panel', c.surface],
      ['--card', c.surface],
      ['--card-solid', c.surfaceElevated],
      ['--surface', c.surface],
      ['--surface-2', c.surfaceElevated],
      ['--stroke', c.border],
      ['--stroke-strong', c.borderStrong],
      ['--stroke-ui', c.borderStrong || c.border],
      ['--line', c.border],
      ['--text', c.text],
      ['--ink', c.text],
      ['--muted', c.textMuted],
      ['--faint', c.textFaint],
      ['--accent', c.accent],
      ['--accent-2', c.accent2],
      ['--accent-3', c.accent3],
      ['--cyan', c.accent],
      ['--teal', c.accent],
      ['--ok', c.success],
      ['--warn', c.warning],
      ['--danger', c.danger],
      ['--hot', c.danger],
      ['--glow', c.glow],
      ['--shadow', e.shadowMd],
      ['--radius', s.radiusLg]
    ];
    pairs.forEach(function (p) { setVar(p[0], p[1]); });

    applySpacing(theme.spacing);
    applyLayout(theme.layout);
    applyHud(theme.hud);
    applyIconography(theme.iconography);
    applyComponents(theme.components);
    applyChrome(theme);

    if (t.fontFamily) {
      try { document.body.style.fontFamily = t.fontFamily; } catch (e1) {}
    }
    if (theme.meta && theme.meta.mode) {
      root().setAttribute('data-aq-theme-mode', theme.meta.mode);
    }
    if (theme.meta && theme.meta.id) {
      root().setAttribute('data-aq-theme', theme.meta.id);
      appliedId = theme.meta.id;
    }
  }

  function normalizeThemePayload(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var theme = raw.theme && typeof raw.theme === 'object' && (raw.theme.meta || raw.theme.color || raw.theme.cssVariables)
      ? raw.theme
      : raw;
    if (raw.layoutPatch && typeof raw.layoutPatch === 'object') {
      theme = JSON.parse(JSON.stringify(theme));
      theme.layoutPatch = raw.layoutPatch;
      theme.chrome = theme.chrome || {};
      theme.layout = theme.layout || {};
      var p = raw.layoutPatch;
      ['shellPreset', 'nav', 'cardDensity', 'buttonHierarchy', 'overlay', 'bottomBar', 'analyticsPanel', 'grid'].forEach(function (k) {
        if (p[k] != null) theme.chrome[k] = p[k];
      });
      if (p.shellPreset) theme.layout.shellPreset = p.shellPreset;
      if (p.nav) theme.layout.navPosition = p.nav;
      if (p.classMap || p.htmlClassMap) theme.chrome.classMap = p.classMap || p.htmlClassMap;
      if (p.cssModules) theme.chrome.cssModules = p.cssModules;
      if (p.applyScript) theme.chrome.applyScript = p.applyScript;
    }
    return theme;
  }

  function applyTheme(theme) {
    if (!theme) return;
    var normalized = normalizeThemePayload(theme) || theme;
    applyStructured(normalized);
    applyCssVariables(normalized.cssVariables);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        id: normalized.meta && normalized.meta.id,
        theme: normalized,
        at: Date.now()
      }));
    } catch (e2) {}
    try {
      global.dispatchEvent(new CustomEvent('aqhub:theme', { detail: { theme: normalized } }));
    } catch (e3) {}
  }

  function applyCached() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.theme) {
        applyTheme(parsed.theme);
        return parsed.theme;
      }
    } catch (e4) {}
    return null;
  }

  function fetchActive(apiBase) {
    var base = apiBase == null ? '' : String(apiBase).replace(/\/$/, '');
    return fetch(base + '/api/themes/active', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok && j.theme) {
          applyTheme(j.theme);
          return j.theme;
        }
        return null;
      });
  }

  function load(opts) {
    opts = opts || {};
    if (!opts.skipCache) applyCached();
    return fetchActive(opts.apiBase).catch(function () { return applyCached(); });
  }

  global.AQTheme = {
    load: load,
    apply: applyTheme,
    fetchActive: fetchActive,
    getAppliedId: function () { return appliedId; },
    normalizePayload: normalizeThemePayload,
    remountChrome: function (theme) { return applyChrome(theme || {}); },
    shellPresets: SHELL_PRESETS,
    syncSoftAnalytics: syncSoftAnalytics,
    version: '1.4.1-ui-kit'
  };

  if (!optsNoAuto()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { load(); });
    } else {
      load();
    }
  }

  function optsNoAuto() {
    var s = document.currentScript;
    return s && s.getAttribute('data-no-auto') === '1';
  }
})(window);
