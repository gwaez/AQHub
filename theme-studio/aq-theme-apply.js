/**
 * Theme Studio — apply layer (drop-in).
 * Loads /api/themes/active and sets :root CSS variables + data-aq-* attrs.
 * Exposes window.AQTheme
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'aqhub.activeThemeCache';
  var appliedId = null;
  var DENSITY_MULT = { compact: 0.85, comfortable: 1, spacious: 1.2 };

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
        // --aq-comp-button-radius, --aq-comp-shell-pattern, …
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
      // Legacy aliases for existing AQHub pages
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

  function applyTheme(theme) {
    if (!theme) return;
    applyStructured(theme);
    applyCssVariables(theme.cssVariables);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        id: theme.meta && theme.meta.id,
        theme: theme,
        at: Date.now()
      }));
    } catch (e2) {}
    try {
      global.dispatchEvent(new CustomEvent('aqhub:theme', { detail: { theme: theme } }));
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
    version: '1.1.0-theme-studio'
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
