import type { WizardSettings } from "../api/aqhub-client.ts";

export const FIRST_RUN_PHASE = "p12";

/**
 * Brand-new settings file (never persisted): show a one-shot welcome bubble.
 * Returning users (updatedAt already set) are not blocked and are not nagged.
 */
export function shouldShowFirstRun(settings: WizardSettings): boolean {
  if (settings.firstRunComplete) return false;
  if (String(settings.updatedAt || "").trim()) return false;
  return true;
}

/** Old settings files without the flag: mark complete quietly, keep name/size/corner/perms. */
export function shouldMarkFirstRunQuiet(settings: WizardSettings): boolean {
  if (settings.firstRunComplete) return false;
  return Boolean(String(settings.updatedAt || "").trim());
}

export function firstRunBubbleText(
  settings: WizardSettings,
  copy: { firstRunWelcome: string },
): string {
  const scale = Math.round((settings.window?.scale || 1) * 100);
  return copy.firstRunWelcome
    .replace("{name}", settings.displayName || "AQWizard")
    .replace("{scale}", String(scale))
    .replace("{corner}", settings.preferredCorner || "bottom-end");
}
