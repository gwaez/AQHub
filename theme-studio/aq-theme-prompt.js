/**
 * Theme Studio — AI prompt for screenshot → complete portable theme JSON.
 * Exposes window.AQThemePrompt = { text, copy() }
 */
(function (global) {
  'use strict';

  var TEXT = [
    'You are helping build a portable AQHub / Theme Studio design-system theme.',
    '',
    'I am attaching a screenshot of a UI / site / theme I like.',
    'Analyze the screenshot deeply: colors, surfaces, typography feel, radii, borders, shadows, glow/accents, spacing density, card/shell patterns, button/input/chip language, light vs dark, HUD/neon cues.',
    '',
    'Return ONLY one valid JSON object — no markdown fences, no commentary — matching Theme Studio\'s portable schema',
    '(theme-studio/SCHEMA.md and the shape of data/themes/jarvis-hud.json).',
    '',
    'Required top-level keys (English keys only):',
    '- meta: { id, name, version, author, description, styleKeywords[], mode, studio:"theme-studio" }',
    '  - id: kebab-case ^[a-z][a-z0-9-]{0,47}$',
    '  - mode: "dark" | "light" | "custom"',
    '  - styleKeywords: short English tags',
    '- color: { bg, bgSecondary, surface, surfaceElevated, border, borderStrong, text, textMuted, textFaint, accent, accent2, accent3, success, warning, danger, glow }',
    '- typography: { fontFamily, monoFamily, scale:{xs,sm,md,lg,xl}, lineHeight?, letterSpacing? }',
    '- shape: { radiusSm, radiusMd, radiusLg, borderWidth, radiusPill? }',
    '- spacing: { unit, scale:{ "0"…"8" } }',
    '- layout: { density:"compact"|"comfortable"|"spacious", shellMaxWidth, shellPadding, sectionGap, cardPadding, gridGap, sidebarWidth }',
    '- elevation: { shadowSm, shadowMd, glowBlur, shadowLg? }',
    '- motion: { fast, normal, slow, easing?, hoverLift? }',
    '- hud: { glowStrength, glowSpread, scanlineOpacity, gridOpacity, accentPulse }',
    '- iconography: { style:"line"|"solid"|"duotone", strokeWidth, sizeSm, sizeMd, sizeLg }',
    '- components: { shell, card, button, input, chip, nav, table, sheet } — each a recipe object with radius/padding/etc.',
    '- cssVariables: map for :root including --aq-* tokens AND legacy aliases (--bg,--text,--cyan,--ink,--radius,…)',
    '',
    'Rules:',
    '1) Infer a cohesive full design system from the screenshot — not colors alone.',
    '2) Fill EVERY field with concrete CSS values (hex/rgba/rem/px/time).',
    '3) Keep cssVariables consistent with structured blocks.',
    '4) Prefer Arabic-friendly readable contrast.',
    '5) Output raw JSON only.',
    '',
    '---',
    'أنت تساعد في بناء ثيم نظام تصميم كامل (Theme Studio) لتطبيقات AQHub.',
    '',
    'أرفق لقطة شاشة لواجهة/موقع/ثيم يعجبني.',
    'حلّل الألوان والأسطح والخطوط والكثافة والمسافات ووصفات المكوّنات (أزرار، حقول، شيبس، جداول، شيتات) والتوهج HUD ووضع فاتح/داكن.',
    '',
    'أرجع كائن JSON واحد صالح فقط — بدون شرح وبدون ``` — مطابق لـ theme-studio/SCHEMA.md وشكل jarvis-hud.json.',
    'المفاتيح الإنجليزية أعلاه إلزامية بالكامل (meta…components…cssVariables + styleKeywords).',
    'لا تفتح board.html ولا تغيّر هيكل التطبيقات — الثيم JSON فقط.'
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
    version: '1.1.0-theme-studio'
  };
})(window);
