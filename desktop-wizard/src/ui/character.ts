/** Character pack loader. Technical id stays on the pack; display name is user data. */

export interface CharacterPack {
  id: string;
  technicalId: string;
  defaultDisplayName: string;
  svgUrl: string;
  bubble: { dir: "rtl" | "ltr"; lang: string };
  anchors: { bubble: { x: number; y: number }; wand: { x: number; y: number } };
}

export async function loadCharacterPack(id = "old-wizard"): Promise<CharacterPack> {
  const base = `/characters/${id}`;
  const fallback: CharacterPack = {
    id,
    technicalId: "AQWizard",
    defaultDisplayName: "الساحر العتيق",
    svgUrl: `${base}/wizard.svg`,
    bubble: { dir: "rtl", lang: "ar" },
    anchors: { bubble: { x: 28, y: 36 }, wand: { x: 198, y: 74 } },
  };
  try {
    const res = await fetch(`${base}/manifest.json`);
    if (!res.ok) return fallback;
    const m = (await res.json()) as {
      id?: string;
      technicalId?: string;
      defaultDisplayName?: string;
      states?: { IDLE?: { asset?: string } };
      bubble?: { dir?: string; lang?: string };
      anchors?: { bubble?: { x: number; y: number }; wand?: { x: number; y: number } };
    };
    const asset = m.states?.IDLE?.asset || "wizard.svg";
    return {
      id: m.id || id,
      technicalId: m.technicalId || "AQWizard",
      defaultDisplayName: m.defaultDisplayName || fallback.defaultDisplayName,
      svgUrl: `${base}/${asset}`,
      bubble: {
        dir: m.bubble?.dir === "ltr" ? "ltr" : "rtl",
        lang: m.bubble?.lang || "ar",
      },
      anchors: {
        bubble: { x: m.anchors?.bubble?.x ?? 28, y: m.anchors?.bubble?.y ?? 36 },
        wand: { x: m.anchors?.wand?.x ?? 198, y: m.anchors?.wand?.y ?? 74 },
      },
    };
  } catch {
    return fallback;
  }
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
