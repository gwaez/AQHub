/** Safe character pack ids + standard PNG pose slots used by secretary-style packs. */

export const DEFAULT_CHARACTER_ID = "secretary";
export const BUILTIN_CHARACTER_IDS = ["secretary", "old-wizard"] as const;
export const KNOWN_CHARACTER_IDS = BUILTIN_CHARACTER_IDS;
export const CHARACTER_ID_RE = /^[a-z][a-z0-9-]{0,47}$/;
export const BLOCKED_CHARACTER_IDS = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "lpt1",
]);

export type BuiltinCharacterId = (typeof BUILTIN_CHARACTER_IDS)[number];

export interface CharacterPoseSlot {
  id: string;
  file: string;
  state: string;
  labelAr: string;
  labelEn: string;
  hintAr: string;
  required: boolean;
}

/** Named PNG slots for a simple character pack (transparent preferred). */
export const CHARACTER_POSE_SLOTS: readonly CharacterPoseSlot[] = [
  {
    id: "idle",
    file: "idle.png",
    state: "IDLE",
    labelAr: "وقوف هادئ",
    labelEn: "Standing calm",
    hintAr: "الوضع الافتراضي على المكتب",
    required: true,
  },
  {
    id: "watch",
    file: "watch.png",
    state: "WATCHING",
    labelAr: "مراقبة",
    labelEn: "Watch",
    hintAr: "لما يتابع المؤشر أو الشغل",
    required: false,
  },
  {
    id: "think",
    file: "think.png",
    state: "THINKING",
    labelAr: "تفكير",
    labelEn: "Think",
    hintAr: "وضع التفكير",
    required: true,
  },
  {
    id: "speak",
    file: "speak.png",
    state: "SPEAKING",
    labelAr: "كلام",
    labelEn: "Speak",
    hintAr: "الفقاعة / التنبيه",
    required: false,
  },
  {
    id: "work",
    file: "work.png",
    state: "WORKING",
    labelAr: "يعمل",
    labelEn: "Work",
    hintAr: "شغل جاري",
    required: false,
  },
  {
    id: "success",
    file: "success.png",
    state: "SUCCESS",
    labelAr: "نجاح",
    labelEn: "Success",
    hintAr: "تم بنجاح",
    required: false,
  },
  {
    id: "error",
    file: "error.png",
    state: "ERROR",
    labelAr: "خطأ",
    labelEn: "Error",
    hintAr: "تعذّر الإجراء",
    required: false,
  },
  {
    id: "drag",
    file: "drag.png",
    state: "DRAGGING",
    labelAr: "سحب",
    labelEn: "Drag",
    hintAr: "أثناء نقل النافذة",
    required: false,
  },
  {
    id: "sleep",
    file: "sleep.png",
    state: "SLEEPING",
    labelAr: "نوم",
    labelEn: "Sleep",
    hintAr: "خمول طويل",
    required: true,
  },
];

export function isBuiltinCharacterId(id: unknown): id is BuiltinCharacterId {
  return id === "secretary" || id === "old-wizard";
}

export function isSafeCharacterId(id: unknown): boolean {
  if (typeof id !== "string") return false;
  if (!CHARACTER_ID_RE.test(id)) return false;
  if (id.includes("..") || id.includes("/") || id.includes("\\")) return false;
  if (BLOCKED_CHARACTER_IDS.has(id)) return false;
  return true;
}

export function normalizeCharacterId(id: unknown): string {
  return isSafeCharacterId(id) ? String(id) : DEFAULT_CHARACTER_ID;
}

export function slugifyCharacterName(name: unknown): string {
  const raw = String(name || "").trim();
  let slug = raw
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) {
    let hash = 0;
    for (let i = 0; i < raw.length; i++) hash = (hash * 33 + raw.charCodeAt(i)) >>> 0;
    slug = `char-${hash.toString(16).padStart(8, "0")}`;
  }
  if (slug.length > 48) slug = slug.slice(0, 48).replace(/-+$/g, "");
  if (!/^[a-z]/.test(slug)) slug = `c-${slug}`.slice(0, 48);
  return isSafeCharacterId(slug) ? slug : DEFAULT_CHARACTER_ID;
}

export function poseFileForState(statesPresent: Iterable<string>, state: string): string {
  const have = new Set(statesPresent);
  const direct = CHARACTER_POSE_SLOTS.find((s) => s.state === state);
  if (direct && have.has(direct.id)) return direct.file;
  if (state === "ALERT") return have.has("speak") ? "speak.png" : "idle.png";
  if (state === "WAND" || state === "NOTE" || state === "MATRIX" || state === "TRASH") {
    return have.has("work") ? "work.png" : "idle.png";
  }
  return "idle.png";
}
