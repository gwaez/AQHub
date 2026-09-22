/** Eisenhower document helpers. Wizard talks HTTP only — never eisenhower.json on disk. */

export type EisQuad = "inbox" | "do" | "sched" | "deleg" | "elim" | "doing" | "trash";

export type MoveFlavour = "DO" | "SCHEDULE" | "DELEGATE" | "ELIMINATE" | "TRASH" | "INBOX" | "DOING";

export interface EisItem {
  id?: string;
  taskId?: string;
  title?: string;
  source?: string;
  quad?: string;
  done?: boolean;
  note?: string;
  updatedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface EisDoc {
  items?: EisItem[];
  updatedAt?: string;
  [key: string]: unknown;
}

export const MATRIX_QUADS: EisQuad[] = ["do", "sched", "deleg", "elim"];

export const QUAD_META: Record<
  EisQuad,
  { ar: string; axis: string; flavour: MoveFlavour; verb: string }
> = {
  inbox: { ar: "وارد", axis: "Inbox", flavour: "INBOX", verb: "رجع للوارد" },
  do: { ar: "عاجل ومهم", axis: "Urgent + Important", flavour: "DO", verb: "افعل الآن" },
  sched: { ar: "مهم غير عاجل", axis: "Important + NotUrgent", flavour: "SCHEDULE", verb: "جدولة" },
  deleg: { ar: "عاجل غير مهم", axis: "Urgent + NotImportant", flavour: "DELEGATE", verb: "تفويض" },
  elim: { ar: "لا هذا ولا ذاك", axis: "Neither", flavour: "ELIMINATE", verb: "تجاهل" },
  doing: { ar: "قيد التنفيذ", axis: "Doing", flavour: "DOING", verb: "قيد التنفيذ" },
  trash: { ar: "تراش", axis: "Trash", flavour: "TRASH", verb: "تراش" },
};

const QUADS: EisQuad[] = ["inbox", "do", "sched", "deleg", "elim", "doing", "trash"];

export function isEisQuad(value: string): value is EisQuad {
  return (QUADS as string[]).includes(value);
}

export function flavourForQuad(quad: string): MoveFlavour {
  return isEisQuad(quad) ? QUAD_META[quad].flavour : "DO";
}

export function flavourBubble(quad: string, title = ""): string {
  const meta = isEisQuad(quad) ? QUAD_META[quad] : QUAD_META.do;
  const short = title.trim().slice(0, 40);
  if (quad === "trash") return short ? `اتنقل للتراش: ${short}` : "اتنقل للتراش";
  return short ? `${meta.verb}: ${short}` : meta.verb;
}

export function moveEisItem(doc: EisDoc, id: string, quad: EisQuad): {
  next: EisDoc;
  prevQuad: EisQuad;
  item: EisItem;
} {
  const trimmed = id.trim();
  if (!trimmed) throw new Error("id_required");
  if (!isEisQuad(quad)) throw new Error("bad_quad");
  const items = Array.isArray(doc.items) ? doc.items.map((i) => ({ ...i })) : [];
  const idx = items.findIndex((i) => String(i.id || "") === trimmed);
  if (idx < 0) throw new Error("item_not_found");
  const prevRaw = String(items[idx].quad || "inbox");
  const prevQuad: EisQuad = isEisQuad(prevRaw) ? prevRaw : "inbox";
  const now = new Date().toISOString();
  items[idx] = { ...items[idx], quad, updatedAt: now };
  return {
    next: {
      ...doc,
      items,
      updatedAt: now,
    },
    prevQuad,
    item: items[idx],
  };
}
