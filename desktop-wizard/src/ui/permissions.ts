import type { WizardAction } from "../actions/wizard-action.ts";

/** Local companion permissions. Never stores CRM tokens. No auto-send. */
export const PERMISSIONS_PHASE = "p10";

export type PermissionMode = "allow" | "ask" | "never";

export type CapabilityId =
  | "character.window"
  | "aqhub.open"
  | "settings.local"
  | "board.create_task"
  | "board.create_note"
  | "board.reminder"
  | "eisenhower.move"
  | "eisenhower.trash"
  | "outlook.read"
  | "outlook.draft"
  | "outlook.send"
  | "delete.external"
  | "uia.magic_wand"
  | "crm.tokens";

export interface Capability {
  id: CapabilityId;
  labelAr: string;
  labelEn: string;
  hintAr: string;
  hintEn: string;
  defaultMode: PermissionMode;
  modes: PermissionMode[];
  actions: WizardAction["type"][];
  implemented: boolean;
  /** Outlook Send / Delete External: Allow is invalid (confirm or deny only). */
  alwaysConfirmOrDeny?: boolean;
}

export const CAPABILITIES: Capability[] = [
  {
    id: "character.window",
    labelAr: "نافذة الشخصية",
    labelEn: "Character window",
    hintAr: "إظهار وإخفاء رفيق سطح المكتب.",
    hintEn: "Show and hide the desktop companion.",
    defaultMode: "allow",
    modes: ["allow", "ask", "never"],
    actions: ["SHOW", "HIDE", "LOAD_SETTINGS"],
    implemented: true,
  },
  {
    id: "aqhub.open",
    labelAr: "فتح AQHub",
    labelEn: "Open AQHub",
    hintAr: "فتح اللوحة المحلية في المتصفح.",
    hintEn: "Open the local board in the browser.",
    defaultMode: "allow",
    modes: ["allow", "ask", "never"],
    actions: ["OPEN_AQHUB"],
    implemented: true,
  },
  {
    id: "settings.local",
    labelAr: "إعدادات محلية",
    labelEn: "Local settings",
    hintAr: "اسم العرض والحجم والحركة — لا تُقفل حتى لا تُحبس عن الإعدادات.",
    hintEn: "Display name, scale, motion — stays Allow so you cannot lock yourself out.",
    defaultMode: "allow",
    modes: ["allow"],
    actions: [
      "RENAME_DISPLAY",
      "SET_SCALE",
      "SET_POSITION",
      "SET_ANIMATION_LEVEL",
      "SET_SLEEP_MS",
      "PATCH_SETTINGS",
      "SET_PERMISSION",
    ],
    implemented: true,
  },
  {
    id: "board.create_task",
    labelAr: "إنشاء تاسك",
    labelEn: "Create task",
    hintAr: "GET ثم POST /api/tasks — بدون كتابة tasks.json.",
    hintEn: "GET then POST /api/tasks — never writes tasks.json.",
    defaultMode: "allow",
    modes: ["allow", "ask", "never"],
    actions: ["CREATE_TASK", "MAIL_CREATE_TASK"],
    implemented: true,
  },
  {
    id: "board.create_note",
    labelAr: "إنشاء ملاحظة",
    labelEn: "Create note",
    hintAr: "ملاحظة الصندوق عبر HTTP.",
    hintEn: "Box note via HTTP.",
    defaultMode: "allow",
    modes: ["allow", "ask", "never"],
    actions: ["CREATE_NOTE"],
    implemented: true,
  },
  {
    id: "board.reminder",
    labelAr: "تذكير محلي",
    labelEn: "Local reminder",
    hintAr: "يُحفظ في wizard-settings.json فقط.",
    hintEn: "Stored only in wizard-settings.json.",
    defaultMode: "allow",
    modes: ["allow", "ask", "never"],
    actions: ["SET_REMINDER", "MAIL_REMIND"],
    implemented: true,
  },
  {
    id: "eisenhower.move",
    labelAr: "نقل أيزنهاور",
    labelEn: "Eisenhower move",
    hintAr: "نقل بند بين الأرباع عبر GET-merge-POST.",
    hintEn: "Move an item between quadrants via GET-merge-POST.",
    defaultMode: "allow",
    modes: ["allow", "ask", "never"],
    actions: ["OPEN_MATRIX", "CLOSE_MATRIX", "MOVE_EIS_ITEM", "UNDO_TRASH"],
    implemented: true,
  },
  {
    id: "eisenhower.trash",
    labelAr: "تراش أيزنهاور",
    labelEn: "Eisenhower trash",
    hintAr: "حذف ناعم (quad=trash) مع تراجع — افتراضي اسأل.",
    hintEn: "Soft-delete (quad=trash) with undo — default Ask.",
    defaultMode: "ask",
    modes: ["allow", "ask", "never"],
    actions: ["TRASH_EIS_ITEM"],
    implemented: true,
  },
  {
    id: "outlook.read",
    labelAr: "قراءة Outlook",
    labelEn: "Outlook Read",
    hintAr: "مزامنة/عرض بريد عبر AQHub (GET tasks أو POST /api/mail/sync). افتراضي اسأل.",
    hintEn: "Sync/show mail via AQHub (GET tasks or POST /api/mail/sync). Default Ask.",
    defaultMode: "ask",
    modes: ["allow", "ask", "never"],
    actions: ["MAIL_POLL", "MAIL_SYNC", "MAIL_OPEN", "MAIL_IGNORE"],
    implemented: true,
  },
  {
    id: "outlook.draft",
    labelAr: "مسودة Outlook",
    labelEn: "Outlook Draft",
    hintAr: "يحضّر suggestedReply عبر /api/task/chat — بدون إرسال.",
    hintEn: "Prepares suggestedReply via /api/task/chat — never sends.",
    defaultMode: "ask",
    modes: ["allow", "ask", "never"],
    actions: ["MAIL_DRAFT"],
    implemented: true,
  },
  {
    id: "outlook.send",
    labelAr: "إرسال Outlook",
    labelEn: "Outlook Send",
    hintAr: "دائمًا تأكيد أو رفض. الساحر لا يستدعي approve-send.",
    hintEn: "Always confirm or deny. Wizard never calls approve-send.",
    defaultMode: "never",
    modes: ["ask", "never"],
    actions: ["APPROVE_SEND"],
    implemented: true,
    alwaysConfirmOrDeny: true,
  },
  {
    id: "delete.external",
    labelAr: "حذف خارجي",
    labelEn: "Delete external",
    hintAr: "مسح نهائي / حذف خارج اللوحة — دائمًا تأكيد أو رفض.",
    hintEn: "Purge / delete outside the board — always confirm or deny.",
    defaultMode: "never",
    modes: ["ask", "never"],
    actions: ["DELETE_EXTERNAL"],
    implemented: true,
    alwaysConfirmOrDeny: true,
  },
  {
    id: "uia.magic_wand",
    labelAr: "العصا السحرية / UIA",
    labelEn: "Magic Wand / UIA",
    hintAr: "موقوف حتى يتوفر سطح مكتب ويندوز.",
    hintEn: "Blocked until a Windows desktop is available.",
    defaultMode: "never",
    modes: ["never"],
    actions: [],
    implemented: false,
  },
  {
    id: "crm.tokens",
    labelAr: "توكنات CRM",
    labelEn: "CRM tokens",
    hintAr: "ممنوع من الساحر — التوكن يبقى في AQHub فقط.",
    hintEn: "Forbidden from the wizard — tokens stay in AQHub.",
    defaultMode: "never",
    modes: ["never"],
    actions: [],
    implemented: false,
  },
];

