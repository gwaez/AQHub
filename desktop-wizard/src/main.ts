import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { createAqHubClient } from "./api/aqhub-client.ts";
import { WizardSettingsStore, type WizardSettings } from "./settings/wizard-settings.ts";
import { dispatch, type CharacterWindowPort } from "./engines/action-engine.ts";
import { WizardStateMachine, isTransientState } from "./state/wizard-state-machine.ts";
import { applyAnimation } from "./engines/animation-engine.ts";
import { IdleDirector } from "./engines/idle-director.ts";
import { BubbleEngine } from "./engines/bubble-engine.ts";
import { injectWizardSvg, loadCharacterPack } from "./ui/character.ts";
import { EisenhowerPanel } from "./ui/eisenhower-panel.ts";
import { SettingsPanel } from "./ui/settings-panel.ts";
import { applyDocumentLocale, localeCopy } from "./i18n/index.ts";
import type { WizardAction } from "./actions/wizard-action.ts";
import type { EisQuad } from "./api/eisenhower.ts";
import type { AuditLine } from "./api/audit.ts";

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
    async setPosition() {},
    async setMatrixLayout(open: boolean) {
      document.body.classList.toggle("matrix-open", open);
    },
    async setAlwaysOnTop() {},
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
    async setMatrixLayout(open: boolean) {
      document.body.classList.toggle("matrix-open", open);
      await invoke("set_matrix_layout", { open });
    },
    async setAlwaysOnTop(on: boolean) {
      await invoke("set_always_on_top", { on });
    },
  };
}

