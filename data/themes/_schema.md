# AQHub Theme Schema

Portable design-system theme JSON for AQHub HTML apps (Control Center, board, Eisenhower, panel, wizard).

Paste a theme file into any AI model and say: **build a theme with these specs**.

## Files

| Path | Role |
|------|------|
| `data/themes/*.json` | Built-in presets (committed) |
| `data/themes/custom/*.json` | User-saved themes (gitignored) |
| `data/themes/jarvis-hud.sample.json` | Documented sample for import / AI prompts |
| `data/themes-state.json` | Active theme id (gitignored live file) |
| `data/themes-state.sample.json` | Seed for first run |

## Top-level shape

```json
{
  "meta": { "...": "..." },
  "color": { "...": "..." },
  "typography": { "...": "..." },
  "shape": { "...": "..." },
  "elevation": { "...": "..." },
  "motion": { "...": "..." },
  "cssVariables": { "--aq-bg": "#050a12" }
}
```

JSON keys are English (portable). UI labels may be Arabic.

## `meta`

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | kebab-case, `^[a-z][a-z0-9-]{0,47}$` |
| `name` | string | Display name |
| `version` | string | Semver-ish, e.g. `1.0.0` |
| `author` | string | Optional |
| `description` | string | Human / AI readable brief |
| `styleKeywords` | string[] | e.g. `["Jarvis","dark","luminous","HUD"]` |
| `mode` | `"dark"` \| `"light"` \| `"custom"` | Base polarity |

## `color`

| Field | Meaning |
|-------|---------|
| `bg` | Page / canvas background |
| `bgSecondary` | Gradient / secondary wash |
| `surface` | Panels, sidebars |
| `surfaceElevated` | Cards, sheets, modals |
| `border` | Default stroke |
| `borderStrong` | Focus / hover stroke |
| `text` | Primary ink |
| `textMuted` | Secondary text |
| `textFaint` | Tertiary / hints |
| `accent` | Primary accent (HUD cyan) |
| `accent2` | Secondary accent |
| `accent3` | Tertiary accent |
| `success` / `warning` / `danger` | Status |
| `glow` | HUD glow / neon aura color |

Values: any valid CSS color (`#hex`, `rgb()`, `rgba()`, `hsl()`).

## `typography`

| Field | Meaning |
|-------|---------|
| `fontFamily` | UI / Arabic-friendly stack |
| `monoFamily` | IDs, status, code |
| `scale.xs` … `scale.xl` | Type scale tokens |

## `shape`

`radiusSm`, `radiusMd`, `radiusLg`, `borderWidth`

## `elevation`

`shadowSm`, `shadowMd`, `glowBlur`

## `motion` (optional)

`fast`, `normal`, `slow` — CSS time values.

## `cssVariables`

Map of CSS custom properties applied to `:root` by `theme.js`.

Canonical tokens use the `--aq-*` prefix. Legacy aliases (`--bg`, `--text`, `--cyan`, …) may be included so existing board/panel CSS picks up the theme without a full rewrite.

## API (Start-Board.ps1 + Theme-Bridge)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/themes` | List presets + custom |
| GET | `/api/themes/active` | Active theme document |
| PUT | `/api/themes/active` | `{ "id": "jarvis-hud" }` |
| GET | `/api/themes/{id}` | One theme |
| POST | `/api/themes` | Save / upsert theme body |
| POST | `/api/themes/import` | Import JSON body or `{ theme: {...} }` |
| GET | `/api/themes/{id}/export` | Download portable JSON |

## Apply runtime

Pages load `/theme.js`, which fetches `/api/themes/active` and sets `document.documentElement` CSS variables. Editor: `/themes.html` (linked from Control Center).
