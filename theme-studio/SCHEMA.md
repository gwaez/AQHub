# Theme Studio — Portable Design-System Schema

Self-describing theme JSON. Paste to any AI with a screenshot and ask it to return a **complete** theme — tokens **and** structural chrome — matching this shape.

JSON keys are **English**. Values are CSS-compatible strings unless noted.

## Top-level

```json
{
  "meta": {},
  "color": {},
  "typography": {},
  "shape": {},
  "spacing": {},
  "layout": {},
  "chrome": {},
  "elevation": {},
  "motion": {},
  "hud": {},
  "iconography": {},
  "components": {},
  "cssVariables": {},
  "layoutPatch": {}
}
```

AI models may also return an envelope:

```json
{
  "theme": { /* same fields as above */ },
  "layoutPatch": {
    "shellPreset": "side-rail-ops",
    "nav": "side",
    "cardDensity": "compact",
    "buttonHierarchy": "primary-start",
    "overlay": "drawer",
    "htmlClassMap": { ".top": "aq-chrome-nav" },
    "cssModules": ["theme-studio/layouts/side-rail-ops.css"]
  }
}
```

`layoutPatch` merges into `chrome` / `layout` on import/apply.

## `meta`

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | kebab-case `^[a-z][a-z0-9-]{0,47}$` |
| `name` | string | Display name |
| `version` | string | e.g. `1.2.0` |
| `author` | string | Optional |
| `description` | string | Human / AI brief |
| `styleKeywords` | string[] | e.g. `["Jarvis","dark","side-rail"]` |
| `mode` | `"dark"` \| `"light"` \| `"custom"` | Base polarity |
| `studio` | string | Optional `"theme-studio"` marker for tooling |

## `color`

`bg`, `bgSecondary`, `surface`, `surfaceElevated`, `border`, `borderStrong`, `text`, `textMuted`, `textFaint`, `accent`, `accent2`, `accent3`, `success`, `warning`, `danger`, `glow`

## `typography`

`fontFamily`, `monoFamily`, `scale: { xs, sm, md, lg, xl }`, optional `lineHeight`, `letterSpacing`

## `shape`

`radiusSm`, `radiusMd`, `radiusLg`, `borderWidth`, optional `radiusPill` (`999px`)

## `spacing`

```json
{
  "unit": "4px",
  "scale": {
    "0": "0", "1": "4px", "2": "8px", "3": "12px",
    "4": "16px", "5": "24px", "6": "32px", "7": "48px", "8": "64px"
  }
}
```

## `layout`

Token + structural layout recipes (maps to CSS vars **and** `data-aq-*`).

| Field | Meaning |
|-------|---------|
| `density` | `"compact"` \| `"comfortable"` \| `"spacious"` → `data-aq-density` |
| `shellMaxWidth` | Content shell max width |
| `shellPadding` | Shell padding |
| `sectionGap` | Gap between major sections |
| `cardPadding` | Default card padding |
| `gridGap` | Default grid/flex gap |
| `sidebarWidth` | Side rail / panel width |
| `shellPreset` | `"jarvis-default"` \| `"side-rail-ops"` \| custom id |
| `navPosition` | `"top"` \| `"side"` \| `"bottom"` |
| `cardDensity` | `"compact"` \| `"comfortable"` \| `"spacious"` |
| `buttonHierarchy` | `"primary-end"` \| `"primary-start"` \| `"stacked"` |
| `overlayMode` | `"sheet"` \| `"drawer"` |

## `chrome` (structural application chrome)

Maps to real shell variants on Control Center, board, Eisenhower, panel.

```json
{
  "shellPreset": "neon-glass-rail",
  "nav": "side-icon",
  "cardDensity": "comfortable",
  "buttonHierarchy": "stacked",
  "overlay": "drawer",
  "bottomBar": false,
  "grid": "mosaic",
  "classMap": {
    ".top": "aq-chrome-nav",
    ".top-actions": "aq-chrome-actions",
    ".actions": "aq-chrome-actions"
  },
  "cssModules": ["theme-studio/layouts/neon-glass-rail.css"],
  "applyScript": "theme-studio/aq-theme-apply.js"
}
```

