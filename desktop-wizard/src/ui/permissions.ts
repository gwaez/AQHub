import type { WizardAction } from "../actions/wizard-action.ts";

/** Local companion permissions. Never stores CRM tokens. No auto-send. */
export const PERMISSIONS_PHASE = "p4-stub";

const DENY: WizardAction["type"][] = ["APPROVE_SEND"];

export function allowAction(type: WizardAction["type"]): boolean {
  return !DENY.includes(type);
}
