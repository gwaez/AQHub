/** Eisenhower document helpers. Wizard talks HTTP only — never eisenhower.json on disk. */

export type EisQuad = "inbox" | "do" | "sched" | "deleg" | "elim" | "doing" | "trash";

export type MoveFlavour = "DO" | "SCHEDULE" | "DELEGATE" | "ELIMINATE" | "TRASH" | "INBOX" | "DOING";

export type EisNoteMsg = {
  id?: string;
  text?: string;
  at?: string;
  from?: string;
};

export interface EisItem {
  id?: string;
  taskId?: string;
  title?: string;
  source?: string;
  quad?: string;
  done?: boolean;
  note?: string;
  noteTimeline?: EisNoteMsg[];
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

function isEisWrapper(it: EisItem & { value?: unknown }): boolean {
  if (it.id || it.taskId) return false;
  if (Array.isArray(it.value) || typeof it.value === "string") return true;
  return false;
}

/** Display title: never "undefined". Prefer item title, then task id, then Arabic fallback. */
export function itemTitle(it: EisItem | null | undefined): string {
  if (!it) return "بدون عنوان";
  const extra = it as EisItem & { subject?: unknown; taskTitle?: unknown };
  const raw = extra.title ?? extra.subject ?? extra.taskTitle;
  let s = raw == null ? "" : String(raw).trim();
  if (!s || s === "undefined" || s === "null") {
    s = extra.taskId ? String(extra.taskId).trim() : "";
  }
  if (!s || s === "undefined" || s === "null") return "بدون عنوان";
  return s;
}

/** CRM tasks stay out of Eisenhower inbox (source=crm, CRM Unit, md_units, …). */
export function isEisCrmSource(obj: EisItem | Record<string, unknown> | null | undefined): boolean {
  if (!obj) return false;
  const rec = obj as Record<string, unknown>;
  const src = String(rec.source ?? "").trim().toLowerCase();
  if (src === "crm") return true;
  if (String(rec.crmEntity ?? "").trim()) return true;
  if (String(rec.createdBy ?? "").trim() === "CRM Sync") return true;
  if (String(rec.crmId ?? "").trim()) return true;
  const sref = String(rec.sourceRef ?? "");
  if (/(md_units|md_unit|md_offers|md_approvaltransactions|aqr_legalcases|leads|opportunities|accounts)[:/]/i.test(sref)) {
    return true;
  }
  const tags = rec.tags;
  if (Array.isArray(tags) && tags.some((t) => String(t).trim().toLowerCase() === "crm")) return true;
  if (/crm\s*unit/i.test(String(rec.title ?? ""))) return true;
  return false;
}

export function rejectInboxCrm(items: EisItem[]): EisItem[] {
  return items.filter((it) => {
    const q = String(it.quad || "inbox").trim().toLowerCase();
    if ((!q || q === "inbox") && isEisCrmSource(it)) return false;
    return true;
  });
}

/**
 * Unwrap ConvertTo-Json corruption:
 * {items:{value:[...]}}, {items:[{value:[...]}]}, or value as whitespace string.
 */
export function normalizeEisItems(raw: unknown): EisItem[] {
  if (raw == null) return [];
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith("[") || t.startsWith("{")) {
      try {
        return normalizeEisItems(JSON.parse(t) as unknown);
      } catch {
        return [];
      }
    }
    return [];
  }
  if (Array.isArray(raw)) {
    if (
      raw.length === 1 &&
      raw[0] &&
      typeof raw[0] === "object" &&
      !Array.isArray(raw[0]) &&
      !(raw[0] as EisItem).id &&
      "value" in (raw[0] as object)
    ) {
      return normalizeEisItems((raw[0] as { value: unknown }).value);
    }
    const out: EisItem[] = [];
    for (const it of raw) {
      if (!it || typeof it !== "object") continue;
      const rec = it as EisItem & { value?: unknown };
      if (isEisWrapper(rec) && "value" in rec) {
        out.push(...normalizeEisItems(rec.value));
        continue;
      }
      if (rec.id || rec.taskId) out.push(rec);
    }
    return out;
  }
  if (typeof raw === "object") {
    const rec = raw as EisItem & { value?: unknown };
    if (!rec.id && "value" in rec) return normalizeEisItems(rec.value);
    if (rec.id || rec.taskId) return [rec];
  }
  return [];
}

export function normalizeEisDoc(doc: EisDoc | null | undefined): EisDoc {
  return { ...(doc || {}), items: normalizeEisItems(doc?.items) };
}

export function moveEisItem(doc: EisDoc, id: string, quad: EisQuad): {
  next: EisDoc;
  prevQuad: EisQuad;
  item: EisItem;
} {
  const trimmed = id.trim();
  if (!trimmed) throw new Error("id_required");
  if (!isEisQuad(quad)) throw new Error("bad_quad");
  const items = normalizeEisItems(doc.items).map((i) => ({ ...i }));
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

export function normalizeNoteTimeline(raw: unknown): EisNoteMsg[] {
  if (raw == null) return [];
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith("[") || t.startsWith("{")) {
      try {
        return normalizeNoteTimeline(JSON.parse(t) as unknown);
      } catch {
        return [{ text: t, from: "user" }];
      }
    }
    return [{ text: t, from: "user" }];
  }
  if (Array.isArray(raw)) {
    if (
      raw.length === 1 &&
      raw[0] &&
      typeof raw[0] === "object" &&
      !Array.isArray(raw[0]) &&
      !("text" in (raw[0] as object)) &&
      "value" in (raw[0] as object)
    ) {
      return normalizeNoteTimeline((raw[0] as { value: unknown }).value);
    }
    const out: EisNoteMsg[] = [];
    for (const m of raw) {
      if (!m) continue;
      if (typeof m === "string") {
        const t = m.trim();
        if (t) out.push({ text: t, from: "user" });
        continue;
      }
      if (typeof m !== "object") continue;
      const rec = m as EisNoteMsg & { value?: unknown; body?: string; note?: string; actor?: string };
      if (!rec.text && "value" in rec) {
        out.push(...normalizeNoteTimeline(rec.value));
        continue;
      }
      const text = String(rec.text || rec.body || rec.note || "").trim();
      if (!text) continue;
      out.push({
        id: rec.id,
        text,
        at: rec.at,
        from: rec.from || rec.actor || "user",
      });
    }
    return out;
  }
  if (typeof raw === "object" && raw && "value" in (raw as object)) {
    return normalizeNoteTimeline((raw as { value: unknown }).value);
  }
  return [];
}

export function latestNoteText(it: EisItem | null | undefined): string {
  if (!it) return "";
  const tl = normalizeNoteTimeline(it.noteTimeline);
  for (let i = tl.length - 1; i >= 0; i--) {
    const t = String(tl[i].text || "").trim();
    if (t) return t;
  }
  return String(it.note || "").trim();
}
