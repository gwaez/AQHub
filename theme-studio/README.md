# Theme Studio

Reusable **UI Kit** theme package for AQHub (drop-in for sibling apps).

Not CSS variables alone — **structural chrome remount**: nav placement (top / pill / side / icon-rail / bottom), card density & grid, button hierarchy, sheet vs drawer, optional floating bottom CTA.

**Workflow:** [SCREENSHOT-TO-APPLY.md](./SCREENSHOT-TO-APPLY.md)

## Demo UI Kit skins (design refs)

| Preset id | Vibe | Structure |
|-----------|------|-----------|
| `crextio-airy` | Light HR / Crextio-like | Top pill nav · modular white cards · mustard |
| `neon-glass-rail` | Dark glass analytics | Left icon rail · hero+mosaic · neon |
| `clay-dock` | Clay music dashboard | Colored side nav · soft cards · bottom floating CTA |

Activate from Theme Studio quick buttons, or `PUT /api/themes/active` with the id, then open `index.html` / `panel.html`.

## Drop into another app

```html
<link rel="stylesheet" href="/theme-studio/aq-theme-layouts.css" />
<link rel="stylesheet" href="/theme-studio/aq-theme-recipes.css" />
<link rel="stylesheet" href="/theme-studio/aq-theme-studio.css" />
<script src="/theme-studio/aq-theme-apply.js"></script>
<script src="/theme-studio/aq-theme-prompt.js"></script>
<script src="/theme-studio/aq-theme-studio.js"></script>

<div id="theme-studio-root"></div>
<script>
  AQTheme.load(); // apply active UI Kit (tokens + chrome remount)
  AQThemeStudio.mount(document.getElementById('theme-studio-root'), {
    apiBase: '',
    title: 'Theme Studio'
  });
</script>
```

## Package layout

| File | Role |
|------|------|
| `SCHEMA.md` | Portable UI Kit JSON schema |
| `SCREENSHOT-TO-APPLY.md` | Screenshot → prompt → paste → Apply |
| `aq-theme-apply.js` | Runtime apply + chrome remount + layout modules |
| `aq-theme-layouts.css` | Shared structural shell rules |
| `layouts/*.css` | Per-preset structural CSS |
| `aq-theme-prompt.js` | AI prompt → `{ theme, layoutPatch }` |
| `aq-theme-studio.js` | Mountable editor + UI Kit quick apply |
| `aq-theme-studio.css` | Editor styles |
| `aq-theme-recipes.css` | Component recipe classes |

## Host in AQHub

- Page: `/themes.html`
- Shim: `/theme.js` → `theme-studio/aq-theme-apply.js`
- Shells: `index.html`, `panel.html`, `board.html`, `eisenhower.html` link `aq-theme-layouts.css` + `data-aq-chrome` markers
- Data: `data/themes/*.json` + `/api/themes*`
- Apply script path (for AI / tooling): `theme-studio/aq-theme-apply.js`

## JSON keys

English keys only. Structural: `layout.*`, `chrome.*`, `components.*`, optional `layoutPatch`.
