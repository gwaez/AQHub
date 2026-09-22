import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { createAqHubClient } from "./api/aqhub-client.ts";
import { WizardSettingsStore, type WizardSettings } from "./settings/wizard-settings.ts";
import { dispatch, type CharacterWindowPort } from "./engines/action-engine.ts";
import { WizardStateMachine } from "./state/wizard-state-machine.ts";
import { applyAnimation } from "./engines/animation-engine.ts";
import { loadCharacterPack } from "./ui/character.ts";
import { copy } from "./i18n/ar.ts";
import type { WizardAction } from "./actions/wizard-action.ts";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error("missing #" + id);
  return node as T;
}

function browserWindowPort(): CharacterWindowPort {
  return {
    async show() {
      el("character").style.visibility = "visible";
      const plate = document.querySelector(".nameplate");
      if (plate instanceof HTMLElement) plate.style.visibility = "visible";
    },
    async hide() {
      el("character").style.visibility = "hidden";
      const plate = document.querySelector(".nameplate");
      if (plate instanceof HTMLElement) plate.style.visibility = "hidden";
    },
    async openAqHub() {
      window.open("http://127.0.0.1:8766/board.html", "_blank");
    },
    async exit() {
      /* browser preview has no process to exit */
    },
    async setPosition() {
      /* browser preview does not move the OS window */
    },
  };
}

function tauriWindowPort(): CharacterWindowPort {
  return {
    async show() {
      await invoke("show_character");
    },
    async hide() {
      await invoke("hide_character");
    },
    async openAqHub() {
      await invoke("open_aqhub");
    },
    async exit() {
      await invoke("exit_app");
    },
    async setPosition(x: number, y: number) {
      await invoke("set_character_position", { x, y });
    },
  };
}

async function main() {
  const sprite = el<HTMLImageElement>("sprite");
  const character = el("character");
  const nameBtn = el<HTMLButtonElement>("displayName");
  const techId = el("techId");
  const chrome = el("chrome");
  const hubStatus = el("hubStatus");
  const scale = el<HTMLInputElement>("scale");
  const bubble = el("bubble");
  const bubbleText = el("bubbleText");

  bubbleText.textContent = copy.bubblePlaceholder;
  bubble.setAttribute("dir", "rtl");

  const pack = await loadCharacterPack("old-wizard");
  sprite.src = pack.idleAssetUrl;
  sprite.alt = pack.defaultDisplayName;

  const api = createAqHubClient();
  const filePort = isTauri
    ? {
        async loadFile() {
          try {
            return (await invoke<WizardSettings | null>("load_settings_file")) ?? null;
          } catch {
            return null;
          }
        },
        async saveFile(settings: WizardSettings) {
          await invoke("save_settings_file", { settings });
        },
      }
    : null;

  const settings = new WizardSettingsStore(api, filePort);
  const machine = new WizardStateMachine();
  const ports = {
    api,
    window: isTauri ? tauriWindowPort() : browserWindowPort(),
    settings,
  };

  const paint = () => {
    applyAnimation(character, machine.hint);
    nameBtn.textContent = settings.current.displayName;
    sprite.alt = settings.current.displayName;
    techId.textContent = `${settings.current.technicalId} · ${settings.current.characterId}`;
    const s = Math.round((settings.current.window.scale || 1) * 100);
    scale.value = String(s);
    character.style.transform = `scale(${settings.current.window.scale || 1})`;
  };

  const run = async (action: WizardAction) => {
    const result = await dispatch(action, ports, machine);
    paint();
    if (action.type === "PING_HEALTH") {
      if (result.ok && result.health?.aqhub) {
        hubStatus.textContent = `${copy.hubUp} · ${result.health.version}`;
        hubStatus.className = "hub up";
      } else {
        hubStatus.textContent = copy.hubDown;
        hubStatus.className = "hub down";
      }
    }
    return result;
  };

  if (!isTauri) {
    document.body.classList.add("browser-preview");
    chrome.hidden = false;
  }

  await run({ type: "LOAD_SETTINGS" });
  if (!settings.current.displayName) {
    await run({ type: "RENAME_DISPLAY", displayName: pack.defaultDisplayName });
  }
  await run({ type: "PING_HEALTH" });
  paint();

  nameBtn.addEventListener("dblclick", async () => {
    const next = window.prompt(copy.displayNameLabel, settings.current.displayName);
    if (next && next.trim()) await run({ type: "RENAME_DISPLAY", displayName: next });
  });

  scale.addEventListener("change", async () => {
    await run({ type: "SET_SCALE", scale: Number(scale.value) / 100 });
  });

  chrome.addEventListener("click", async (ev) => {
    const btn = (ev.target as HTMLElement).closest("button[data-act]");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    if (act === "SHOW") await run({ type: "SHOW" });
    if (act === "HIDE") await run({ type: "HIDE" });
    if (act === "WATCH") await run({ type: "WATCH" });
    if (act === "IDLE") await run({ type: "IDLE" });
    if (act === "OPEN_AQHUB") await run({ type: "OPEN_AQHUB" });
  });

  if (isTauri) {
    await listen<string>("wizard://action", async (event) => {
      const t = event.payload;
      if (t === "SHOW") await run({ type: "SHOW" });
      if (t === "HIDE") await run({ type: "HIDE" });
      if (t === "OPEN_AQHUB") await run({ type: "OPEN_AQHUB" });
      if (t === "WATCH") await run({ type: "WATCH" });
    });
    const win = getCurrentWindow();
    let moveTimer: number | undefined;
    await win.onMoved(async (pos) => {
      window.clearTimeout(moveTimer);
      moveTimer = window.setTimeout(() => {
        void run({ type: "SET_POSITION", x: pos.payload.x, y: pos.payload.y });
      }, 400);
    });
  }

  window.setInterval(() => {
    machine.update(
      {
        displayName: settings.current.displayName,
        scale: settings.current.window.scale,
        nowMs: Date.now(),
      },
      250,
    );
    applyAnimation(character, machine.hint);
  }, 250);
}

void main();
