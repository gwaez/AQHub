import { parseAuditLog, type AuditLine, AUDIT_VIEW_LIMIT } from "./audit.ts";
import { mergeTaskIntoDoc, nextTaskId, newWizardTask, type BoardDoc, type BoardTask } from "./tasks.ts";
import {
  defaultPermissionMap,
  normalizePermissionMap,
  type PermissionMap,
} from "../ui/permissions.ts";
import type { MailItem, MailStatus, MailSyncResult } from "./mail.ts";
import { taskToMailItem } from "./mail.ts";

export const DEFAULT_AQHUB_URL = "http://127.0.0.1:8766";

export type AnimationLevel = "normal" | "reduced" | "off";
export type UiLanguage = "ar" | "en";
export type ProactiveLevel = "high" | "normal" | "low" | "off";
export type PreferredCorner = "bottom-end" | "bottom-start" | "top-end" | "top-start";
export type CloseAction = "hide" | "exit";

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
  language: UiLanguage;
  startMinimized: boolean;
  alwaysOnTop: boolean;
  opacity: number;
  followPointer: boolean;
  roamEnabled: boolean;
  preferredCorner: PreferredCorner;
  proactiveBubbles: ProactiveLevel;
  bubbleScale: number;
  bubbleFontSize: number;
  closeAction: CloseAction;
  permissions: PermissionMap;
  mailLastSyncAt: string;
  mailIgnored: string[];
  firstRunComplete: boolean;
}

export const DEFAULT_CHARACTER_ID = "secretary";
export const KNOWN_CHARACTER_IDS = ["secretary", "old-wizard"] as const;

export function normalizeCharacterId(id: unknown): string {
  if (id === "old-wizard" || id === "secretary") return id;
  return DEFAULT_CHARACTER_ID;
}

export function defaultSettings(displayName = "السكرتيرة"): WizardSettings {
  return {
    version: 1,
    characterId: DEFAULT_CHARACTER_ID,
    technicalId: "AQWizard",
    displayName,
    window: { x: null, y: null, scale: 1 },
    visible: true,
    animationLevel: "normal",
    idleSleepMs: 90_000,
    reminders: [],
    updatedAt: "",
    language: "ar",
    startMinimized: false,
    alwaysOnTop: true,
    opacity: 1,
    followPointer: true,
    roamEnabled: true,
    preferredCorner: "bottom-end",
    proactiveBubbles: "normal",
    bubbleScale: 1,
    bubbleFontSize: 13,
    closeAction: "hide",
    permissions: defaultPermissionMap(),
    mailLastSyncAt: "",
    mailIgnored: [],
    firstRunComplete: false,
  };
}

