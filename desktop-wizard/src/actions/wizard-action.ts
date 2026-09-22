import type { WizardSettings } from "../api/aqhub-client.ts";
import type { PermissionMode } from "../ui/permissions.ts";

export type WizardAction =
  | { type: "SHOW" }
  | { type: "HIDE" }
  | { type: "OPEN_AQHUB" }
  | { type: "OPEN_EISENHOWER" }
  | { type: "EXIT" }
  | { type: "RENAME_DISPLAY"; displayName: string }
  | { type: "SET_SCALE"; scale: number }
  | { type: "SET_POSITION"; x: number; y: number }
  | { type: "PING_HEALTH" }
  | { type: "LOAD_SETTINGS" }
  | { type: "WATCH" }
  | { type: "IDLE" }
  | { type: "SLEEP" }
  | { type: "THINK" }
  | { type: "SPEAK"; text?: string }
  | { type: "ALERT"; text: string }
  | { type: "DRAG_START" }
  | { type: "DRAG_END" }
  | { type: "SET_ANIMATION_LEVEL"; level: "normal" | "reduced" | "off" }
  | { type: "SET_SLEEP_MS"; ms: number }
  | { type: "PATCH_SETTINGS"; patch: Partial<WizardSettings> }
  | { type: "SET_PERMISSION"; capabilityId: string; mode: PermissionMode }
  | { type: "CREATE_TASK"; title: string; notes?: string }
  | { type: "CREATE_NOTE"; note: string; taskId?: string }
  | { type: "SET_REMINDER"; text: string; dueAt: string }
  | { type: "OPEN_MATRIX" }
  | { type: "CLOSE_MATRIX" }
  | { type: "MOVE_EIS_ITEM"; id: string; quad: import("../api/eisenhower.ts").EisQuad }
  | { type: "TRASH_EIS_ITEM"; id: string }
  | { type: "UNDO_TRASH"; id: string; prevQuad: import("../api/eisenhower.ts").EisQuad }
  | { type: "ENTER_STUB"; state: "WAND" | "NOTE" }
  | { type: "APPROVE_SEND"; taskId: string }
  | { type: "DELETE_EXTERNAL"; target?: string }
  | { type: "MAIL_POLL"; prompt?: boolean }
  | { type: "MAIL_SYNC" }
  | { type: "MAIL_OPEN"; taskId?: string; entryId?: string; query?: string }
  | { type: "MAIL_CREATE_TASK"; title: string; notes?: string; taskId?: string; entryId?: string; fromEmail?: string }
  | { type: "MAIL_REMIND"; text: string; dueAt?: string; taskId?: string }
  | { type: "MAIL_IGNORE"; taskId?: string; entryId?: string }
  | { type: "MAIL_DRAFT"; taskId: string }
  | { type: "CONFIRM"; pending: WizardAction }
  | { type: "DENY"; pending: WizardAction };

export type BubbleKind = "speech" | "thought" | "alert";

export type WizardActionResult =
  | {
      ok: true;
      action: WizardAction;
      health?: { ok: boolean; aqhub: boolean; version: string };
      taskId?: string;
      bubble?: { kind: BubbleKind; text: string };
      eisDoc?: import("../api/eisenhower.ts").EisDoc;
      flavour?: string;
      undo?: { id: string; prevQuad: string };
      returnTo?: "MATRIX" | "IDLE";
      mail?: import("../api/mail.ts").MailItem;
      mailStatus?: import("../api/mail.ts").MailStatus;
      bubbleActions?: import("../api/mail.ts").MailBubbleAction[];
    }
  | {
      ok: false;
      action: WizardAction;
      error: string;
      bubble?: { kind: BubbleKind; text: string };
      needsConfirm?: boolean;
      mailStatus?: import("../api/mail.ts").MailStatus;
    };

const TYPES: WizardAction["type"][] = [
  "SHOW",
  "HIDE",
  "OPEN_AQHUB",
  "OPEN_EISENHOWER",
  "EXIT",
  "RENAME_DISPLAY",
  "SET_SCALE",
  "SET_POSITION",
  "PING_HEALTH",
  "LOAD_SETTINGS",
  "WATCH",
  "IDLE",
  "SLEEP",
  "THINK",
  "SPEAK",
  "ALERT",
  "DRAG_START",
  "DRAG_END",
  "SET_ANIMATION_LEVEL",
  "SET_SLEEP_MS",
  "PATCH_SETTINGS",
  "SET_PERMISSION",
  "CREATE_TASK",
  "CREATE_NOTE",
  "SET_REMINDER",
  "OPEN_MATRIX",
  "CLOSE_MATRIX",
  "MOVE_EIS_ITEM",
  "TRASH_EIS_ITEM",
  "UNDO_TRASH",
  "ENTER_STUB",
  "APPROVE_SEND",
  "DELETE_EXTERNAL",
  "MAIL_POLL",
  "MAIL_SYNC",
  "MAIL_OPEN",
  "MAIL_CREATE_TASK",
  "MAIL_REMIND",
  "MAIL_IGNORE",
  "MAIL_DRAFT",
  "CONFIRM",
  "DENY",
];

export function isWizardActionType(value: string): value is WizardAction["type"] {
  return (TYPES as string[]).includes(value);
}
