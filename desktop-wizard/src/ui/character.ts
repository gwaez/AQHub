/** Character pack loader. Technical id stays on the pack; display name is user data. */

export interface CharacterPack {
  id: string;
  technicalId: string;
  defaultDisplayName: string;
  idleAssetUrl: string;
  bubble: { dir: "rtl" | "ltr"; lang: string };
}

export async function loadCharacterPack(id = "old-wizard"): Promise<CharacterPack> {
  const base = `/characters/${id}`;
  const res = await fetch(`${base}/manifest.json`);
  if (!res.ok) {
    return {
      id,
      technicalId: "AQWizard",
      defaultDisplayName: "الساحر العتيق",
      idleAssetUrl: `${base}/idle.svg`,
      bubble: { dir: "rtl", lang: "ar" },
    };
  }
  const m = (await res.json()) as {
    id?: string;
    technicalId?: string;
    defaultDisplayName?: string;
    states?: { IDLE?: { asset?: string } };
    bubble?: { dir?: string; lang?: string };
  };
  const asset = m.states?.IDLE?.asset || "idle.svg";
  return {
    id: m.id || id,
    technicalId: m.technicalId || "AQWizard",
    defaultDisplayName: m.defaultDisplayName || "الساحر العتيق",
    idleAssetUrl: `${base}/${asset}`,
    bubble: {
      dir: m.bubble?.dir === "ltr" ? "ltr" : "rtl",
      lang: m.bubble?.lang || "ar",
    },
  };
}
