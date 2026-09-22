import { mergeTaskIntoDoc, nextTaskId, newWizardTask, type BoardDoc } from "./tasks.ts";

export const DEFAULT_AQHUB_URL = "http://127.0.0.1:8766";

export type AnimationLevel = "normal" | "reduced" | "off";

export interface WizardHealth {
  ok: boolean;
  aqhub: boolean;
  version: string;
}

export interface WizardReminder {
  id: string;
  text: string;
  dueAt: string;
  fired: boolean;
}

export interface WizardSettings {
  version: number;
  characterId: string;
  technicalId: string;
  displayName: string;
  window: { x: number | null; y: number | null; scale: number };
  visible: boolean;
  animationLevel: AnimationLevel;
  idleSleepMs: number;
  reminders: WizardReminder[];
  updatedAt: string;
}

export function defaultSettings(displayName = "الساحر العتيق"): WizardSettings {
  return {
    version: 1,
    characterId: "old-wizard",
    technicalId: "AQWizard",
    displayName,
    window: { x: null, y: null, scale: 1 },
    visible: true,
    animationLevel: "normal",
    idleSleepMs: 90_000,
    reminders: [],
    updatedAt: "",
  };
}

export function normalizeSettings(raw: Partial<WizardSettings> | Record<string, unknown>): WizardSettings {
  const base = defaultSettings();
  const s = raw as Partial<WizardSettings>;
  const level = s.animationLevel;
  const anim: AnimationLevel = level === "reduced" || level === "off" || level === "normal" ? level : "normal";
  const reminders = Array.isArray(s.reminders) ? s.reminders : [];
  return {
    ...base,
    ...s,
    characterId: base.characterId,
    technicalId: base.technicalId,
    displayName: String(s.displayName || base.displayName),
    window: { ...base.window, ...(s.window || {}) },
    animationLevel: anim,
    idleSleepMs: typeof s.idleSleepMs === "number" && s.idleSleepMs >= 5000 ? s.idleSleepMs : base.idleSleepMs,
    reminders: reminders.map((r) => ({
      id: String(r.id || ""),
      text: String(r.text || ""),
      dueAt: String(r.dueAt || ""),
      fired: Boolean(r.fired),
    })),
    visible: s.visible !== false,
  };
}

export interface AqHubApi {
  health(): Promise<WizardHealth>;
  getSettings(): Promise<WizardSettings>;
  putSettings(settings: WizardSettings): Promise<WizardSettings>;
  getTasksDoc(): Promise<BoardDoc>;
  putTasksDoc(doc: BoardDoc): Promise<void>;
  postBoxNote(taskId: string, note: string): Promise<void>;
  postAudit(entry: Record<string, unknown>): Promise<void>;
  getEisDoc(): Promise<import("./eisenhower.ts").EisDoc>;
  putEisDoc(doc: import("./eisenhower.ts").EisDoc): Promise<void>;
}

export function createAqHubClient(baseUrl = DEFAULT_AQHUB_URL): AqHubApi {
  const json = async (path: string, init?: RequestInit) => {
    const res = await fetch(baseUrl + path, init);
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }
    if (!res.ok) {
      const err = body as { error?: string; message?: string };
      throw new Error(err?.error || err?.message || `HTTP ${res.status}`);
    }
    return body as Record<string, unknown>;
  };

  return {
    async health() {
      const body = await json("/api/v1/wizard/health");
      return {
        ok: Boolean(body.ok),
        aqhub: Boolean(body.aqhub),
        version: String(body.version || ""),
      };
    },
    async getSettings() {
      const body = await json("/api/v1/wizard/settings");
      const s = (body.settings || body) as Partial<WizardSettings>;
      return normalizeSettings(s);
    },
    async putSettings(settings) {
      const body = await json("/api/v1/wizard/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const s = (body.settings || settings) as Partial<WizardSettings>;
      return normalizeSettings({ ...settings, ...s });
    },
    async getTasksDoc() {
      const body = await json("/api/tasks");
      const tasks = Array.isArray(body.tasks) ? body.tasks : [];
      return { ...body, tasks } as BoardDoc;
    },
    async putTasksDoc(doc) {
      await json("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
      });
    },
    async postBoxNote(taskId, note) {
      await json("/api/task/box-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, note }),
      });
    },
    async postAudit(entry) {
      try {
        await json("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
      } catch {
        /* audit is best-effort */
      }
    },
    async getEisDoc() {
      const body = await json("/api/eisenhower");
      const items = Array.isArray(body.items) ? body.items : [];
      return { ...body, items };
    },
    async putEisDoc(doc) {
      await json("/api/eisenhower", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: doc.items || [], updatedAt: doc.updatedAt || new Date().toISOString() }),
      });
    },
  };
}

export async function createTaskViaHub(
  api: AqHubApi,
  title: string,
  notes = "",
): Promise<{ id: string; doc: BoardDoc }> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("title_required");
  const doc = await api.getTasksDoc();
  const tasks = Array.isArray(doc.tasks) ? doc.tasks : [];
  const id = nextTaskId(tasks);
  const task = newWizardTask(id, trimmed, notes);
  const next = mergeTaskIntoDoc(doc, task);
  await api.putTasksDoc(next);
  return { id, doc: next };
}

export { mergeTaskIntoDoc, nextTaskId, newWizardTask };
export type { BoardDoc };
export type { EisDoc, EisItem, EisQuad } from "./eisenhower.ts";
