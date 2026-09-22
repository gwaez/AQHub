/** Ask-the-Wizard chat sheet. Short speech bubbles stay in BubbleEngine. */

import type { WizardSettings } from "../api/aqhub-client.ts";
import { hasBridgeSecret, type KvPort, browserKv } from "../bridge/secret-store.ts";
import { isBridgeLinked, type WizardBridgeConfig } from "../bridge/config.ts";
import type { UiCopy } from "../i18n/ar.ts";
import type { ChatLine, ChatMode } from "./types.ts";

export interface ChatHandlers {
  onSend(mode: ChatMode, text: string): void;
  onClose(): void;
  onBridgePatch(patch: Partial<WizardBridgeConfig>): void;
  onSecretChange(secret: string): void;
}

export class ChatPanel {
  private host: HTMLElement;
  private handlers: ChatHandlers;
  private copy: UiCopy;
  private lines: ChatLine[] = [];
  private mode: ChatMode = "chat";
  private last: WizardSettings | null = null;
  private kv: KvPort;
  private debounce = 0;

  constructor(host: HTMLElement, handlers: ChatHandlers, copy: UiCopy, kv: KvPort = browserKv()) {
    this.host = host;
    this.handlers = handlers;
    this.copy = copy;
    this.kv = kv;
    this.host.addEventListener("click", (ev) => {
      const t = ev.target as HTMLElement;
      if (t.closest("[data-ask=close]")) {
        this.handlers.onClose();
        return;
      }
      const modeBtn = t.closest("[data-ask-mode]") as HTMLElement | null;
      if (modeBtn) {
        this.mode = modeBtn.getAttribute("data-ask-mode") === "execute" ? "execute" : "chat";
        this.paintMode();
        return;
      }
    });
    this.host.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const input = this.host.querySelector<HTMLTextAreaElement>("[data-ask=input]");
      const text = input?.value.trim() || "";
      if (!text) return;
      if (input) input.value = "";
      this.handlers.onSend(this.mode, text);
    });
    this.host.addEventListener("change", (ev) => {
      const el = ev.target as HTMLElement;
      if (!(el instanceof HTMLInputElement)) return;
      this.emitBridge(el);
    });
    this.host.addEventListener("input", (ev) => {
      const el = ev.target as HTMLElement;
      if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return;
      if (el.getAttribute("data-bridge") === "secret") return;
      if (el instanceof HTMLInputElement && (el.type === "text" || el.type === "url")) {
        window.clearTimeout(this.debounce);
        this.debounce = window.setTimeout(() => this.emitBridge(el), 220);
      }
    });
    this.host.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" || ev.shiftKey) return;
      const el = ev.target as HTMLElement;
      if (el.getAttribute("data-ask") !== "input") return;
      ev.preventDefault();
      (this.host.querySelector("form") as HTMLFormElement | null)?.requestSubmit();
    });
  }

  setCopy(copy: UiCopy): void {
    this.copy = copy;
    if (this.visible && this.last) this.render(this.last);
  }

  show(settings: WizardSettings): void {
    this.host.hidden = false;
    this.sync(settings);
    const input = this.host.querySelector<HTMLTextAreaElement>("[data-ask=input]");
    input?.focus();
  }

  hide(): void {
    this.host.hidden = true;
  }

  get visible(): boolean {
    return !this.host.hidden;
  }

  get currentMode(): ChatMode {
    return this.mode;
  }

  sync(settings: WizardSettings): void {
    const localeChanged = this.last && this.last.language !== settings.language;
    this.last = settings;
    if (!this.host.querySelector("[data-ask=log]") || localeChanged) {
      this.render(settings);
      return;
    }
    this.fillBridge(settings);
    this.paintMode();
    this.paintLink(settings);
  }

  addLine(line: ChatLine): void {
    this.lines = [...this.lines, line].slice(-80);
    const log = this.host.querySelector("[data-ask=log]");
    if (!log) return;
    log.appendChild(this.lineEl(line));
    log.scrollTop = log.scrollHeight;
  }

  private emitBridge(el: HTMLInputElement): void {
    const key = el.getAttribute("data-bridge");
    if (!key) return;
    if (key === "secret") {
      this.handlers.onSecretChange(el.value);
      this.paintSecretHint();
      return;
    }
    const patch: Partial<WizardBridgeConfig> = {};
    if (key === "enabled") patch.enabled = el.checked;
    else if (key === "url") patch.url = el.value.trim();
    else if (key === "secretRef") patch.secretRef = el.value.trim();
    else if (key === "agentId") patch.agentId = el.value.trim();
    else return;
    this.handlers.onBridgePatch(patch);
  }

  private fillBridge(settings: WizardSettings): void {
    const b = settings.bridge;
    const set = (key: string, value: string | boolean) => {
      const el = this.host.querySelector(`[data-bridge="${key}"]`);
      if (el instanceof HTMLInputElement) {
        if (el.type === "checkbox") el.checked = Boolean(value);
        else if (el.type === "password") return;
        else if (document.activeElement !== el) el.value = String(value);
      }
    };
    set("enabled", b.enabled);
    set("url", b.url);
    set("secretRef", b.secretRef);
    set("agentId", b.agentId);
    this.paintSecretHint();
    this.paintLink(settings);
  }

  private paintSecretHint(): void {
    const hint = this.host.querySelector("[data-ask=secret-state]");
    if (!hint || !this.last) return;
    const present = hasBridgeSecret(this.last.bridge.secretRef, this.kv);
    hint.textContent = present ? this.copy.bridgeSecretSet : this.copy.bridgeSecretEmpty;
  }

  private paintLink(settings: WizardSettings): void {
    const el = this.host.querySelector("[data-ask=link]");
    if (!el) return;
    const linked = isBridgeLinked(settings.bridge);
    el.textContent = linked ? this.copy.bridgeLinked : this.copy.bridgeNotLinked;
    el.className = linked ? "hub up" : "hub down";
  }

  private paintMode(): void {
    this.host.querySelectorAll("[data-ask-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-ask-mode") === this.mode);
    });
    const input = this.host.querySelector<HTMLTextAreaElement>("[data-ask=input]");
    if (input) {
      input.placeholder = this.mode === "execute" ? this.copy.askExecutePlaceholder : this.copy.askChatPlaceholder;
    }
  }

  private lineEl(line: ChatLine): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "ask-line ask-" + line.role;
    const who = document.createElement("small");
    who.textContent =
      line.role === "user"
        ? this.copy.askYou + (line.mode ? " · " + (line.mode === "execute" ? this.copy.askExecute : this.copy.askChat) : "")
        : line.role === "wizard"
          ? this.copy.askWizard
          : this.copy.askSystem;
    const body = document.createElement("p");
    body.textContent = line.text;
    wrap.append(who, body);
    return wrap;
  }

  private render(settings: WizardSettings): void {
    const c = this.copy;
    const b = settings.bridge;
    const linked = isBridgeLinked(b);
    this.host.innerHTML = `
      <p class="composer-title">${esc(c.askWizard)}</p>
      <p>${esc(c.bridgeStatus)}: <span data-ask="link" class="${linked ? "hub up" : "hub down"}">${esc(
        linked ? c.bridgeLinked : c.bridgeNotLinked,
      )}</span></p>
      <div class="ask-log" data-ask="log"></div>
      <form class="ask-form">
        <div class="ask-mode" role="group" aria-label="${esc(c.askMode)}">
          <button type="button" data-ask-mode="chat">${esc(c.askChat)}</button>
          <button type="button" data-ask-mode="execute">${esc(c.askExecute)}</button>
        </div>
        <textarea data-ask="input" rows="3" maxlength="4000" placeholder="${esc(
          this.mode === "execute" ? c.askExecutePlaceholder : c.askChatPlaceholder,
        )}"></textarea>
        <div class="composer-actions">
          <button type="submit" class="primary">${esc(c.askSend)}</button>
          <button type="button" data-ask="close">${esc(c.cancel)}</button>
        </div>
      </form>
      <details class="ask-bridge">
        <summary>${esc(c.bridgeTitle)}</summary>
        <p class="hint">${esc(c.bridgeHint)}</p>
        <label class="check"><input type="checkbox" data-bridge="enabled" ${b.enabled ? "checked" : ""} /> ${esc(c.bridgeEnabled)}</label>
        <label>${esc(c.bridgeUrl)}
          <input data-bridge="url" type="url" dir="ltr" placeholder="https://example.invalid/wizard" value="${esc(b.url)}" />
        </label>
        <label>${esc(c.bridgeSecretRef)}
          <input data-bridge="secretRef" type="text" dir="ltr" maxlength="80" value="${esc(b.secretRef)}" />
        </label>
        <label>${esc(c.bridgeSecret)}
          <input data-bridge="secret" type="password" dir="ltr" autocomplete="off" placeholder="${esc(c.bridgeSecretPlaceholder)}" />
        </label>
        <p class="hint" data-ask="secret-state"></p>
        <label>${esc(c.bridgeAgentId)}
          <input data-bridge="agentId" type="text" dir="ltr" maxlength="80" value="${esc(b.agentId)}" />
        </label>
      </details>
    `;
    const log = this.host.querySelector("[data-ask=log]");
    if (log) {
      for (const line of this.lines) log.appendChild(this.lineEl(line));
      log.scrollTop = log.scrollHeight;
    }
    this.paintMode();
    this.paintSecretHint();
  }
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
