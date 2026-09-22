/** In-app settings + permission dashboard. Live-applies through Action Engine. */

import type { AuditLine } from "../api/audit.ts";
import { formatAuditLine } from "../api/audit.ts";
import type { MailStatus } from "../api/mail.ts";
import { DEFAULT_AQHUB_URL, type WizardSettings } from "../api/aqhub-client.ts";
import type { UiCopy } from "../i18n/ar.ts";
import { isSafeCharacterId, normalizeCharacterId } from "../settings/character-id.ts";
import {
  CAPABILITIES,
  type CapabilityId,
  type PermissionMode,
} from "./permissions.ts";

export const SETTINGS_PANEL_PHASE = "p10";

export interface SettingsHandlers {
  onPatch(patch: Partial<WizardSettings>): void;
  onPermission(id: CapabilityId, mode: PermissionMode): void;
  onRefreshAudit(): void;
  onMailSync(): void;
  onJumpPermissions(): void;
  onClose(): void;
}

export class SettingsPanel {
  private host: HTMLElement;
  private handlers: SettingsHandlers;
  private copy: UiCopy;
  private tab = "general";
  private last: WizardSettings | null = null;
  private debounce = 0;
  private mailStatus: MailStatus | null = null;
  private packs: { id: string; label: string }[] = [
    { id: "secretary", label: "secretary — السكرتيرة" },
    { id: "old-wizard", label: "old-wizard — الساحر العتيق" },
  ];

