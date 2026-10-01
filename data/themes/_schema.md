# AQHub themes — schema pointer

The canonical **Theme Studio** design-system schema lives in:

→ **[`theme-studio/SCHEMA.md`](../../theme-studio/SCHEMA.md)**

Drop-in module docs: [`theme-studio/README.md`](../../theme-studio/README.md)

Presets in this folder (`jarvis-hud.json`, `aqaar-control.json`, `daylight-ops.json`) follow that full shape: `meta`, `color`, `typography`, `shape`, `spacing`, `layout`, `elevation`, `motion`, `hud`, `iconography`, `components`, `cssVariables`.

Editor: `/themes.html` (hosts Theme Studio).  
Runtime: `/theme-studio/aq-theme-apply.js` (shim: `/theme.js`).  
API: `/api/themes*` via `wizard/Theme-Bridge.ps1`.
