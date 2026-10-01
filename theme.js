/**
 * AQHub theme runtime — loads active theme from /api/themes/active
 * and applies cssVariables (+ derived tokens) onto :root.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'aqhub.activeThemeCache';
  var appliedId = null;

  function root() {
    return document.documentElement;
  }

  function setVar(name, value) {
    if (value == null || value === '') return;
    var key = String(name);
    if (key.charAt(0) !== '-') key = '--' + key;
    root().style.setProperty(key, String(value));
  }

  function applyCssVariables(map) {
    if (!map || typeof map !== 'object') return;
    Object.keys(map).forEach(function (k) {
      setVar(k, map[k]);
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
      ['--aq-radius-sm', s.radiusSm],
      ['--aq-radius-md', s.radiusMd],
      ['--aq-radius-lg', s.radiusLg],
      ['--aq-border-width', s.borderWidth],
      ['--aq-shadow-sm', e.shadowSm],
      ['--aq-shadow-md', e.shadowMd],
      ['--aq-glow-blur', e.glowBlur],
      ['--aq-motion-fast', m.fast],
      ['--aq-motion-normal', m.normal],
      ['--aq-motion-slow', m.slow],
      // Legacy aliases for board / panel / eisenhower
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

  function fetchActive() {
    return fetch('/api/themes/active', { cache: 'no-store' })
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
    return fetchActive().catch(function () { return applyCached(); });
  }

  function getAppliedId() { return appliedId; }

  global.AQTheme = {
    load: load,
    apply: applyTheme,
    fetchActive: fetchActive,
    getAppliedId: getAppliedId
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { load(); });
  } else {
    load();
  }
})(window);
