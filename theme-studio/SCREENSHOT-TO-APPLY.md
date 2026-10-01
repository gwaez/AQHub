# Screenshot → Prompt → Paste JSON+Layout → Apply

Works with **any** multimodal AI (ChatGPT, Claude, Gemini, Grok, …). No secrets in-repo.

## Goal

Turn design screenshots into a **UI Kit** that remounts AQHub chrome:

- Nav: top · top-pill · side · side-icon · bottom  
- Cards / grid density  
- Button hierarchy  
- Sheet vs drawer  
- Optional floating bottom CTA (`clay-dock`)

## Steps

### 1. Capture screenshots

Full app chrome beats a single widget. The three reference vibes map to built-ins:

| Screenshot vibe | Activate preset |
|-----------------|-----------------|
| Light airy HR, pill top nav, mustard | `crextio-airy` |
| Dark glass, left icon rail, neon | `neon-glass-rail` |
| Clay side nav + bottom floating CTA | `clay-dock` |

### 2. Copy the AI prompt

Open http://127.0.0.1:8766/themes.html → **Copy prompt**  
Source: `theme-studio/aq-theme-prompt.js`

### 3. Ask any model

Paste prompt + attach screenshot(s). Expect raw JSON:

```json
{
  "theme": { "meta": {}, "color": {}, "layout": {}, "chrome": {}, "components": {}, "cssVariables": {} },
  "layoutPatch": {
    "shellPreset": "neon-glass-rail",
    "nav": "side-icon",
    "cardDensity": "comfortable",
    "buttonHierarchy": "stacked",
    "overlay": "drawer",
    "bottomBar": false,
    "grid": "mosaic",
    "htmlClassMap": { ".top": "aq-chrome-nav", ".top-actions": "aq-chrome-actions" },
    "cssModules": ["theme-studio/layouts/neon-glass-rail.css"],
    "applyScript": "theme-studio/aq-theme-apply.js"
  }
}
```

### 4. Paste → Apply

Theme Studio → JSON zone → **Apply + Save custom + Activate**

Or skip AI and click a UI Kit quick button (`Crextio Airy` / `Neon Glass` / `Clay Dock`).

### 5. Verify on real shells

| Page | Expect |
|------|--------|
| `/index.html` `/panel.html` | Top pill / side rail / clay side+dock |
| `/board.html` | Header chrome follows nav; overlays sheet↔drawer |
| `/eisenhower.html` | Top actions follow chrome attrs |

## Apply path (runtime)

1. `theme.js` → **`theme-studio/aq-theme-apply.js`**  
2. `GET /api/themes/active`  
3. Set `:root` CSS variables  
4. Set `data-aq-shell`, `data-aq-nav`, `data-aq-card-density`, `data-aq-btn-hierarchy`, `data-aq-overlay`, `data-aq-bottom-bar`  
5. Load `aq-theme-layouts.css` + `layouts/<preset>.css`  
6. Remount chrome markers; inject `#aq-chrome-dock` when `bottomBar: true`

## Tips

- Prefer built-in `shellPreset` ids so structure works immediately.  
- Custom modules go under `theme-studio/layouts/`.  
- Never put CRM tokens / secrets into theme JSON.
