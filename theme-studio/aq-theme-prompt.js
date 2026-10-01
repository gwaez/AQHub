/**
 * Theme Studio — AI prompt: screenshot(s) → full UI Kit JSON + layoutPatch.
 * Apply path: theme-studio/aq-theme-apply.js (via Theme Studio import or AQTheme.apply).
 */
(function (global) {
  'use strict';

  var TEXT = [
    'You are building an AQHub Theme Studio UI Kit package — NOT colors alone.',
    'The kit must remount real application chrome: nav placement, button hierarchy, card grid, overlays.',
    '',
    'I am attaching design screenshot(s). Infer BOTH visual tokens AND structural layout.',
    '',
    'Return ONLY one valid JSON object (no markdown fences, no commentary) using this envelope:',
    '{',
    '  "theme": {',
    '    "meta": { "id":"kebab-id", "name":"...", "version":"1.3.0", "author":"...", "description":"...", "styleKeywords":[], "mode":"dark|light|custom", "studio":"theme-studio" },',
    '    "color": { "bg","bgSecondary","surface","surfaceElevated","border","borderStrong","text","textMuted","textFaint","accent","accent2","accent3","success","warning","danger","glow" },',
    '    "typography": { "fontFamily","monoFamily","scale":{"xs","sm","md","lg","xl"}, "lineHeight?","letterSpacing?" },',
    '    "shape": { "radiusSm","radiusMd","radiusLg","borderWidth","radiusPill?" },',
    '    "spacing": { "unit","scale":{"0"…"8"} },',
    '    "layout": {',
    '      "density":"compact|comfortable|spacious",',
    '      "shellMaxWidth","shellPadding","sectionGap","cardPadding","gridGap","sidebarWidth",',
    '      "shellPreset","navPosition","cardDensity","buttonHierarchy","overlayMode","grid"',
    '    },',
    '    "chrome": {',
    '      "shellPreset":"jarvis-default|soft-ui-interactive|crextio-airy|neon-glass-rail|clay-dock|side-rail-ops|<custom>",',
    '      "nav":"top|top-pill|side|side-icon|bottom",',
    '      "cardDensity":"compact|comfortable|spacious",',
    '      "buttonHierarchy":"primary-end|primary-start|stacked",',
    '      "overlay":"sheet|drawer",',
    '      "bottomBar": true|false,',
    '      "grid":"default|modular|mosaic|soft",',
    '      "classMap": { ".top":"aq-chrome-nav", ".top-actions":"aq-chrome-actions" },',
    '      "cssModules": ["theme-studio/layouts/<preset>.css"],',
    '      "applyScript": "theme-studio/aq-theme-apply.js"',
    '    },',
    '    "elevation": {}, "motion": {}, "hud": {}, "iconography": {},',
    '    "components": {',
    '      "shell": {}, "card": {}, "button": { "primaryStyle":"gradient|solid|outline" },',
    '      "input": {}, "chip": {}, "nav": { "position":"..." }, "table": {},',
    '      "sheet": { "mode":"sheet|drawer" }',
    '    },',
    '    "cssVariables": { "--aq-*": "...", "--bg":"...", "--text":"...", "--cyan":"...", "--radius":"..." }',
    '  },',
    '  "layoutPatch": {',
    '    "shellPreset": "...",',
    '    "nav": "...",',
    '    "cardDensity": "...",',
    '    "buttonHierarchy": "...",',
    '    "overlay": "...",',
    '    "bottomBar": false,',
    '    "grid": "...",',
    '    "htmlClassMap": { ".top":"aq-chrome-nav", ".top-actions":"aq-chrome-actions", "#systemsGrid":"aq-chrome-grid" },',
    '    "cssModules": ["theme-studio/layouts/<preset>.css"],',
    '    "applyScript": "theme-studio/aq-theme-apply.js"',
    '  }',
    '}',
    '',
    'Map screenshot vibes to built-in UI Kit presets when close:',
    '0) Soft UI dual chrome (icon rail + project sidebar + floating cards) + Kanban drag lift/ghost → shellPreset "soft-ui-interactive"',
    '1) Light airy HR / Crextio-like (top pill nav, white modular cards, mustard) → shellPreset "crextio-airy"',
    '2) Dark glass analytics (left icon rail, hero+mosaic, neon) → shellPreset "neon-glass-rail"',
    '3) Clay music dashboard (colored side nav, soft raised cards, bottom floating CTA) → shellPreset "clay-dock"',
    '',
    'Apply path after paste in Theme Studio:',
    '1) Import JSON → Apply + Save custom + Activate',
    '2) Runtime loads theme-studio/aq-theme-apply.js',
    '3) Sets data-aq-shell / data-aq-nav / data-aq-card-density / data-aq-btn-hierarchy / data-aq-overlay',
    '4) Loads theme-studio/aq-theme-layouts.css + layouts/<preset>.css',
    '5) Remounts chrome markers (+ soft dual rail/aside/analytics, or bottom dock when bottomBar:true) on index/panel/board/eisenhower/themes',
    '',
    'Rules:',
    '- Fill EVERY theme field with concrete CSS values.',
    '- Structure must change visibly (nav/cards/buttons), not tokens only.',
    '- Prefer Arabic-friendly contrast.',
    '- Output raw JSON only.',
    '',
    '---',
    'ابنِ حزمة UI Kit لـ Theme Studio من لقطات الشاشة: توكنات + كروم هيكلي (ناف / بطاقات / أزرار / sheet|drawer).',
    'أرجع JSON بالشكل { theme, layoutPatch } فقط. presets جاهزة: soft-ui-interactive · crextio-airy · neon-glass-rail · clay-dock.',
    'مسار التطبيق: theme-studio/aq-theme-apply.js بعد اللصق في Theme Studio.'
  ].join('\n');

  function copy() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(TEXT);
    }
    return Promise.reject(new Error('clipboard_unavailable'));
  }

  global.AQThemePrompt = {
    text: TEXT,
    copy: copy,
    version: '1.3.0-ui-kit'
  };
})(window);
