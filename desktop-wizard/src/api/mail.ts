import type { BoardTask } from "./tasks.ts";

export const MAIL_ADAPTER_PHASE = "p10";

export type MailBubbleAction = "open" | "task" | "remind" | "ignore" | "draft";

export interface MailItem {
  taskId: string;
  title: string;
  fromEmail: string;
  entryId: string;
  preview: string;
  sourceRef: string;
  suggestedReply: string;
  receivedAt: string;
}

export interface MailStatus {
  outlook: boolean;
  aqhub: boolean;
  reason: string;
  lastSyncAt: string;
  added?: number;
  unreadTotal?: number;
}

export interface MailSyncResult {
  ok: boolean;
  outlook: boolean;
  added: number;
  scanned: number;
  unreadTotal: number;
  items: MailItem[];
  error?: string;
}

export function taskToMailItem(task: BoardTask): MailItem | null {
  const source = String(task.source || "").toLowerCase();
  const entryId = String(task.entryId || task.entryID || "");
  const taskId = String(task.id || "");
  if (!taskId) return null;
  if (source !== "email" && !entryId) return null;
  const notes = String(task.notes || task.boxNote || "");
  return {
    taskId,
    title: String(task.title || "(no subject)"),
    fromEmail: String(task.fromEmail || ""),
    entryId,
    preview: notes.slice(0, 180),
    sourceRef: String(task.sourceRef || ""),
    suggestedReply: String(task.suggestedReply || ""),
    receivedAt: String(task.receivedAt || task.createdAt || task.updatedAt || ""),
  };
}

export function isIgnoredMail(item: MailItem, ignored: string[]): boolean {
  const set = new Set(ignored.map(String));
  return set.has(item.taskId) || (item.entryId !== "" && set.has(item.entryId));
}

/** Newest email-sourced board task that the user has not ignored. */
export function pickRecentMail(tasks: BoardTask[] | undefined, ignored: string[] = []): MailItem | null {
  const items = (Array.isArray(tasks) ? tasks : [])
    .map(taskToMailItem)
    .filter((m): m is MailItem => Boolean(m))
    .filter((m) => !isIgnoredMail(m, ignored));
  items.sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)));
  return items[0] || null;
}

export function mailAlertText(item: MailItem, lang: "ar" | "en" = "ar"): string {
  const from = item.fromEmail || item.sourceRef || (lang === "en" ? "mail" : "بريد");
  if (lang === "en") return `Mail: ${item.title} — ${from}`;
  return `بريد: ${item.title} — ${from}`;
}

export function mailUnavailableText(lang: "ar" | "en" = "ar"): string {
  if (lang === "en") return "Outlook is unavailable — AQHub mail APIs were not reached.";
  return "Outlook غير متصل — ما قدرت أوصل لطبقة البريد في AQHub.";
}
