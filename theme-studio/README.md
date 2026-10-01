# Theme Studio

Reusable **full design-system** theme package for AQHub (and drop-in for sibling apps).

Not just colors/fonts — layout density, spacing, elevation, motion, HUD/glow language, iconography hints, and component recipes (button, input, chip, nav, table, sheet, card, shell).

## Drop into another app

```html
<link rel="stylesheet" href="/theme-studio/aq-theme-recipes.css" />
<link rel="stylesheet" href="/theme-studio/aq-theme-studio.css" />
<script src="/theme-studio/aq-theme-apply.js"></script>
<script src="/theme-studio/aq-theme-prompt.js"></script>
<script src="/theme-studio/aq-theme-studio.js"></script>

<div id="theme-studio-root"></div>
<script>
  // Apply active theme on any page
  AQTheme.load();

  // Mount the full Theme Studio editor (optional)
  AQThemeStudio.mount(document.getElementById('theme-studio-root'), {
    apiBase: '',           // same-origin AQHub /api/themes*
    title: 'Theme Studio',
    stayOnPage: true       // never navigate to board.html
  });
</script>
```

## Package layout

| File | Role |
|------|------|
| `SCHEMA.md` | Portable design-system JSON schema (English keys) |
| `aq-theme-apply.js` | Runtime: fetch active theme → set `:root` CSS vars + `data-aq-*` |
| `aq-theme-prompt.js` | Copyable AI prompt for screenshot → complete theme JSON |
| `aq-theme-studio.js` | Mountable editor UI (library, live preview, import/export) |
| `aq-theme-studio.css` | Editor chrome styles (uses `--aq-*` tokens) |
| `aq-theme-recipes.css` | Optional component recipes bound to tokens |

## Host in AQHub

- Page: `/themes.html` (thin host)
- Shim: `/theme.js` → loads `theme-studio/aq-theme-apply.js`
- Data: `/data/themes/*.json` + `/api/themes*` (Theme-Bridge)
- Custom themes: `data/themes/custom/` (gitignored)

## JSON keys

Always English for cross-app reuse. UI labels may be Arabic.
