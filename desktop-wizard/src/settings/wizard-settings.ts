import { createAqHubClient, defaultSettings, normalizeSettings, type AqHubApi, type WizardSettings } from "../api/aqhub-client.ts";

export type { WizardSettings };

/**
 * Settings module: GET/PUT when the AQHub bridge exists.
 * Canonical live path is AQHub `data/wizard-settings.json` — never tasks.json.
 */
export interface SettingsFilePort {
  loadFile(): Promise<WizardSettings | null>;
  saveFile(settings: WizardSettings): Promise<void>;
}

export class WizardSettingsStore {
  private api: AqHubApi;
  private file: SettingsFilePort | null;
  current: WizardSettings;

  constructor(api: AqHubApi = createAqHubClient(), file: SettingsFilePort | null = null) {
    this.api = api;
    this.file = file;
    this.current = defaultSettings();
  }

  async load(): Promise<WizardSettings> {
    try {
      this.current = normalizeSettings(await this.api.getSettings());
      return this.current;
    } catch {
      const fromFile = this.file ? await this.file.loadFile() : null;
      if (fromFile) this.current = normalizeSettings(fromFile);
      return this.current;
    }
  }

  async save(partial: Partial<WizardSettings>): Promise<WizardSettings> {
    const next: WizardSettings = normalizeSettings({
      ...this.current,
      ...partial,
      characterId: partial.characterId ?? this.current.characterId,
      technicalId: this.current.technicalId,
      window: { ...this.current.window, ...(partial.window || {}) },
      reminders: partial.reminders ?? this.current.reminders,
      mailIgnored: partial.mailIgnored ?? this.current.mailIgnored,
      permissions: {
        ...this.current.permissions,
        ...(partial.permissions || {}),
      },
    });
    if (partial.displayName !== undefined) {
      next.displayName = partial.displayName.trim().slice(0, 80) || this.current.displayName;
    }
    try {
      this.current = normalizeSettings(await this.api.putSettings(next));
      return this.current;
    } catch {
      this.current = next;
      if (this.file) await this.file.saveFile(next);
      return this.current;
    }
  }
}
