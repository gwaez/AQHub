export const DEFAULT_AQHUB_URL = "http://127.0.0.1:8766";

export interface WizardHealth {
  ok: boolean;
  aqhub: boolean;
  version: string;
}

export interface WizardSettings {
  version: number;
  characterId: string;
  technicalId: string;
  displayName: string;
  window: { x: number | null; y: number | null; scale: number };
  visible: boolean;
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
    updatedAt: "",
  };
}

export interface AqHubApi {
  health(): Promise<WizardHealth>;
  getSettings(): Promise<WizardSettings>;
  putSettings(settings: WizardSettings): Promise<WizardSettings>;
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
      const s = (body.settings || body) as WizardSettings;
      return { ...defaultSettings(), ...s, window: { ...defaultSettings().window, ...(s.window || {}) } };
    },
    async putSettings(settings) {
      const body = await json("/api/v1/wizard/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const s = (body.settings || settings) as WizardSettings;
      return { ...settings, ...s };
    },
  };
}