function clamp(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeSettings(raw: Partial<WizardSettings> | Record<string, unknown>): WizardSettings {
  const base = defaultSettings();
  const s = raw as Partial<WizardSettings>;
  const level = s.animationLevel;
  const anim: AnimationLevel = level === "reduced" || level === "off" || level === "normal" ? level : "normal";
  const reminders = Array.isArray(s.reminders) ? s.reminders : [];
  const lang: UiLanguage = s.language === "en" ? "en" : "ar";
  const proactive: ProactiveLevel =
    s.proactiveBubbles === "high" || s.proactiveBubbles === "low" || s.proactiveBubbles === "off"
      ? s.proactiveBubbles
      : "normal";
  const corner: PreferredCorner =
    s.preferredCorner === "bottom-start" || s.preferredCorner === "top-end" || s.preferredCorner === "top-start"
      ? s.preferredCorner
      : "bottom-end";
  const closeAction: CloseAction = s.closeAction === "exit" ? "exit" : "hide";
  const scale = clamp(Number(s.window?.scale ?? base.window.scale), 0.5, 3, 1);
  return {
    ...base,
    ...s,
    characterId: normalizeCharacterId(s.characterId ?? base.characterId),
    technicalId: base.technicalId,
    displayName: String(s.displayName || base.displayName),
    window: { ...base.window, ...(s.window || {}), scale },
    animationLevel: anim,
    idleSleepMs: clamp(Number(s.idleSleepMs ?? base.idleSleepMs), 5000, 600_000, base.idleSleepMs),
    reminders: reminders.map((r) => ({
      id: String(r.id || ""),
      text: String(r.text || ""),
      dueAt: String(r.dueAt || ""),
      fired: Boolean(r.fired),
    })),
    visible: s.visible !== false,
    language: lang,
    startMinimized: s.startMinimized === true,
    alwaysOnTop: s.alwaysOnTop !== false,
    opacity: clamp(Number(s.opacity ?? base.opacity), 0.35, 1, 1),
    followPointer: s.followPointer !== false,
    roamEnabled: s.roamEnabled !== false,
    preferredCorner: corner,
    proactiveBubbles: proactive,
    bubbleScale: clamp(Number(s.bubbleScale ?? base.bubbleScale), 0.7, 1.8, 1),
    bubbleFontSize: clamp(Number(s.bubbleFontSize ?? base.bubbleFontSize), 11, 22, 13),
    closeAction,
    permissions: normalizePermissionMap(s.permissions),
    mailLastSyncAt: String(s.mailLastSyncAt || ""),
    mailIgnored: Array.isArray(s.mailIgnored) ? s.mailIgnored.map(String).filter(Boolean).slice(0, 200) : [],
    firstRunComplete: s.firstRunComplete === true,
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
  getAudit(limit?: number): Promise<AuditLine[]>;
  getEisDoc(): Promise<import("./eisenhower.ts").EisDoc>;
  putEisDoc(doc: import("./eisenhower.ts").EisDoc): Promise<void>;
  getMailStatus(): Promise<MailStatus>;
  postMailSync(): Promise<MailSyncResult>;
  postOpen(body: { type?: string; url?: string; entryId?: string; query?: string }): Promise<{ ok: boolean; error?: string; method?: string }>;
  postTaskChat(taskId: string, text: string): Promise<{ ok: boolean; suggestedReply?: string; error?: string }>;
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
    async getAudit(limit = AUDIT_VIEW_LIMIT) {
      try {
        const res = await fetch(baseUrl + "/api/audit");
        const text = await res.text();
        return parseAuditLog(text, limit);
      } catch {
        return [];
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
    async getMailStatus() {
      try {
        const body = await json("/api/v1/wizard/mail/status");
        return {
          outlook: Boolean(body.outlook),
          aqhub: body.aqhub !== false,
          reason: String(body.reason || ""),
          lastSyncAt: String(body.lastSyncAt || ""),
          unreadTotal: typeof body.unreadTotal === "number" ? body.unreadTotal : undefined,
        };
      } catch {
        return { outlook: false, aqhub: false, reason: "unavailable", lastSyncAt: "" };
      }
    },
    async postMailSync() {
      try {
        const body = await json("/api/mail/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const rawItems = Array.isArray(body.items) ? body.items : [];
        const items: MailItem[] = [];
        for (const row of rawItems) {
          const mapped = taskToMailItem(row as BoardTask);
          if (mapped) items.push(mapped);
        }
        return {
          ok: body.ok !== false,
          outlook: body.outlook !== false && body.ok !== false,
          added: Number(body.added || items.length || 0),
          scanned: Number(body.scanned || 0),
          unreadTotal: Number(body.unreadTotal || 0),
          items,
          error: body.error ? String(body.error) : undefined,
        };
      } catch (err) {
        return {
          ok: false,
          outlook: false,
          added: 0,
          scanned: 0,
          unreadTotal: 0,
          items: [],
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    async postOpen(body) {
      try {
        const res = await json("/api/open", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return { ok: res.ok !== false, error: res.error ? String(res.error) : undefined, method: res.method ? String(res.method) : undefined };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    async postTaskChat(taskId, text) {
      try {
        const res = await json("/api/task/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, text }),
        });
        const task = (res.task || {}) as { suggestedReply?: string };
        return { ok: res.ok !== false, suggestedReply: task.suggestedReply ? String(task.suggestedReply) : undefined };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}

export async function createTaskViaHub(
  api: AqHubApi,
  title: string,
  notes = "",
  extra: Partial<BoardTask> = {},
): Promise<{ id: string; doc: BoardDoc }> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("title_required");
  const doc = await api.getTasksDoc();
  const tasks = Array.isArray(doc.tasks) ? doc.tasks : [];
  const id = nextTaskId(tasks);
  const task = { ...newWizardTask(id, trimmed, notes), ...extra, id };
  const next = mergeTaskIntoDoc(doc, task);
  await api.putTasksDoc(next);
  return { id, doc: next };
}

export { mergeTaskIntoDoc, nextTaskId, newWizardTask };
export type { BoardDoc };
export type { EisDoc, EisItem, EisQuad } from "./eisenhower.ts";
