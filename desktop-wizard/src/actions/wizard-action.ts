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
  | { type: "IDLE" };

export type WizardActionResult =
  | { ok: true; action: WizardAction; health?: { ok: boolean; aqhub: boolean; version: string } }
  | { ok: false; action: WizardAction; error: string };

export function isWizardActionType(value: string): value is WizardAction["type"] {
  return (
    value === "SHOW" ||
    value === "HIDE" ||
    value === "OPEN_AQHUB" ||
    value === "EXIT" ||
    value === "RENAME_DISPLAY" ||
    value === "SET_SCALE" ||
    value === "SET_POSITION" ||
    value === "PING_HEALTH" ||
    value === "LOAD_SETTINGS" ||
    value === "WATCH" ||
    value === "IDLE"
  );
}