export type PermissionMap = Record<CapabilityId, PermissionMode>;

export function defaultPermissionMap(): PermissionMap {
  const out = {} as PermissionMap;
  for (const cap of CAPABILITIES) out[cap.id] = cap.defaultMode;
  return out;
}

export function isCapabilityId(value: string): value is CapabilityId {
  return CAPABILITIES.some((c) => c.id === value);
}

export function isPermissionMode(value: string): value is PermissionMode {
  return value === "allow" || value === "ask" || value === "never";
}

export function capabilityById(id: string): Capability | undefined {
  return CAPABILITIES.find((c) => c.id === id);
}

export function capabilityForAction(type: WizardAction["type"]): Capability | undefined {
  return CAPABILITIES.find((c) => c.actions.includes(type));
}

export function coerceMode(cap: Capability, mode: PermissionMode): PermissionMode {
  if (cap.alwaysConfirmOrDeny && mode === "allow") return "ask";
  if (!cap.modes.includes(mode)) return cap.defaultMode;
  return mode;
}

export function normalizePermissionMap(raw: unknown): PermissionMap {
  const out = defaultPermissionMap();
  if (!raw || typeof raw !== "object") return out;
  const rec = raw as Record<string, unknown>;
  for (const cap of CAPABILITIES) {
    const v = rec[cap.id];
    if (typeof v === "string" && isPermissionMode(v)) {
      out[cap.id] = coerceMode(cap, v);
    }
  }
  return out;
}

export type PermissionDecision = "allow" | "ask" | "never";

export function decidePermission(
  type: WizardAction["type"],
  permissions: PermissionMap | Record<string, PermissionMode> | undefined,
  confirmed = false,
): PermissionDecision {
  const cap = capabilityForAction(type);
  if (!cap) return "allow";
  const map = normalizePermissionMap(permissions);
  let mode = coerceMode(cap, map[cap.id]);
  if (cap.alwaysConfirmOrDeny && mode === "allow") mode = "ask";
  if (mode === "never") return "never";
  if (mode === "ask" && !confirmed) return "ask";
  return "allow";
}

/** @deprecated P4 boolean stub — prefer decidePermission. */
export function allowAction(
  type: WizardAction["type"],
  permissions?: PermissionMap,
  confirmed = false,
): boolean {
  return decidePermission(type, permissions, confirmed) === "allow";
}

export function confirmLabel(action: WizardAction, lang: "ar" | "en" = "ar"): string {
  const cap = capabilityForAction(action.type);
  const name = cap ? (lang === "en" ? cap.labelEn : cap.labelAr) : action.type;
  if (lang === "en") return `Confirm: ${name}?`;
  return `تأكيد: ${name}؟`;
}
