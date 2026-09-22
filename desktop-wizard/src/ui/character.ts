/** Character pack loader. Technical id stays on the pack; display name is user data. */

export const DEFAULT_CHARACTER_ID = "secretary";
export const KNOWN_CHARACTER_IDS = ["secretary", "old-wizard"] as const;
export type KnownCharacterId = (typeof KNOWN_CHARACTER_IDS)[number];

export interface CharacterStateSpec {
  asset: string | null;
  loop?: boolean;
  motion?: string;
  stub?: boolean;
}

export interface CharacterPack {
  id: string;
  technicalId: string;
  defaultDisplayName: string;
  displayNameEn?: string;
  /** IDLE (or first) asset URL — kept for callers that still inject a single sprite. */
  svgUrl: string;
  baseUrl: string;
  bubble: { dir: "rtl" | "ltr"; lang: string };
  anchors: { bubble: { x: number; y: number }; wand: { x: number; y: number } };
  states: Record<string, CharacterStateSpec>;
}

const RASTER_EXT = /\.(png|webp|jpe?g)(\?|#|$)/i;

export function isKnownCharacterId(id: unknown): id is KnownCharacterId {
  return id === "secretary" || id === "old-wizard";
}

export function normalizeCharacterId(id: unknown): KnownCharacterId {
  return isKnownCharacterId(id) ? id : DEFAULT_CHARACTER_ID;
}

export function isRasterAsset(asset: string): boolean {
  return RASTER_EXT.test(asset);
}

export function characterAssetUrl(baseUrl: string, asset: string): string {
  if (/^https?:\/\//i.test(asset) || asset.startsWith("/")) return asset;
  return `${baseUrl}/${asset.replace(/^\.\//, "")}`;
}

export function resolveStateAsset(pack: CharacterPack, state: string): string | null {
  if (Object.prototype.hasOwnProperty.call(pack.states, state)) {
    const spec = pack.states[state];
    if (!spec || spec.asset == null || spec.asset === "") return null;
    return spec.asset;
  }
  const idle = pack.states.IDLE?.asset;
  return idle || null;
}

function fallbackStates(id: string): Record<string, CharacterStateSpec> {
  if (id === "old-wizard") {
    const svg: CharacterStateSpec = { asset: "wizard.svg", loop: true, motion: "breathe" };
    return {
      IDLE: svg,
      WATCHING: { asset: "wizard.svg", loop: true, motion: "glance" },
      THINKING: { asset: "wizard.svg", loop: true, motion: "ponder" },
      SPEAKING: { asset: "wizard.svg", loop: true, motion: "speak" },
      ALERT: { asset: "wizard.svg", loop: false, motion: "alert" },
      WORKING: { asset: "wizard.svg", loop: true, motion: "work" },
      SUCCESS: { asset: "wizard.svg", loop: false, motion: "success" },
      ERROR: { asset: "wizard.svg", loop: false, motion: "error" },
      DRAGGING: { asset: "wizard.svg", loop: false, motion: "lift" },
      SLEEPING: { asset: "wizard.svg", loop: true, motion: "sleep" },
      HIDDEN: { asset: null, loop: false, motion: "fade-out" },
      WAND: { asset: "wizard.svg", stub: true },
      NOTE: { asset: "wizard.svg", stub: true },
      MATRIX: { asset: "wizard.svg", loop: true, motion: "work" },
      TRASH: { asset: "wizard.svg", loop: false, motion: "work" },
    };
  }
  return {
    IDLE: { asset: "idle.png", loop: true, motion: "breathe" },
    WATCHING: { asset: "watch.png", loop: true, motion: "glance" },
    THINKING: { asset: "think.png", loop: true, motion: "ponder" },
    SPEAKING: { asset: "speak.png", loop: true, motion: "speak" },
    ALERT: { asset: "speak.png", loop: false, motion: "alert" },
    WORKING: { asset: "work.png", loop: true, motion: "work" },
    SUCCESS: { asset: "success.png", loop: false, motion: "success" },
    ERROR: { asset: "error.png", loop: false, motion: "error" },
    DRAGGING: { asset: "drag.png", loop: false, motion: "lift" },
    SLEEPING: { asset: "sleep.png", loop: true, motion: "sleep" },
    HIDDEN: { asset: null, loop: false, motion: "fade-out" },
    WAND: { asset: "work.png", stub: true },
    NOTE: { asset: "work.png", stub: true },
    MATRIX: { asset: "work.png", loop: true, motion: "work" },
    TRASH: { asset: "work.png", loop: false, motion: "work" },
  };
}

function fallbackPack(id: string): CharacterPack {
  const baseUrl = `/characters/${id}`;
  const states = fallbackStates(id);
  const idleAsset = states.IDLE.asset || (id === "old-wizard" ? "wizard.svg" : "idle.png");
  const secretary = id !== "old-wizard";
  return {
    id,
    technicalId: "AQWizard",
    defaultDisplayName: secretary ? "السكرتيرة" : "الساحر العتيق",
    displayNameEn: secretary ? "Secretary" : "Old Wizard",
    svgUrl: `${baseUrl}/${idleAsset}`,
    baseUrl,
    bubble: { dir: "rtl", lang: "ar" },
    anchors: secretary
      ? { bubble: { x: 430, y: 210 }, wand: { x: 780, y: 620 } }
      : { bubble: { x: 28, y: 36 }, wand: { x: 198, y: 74 } },
    states,
  };
}

function parseStates(raw: unknown, id: string): Record<string, CharacterStateSpec> {
  const fallback = fallbackStates(id);
  if (!raw || typeof raw !== "object") return fallback;
  const out: Record<string, CharacterStateSpec> = { ...fallback };
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const row = value as { asset?: unknown; loop?: unknown; motion?: unknown; stub?: unknown };
    const asset = row.asset == null ? null : String(row.asset);
    out[key] = {
      asset,
      loop: typeof row.loop === "boolean" ? row.loop : undefined,
      motion: typeof row.motion === "string" ? row.motion : undefined,
      stub: row.stub === true ? true : undefined,
    };
  }
  return out;
}

export async function loadCharacterPack(id = DEFAULT_CHARACTER_ID): Promise<CharacterPack> {
  const packId = normalizeCharacterId(id);
  const base = `/characters/${packId}`;
  const fallback = fallbackPack(packId);
  try {
    const res = await fetch(`${base}/manifest.json`);
    if (!res.ok) return fallback;
    const m = (await res.json()) as {
      id?: string;
      technicalId?: string;
      defaultDisplayName?: string;
      displayNameEn?: string;
      states?: unknown;
      bubble?: { dir?: string; lang?: string };
      anchors?: { bubble?: { x: number; y: number }; wand?: { x: number; y: number } };
    };
    const states = parseStates(m.states, packId);
    const idleAsset = states.IDLE?.asset || (packId === "old-wizard" ? "wizard.svg" : "idle.png");
    return {
      id: m.id || packId,
      technicalId: m.technicalId || "AQWizard",
      defaultDisplayName: m.defaultDisplayName || fallback.defaultDisplayName,
      displayNameEn: m.displayNameEn || fallback.displayNameEn,
      svgUrl: characterAssetUrl(base, idleAsset),
      baseUrl: base,
      bubble: {
        dir: m.bubble?.dir === "ltr" ? "ltr" : "rtl",
        lang: m.bubble?.lang || "ar",
      },
      anchors: {
        bubble: { x: m.anchors?.bubble?.x ?? fallback.anchors.bubble.x, y: m.anchors?.bubble?.y ?? fallback.anchors.bubble.y },
        wand: { x: m.anchors?.wand?.x ?? fallback.anchors.wand.x, y: m.anchors?.wand?.y ?? fallback.anchors.wand.y },
      },
      states,
    };
  } catch {
    return fallback;
  }
}

export function injectWizardRaster(host: HTMLElement, url: string, alt = ""): void {
  const img = host.querySelector(":scope > img.character-art") as HTMLImageElement | null;
  if (img) {
    if (img.getAttribute("src") !== url) img.src = url;
    if (alt && img.alt !== alt) img.alt = alt;
    return;
  }
  const next = document.createElement("img");
  next.className = "character-art";
  next.src = url;
  next.alt = alt;
  next.draggable = false;
  next.decoding = "async";
  next.setAttribute("draggable", "false");
  host.replaceChildren(next);
}

export async function injectWizardSvg(host: HTMLElement, url: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("pack_svg_missing");
  host.innerHTML = await res.text();
  const svg = host.querySelector("svg");
  if (svg) {
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
  }
}

/**
 * Swap the visible pack asset for the current wizard state.
 * Raster files use &lt;img&gt;; everything else uses the SVG inject path.
 * HIDDEN (asset null) keeps the last pose — opacity/visibility already hide the host.
 */
export async function applyCharacterVisual(
  host: HTMLElement,
  pack: CharacterPack,
  state: string,
): Promise<void> {
  const asset = resolveStateAsset(pack, state);
  if (asset == null) return;
  const url = characterAssetUrl(pack.baseUrl, asset);
  if (host.dataset.packId === pack.id && host.dataset.asset === url) return;
  host.dataset.packId = pack.id;
  host.dataset.asset = url;
  if (isRasterAsset(asset) || isRasterAsset(url)) {
    injectWizardRaster(host, url, pack.defaultDisplayName);
    return;
  }
  await injectWizardSvg(host, url);
}
