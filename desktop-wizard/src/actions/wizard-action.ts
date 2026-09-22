export type WizardAction =
  | { type: "SHOW" }
  | { type: "HIDE" }
  | { type: "OPEN_AQHUB" }
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
  | { type: "CREATE_TASK"; title: string; notes?: string }
  | { type: "CREATE_NOTE"; note: string; taskId?: string }
  | { type: "SET_REMINDER"; text: string; dueAt: string }
  | { type: "ENTER_STUB"; state: "WAND" | "NOTE" | "MATRIX" | "TRASH" }
  | { type: "APPROVE_SEND"; taskId: string };

export type BubbleKind = "speech" | "thought" | "alert";

export type WizardActionResult =
  | {
      ok: true;
      action: WizardAction;
      health?: { ok: boolean; aqhub: boolean; version: string };
      taskId?: string;
      bubble?: { kind: BubbleKind; text: string };
    }
  | { ok: false; action: WizardAction; error: string; bubble?: { kind: BubbleKind; text: string } };

const TYPES: WizardAction["type"][] = [
  "SHOW",
  "HIDE",
  "OPEN_AQHUB",
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
  "CREATE_TASK",
  "CREATE_NOTE",
  "SET_REMINDER",
  "ENTER_STUB",
  "APPROVE_SEND",
];

export function isWizardActionType(value: string): value is WizardAction["type"] {
  return (TYPES as string[]).includes(value);
}