  constructor(host: HTMLElement, handlers: SettingsHandlers, copy: UiCopy) {
    this.host = host;
    this.handlers = handlers;
    this.copy = copy;
    this.host.addEventListener("click", (ev) => {
      const tabBtn = (ev.target as HTMLElement).closest("[data-settings-tab]") as HTMLElement | null;
      if (tabBtn) {
        this.tab = tabBtn.getAttribute("data-settings-tab") || "general";
        this.paintTabs();
        return;
      }
      const close = (ev.target as HTMLElement).closest("[data-settings=close]");
      if (close) this.handlers.onClose();
      const refresh = (ev.target as HTMLElement).closest("[data-settings=audit-refresh]");
      if (refresh) this.handlers.onRefreshAudit();
      const sync = (ev.target as HTMLElement).closest("[data-settings=mail-sync]");
      if (sync) this.handlers.onMailSync();
      const jump = (ev.target as HTMLElement).closest("[data-settings=mail-perms]");
      if (jump) {
        this.tab = "permissions";
        this.handlers.onJumpPermissions();
        this.paintTabs();
      }
    });
    this.host.addEventListener("change", (ev) => {
      const t = ev.target as HTMLElement;
      if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement)) return;
      this.emitFromControl(t);
    });
    this.host.addEventListener("input", (ev) => {
      const t = ev.target as HTMLElement;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.type === "range" || t.type === "number") {
        window.clearTimeout(this.debounce);
        this.debounce = window.setTimeout(() => this.emitFromControl(t), 180);
      }
    });
  }

  setCopy(copy: UiCopy): void {
    this.copy = copy;
  }

  show(settings: WizardSettings, audit: AuditLine[], mail?: MailStatus | null): void {
    this.host.hidden = false;
    this.sync(settings, audit, mail);
    void this.refreshPacks().then(() => {
      if (!this.host.hidden && this.last) this.render(this.last, audit);
    });
  }

  hide(): void {
    this.host.hidden = true;
  }

  get visible(): boolean {
    return !this.host.hidden;
  }

  sync(settings: WizardSettings, audit: AuditLine[], mail?: MailStatus | null): void {
    if (mail) this.mailStatus = mail;
    const localeChanged = this.last && this.last.language !== settings.language;
    this.last = settings;
    if (!this.host.querySelector(".settings-tabs") || localeChanged) {
      this.render(settings, audit);
      return;
    }
    this.fillValues(settings);
    this.fillPermissions(settings);
    this.fillAudit(audit);
    this.fillEmail(settings);
    this.paintTabs();
  }

  private paintTabs(): void {
    this.host.querySelectorAll("[data-settings-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-settings-tab") === this.tab);
    });
    this.host.querySelectorAll("[data-settings-section]").forEach((sec) => {
      (sec as HTMLElement).hidden = sec.getAttribute("data-settings-section") !== this.tab;
    });
  }

  private emitFromControl(el: HTMLInputElement | HTMLSelectElement): void {
    const key = el.getAttribute("data-set");
    if (!key) return;
    if (key.startsWith("perm:")) {
      const id = key.slice(5) as CapabilityId;
      this.handlers.onPermission(id, el.value as PermissionMode);
      return;
    }
    const patch: Partial<WizardSettings> = {};
    switch (key) {
      case "language":
        patch.language = el.value === "en" ? "en" : "ar";
        break;
      case "startMinimized":
        patch.startMinimized = (el as HTMLInputElement).checked;
        break;
      case "alwaysOnTop":
        patch.alwaysOnTop = (el as HTMLInputElement).checked;
        break;
      case "displayName":
        patch.displayName = el.value;
        break;
      case "characterId":
        patch.characterId = normalizeCharacterId(el.value);
        break;
      case "scale":
        patch.window = {
          ...(this.last?.window || { x: null, y: null, scale: 1 }),
          scale: Number(el.value) / 100,
        };
        break;
      case "opacity":
        patch.opacity = Number(el.value) / 100;
        break;
      case "animationLevel":
        patch.animationLevel = el.value as WizardSettings["animationLevel"];
        break;
      case "followPointer":
        patch.followPointer = (el as HTMLInputElement).checked;
        break;
      case "roamEnabled":
        patch.roamEnabled = (el as HTMLInputElement).checked;
        break;
      case "preferredCorner":
        patch.preferredCorner = el.value as WizardSettings["preferredCorner"];
        break;
      case "proactiveBubbles":
        patch.proactiveBubbles = el.value as WizardSettings["proactiveBubbles"];
        break;
      case "idleSleepMs":
        patch.idleSleepMs = Number(el.value) * 1000;
        break;
      case "bubbleScale":
        patch.bubbleScale = Number(el.value) / 100;
        break;
      case "bubbleFontSize":
        patch.bubbleFontSize = Number(el.value);
        break;
      case "closeAction":
        patch.closeAction = el.value === "exit" ? "exit" : "hide";
        break;
      default:
        return;
    }
    this.handlers.onPatch(patch);
  }

  private async refreshPacks(): Promise<void> {
    try {
      const res = await fetch(`${DEFAULT_AQHUB_URL}/api/v1/wizard/characters`);
      if (!res.ok) return;
      const body = (await res.json()) as {
        characters?: { id?: string; displayName?: string; defaultDisplayName?: string }[];
      };
      const next: { id: string; label: string }[] = [];
      const seen = new Set<string>();
      for (const row of body.characters || []) {
        const id = String(row.id || "");
        if (!isSafeCharacterId(id) || seen.has(id)) continue;
        seen.add(id);
        const name = String(row.displayName || row.defaultDisplayName || id);
        next.push({ id, label: `${id} — ${name}` });
      }
      if (next.length) this.packs = next;
    } catch {
      /* keep built-in list when the board is down */
    }
  }

  private packOptions(settings: WizardSettings): string {
    const rows = [...this.packs];
    if (isSafeCharacterId(settings.characterId) && !rows.some((p) => p.id === settings.characterId)) {
      rows.push({ id: settings.characterId, label: settings.characterId });
    }
    return rows
      .map((p) => `<option value="${esc(p.id)}" ${sel(settings.characterId === p.id)}>${esc(p.label)}</option>`)
      .join("");
  }

  private fillValues(settings: WizardSettings): void {
    const setVal = (key: string, value: string | boolean) => {
      const el = this.host.querySelector(`[data-set="${key}"]`);
      if (el instanceof HTMLInputElement) {
        if (el.type === "checkbox") el.checked = Boolean(value);
        else if (document.activeElement !== el) el.value = String(value);
      } else if (el instanceof HTMLSelectElement && document.activeElement !== el) {
        el.value = String(value);
      }
    };
    setVal("language", settings.language);
    setVal("startMinimized", settings.startMinimized);
    setVal("alwaysOnTop", settings.alwaysOnTop);
    setVal("displayName", settings.displayName);
    setVal("characterId", settings.characterId);
    setVal("scale", String(Math.round((settings.window.scale || 1) * 100)));
    setVal("opacity", String(Math.round(settings.opacity * 100)));
    setVal("animationLevel", settings.animationLevel);
    setVal("followPointer", settings.followPointer);
    setVal("roamEnabled", settings.roamEnabled);
    setVal("preferredCorner", settings.preferredCorner);
    setVal("proactiveBubbles", settings.proactiveBubbles);
    setVal("idleSleepMs", String(Math.round(settings.idleSleepMs / 1000)));
    setVal("bubbleScale", String(Math.round(settings.bubbleScale * 100)));
    setVal("bubbleFontSize", String(settings.bubbleFontSize));
    setVal("closeAction", settings.closeAction);
  }

  private fillPermissions(settings: WizardSettings): void {
    for (const cap of CAPABILITIES) {
      const el = this.host.querySelector(`[data-set="perm:${cap.id}"]`);
      if (el instanceof HTMLSelectElement && document.activeElement !== el) {
        el.value = settings.permissions[cap.id];
      }
      const modeCell = el?.closest("tr")?.querySelector(".perm-mode");
      if (modeCell) modeCell.textContent = settings.permissions[cap.id];
    }
  }

  private fillAudit(audit: AuditLine[]): void {
    const section = this.host.querySelector('[data-settings-section="audit"]');
    if (!section) return;
    const c = this.copy;
    section.querySelector(":scope > .hint")?.remove();
    let ul = section.querySelector(".audit-list");
    if (!audit.length) {
      ul?.remove();
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = c.auditEmpty;
      section.appendChild(p);
      return;
    }
    if (!ul) {
      ul = document.createElement("ul");
      ul.className = "audit-list";
      section.appendChild(ul);
    }
    ul.innerHTML = audit.map((line) => `<li>${esc(formatAuditLine(line))}</li>`).join("");
  }

  private fillEmail(settings: WizardSettings): void {
    const c = this.copy;
    const st = this.mailStatus;
    const statusEl = this.host.querySelector("[data-email-status]");
    if (statusEl) {
      statusEl.textContent = st?.outlook ? c.emailConnected : c.emailUnavailable;
      statusEl.className = st?.outlook ? "hub up" : "hub down";
    }
    const reason = this.host.querySelector("[data-email-reason]");
    if (reason) reason.textContent = st?.reason || "";
    const sync = this.host.querySelector("[data-email-sync]");
    if (sync) sync.textContent = settings.mailLastSyncAt || st?.lastSyncAt || "—";
  }

  private render(settings: WizardSettings, audit: AuditLine[]): void {
    const c = this.copy;
    const lang = settings.language === "en" ? "en" : "ar";
    this.host.innerHTML = `
      <p class="composer-title">${esc(c.settings)}</p>
      <nav class="settings-tabs">
        ${tabBtn("general", c.general)}
        ${tabBtn("character", c.character)}
        ${tabBtn("behaviour", c.behaviour)}
        ${tabBtn("bubbles", c.bubbles)}
        ${tabBtn("hotkeys", c.hotkeys)}
        ${tabBtn("tray", c.tray)}
        ${tabBtn("email", c.email)}
        ${tabBtn("permissions", c.permissions)}
        ${tabBtn("audit", c.audit)}
      </nav>
      <div class="settings-body">
        <section data-settings-section="general">
          <label>${esc(c.language)}
            <select data-set="language">
              <option value="ar" ${sel(settings.language === "ar")}>العربية</option>
              <option value="en" ${sel(settings.language === "en")}>English</option>
            </select>
          </label>
          <label class="check"><input type="checkbox" data-set="startMinimized" ${chk(settings.startMinimized)} /> ${esc(c.startMinimized)}</label>
          <label class="check"><input type="checkbox" data-set="alwaysOnTop" ${chk(settings.alwaysOnTop)} /> ${esc(c.alwaysOnTop)}</label>
        </section>
        <section data-settings-section="character">
          <label>${esc(c.packSelect)}
            <select data-set="characterId">
              ${this.packOptions(settings)}
            </select>
          </label>
          <label>${esc(c.displayNameLabel)}
            <input data-set="displayName" type="text" maxlength="80" value="${esc(settings.displayName)}" />
          </label>
          <label>${esc(c.scaleLabel)}
            <input data-set="scale" type="range" min="50" max="200" value="${Math.round((settings.window.scale || 1) * 100)}" />
          </label>
          <label>${esc(c.opacity)}
            <input data-set="opacity" type="range" min="35" max="100" value="${Math.round(settings.opacity * 100)}" />
          </label>
          <label>${esc(c.animLabel)}
            <select data-set="animationLevel">
              <option value="normal" ${sel(settings.animationLevel === "normal")}>${esc(c.animNormal)}</option>
              <option value="reduced" ${sel(settings.animationLevel === "reduced")}>${esc(c.animReduced)}</option>
              <option value="off" ${sel(settings.animationLevel === "off")}>${esc(c.animOff)}</option>
            </select>
          </label>
          <label class="check"><input type="checkbox" data-set="followPointer" ${chk(settings.followPointer)} /> ${esc(c.followPointer)}</label>
          <label class="check"><input type="checkbox" data-set="roamEnabled" ${chk(settings.roamEnabled)} /> ${esc(c.roamEnabled)}</label>
          <label>${esc(c.preferredCorner)}
            <select data-set="preferredCorner">
              <option value="bottom-end" ${sel(settings.preferredCorner === "bottom-end")}>bottom-end</option>
              <option value="bottom-start" ${sel(settings.preferredCorner === "bottom-start")}>bottom-start</option>
              <option value="top-end" ${sel(settings.preferredCorner === "top-end")}>top-end</option>
              <option value="top-start" ${sel(settings.preferredCorner === "top-start")}>top-start</option>
            </select>
          </label>
        </section>
        <section data-settings-section="behaviour">
          <label>${esc(c.proactive)}
            <select data-set="proactiveBubbles">
              <option value="high" ${sel(settings.proactiveBubbles === "high")}>High</option>
              <option value="normal" ${sel(settings.proactiveBubbles === "normal")}>Normal</option>
              <option value="low" ${sel(settings.proactiveBubbles === "low")}>Low</option>
              <option value="off" ${sel(settings.proactiveBubbles === "off")}>Off</option>
            </select>
          </label>
          <label>${esc(c.sleepLabel)}
            <input data-set="idleSleepMs" type="number" min="5" max="600" step="5" value="${Math.round(settings.idleSleepMs / 1000)}" />
          </label>
        </section>
        <section data-settings-section="bubbles">
          <label>${esc(c.bubbleScale)}
            <input data-set="bubbleScale" type="range" min="70" max="180" value="${Math.round(settings.bubbleScale * 100)}" />
          </label>
          <label>${esc(c.bubbleFont)}
            <input data-set="bubbleFontSize" type="range" min="11" max="22" value="${settings.bubbleFontSize}" />
          </label>
        </section>
        <section data-settings-section="hotkeys">
          <p class="hint">${esc(c.hotkeysHint)}</p>
          <ul class="hotkey-list">
            <li><kbd>Ctrl+Alt+Space</kbd> ${esc(c.show)} / ${esc(c.hide)}</li>
            <li><kbd>Ctrl+Alt+T</kbd> ${esc(c.newTask)}</li>
            <li><kbd>Ctrl+Alt+N</kbd> ${esc(c.quickNote)}</li>
            <li><kbd>Ctrl+Alt+W</kbd> ${esc(c.openAqHub)}</li>
          </ul>
        </section>
        <section data-settings-section="tray">
          <label>${esc(c.closeAction)}
            <select data-set="closeAction">
              <option value="hide" ${sel(settings.closeAction === "hide")}>${esc(c.closeHide)}</option>
              <option value="exit" ${sel(settings.closeAction === "exit")}>${esc(c.closeExit)}</option>
            </select>
          </label>
        </section>
        <section data-settings-section="email">
          <p class="hint">${esc(c.emailHint)}</p>
          <p>${esc(c.emailStatus)}: <span data-email-status class="${this.mailStatus?.outlook ? "hub up" : "hub down"}">${esc(this.mailStatus?.outlook ? c.emailConnected : c.emailUnavailable)}</span></p>
          <p class="hint" data-email-reason>${esc(this.mailStatus?.reason || "")}</p>
          <p>${esc(c.emailLastSync)}: <span data-email-sync dir="ltr">${esc(settings.mailLastSyncAt || this.mailStatus?.lastSyncAt || "—")}</span></p>
          <div class="composer-actions">
            <button type="button" data-settings="mail-sync">${esc(c.emailSyncNow)}</button>
            <button type="button" data-settings="mail-perms">${esc(c.emailPerms)}</button>
          </div>
        </section>
        <section data-settings-section="permissions">
          <table class="perm-table">
            <thead>
              <tr><th>${esc(c.permissions)}</th><th></th><th></th></tr>
            </thead>
            <tbody>
              ${CAPABILITIES.map((cap) => {
                const mode = settings.permissions[cap.id];
                const label = lang === "en" ? cap.labelEn : cap.labelAr;
                const hint = lang === "en" ? cap.hintEn : cap.hintAr;
                const locked = cap.modes.length <= 1;
                const options = cap.modes
                  .map(
                    (m) =>
                      `<option value="${m}" ${sel(mode === m)}>${esc(modeLabel(c, m))}</option>`,
                  )
                  .join("");
                return `<tr>
                  <td>
                    <strong>${esc(label)}</strong>
                    <small>${esc(hint)}${cap.implemented ? "" : " · " + esc(c.notImplemented)}</small>
                  </td>
                  <td>
                    <select data-set="perm:${cap.id}" ${locked || !cap.implemented ? "disabled" : ""}>${options}</select>
                  </td>
                  <td class="perm-mode">${esc(mode)}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </section>
        <section data-settings-section="audit">
          <div class="composer-actions">
            <button type="button" data-settings="audit-refresh">${esc(c.auditRefresh)}</button>
          </div>
          ${
            audit.length
              ? `<ul class="audit-list">${audit
                  .map((line) => `<li>${esc(formatAuditLine(line))}</li>`)
                  .join("")}</ul>`
              : `<p class="hint">${esc(c.auditEmpty)}</p>`
          }
        </section>
      </div>
      <div class="composer-actions">
        <button type="button" data-settings="close">${esc(c.matrixClose)}</button>
      </div>
    `;
    this.paintTabs();
  }
}

function tabBtn(id: string, label: string): string {
  return `<button type="button" data-settings-tab="${id}">${esc(label)}</button>`;
}
function sel(on: boolean): string {
  return on ? "selected" : "";
}
function chk(on: boolean): string {
  return on ? "checked" : "";
}
function modeLabel(c: UiCopy, m: PermissionMode): string {
  if (m === "allow") return c.modeAllow;
  if (m === "ask") return c.modeAsk;
  return c.modeNever;
}
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
