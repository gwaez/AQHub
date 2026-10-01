# Theme Studio — Portable Design-System Schema

Self-describing theme JSON. Paste to any AI with a screenshot and ask it to return a **complete** theme matching this shape.

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
  "elevation": {},
  "motion": {},
  "hud": {},
  "iconography": {},
  "components": {},
  "cssVariables": {}
}
```

## `meta`

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | kebab-case `^[a-z][a-z0-9-]{0,47}$` |
| `name` | string | Display name |
| `version` | string | e.g. `1.1.0` |
| `author` | string | Optional |
| `description` | string | Human / AI brief |
| `styleKeywords` | string[] | e.g. `["Jarvis","dark","luminous","HUD"]` |
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

| Field | Meaning |
|-------|---------|
| `density` | `"compact"` \| `"comfortable"` \| `"spacious"` |
| `shellMaxWidth` | Content shell max width |
| `shellPadding` | Shell padding |
| `sectionGap` | Gap between major sections |
| `cardPadding` | Default card padding |
| `gridGap` | Default grid/flex gap |
| `sidebarWidth` | Side panel width |

Density maps to spacing multipliers applied by the apply layer (`data-aq-density`).

## `elevation`

`shadowSm`, `shadowMd`, `glowBlur`, optional `shadowLg`

## `motion`

`fast`, `normal`, `slow`, optional `easing`, `hoverLift`

## `hud`

HUD / glow language (Jarvis-style ops UI):

| Field | Meaning |
|-------|---------|
| `glowStrength` | 0–1 opacity hint |
| `glowSpread` | Blur radius string |
| `scanlineOpacity` | Optional overlay |
| `gridOpacity` | Optional grid wash |
| `accentPulse` | boolean — soft pulse on accents |

## `iconography`

`style` (`line` \| `solid` \| `duotone`), `strokeWidth`, `sizeSm`, `sizeMd`, `sizeLg`

## `components` (recipes)

Recipes describe how common controls should feel. Apps may map these to CSS classes in `aq-theme-recipes.css`.

```json
{
  "shell":  { "pattern": "glass", "blur": "18px", "border": "1px solid var(--aq-border)" },
  "card":   { "radius": "var(--aq-radius-md)", "padding": "var(--aq-space-4)", "backdropBlur": "14px" },
  "button": { "radius": "var(--aq-radius-md)", "padding": "10px 14px", "fontWeight": "600", "primaryStyle": "gradient" },
  "input":  { "radius": "12px", "padding": "9px 11px", "background": "rgba(7,11,18,.55)" },
  "chip":   { "radius": "999px", "padding": "3px 8px", "fontSize": "0.72rem" },
  "nav":    { "height": "52px", "blur": "12px", "gap": "8px" },
  "table":  { "rowHeight": "40px", "headerWeight": "700", "cellPadding": "8px 10px" },
  "sheet":  { "radius": "18px", "maxWidth": "500px", "backdrop": "rgba(2,8,16,.55)" }
}
```

`primaryStyle`: `"gradient"` \| `"solid"` \| `"outline"`

## `cssVariables`

Map applied to `:root` by `aq-theme-apply.js`.

Canonical prefix: `--aq-*`.  
Legacy aliases (`--bg`, `--text`, `--cyan`, …) may be included for existing AQHub HTML without a full rewrite.

The apply layer also **derives** vars from structured blocks when `cssVariables` is incomplete.

## AI workflow

1. Copy prompt from Theme Studio (`AQThemePrompt.text`).
2. Paste into any model + attach a screenshot.
3. Paste returned JSON into Theme Studio import → Apply / Save custom / Activate.
