import type { WizardAction } from "../actions/wizard-action.ts";

export type ExecuteRoute =
  | { kind: "action"; action: WizardAction }
  | { kind: "open_settings" }
  | { kind: "blocked"; reason: "send" | "crm" }
  | { kind: "unknown"; hintAr: string; hintEn: string };

const HINT_AR =
  "أوامر نفّذ: إظهار، إخفاء، إعدادات، أيزنهاور، فتح AQHub، تاسك: العنوان";
const HINT_EN =
  "Execute commands: show, hide, settings, Eisenhower, open AQHub, task: title";

function fold(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[؟?!.،,]/g, " ")
    .replace(/\s+/g, " ");
}

function isSendEmail(n: string): boolean {
  return (
    /\bapprove-send\b/.test(n) ||
    /\bauto-send\b/.test(n) ||
    /ارسل البريد/.test(n) ||
    /ارسال بريد/.test(n) ||
    /ارسل ايميل/.test(n) ||
    /\bsend (the )?email\b/.test(n) ||
    /\bsend mail\b/.test(n)
  );
}

function isCrm(n: string): boolean {
  return /\bcrm\b/.test(n) || /توكن/.test(n) || /\b(access|refresh)?tokens?\b/.test(n);
}

function taskTitle(n: string, original: string): string | null {
  const labeled = original.match(/^(?:تاسك|مهمة|مهمه|task)\s*[:：]\s*(.+)$/i);
  if (labeled) return labeled[1].trim();
  const create = original.match(/^(?:انشئ|أنشئ|أنشئى|create)\s+(?:تاسك|مهمة|مهمه|task)\s+(.+)$/i);
  if (create) return create[1].trim();
  const slash = original.match(/^\/task\s+(.+)$/i);
  if (slash) return slash[1].trim();
  const folded = n.match(/^(?:تاسك|مهمه|task)\s+(.+)$/);
  if (folded) return folded[1].trim();
  return null;
}

/**
 * Map a free-form execute utterance onto a small safe command set.
 * CRM tokens and auto-send are never routed to the action engine.
 */
export function routeExecute(text: string): ExecuteRoute {
  const original = text.trim();
  if (!original) {
    return { kind: "unknown", hintAr: HINT_AR, hintEn: HINT_EN };
  }
  const n = fold(original);

  if (isSendEmail(n) || /\bapprove send\b/.test(n)) {
    return { kind: "blocked", reason: "send" };
  }
  if (isCrm(n)) {
    return { kind: "blocked", reason: "crm" };
  }

  if (
    /^(اظهار|اظهر|ظهر|show)( الشخصيه| الساحر| wizard)?$/.test(n) ||
    n === "show the wizard"
  ) {
    return { kind: "action", action: { type: "SHOW" } };
  }
  if (
    /^(اخفاء|اخف|hide)( للصينيه| للصينية| الشخصيه| الساحر| wizard| to tray)?$/.test(n) ||
    n === "hide the wizard"
  ) {
    return { kind: "action", action: { type: "HIDE" } };
  }
  if (
    /(ايزنهاور|eisenhower|\/matrix|\bmatrix\b|المصفوفه)/.test(n)
  ) {
    return { kind: "action", action: { type: "OPEN_EISENHOWER" } };
  }
  if (/فتح aqhub|open aqhub|افتح aqhub/.test(n)) {
    return { kind: "action", action: { type: "OPEN_AQHUB" } };
  }
  if (/(اعدادات|settings)/.test(n) && !/(صلاح|permission)/.test(n)) {
    return { kind: "open_settings" };
  }

  const title = taskTitle(n, original);
  if (title) {
    return { kind: "action", action: { type: "CREATE_TASK", title } };
  }

  return { kind: "unknown", hintAr: HINT_AR, hintEn: HINT_EN };
}