| Field | Effect |
|-------|--------|
| `shellPreset` | Sets `data-aq-shell` + loads layout CSS module |
| `nav` | `top` \| `top-pill` \| `side` \| `side-icon` \| `soft-dual` \| `bottom` → remounts chrome |
| `cardDensity` | Sets `data-aq-card-density` — card padding/gaps |
| `buttonHierarchy` | Sets `data-aq-btn-hierarchy` — primary order / stack |
| `overlay` | Sets `data-aq-overlay` — board sheet vs side drawer |
| `bottomBar` | Injects floating `#aq-chrome-dock` CTA (clay-dock) |
| `analyticsPanel` | Injects `#aq-soft-analytics` (soft-ui-interactive) |
| `grid` | `default` \| `modular` \| `mosaic` \| `soft` hint for card grids |
| `classMap` | Optional HTML class map applied at runtime |
| `cssModules` | Structural CSS files under `theme-studio/layouts/` |
| `applyScript` | Runtime entry (`theme-studio/aq-theme-apply.js`) |

### Built-in shell / UI Kit presets

| Id | Nav | Cards | Buttons | Overlay | Notes |
|----|-----|-------|---------|---------|-------|
| `jarvis-default` | top | comfortable | primary-end | sheet | Classic AQHub |
| `side-rail-ops` | side | compact | primary-start | drawer | Ops demo rail |
| `soft-ui-interactive` | soft-dual | spacious | primary-end | sheet | Soft UI rail+aside · Kanban drag lift/ghost · analytics panel |
| `crextio-airy` | top-pill | spacious | primary-end | sheet | Light HR / mustard |
| `neon-glass-rail` | side-icon | comfortable | stacked | drawer | Dark glass + neon |
| `clay-dock` | side | comfortable | primary-start | sheet | Clay side + **bottomBar** dock |

Shared structural CSS: `theme-studio/aq-theme-layouts.css`.  
Per-preset modules: `theme-studio/layouts/<id>.css`.  
Apply script: `theme-studio/aq-theme-apply.js`.

## `elevation` / `motion` / `hud` / `iconography`

Unchanged from Theme Studio 1.1 — see prior fields (`shadowSm`, `fast`/`normal`/`slow`, HUD glow language, icon sizes).

## `components` (recipes)

Recipes describe how common controls should feel. Apps map these to CSS classes in `aq-theme-recipes.css` and chrome attrs.

```json
{
  "shell":  { "pattern": "glass", "blur": "18px", "border": "1px solid var(--aq-border)" },
  "card":   { "radius": "var(--aq-radius-md)", "padding": "var(--aq-space-4)", "backdropBlur": "14px" },
  "button": { "radius": "var(--aq-radius-md)", "padding": "10px 14px", "fontWeight": "600", "primaryStyle": "gradient" },
  "input":  { "radius": "12px", "padding": "9px 11px", "background": "rgba(7,11,18,.55)" },
  "chip":   { "radius": "999px", "padding": "3px 8px", "fontSize": "0.72rem" },
  "nav":    { "height": "52px", "blur": "12px", "gap": "8px", "position": "top" },
  "table":  { "rowHeight": "40px", "headerWeight": "700", "cellPadding": "8px 10px" },
  "sheet":  { "radius": "18px", "maxWidth": "500px", "backdrop": "rgba(2,8,16,.55)", "mode": "sheet" }
}
```

`primaryStyle`: `"gradient"` \| `"solid"` \| `"outline"`  
`sheet.mode`: `"sheet"` \| `"drawer"`

## `cssVariables`

Map applied to `:root` by `aq-theme-apply.js`.

Canonical prefix: `--aq-*`.  
Legacy aliases (`--bg`, `--text`, `--cyan`, …) may be included for existing AQHub HTML without a full rewrite.

The apply layer also **derives** vars from structured blocks and sets:

- `data-aq-theme`, `data-aq-theme-mode`, `data-aq-density`
- `data-aq-shell`, `data-aq-nav`, `data-aq-card-density`, `data-aq-btn-hierarchy`, `data-aq-overlay`

## AI workflow

See **[SCREENSHOT-TO-APPLY.md](./SCREENSHOT-TO-APPLY.md)**.

1. Copy prompt from Theme Studio (`AQThemePrompt.text`).
2. Paste into any model + attach design screenshot(s).
3. Paste returned JSON (+ layout patch) into Theme Studio import → Apply.
4. Activate `side-rail-ops` (or your import) and open `index.html` / `board.html` — nav/cards/actions move.
