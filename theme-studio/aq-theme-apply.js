/**
 * Theme Studio — apply layer (UI Kit).
 * Tokens + structural chrome remount + layout CSS modules.
 * Exposes window.AQTheme
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'aqhub.activeThemeCache';
  var LAYOUT_LINK_ID = 'aq-theme-layout-module';
  var DOCK_ID = 'aq-chrome-dock';
  var appliedId = null;
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

  function ensureLayoutStylesheet(href) {
    var existing = document.getElementById(LAYOUT_LINK_ID);
    if (!href) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    if (existing && existing.getAttribute('href') === href) return;
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var link = document.createElement('link');
    link.id = LAYOUT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function ensureSharedLayoutsCss(base) {
    if (document.querySelector('link[href*="aq-theme-layouts.css"]')) return;
    var shared = document.createElement('link');
    shared.rel = 'stylesheet';
    shared.href = base + 'theme-studio/aq-theme-layouts.css';
    shared.setAttribute('data-aq-layouts-auto', '1');
    document.head.appendChild(shared);
  }

  function applyClassMap(classMap) {
    if (!classMap || typeof classMap !== 'object') return;
    Object.keys(classMap).forEach(function (selector) {
      var cls = classMap[selector];
      if (!cls) return;
      var nodes;
      try { nodes = document.querySelectorAll(selector); } catch (e1) { return; }
      var parts = String(cls).split(/\s+/).filter(Boolean);
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
    var grid = shell.querySelector('#systemsGrid, .grid');
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

  /**
   * Remount application chrome markers / dock for structural skins.
   * Does not destroy page content — relocates chrome affordances via attrs + optional dock.
   */
  function remountChrome(chrome, theme) {
    markChromeRegions();
    root().setAttribute('data-aq-grid', chrome.grid || 'default');
    if (chrome.bottomBar) ensureDock(theme);
    else removeDock();
    applyClassMap(chrome.classMap);
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
      grid: chrome.grid || layout.grid || patch.grid || preset.grid || 'default',
      classMap: chrome.classMap || patch.classMap || patch.htmlClassMap || {},
      cssModules: chrome.cssModules || patch.cssModules || (preset.cssModule ? [preset.cssModule] : []),
      buttonPrimaryStyle: (theme.components && theme.components.button && theme.components.button.primaryStyle) || null
    };
  }

  function navAttr(nav) {
    if (nav === 'top-pill') return 'top';
    if (nav === 'side-icon') return 'side';
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
    ensureLayoutStylesheet(modules.length ? normalizeModuleHref(modules[0], base) : '');
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
      ['shellPreset', 'nav', 'cardDensity', 'buttonHierarchy', 'overlay', 'bottomBar', 'grid'].forEach(function (k) {
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
    version: '1.3.0-ui-kit'
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
