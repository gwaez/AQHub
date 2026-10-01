/**
 * Theme Studio — mountable full design-system editor.
 * Depends on: aq-theme-apply.js (AQTheme), optionally aq-theme-prompt.js (AQThemePrompt)
 *
 * AQThemeStudio.mount(hostElement, { apiBase, title, navLinks })
 */
(function (global) {
  'use strict';

  var COLOR_KEYS = [
    ['bg', 'Background'], ['bgSecondary', 'Bg secondary'], ['surface', 'Surface'], ['surfaceElevated', 'Elevated'],
    ['border', 'Border'], ['borderStrong', 'Border strong'], ['text', 'Text'], ['textMuted', 'Muted'], ['textFaint', 'Faint'],
    ['accent', 'Accent'], ['accent2', 'Accent 2'], ['accent3', 'Accent 3'],
    ['success', 'Success'], ['warning', 'Warning'], ['danger', 'Danger'], ['glow', 'HUD glow']
  ];

  var EDITOR_TABS = [
    { id: 'meta', label: 'Meta' },
    { id: 'color', label: 'Color' },
    { id: 'type', label: 'Type' },
    { id: 'space', label: 'Space / Layout' },
    { id: 'shape', label: 'Shape / Elev' },
    { id: 'motion', label: 'Motion / HUD' },
    { id: 'comp', label: 'Components' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  function stripJsonFences(text) {
    var s = String(text || '').trim();
    var fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fence) s = fence[1].trim();
    if (s.indexOf('```') === 0) {
      s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```[\s\S]*$/, '').trim();
    }
    return s;
  }

  function toColorInput(val) {
    var s = String(val || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
    if (/^#[0-9a-fA-F]{3}$/.test(s)) return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    return '#22d3ee';
  }

  function defaultComponents() {
    return {
      shell: { pattern: 'glass', blur: '18px', border: '1px solid var(--aq-border)' },
      card: { radius: 'var(--aq-radius-md)', padding: 'var(--aq-space-4)', backdropBlur: '14px' },
      button: { radius: 'var(--aq-radius-md)', padding: '10px 14px', fontWeight: '600', primaryStyle: 'gradient' },
      input: { radius: '12px', padding: '9px 11px', background: 'rgba(7,11,18,.55)' },
      chip: { radius: '999px', padding: '3px 8px', fontSize: '0.72rem' },
      nav: { height: '52px', blur: '12px', gap: '8px' },
      table: { rowHeight: '40px', headerWeight: '700', cellPadding: '8px 10px' },
      sheet: { radius: '18px', maxWidth: '500px', backdrop: 'rgba(2,8,16,.55)' }
    };
  }

  function Studio(host, opts) {
    this.host = host;
    this.opts = opts || {};
    this.apiBase = (this.opts.apiBase == null ? '' : String(this.opts.apiBase)).replace(/\/$/, '');
    this.themes = [];
    this.activeId = null;
    this.current = null;
    this.currentSource = 'preset';
    this.editorTab = 'meta';
    this._toastTimer = 0;
  }

  Studio.prototype.api = function (path, options) {
    var self = this;
    return fetch(self.apiBase + path, Object.assign({ cache: 'no-store' }, options || {})).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || j.ok === false) throw new Error((j && j.error) || ('http_' + r.status));
        return j;
      });
    });
  };

  Studio.prototype.toast = function (msg) {
    var el = this.host.querySelector('[data-aqts=toast]');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    var self = this;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2800);
  };

  Studio.prototype.promptText = function () {
    if (global.AQThemePrompt && global.AQThemePrompt.text) return global.AQThemePrompt.text;
    return 'See theme-studio/aq-theme-prompt.js — load AQThemePrompt for the full AI prompt.';
  };

  Studio.prototype.renderShell = function () {
    var title = this.opts.title || 'Theme Studio';
    var links = this.opts.navLinks || [
      { href: './index.html', label: '← Control Center', ghost: true },
      { href: './wizard.html', label: 'Wizard' },
      { href: './board.html', label: 'Board' },
      { href: './eisenhower.html', label: 'Eisenhower' }
    ];
    var nav = links.map(function (l) {
      return '<a class="aqts-btn' + (l.ghost ? ' ghost' : '') + '" href="' + esc(l.href) + '">' + esc(l.label) + '</a>';
    }).join('');

    this.host.classList.add('aqts-root');
    this.host.innerHTML =
      '<div class="aqts-shell">' +
        '<div class="aqts-top">' +
          '<div class="aqts-brand"><div class="aqts-logo" aria-hidden="true"></div><div>' +
            '<h1>' + esc(title) + '</h1>' +
            '<p>Full design-system editor — layout · components · HUD · import/export · AI JSON</p>' +
          '</div></div>' +
          '<div class="aqts-row">' + nav + '</div>' +
        '</div>' +
        '<p class="aqts-status" data-aqts="status">Connecting…</p>' +
        '<div class="aqts-grid">' +
          '<section class="aqts-glass">' +
            '<h2>Library</h2>' +
            '<p class="aqts-lead">Presets + custom packages. Activate applies the full system on this page (does not open board.html).</p>' +
            '<div class="aqts-list" data-aqts="list"></div>' +
            '<div class="aqts-row">' +
              '<button class="aqts-btn primary" type="button" data-aqts="activate">Activate</button>' +
              '<button class="aqts-btn" type="button" data-aqts="save">Save</button>' +
              '<button class="aqts-btn" type="button" data-aqts="saveAs">Save as…</button>' +
              '<button class="aqts-btn" type="button" data-aqts="export">Export JSON</button>' +
              '<button class="aqts-btn ghost" type="button" data-aqts="delete" hidden>Delete custom</button>' +
            '</div>' +
            '<p class="aqts-hint" style="margin-top:12px">Module: <code>theme-studio/</code> · Data: <code>data/themes/</code> · Schema: <code>theme-studio/SCHEMA.md</code></p>' +
          '</section>' +
          '<section class="aqts-glass">' +
            '<h2>Live preview</h2>' +
            '<div class="aqts-preview" data-aqts="preview">' +
              '<div class="aqts-preview-bar"><div><i class="aqts-swatch"></i><strong data-aqts="pvName">—</strong></div><span data-aqts="pvMode">dark</span></div>' +
              '<div class="aqts-preview-cards">' +
                '<div class="aqts-preview-card">Elevated surface<small>card · shell · sheet</small></div>' +
                '<div class="aqts-preview-card">HUD glow<small>border · accent pulse</small></div>' +
              '</div>' +
              '<div class="aqts-row" style="margin-top:12px">' +
                '<span class="aqts-chip" style="color:var(--aq-success,#34d399)">success</span>' +
                '<span class="aqts-chip" style="color:var(--aq-warning,#fbbf24)">warning</span>' +
                '<span class="aqts-chip" style="color:var(--aq-danger,#fb7185)">danger</span>' +
                '<span class="aqts-chip" style="color:var(--aq-accent,#22d3ee)">accent</span>' +
              '</div>' +
            '</div>' +
            '<p class="aqts-hint" style="margin-top:10px" data-aqts="pvDesc"></p>' +
          '</section>' +
        '</div>' +
        '<section class="aqts-glass aqts-section">' +
          '<h2>Design-system editor</h2>' +
          '<p class="aqts-lead">Edit the full package: tokens, density, HUD language, and component recipes. Live-applies on this page.</p>' +
          '<div class="aqts-tabs" data-aqts="tabs"></div>' +
          '<div data-aqts="editor"></div>' +
        '</section>' +
        '<section class="aqts-glass aqts-section" id="aqts-import">' +
          '<h2>Paste AI JSON → Apply / Save</h2>' +
          '<p class="aqts-lead">Paste the complete theme JSON returned by any model (or upload a file). Stays on this page.</p>' +
          '<div class="aqts-import">' +
            '<h3>JSON zone</h3>' +
            '<p class="aqts-hint" style="margin-top:0">Strips <code>```json</code> fences automatically. English keys required.</p>' +
            '<label>Upload <code>.json</code><input data-aqts="importFile" type="file" accept="application/json,.json" /></label>' +
            '<label>Paste complete JSON<textarea data-aqts="importText" placeholder="{ meta, color, typography, spacing, layout, components, cssVariables, … }"></textarea></label>' +
            '<div class="aqts-row" style="margin-top:8px">' +
              '<button class="aqts-btn" type="button" data-aqts="importPreview">Preview only</button>' +
              '<button class="aqts-btn primary" type="button" data-aqts="importSaveActivate">Apply + Save custom + Activate</button>' +
              '<button class="aqts-btn" type="button" data-aqts="importSaveOnly">Save custom only</button>' +
            '</div>' +
          '</div>' +
        '</section>' +
        '<section class="aqts-glass aqts-section" id="aqts-ai-prompt">' +
          '<h2>AI prompt — copy + attach screenshot</h2>' +
          '<p class="aqts-lead">At the bottom: copy this prompt into any AI model with a screenshot of a theme you like, then paste the JSON above.</p>' +
          '<ol class="aqts-steps">' +
            '<li>Click <strong>Copy prompt</strong>.</li>' +
            '<li>Paste into any model + attach a screenshot.</li>' +
            '<li>Paste returned JSON into the JSON zone → <strong>Apply + Save custom + Activate</strong>.</li>' +
          '</ol>' +
          '<div class="aqts-row" style="margin-bottom:10px">' +
            '<button class="aqts-btn primary" type="button" data-aqts="copyPrompt">Copy prompt</button>' +
            '<a class="aqts-btn ghost" href="./theme-studio/SCHEMA.md" target="_blank" rel="noopener">SCHEMA.md</a>' +
            '<a class="aqts-btn ghost" href="./data/themes/jarvis-hud.sample.json" target="_blank" rel="noopener">jarvis-hud sample</a>' +
          '</div>' +
          '<pre class="aqts-prompt" data-aqts="promptBox" tabindex="0"></pre>' +
          '<p class="aqts-hint">Bilingual prompt. Expect raw JSON only matching the full design-system schema.</p>' +
        '</section>' +
      '</div>' +
      '<div class="aqts-toast" data-aqts="toast"></div>';
  };

  Studio.prototype.bind = function () {
    var self = this;
    var q = function (sel) { return self.host.querySelector(sel); };

    q('[data-aqts=promptBox]').textContent = self.promptText();

    q('[data-aqts=activate]').onclick = function () { self.activate(); };
    q('[data-aqts=save]').onclick = function () { self.save(false); };
    q('[data-aqts=saveAs]').onclick = function () { self.saveAs(); };
    q('[data-aqts=export]').onclick = function () { self.exportJson(); };
    q('[data-aqts=delete]').onclick = function () { self.deleteCustom(); };
    q('[data-aqts=copyPrompt]').onclick = function () { self.copyPrompt(); };
    q('[data-aqts=importFile]').onchange = function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      file.text().then(function (t) {
        q('[data-aqts=importText]').value = t;
        self.toast('File loaded — Preview or Save');
      });
    };
    q('[data-aqts=importPreview]').onclick = function () { self.importPreview(); };
    q('[data-aqts=importSaveActivate]').onclick = function () { self.importSave(true); };
    q('[data-aqts=importSaveOnly]').onclick = function () { self.importSave(false); };
  };

  Studio.prototype.renderTabs = function () {
    var self = this;
    var host = this.host.querySelector('[data-aqts=tabs]');
    host.innerHTML = EDITOR_TABS.map(function (t) {
      return '<button type="button" class="aqts-tab' + (t.id === self.editorTab ? ' on' : '') + '" data-tab="' + t.id + '">' + esc(t.label) + '</button>';
    }).join('');
    host.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.onclick = function () {
        self.editorTab = btn.getAttribute('data-tab');
        self.renderTabs();
        self.renderEditorFields();
      };
    });
  };

  Studio.prototype.renderEditorFields = function () {
    var ed = this.host.querySelector('[data-aqts=editor]');
    var tab = this.editorTab;
    var html = '';
    if (tab === 'meta') {
      html =
        '<label>Name<input data-f="meta.name" type="text" maxlength="80" /></label>' +
        '<label>Id<input data-f="meta.id" type="text" maxlength="48" dir="ltr" /></label>' +
        '<label>Description<input data-f="meta.description" type="text" maxlength="280" /></label>' +
        '<label>styleKeywords (comma)<input data-f="meta.styleKeywords" type="text" dir="ltr" /></label>' +
        '<label>Mode<select data-f="meta.mode"><option value="dark">dark</option><option value="light">light</option><option value="custom">custom</option></select></label>';
    } else if (tab === 'color') {
      html = '<div class="aqts-colors" data-aqts="colorFields"></div>';
    } else if (tab === 'type') {
      html =
        '<label>fontFamily<input data-f="typography.fontFamily" type="text" dir="ltr" /></label>' +
        '<label>monoFamily<input data-f="typography.monoFamily" type="text" dir="ltr" /></label>' +
        '<div class="aqts-colors">' +
          '<label>xs<input data-f="typography.scale.xs" dir="ltr" /></label>' +
          '<label>sm<input data-f="typography.scale.sm" dir="ltr" /></label>' +
          '<label>md<input data-f="typography.scale.md" dir="ltr" /></label>' +
          '<label>lg<input data-f="typography.scale.lg" dir="ltr" /></label>' +
          '<label>xl<input data-f="typography.scale.xl" dir="ltr" /></label>' +
          '<label>lineHeight<input data-f="typography.lineHeight" dir="ltr" /></label>' +
        '</div>';
    } else if (tab === 'space') {
      html =
        '<label>Density<select data-f="layout.density"><option value="compact">compact</option><option value="comfortable">comfortable</option><option value="spacious">spacious</option></select></label>' +
        '<div class="aqts-colors">' +
          '<label>shellMaxWidth<input data-f="layout.shellMaxWidth" dir="ltr" /></label>' +
          '<label>shellPadding<input data-f="layout.shellPadding" dir="ltr" /></label>' +
          '<label>sectionGap<input data-f="layout.sectionGap" dir="ltr" /></label>' +
          '<label>cardPadding<input data-f="layout.cardPadding" dir="ltr" /></label>' +
          '<label>gridGap<input data-f="layout.gridGap" dir="ltr" /></label>' +
          '<label>sidebarWidth<input data-f="layout.sidebarWidth" dir="ltr" /></label>' +
          '<label>spacing.unit<input data-f="spacing.unit" dir="ltr" /></label>' +
        '</div>' +
        '<p class="aqts-hint">Spacing scale 0–8 is rebuilt into cssVariables on save. Density sets <code>data-aq-density</code>.</p>';
    } else if (tab === 'shape') {
      html =
        '<div class="aqts-colors">' +
          '<label>radiusSm<input data-f="shape.radiusSm" dir="ltr" /></label>' +
          '<label>radiusMd<input data-f="shape.radiusMd" dir="ltr" /></label>' +
          '<label>radiusLg<input data-f="shape.radiusLg" dir="ltr" /></label>' +
          '<label>radiusPill<input data-f="shape.radiusPill" dir="ltr" /></label>' +
          '<label>borderWidth<input data-f="shape.borderWidth" dir="ltr" /></label>' +
          '<label>shadowSm<input data-f="elevation.shadowSm" dir="ltr" /></label>' +
          '<label>shadowMd<input data-f="elevation.shadowMd" dir="ltr" /></label>' +
          '<label>glowBlur<input data-f="elevation.glowBlur" dir="ltr" /></label>' +
        '</div>';
    } else if (tab === 'motion') {
      html =
        '<div class="aqts-colors">' +
          '<label>fast<input data-f="motion.fast" dir="ltr" /></label>' +
          '<label>normal<input data-f="motion.normal" dir="ltr" /></label>' +
          '<label>slow<input data-f="motion.slow" dir="ltr" /></label>' +
          '<label>easing<input data-f="motion.easing" dir="ltr" /></label>' +
          '<label>hoverLift<input data-f="motion.hoverLift" dir="ltr" /></label>' +
          '<label>glowStrength<input data-f="hud.glowStrength" dir="ltr" /></label>' +
          '<label>glowSpread<input data-f="hud.glowSpread" dir="ltr" /></label>' +
          '<label>scanlineOpacity<input data-f="hud.scanlineOpacity" dir="ltr" /></label>' +
          '<label>gridOpacity<input data-f="hud.gridOpacity" dir="ltr" /></label>' +
        '</div>' +
        '<label class="aqts-row" style="display:flex;gap:8px;align-items:center"><input data-f="hud.accentPulse" type="checkbox" /> accentPulse</label>' +
        '<div class="aqts-colors" style="margin-top:10px">' +
          '<label>icon style<select data-f="iconography.style"><option value="line">line</option><option value="solid">solid</option><option value="duotone">duotone</option></select></label>' +
          '<label>strokeWidth<input data-f="iconography.strokeWidth" dir="ltr" /></label>' +
          '<label>sizeSm<input data-f="iconography.sizeSm" dir="ltr" /></label>' +
          '<label>sizeMd<input data-f="iconography.sizeMd" dir="ltr" /></label>' +
          '<label>sizeLg<input data-f="iconography.sizeLg" dir="ltr" /></label>' +
        '</div>';
    } else if (tab === 'comp') {
      html =
        '<p class="aqts-hint">Component recipes (English keys). Values become <code>--aq-comp-*</code> tokens and drive <code>aq-theme-recipes.css</code>.</p>' +
        '<div class="aqts-colors">' +
          '<label>shell.pattern<input data-f="components.shell.pattern" dir="ltr" /></label>' +
          '<label>shell.blur<input data-f="components.shell.blur" dir="ltr" /></label>' +
          '<label>card.radius<input data-f="components.card.radius" dir="ltr" /></label>' +
          '<label>card.padding<input data-f="components.card.padding" dir="ltr" /></label>' +
          '<label>button.padding<input data-f="components.button.padding" dir="ltr" /></label>' +
          '<label>button.primaryStyle<select data-f="components.button.primaryStyle"><option value="gradient">gradient</option><option value="solid">solid</option><option value="outline">outline</option></select></label>' +
          '<label>input.radius<input data-f="components.input.radius" dir="ltr" /></label>' +
          '<label>chip.radius<input data-f="components.chip.radius" dir="ltr" /></label>' +
          '<label>nav.height<input data-f="components.nav.height" dir="ltr" /></label>' +
          '<label>table.rowHeight<input data-f="components.table.rowHeight" dir="ltr" /></label>' +
          '<label>sheet.maxWidth<input data-f="components.sheet.maxWidth" dir="ltr" /></label>' +
          '<label>sheet.backdrop<input data-f="components.sheet.backdrop" dir="ltr" /></label>' +
        '</div>';
    }
    ed.innerHTML = html;

    if (tab === 'color') {
      var cf = ed.querySelector('[data-aqts=colorFields]');
      cf.innerHTML = COLOR_KEYS.map(function (pair) {
        return '<div class="aqts-color-row"><label>' + esc(pair[1]) + ' <small style="color:var(--aqts-faint)">(' + pair[0] + ')</small>' +
          '<input data-color="' + pair[0] + '" type="text" dir="ltr" /></label>' +
          '<input data-color-picker="' + pair[0] + '" type="color" /></div>';
      }).join('');
    }

    this.fillEditorFields();
    this.wireEditorInputs();
  };

  Studio.prototype.getPath = function (obj, path) {
    return path.split('.').reduce(function (a, k) { return a == null ? undefined : a[k]; }, obj);
  };

  Studio.prototype.setPath = function (obj, path, value) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  };

  Studio.prototype.fillEditorFields = function () {
    var self = this;
    var t = this.current;
    if (!t) return;
    this.host.querySelectorAll('[data-f]').forEach(function (el) {
      var path = el.getAttribute('data-f');
      var val = self.getPath(t, path);
      if (el.type === 'checkbox') {
        el.checked = !!val;
      } else if (path === 'meta.styleKeywords') {
        el.value = Array.isArray(val) ? val.join(', ') : (val || '');
      } else {
        el.value = val == null ? '' : String(val);
      }
    });
    this.host.querySelectorAll('[data-color]').forEach(function (el) {
      var key = el.getAttribute('data-color');
      var val = (t.color && t.color[key]) || '';
      el.value = val;
      var pick = self.host.querySelector('[data-color-picker="' + key + '"]');
      if (pick) pick.value = toColorInput(val);
    });
    var del = this.host.querySelector('[data-aqts=delete]');
    if (del) del.hidden = this.currentSource !== 'custom';
  };

  Studio.prototype.wireEditorInputs = function () {
    var self = this;
    var onChange = function () { self.onEditorChange(); };
    this.host.querySelectorAll('[data-f]').forEach(function (el) {
      el.addEventListener('input', onChange);
      el.addEventListener('change', onChange);
    });
    this.host.querySelectorAll('[data-color]').forEach(function (el) {
      el.addEventListener('input', onChange);
    });
    this.host.querySelectorAll('[data-color-picker]').forEach(function (el) {
      el.addEventListener('input', function () {
        var key = el.getAttribute('data-color-picker');
        var text = self.host.querySelector('[data-color="' + key + '"]');
        if (text) text.value = el.value;
        onChange();
      });
    });
  };

  Studio.prototype.readEditor = function () {
    var base = this.current ? deepClone(this.current) : { meta: {}, color: {} };
    if (!base.meta) base.meta = {};
    if (!base.color) base.color = {};
    if (!base.typography) base.typography = { scale: {} };
    if (!base.typography.scale) base.typography.scale = {};
    if (!base.shape) base.shape = {};
    if (!base.spacing) base.spacing = { unit: '4px', scale: {} };
    if (!base.layout) base.layout = {};
    if (!base.elevation) base.elevation = {};
    if (!base.motion) base.motion = {};
    if (!base.hud) base.hud = {};
    if (!base.iconography) base.iconography = {};
    if (!base.components) base.components = defaultComponents();
    base.meta.studio = 'theme-studio';

    var self = this;
    this.host.querySelectorAll('[data-f]').forEach(function (el) {
      var path = el.getAttribute('data-f');
      var val;
      if (el.type === 'checkbox') val = el.checked;
      else if (path === 'meta.styleKeywords') {
        val = el.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      } else val = el.value.trim();
      self.setPath(base, path, val);
    });
    this.host.querySelectorAll('[data-color]').forEach(function (el) {
      var key = el.getAttribute('data-color');
      var v = el.value.trim();
      if (v) base.color[key] = v;
    });
    if (!base.meta.id) base.meta.id = 'custom-theme';
    if (!base.meta.name) base.meta.name = base.meta.id;
    return base;
  };

  Studio.prototype.paintPreview = function (theme) {
    var name = this.host.querySelector('[data-aqts=pvName]');
    var mode = this.host.querySelector('[data-aqts=pvMode]');
    var desc = this.host.querySelector('[data-aqts=pvDesc]');
    if (name) name.textContent = (theme.meta && theme.meta.name) || '—';
    if (mode) mode.textContent = (theme.meta && theme.meta.mode) || 'custom';
    if (desc) {
      var bits = [(theme.meta && theme.meta.description) || ''];
      if (theme.layout && theme.layout.density) bits.push('density: ' + theme.layout.density);
      if (theme.components && theme.components.shell && theme.components.shell.pattern) bits.push('shell: ' + theme.components.shell.pattern);
      desc.textContent = bits.filter(Boolean).join(' · ');
    }
  };

  Studio.prototype.onEditorChange = function () {
    var t = this.readEditor();
    this.current = t;
    this.paintPreview(t);
    if (global.AQTheme) global.AQTheme.apply(t);
  };

  Studio.prototype.fillEditor = function (theme) {
    this.current = deepClone(theme);
    if (!this.current.components) this.current.components = defaultComponents();
    if (!this.current.spacing) {
      this.current.spacing = {
        unit: '4px',
        scale: { '0': '0', '1': '4px', '2': '8px', '3': '12px', '4': '16px', '5': '24px', '6': '32px', '7': '48px', '8': '64px' }
      };
    }
    if (!this.current.layout) {
      this.current.layout = {
        density: 'comfortable', shellMaxWidth: '1280px', shellPadding: '28px 22px',
        sectionGap: '16px', cardPadding: '16px', gridGap: '10px', sidebarWidth: '286px'
      };
    }
    if (!this.current.hud) {
      this.current.hud = { glowStrength: '0.45', glowSpread: '18px', scanlineOpacity: '0.05', gridOpacity: '0.04', accentPulse: true };
    }
    if (!this.current.iconography) {
      this.current.iconography = { style: 'line', strokeWidth: '1.75', sizeSm: '14px', sizeMd: '18px', sizeLg: '24px' };
    }
    this.paintPreview(this.current);
    this.renderTabs();
    this.renderEditorFields();
    if (global.AQTheme) global.AQTheme.apply(this.current);
  };

  Studio.prototype.renderList = function () {
    var self = this;
    var host = this.host.querySelector('[data-aqts=list]');
    var curId = this.current && this.current.meta && this.current.meta.id;
    host.innerHTML = this.themes.map(function (t) {
      var active = t.id === self.activeId;
      var sel = curId === t.id;
      return '<div class="aqts-item' + (sel ? ' active' : '') + '" data-id="' + esc(t.id) + '">' +
        '<div class="aqts-row" style="min-width:0">' +
          '<span class="aqts-dot" style="background:' + esc(t.accent || '#22d3ee') + ';box-shadow:0 0 10px ' + esc(t.accent || '#22d3ee') + '"></span>' +
          '<div class="meta"><b>' + esc(t.name || t.id) + '</b><small>' + esc(t.id) + ' · ' + esc(t.source || 'preset') + (t.mode ? ' · ' + esc(t.mode) : '') + '</small></div>' +
        '</div>' +
        '<div class="aqts-row">' +
          (active ? '<span class="aqts-chip on">active</span>' : '') +
          (t.source === 'custom' ? '<span class="aqts-chip custom">custom</span>' : '') +
        '</div></div>';
    }).join('') || '<p class="aqts-hint">No themes yet.</p>';
    host.querySelectorAll('.aqts-item').forEach(function (el) {
      el.onclick = function () { self.selectTheme(el.getAttribute('data-id')); };
    });
  };

  Studio.prototype.selectTheme = function (id) {
    var self = this;
    return this.api('/api/themes/' + encodeURIComponent(id)).then(function (j) {
      self.currentSource = j.source || 'preset';
      self.fillEditor(j.theme);
      self.renderList();
    });
  };

  Studio.prototype.refresh = function () {
    var self = this;
    return this.api('/api/themes').then(function (j) {
      self.themes = j.themes || [];
      self.activeId = j.activeThemeId;
      self.renderList();
      var pick = (self.current && self.current.meta && self.current.meta.id) || self.activeId || (self.themes[0] && self.themes[0].id);
      if (pick) return self.selectTheme(pick);
    });
  };

  Studio.prototype.activate = function () {
    var self = this;
    var id = (this.readEditor().meta.id || '').trim();
    this.api('/api/themes/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id })
    }).then(function (j) {
      self.activeId = j.activeThemeId;
      if (j.theme && global.AQTheme) global.AQTheme.apply(j.theme);
      return self.refresh();
    }).then(function () {
      self.toast('Activated: ' + self.activeId + ' (stayed on Theme Studio)');
    }).catch(function (e) { self.toast('Activate failed: ' + e.message); });
  };

  Studio.prototype.save = function () {
    var self = this;
    var theme = this.readEditor();
    this.api('/api/themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: theme, activate: false })
    }).then(function (j) {
      self.currentSource = 'custom';
      self.fillEditor(j.theme);
      return self.refresh();
    }).then(function () { self.toast('Saved to custom/'); })
      .catch(function (e) { self.toast('Save failed: ' + e.message); });
  };

  Studio.prototype.saveAs = function () {
    var self = this;
    var name = prompt('New theme name:', ((this.current && this.current.meta && this.current.meta.name) || '') + ' copy');
    if (!name) return;
    var theme = this.readEditor();
    this.api('/api/themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: theme, saveAsName: name, activate: false })
    }).then(function (j) {
      self.currentSource = 'custom';
      self.fillEditor(j.theme);
      return self.refresh();
    }).then(function () { self.toast('Saved as custom'); })
      .catch(function (e) { self.toast('Save failed: ' + e.message); });
  };

  Studio.prototype.exportJson = function () {
    var theme = this.readEditor();
    var id = (theme.meta && theme.meta.id) || 'theme';
    var blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = id + '.theme.json';
    a.click();
    URL.revokeObjectURL(a.href);
    this.toast('Downloaded ' + id + '.theme.json');
  };

  Studio.prototype.deleteCustom = function () {
    var self = this;
    var id = (this.readEditor().meta.id || '').trim();
    if (!id || !confirm('Delete custom theme «' + id + '»?')) return;
    this.api('/api/themes/' + encodeURIComponent(id), { method: 'DELETE' })
      .then(function () { self.current = null; return self.refresh(); })
      .then(function () { self.toast('Deleted'); })
      .catch(function (e) { self.toast('Delete failed: ' + e.message); });
  };

  Studio.prototype.copyPrompt = function () {
    var self = this;
    var text = this.promptText();
    var done = function () { self.toast('Prompt copied — paste into any AI with a screenshot'); };
    if (global.AQThemePrompt && global.AQThemePrompt.copy) {
      global.AQThemePrompt.copy().then(done).catch(function () {
        try {
          var pre = self.host.querySelector('[data-aqts=promptBox]');
          var range = document.createRange();
          range.selectNodeContents(pre);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand('copy');
          done();
        } catch (e) { self.toast('Copy manually from the box'); }
      });
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { self.toast('Copy manually'); });
    }
  };

  Studio.prototype.parseImport = function () {
    var text = stripJsonFences(this.host.querySelector('[data-aqts=importText]').value);
    if (!text) throw new Error('Paste JSON first');
    var parsed = JSON.parse(text);
    var theme = parsed.theme || parsed;
    if (!theme || typeof theme !== 'object') throw new Error('invalid_theme');
    if (!theme.meta && !theme.color && !theme.cssVariables) throw new Error('missing_theme_fields');
    if (!theme.meta) theme.meta = {};
    theme.meta.studio = 'theme-studio';
    return theme;
  };

  Studio.prototype.importPreview = function () {
    try {
      var theme = this.parseImport();
      this.currentSource = 'custom';
      this.fillEditor(theme);
      this.toast('Preview only (not saved)');
    } catch (e) { this.toast('Preview failed: ' + e.message); }
  };

  Studio.prototype.importSave = function (activate) {
    var self = this;
    try {
      var theme = this.parseImport();
      this.api('/api/themes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: theme, activate: !!activate })
      }).then(function (j) {
        self.activeId = j.activeThemeId;
        self.currentSource = 'custom';
        self.fillEditor(j.theme);
        if (j.theme && global.AQTheme) global.AQTheme.apply(j.theme);
        return self.refresh();
      }).then(function () {
        self.toast(activate ? 'Imported + activated' : 'Imported as custom');
      }).catch(function (e) { self.toast('Import failed: ' + e.message); });
    } catch (e) { this.toast('Import failed: ' + e.message); }
  };

  Studio.prototype.boot = function () {
    var self = this;
    this.renderShell();
    this.bind();
    this.renderTabs();
    this.renderEditorFields();
    var status = this.host.querySelector('[data-aqts=status]');
    this.api('/api/themes').then(function () {
      status.textContent = 'Theme Studio connected · /api/themes';
      status.className = 'aqts-status up';
      return self.refresh();
    }).catch(function () {
      status.textContent = 'Offline — start Start-Board.ps1';
      status.className = 'aqts-status down';
    });
  };

  function mount(host, opts) {
    if (!host) throw new Error('host required');
    var studio = new Studio(host, opts || {});
    studio.boot();
    return studio;
  }

  global.AQThemeStudio = {
    mount: mount,
    version: '1.1.0-theme-studio'
  };
})(window);