async function main() {
  const character = el("character");
  const nameBtn = el<HTMLButtonElement>("displayName");
  const techId = el("techId");
  const chrome = el("chrome");
  const hubStatus = el("hubStatus");
  const stateLabel = el("stateLabel");
  const scale = el<HTMLInputElement>("scale");
  const bubble = el("bubble");
  const bubbleText = el("bubbleText");
  const composer = el<HTMLFormElement>("composer");
  const composerTitle = el<HTMLInputElement>("composerTitle");
  const composerBody = el<HTMLTextAreaElement>("composerBody");
  const composerDue = el<HTMLInputElement>("composerDue");
  const ctx = el("ctx");
  const settingsHost = el("settingsPanel");
  const matrixHost = el("matrixPanel");
  const bubbleConfirm = el("bubbleConfirm");
  const bubbleYes = el<HTMLButtonElement>("bubbleYes");
  const bubbleNo = el<HTMLButtonElement>("bubbleNo");
  const stage = el("stage");

  const pack = await loadCharacterPack("old-wizard");
  try {
    await injectWizardSvg(character, pack.svgUrl);
  } catch {
    character.innerHTML = "<p class='hint'>missing pack</p>";
  }

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
  const bubbles = new BubbleEngine();
  const idle = new IdleDirector({ sleepAfterMs: 90_000, animationLevel: "normal" }, Date.now());
  const look = { x: 0, y: 0 };
  let idleReturnTimer = 0;
  let lastUndo: { id: string; prevQuad: EisQuad } | null = null;
  let pendingAsk: WizardAction | null = null;
  let lastProactive = Date.now();
  let auditLines: AuditLine[] = [];
  let ui = localeCopy(settings.current.language);
  let settingsUi: SettingsPanel;

  const ports = {
    api,
    window: isTauri ? tauriWindowPort() : browserWindowPort(),
    settings,
  };

  const paint = () => {
    ui = localeCopy(settings.current.language);
    applyDocumentLocale(settings.current.language);
    settingsUi.setCopy(ui);
    applyAnimation(character, machine.hint, look, settings.current.animationLevel);
    nameBtn.textContent = settings.current.displayName;
    techId.textContent = `${settings.current.technicalId} · ${settings.current.characterId}`;
    const s = Math.round((settings.current.window.scale || 1) * 100);
    scale.value = String(s);
    character.style.transform = `scale(${settings.current.window.scale || 1})`;
    character.style.opacity = String((Number(character.style.opacity) || 1) * settings.current.opacity);
    bubble.style.transform = `scale(${settings.current.bubbleScale})`;
    bubble.style.fontSize = `${settings.current.bubbleFontSize}px`;
    for (const corner of ["bottom-end", "bottom-start", "top-end", "top-start"] as const) {
      stage.classList.toggle("corner-" + corner, settings.current.preferredCorner === corner);
    }
    stateLabel.textContent = (ui.idle.startsWith("Idle") ? "State: " : "الحالة: ") + machine.state;
    bubbleYes.textContent = ui.confirm;
    bubbleNo.textContent = ui.deny;
    bubbles.apply(bubble, bubbleText);
    if (settingsUi.visible) settingsUi.sync(settings.current, auditLines);
  };

  const speak = (kind: "speech" | "thought" | "alert", text: string, ms?: number) => {
    if (!text) return;
    const lang = settings.current.language === "en" ? "en" : "ar";
    bubbles.show({
      kind,
      text,
      dir: lang === "en" ? "ltr" : "rtl",
      lang,
      ms,
    });
    paint();
  };

  const matrix = new EisenhowerPanel(matrixHost, {
    onMove(id, quad) {
      void run({ type: "MOVE_EIS_ITEM", id, quad });
    },
    onTrash(id) {
      void run({ type: "TRASH_EIS_ITEM", id });
    },
    onUndo() {
      if (lastUndo) void run({ type: "UNDO_TRASH", id: lastUndo.id, prevQuad: lastUndo.prevQuad });
    },
    onClose() {
      void run({ type: "CLOSE_MATRIX" });
    },
  });

  settingsUi = new SettingsPanel(
    settingsHost,
    {
      onPatch(patch) {
        void run({ type: "PATCH_SETTINGS", patch });
      },
      onPermission(id, mode) {
        void run({ type: "SET_PERMISSION", capabilityId: id, mode });
      },
      onRefreshAudit() {
        void refreshAudit();
      },
      onClose() {
        closeOverlays();
      },
    },
    ui,
  );

  async function refreshAudit() {
    auditLines = await api.getAudit(40);
    if (settingsUi.visible) settingsUi.sync(settings.current, auditLines);
  }

  async function openSettings() {
    closeOverlays();
    idle.pause();
    settingsUi.setCopy(localeCopy(settings.current.language));
    await refreshAudit();
    settingsUi.show(settings.current, auditLines);
  }

  async function run(action: WizardAction) {
    const result = await dispatch(action, ports, machine);
    idle.animationLevel = settings.current.animationLevel;
    idle.sleepAfterMs = settings.current.idleSleepMs;
    if (result.ok && "eisDoc" in result && result.eisDoc) {
      matrix.setDoc(result.eisDoc);
      if (action.type === "OPEN_MATRIX") {
        idle.pause();
        matrix.show(result.eisDoc);
      }
    }
    if (result.ok && "undo" in result && result.undo) {
      lastUndo = { id: result.undo.id, prevQuad: result.undo.prevQuad as EisQuad };
      matrix.setUndo(lastUndo);
    }
    if (action.type === "UNDO_TRASH" && result.ok) {
      lastUndo = null;
      matrix.setUndo(null);
    }
    if (action.type === "CLOSE_MATRIX") {
      matrix.hide();
      lastUndo = null;
      idle.resume(Date.now());
    }
    if (!result.ok && result.needsConfirm) {
      pendingAsk = result.action;
      bubbleConfirm.hidden = false;
      speak(result.bubble?.kind || "alert", result.bubble?.text || ui.needsConfirm, 0);
    } else {
      pendingAsk = null;
      bubbleConfirm.hidden = true;
      if (result.bubble?.text) speak(result.bubble.kind, result.bubble.text);
    }
    if (isTransientState(machine.state)) {
      window.clearTimeout(idleReturnTimer);
      const back = result.ok && "returnTo" in result && result.returnTo === "MATRIX" ? "MATRIX" : "IDLE";
      idleReturnTimer = window.setTimeout(() => {
        if (!isTransientState(machine.state)) return;
        if (back === "MATRIX" && matrix.visible) machine.enter("MATRIX", {
          displayName: settings.current.displayName,
          scale: settings.current.window.scale,
          nowMs: Date.now(),
          animationLevel: settings.current.animationLevel,
        });
        else if (back !== "MATRIX") void run({ type: "IDLE" });
        paint();
      }, 1200);
    }
    paint();
    if (action.type === "PING_HEALTH") {
      if (result.ok && "health" in result && result.health?.aqhub) {
        hubStatus.textContent = `${ui.hubUp} · ${result.health.version}`;
        hubStatus.className = "hub up";
      } else {
        hubStatus.textContent = ui.hubDown;
        hubStatus.className = "hub down";
      }
    }
    return result;
  }

  const closeOverlays = () => {
    composer.hidden = true;
    ctx.hidden = true;
    settingsUi.hide();
    if (!matrix.visible) idle.resume(Date.now());
  };

  const openComposer = (mode: "task" | "note" | "reminder") => {
    closeOverlays();
    idle.pause();
    composer.hidden = false;
    const radios = composer.querySelectorAll<HTMLInputElement>('input[name="mode"]');
    radios.forEach((r) => {
      r.checked = r.value === mode;
    });
    composerDue.hidden = mode !== "reminder";
    composerTitle.focus();
  };

  if (!isTauri) {
    document.body.classList.add("browser-preview");
    chrome.hidden = false;
  }

  await run({ type: "LOAD_SETTINGS" });
  idle.sleepAfterMs = settings.current.idleSleepMs;
  idle.animationLevel = settings.current.animationLevel;
  idle.nudge(Date.now());
  if (!settings.current.displayName) {
    await run({ type: "RENAME_DISPLAY", displayName: pack.defaultDisplayName });
  }
  await run({ type: "PING_HEALTH" });
  paint();

  nameBtn.addEventListener("dblclick", async () => {
    const next = window.prompt(ui.displayNameLabel, settings.current.displayName);
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
    if (act === "SLEEP") await run({ type: "SLEEP" });
    if (act === "THINK") await run({ type: "THINK" });
    if (act === "ALERT") await run({ type: "ALERT", text: "تنبيه تجريبي" });
    if (act === "MATRIX") await run({ type: "OPEN_MATRIX" });
    if (act === "SETTINGS") await openSettings();
    if (act === "OPEN_AQHUB") await run({ type: "OPEN_AQHUB" });
  });

  character.addEventListener("pointermove", (ev) => {
    idle.nudge(Date.now());
    if (!settings.current.followPointer) {
      look.x = 0;
      look.y = 0;
      paint();
      return;
    }
    const r = character.getBoundingClientRect();
    look.x = ((ev.clientX - r.left) / r.width - 0.5) * 6;
    look.y = ((ev.clientY - r.top) / r.height - 0.5) * 4;
    if (machine.state === "IDLE" || machine.state === "SLEEPING") void run({ type: "WATCH" });
    else paint();
  });
  character.addEventListener("pointerleave", () => {
    look.x = 0;
    look.y = 0;
    if (machine.state === "WATCHING" && !matrix.visible) void run({ type: "IDLE" });
  });
  character.addEventListener("click", (ev) => {
    ev.preventDefault();
    idle.nudge(Date.now());
    openComposer("task");
  });
  character.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
    idle.pause();
    ctx.hidden = false;
    ctx.style.left = `${Math.min(ev.clientX, window.innerWidth - 200)}px`;
    ctx.style.top = `${Math.min(ev.clientY, window.innerHeight - 240)}px`;
  });

  ctx.addEventListener("click", async (ev) => {
    const btn = (ev.target as HTMLElement).closest("button[data-ctx]");
    if (!btn) return;
    const key = btn.getAttribute("data-ctx");
    closeOverlays();
    if (key === "NEW_TASK") openComposer("task");
    if (key === "QUICK_NOTE") openComposer("note");
    if (key === "MATRIX") await run({ type: "OPEN_MATRIX" });
    if (key === "OPEN_AQHUB") await run({ type: "OPEN_AQHUB" });
    if (key === "ASK") speak("thought", ui.askLater);
    if (key === "SETTINGS") await openSettings();
    if (key === "HIDE") await run({ type: "HIDE" });
    if (key === "EXIT") await run({ type: "EXIT" });
  });

  composer.addEventListener("change", () => {
    const mode = (composer.querySelector('input[name="mode"]:checked') as HTMLInputElement | null)?.value;
    composerDue.hidden = mode !== "reminder";
  });
  composer.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const mode = (composer.querySelector('input[name="mode"]:checked') as HTMLInputElement | null)?.value || "task";
    const title = composerTitle.value.trim();
    const body = composerBody.value.trim();
    closeOverlays();
    if (title === "/matrix" || body === "/matrix" || title.startsWith("/matrix")) {
      await run({ type: "OPEN_MATRIX" });
    } else if (mode === "task") await run({ type: "CREATE_TASK", title: title || body, notes: body });
    else if (mode === "note") await run({ type: "CREATE_NOTE", note: body || title });
    else if (mode === "reminder") {
      const due = composerDue.value ? new Date(composerDue.value).toISOString() : "";
      await run({ type: "SET_REMINDER", text: title || body, dueAt: due });
    }
    composerTitle.value = "";
    composerBody.value = "";
  });
  el("composerCancel").addEventListener("click", closeOverlays);

  bubbleYes.addEventListener("click", () => {
    if (pendingAsk) void run({ type: "CONFIRM", pending: pendingAsk });
  });
  bubbleNo.addEventListener("click", () => {
    if (pendingAsk) void run({ type: "DENY", pending: pendingAsk });
  });

  document.addEventListener("pointerdown", (ev) => {
    idle.nudge(Date.now());
    const t = ev.target as Node;
    if (!ctx.contains(t) && !ctx.hidden && t !== character) ctx.hidden = true;
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
      idle.nudge(Date.now());
      if (machine.state !== "DRAGGING") void run({ type: "DRAG_START" });
      window.clearTimeout(moveTimer);
      moveTimer = window.setTimeout(() => {
        void run({ type: "SET_POSITION", x: pos.payload.x, y: pos.payload.y });
        void run({ type: "DRAG_END" });
      }, 400);
    });
  }

  window.setInterval(() => {
    const now = Date.now();
    machine.update(
      {
        displayName: settings.current.displayName,
        scale: settings.current.window.scale,
        nowMs: now,
        animationLevel: settings.current.animationLevel,
        lookX: look.x,
        lookY: look.y,
      },
      250,
    );
    if (idle.shouldSleep(now, machine.state)) void run({ type: "SLEEP" });
    const gap =
      settings.current.proactiveBubbles === "high"
        ? 20_000
        : settings.current.proactiveBubbles === "low"
          ? 180_000
          : settings.current.proactiveBubbles === "off"
            ? 0
            : 60_000;
    if (
      gap > 0 &&
      now - lastProactive >= gap &&
      machine.state === "IDLE" &&
      composer.hidden &&
      !settingsUi.visible &&
      !matrix.visible
    ) {
      lastProactive = now;
      speak(
        "thought",
        settings.current.language === "en" ? "Ready for a task or the matrix." : "جاهز لتاسك جديد أو أيزنهاور.",
      );
    }
    bubbles.tick(now);
    paint();
  }, 250);

  window.setInterval(() => {
    const now = Date.now();
    let changed = false;
    const next = settings.current.reminders.map((r) => {
      if (!r.fired && r.dueAt && new Date(r.dueAt).getTime() <= now) {
        changed = true;
        void run({ type: "ALERT", text: r.text || "تذكير" });
        return { ...r, fired: true };
      }
      return r;
    });
    if (changed) void settings.save({ reminders: next });
  }, 1000);
}

void main();
