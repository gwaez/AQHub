/** External agent / Grok Bot bridge config. Never stores the webhook secret. */

export interface WizardBridgeConfig {
  enabled: boolean;
  url: string;
  /** Name of a locally stored secret — not the secret itself. */
  secretRef: string;
  agentId: string;
}

export const DEFAULT_BRIDGE_SECRET_REF = "wizard-bridge";

export function defaultBridge(): WizardBridgeConfig {
  return {
    enabled: false,
    url: "",
    secretRef: DEFAULT_BRIDGE_SECRET_REF,
    agentId: "",
  };
}

export function isSafeBridgeUrl(url: string): boolean {
  const raw = url.trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeBridge(raw: unknown): WizardBridgeConfig {
  const base = defaultBridge();
  if (!raw || typeof raw !== "object") return base;
  const rec = raw as Record<string, unknown>;
  let url = typeof rec.url === "string" ? rec.url.trim() : "";
  if (url && /^[a-z][a-z0-9+.-]*:/i.test(url) && !isSafeBridgeUrl(url)) url = "";
  const secretRef =
    typeof rec.secretRef === "string" && rec.secretRef.trim()
      ? rec.secretRef.trim().slice(0, 80)
      : base.secretRef;
  const agentId = typeof rec.agentId === "string" ? rec.agentId.trim().slice(0, 80) : "";
  return {
    enabled: rec.enabled === true,
    url: url.slice(0, 500),
    secretRef,
    agentId,
  };
}

/** Linked means the operator turned the bridge on and gave a usable webhook URL. */
export function isBridgeLinked(cfg: WizardBridgeConfig | undefined | null): boolean {
  if (!cfg || !cfg.enabled) return false;
  return isSafeBridgeUrl(cfg.url);
}
