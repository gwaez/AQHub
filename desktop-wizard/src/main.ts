import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { createAqHubClient } from "./api/aqhub-client.ts";
import { WizardSettingsStore, type WizardSettings } from "./settings/wizard-settings.ts";
import { dispatch, type CharacterWindowPort } from "./engines/action-engine.ts";
import { WizardStateMachine, isTransientState } from "./state/wizard-state-machine.ts";
import { applyAnimation } from "./engines/animation-engine.ts";
import { IdleDirector } from "./engines/idle-director.ts";
import { RoamEngine } from "./engines/roam-engine.ts";
import { BubbleEngine } from "./engines/bubble-engine.ts";
import { applyCharacterVisual, loadCharacterPack } from "./ui/character.ts";
import { EisenhowerPanel } from "./ui/eisenhower-panel.ts";
import { SettingsPanel } from "./ui/settings-panel.ts";
import { measureAndPlaceMenu } from "./ui/place-menu.ts";
import { applyDocumentLocale, localeCopy } from "./i18n/index.ts";
import { firstRunBubbleText, shouldMarkFirstRunQuiet, shouldShowFirstRun } from "./settings/first-run.ts";
import type { WizardAction } from "./actions/wizard-action.ts";
import type { EisQuad } from "./api/eisenhower.ts";
import type { AuditLine } from "./api/audit.ts";
import type { MailItem, MailStatus } from "./api/mail.ts";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error("missing #" + id);
  return node as T;
}

function fallbackWorkArea(): { x: number; y: number; width: number; height: number } {
  const s = window.screen as Screen & { availLeft?: number; availTop?: number };
  return {
    x: s.availLeft || 0,
    y: s.availTop || 0,
    width: s.availWidth || window.innerWidth || 1280,
    height: s.availHeight || window.innerHeight || 720,
  };
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
    async openAqHubPath(path: string) {
      const p = path.startsWith("/") ? path : `/${path}`;
      window.open(`http://127.0.0.1:8766${p}`, "_blank");
    },
    async exit() {
      /* browser preview has no process to exit */
    },
    async setPosition(x: number, y: number) {
      const stage = el("stage");
      stage.classList.add("is-roaming");
      stage.style.left = `${Math.round(x)}px`;
      stage.style.top = `${Math.round(y)}px`;
    },
    async getPlacement() {
      const hit = document.getElementById("petHit") || el("character");
      const host = el("stage");
      const roaming = host.classList.contains("is-roaming");
      const origin = (roaming ? host : hit).getBoundingClientRect();
      const size = hit.getBoundingClientRect();
      return {
        x: Math.round(origin.left),
        y: Math.round(origin.top),
        width: Math.max(160, Math.round(size.width) || 200),
        height: Math.max(220, Math.round(size.height) || 280),
        workArea: {
          x: 8,
          y: 88,
          width: Math.max(280, window.innerWidth - 16),
          height: Math.max(300, window.innerHeight - 96),
        },
      };
    },
    async setMatrixLayout(open: boolean) {
      document.body.classList.toggle("matrix-open", open);
    },
    async setSettingsLayout(open: boolean) {
      document.body.classList.toggle("settings-open", open);
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
    async openAqHubPath(path: string) {
      await invoke("open_aqhub_path", { path });
    },
    async exit() {
      await invoke("exit_app");
    },
    async setPosition(x: number, y: number) {
      await invoke("set_character_position", { x, y });
    },
    async getPlacement() {
      const win = getCurrentWindow();
      const pos = await win.outerPosition();
      const size = await win.outerSize();
      const mon = await currentMonitor();
      const work = mon?.workArea;
      return {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
        workArea: work
          ? {
              x: work.position.x,
              y: work.position.y,
              width: work.size.width,
              height: work.size.height,
            }
          : fallbackWorkArea(),
      };
    },
    async setMatrixLayout(open: boolean) {
      document.body.classList.toggle("matrix-open", open);
      await invoke("set_matrix_layout", { open });
    },
    async setSettingsLayout(open: boolean) {
      document.body.classList.toggle("settings-open", open);
      await invoke("set_settings_layout", { open });
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
  const bubbleMail = el("bubbleMail");
  const stage = el("stage");

  let pack = await loadCharacterPack();
  try {
    await applyCharacterVisual(character, pack, "IDLE");
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
  const roam = new RoamEngine();
  let lastRoamPos: { x: number; y: number } | null = null;
  let roamQuietUntil = 0;
  let roamTickBusy = false;
  const look = { x: 0, y: 0 };
  let idleReturnTimer = 0;
  let lastUndo: { id: string; prevQuad: EisQuad } | null = null;
  let pendingAsk: WizardAction | null = null;
  let pendingMail: MailItem | null = null;
  let lastMailStatus: MailStatus | null = null;
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
    void applyCharacterVisual(character, pack, machine.state);
    nameBtn.textContent = settings.current.displayName;
    techId.textContent = `${settings.current.technicalId} · ${settings.current.characterId}`;
    const s = Math.round((settings.current.window.scale || 1) * 100);
    scale.value = String(s);
    character.style.setProperty("--char-scale", String(settings.current.window.scale || 1));
    character.style.opacity = String((Number(character.style.opacity) || 1) * settings.current.opacity);
    bubble.style.transform = `scale(${settings.current.bubbleScale})`;
    bubble.style.fontSize = `${settings.current.bubbleFontSize}px`;
    for (const corner of ["bottom-end", "bottom-start", "top-end", "top-start"] as const) {
      stage.classList.toggle("corner-" + corner, settings.current.preferredCorner === corner);
    }
    stateLabel.textContent = (ui.idle.startsWith("Idle") ? "State: " : "الحالة: ") + machine.state;
    bubbleYes.textContent = ui.confirm;
    bubbleNo.textContent = ui.deny;
    const mailLabels: Record<string, string> = {
      open: ui.mailOpen,
      task: ui.mailTask,
      remind: ui.mailRemind,
      ignore: ui.mailIgnore,
      draft: ui.mailDraft,
    };
    bubbleMail.querySelectorAll("[data-mail]").forEach((btn) => {
      const key = btn.getAttribute("data-mail") || "";
      if (mailLabels[key]) btn.textContent = mailLabels[key];
    });
    bubbles.apply(bubble, bubbleText);
    const mailVisible = Boolean(pendingMail && bubbles.current?.visible && !pendingAsk);
    bubbleMail.hidden = !mailVisible;
    if (settingsUi.visible) settingsUi.sync(settings.current, auditLines, lastMailStatus);
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
      onMailSync() {
        void run({ type: "MAIL_SYNC" });
      },
      onJumpPermissions() {
        /* SettingsPanel already switches to the permissions tab */
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
    try {
      lastMailStatus = await api.getMailStatus();
    } catch {
      lastMailStatus = { outlook: false, aqhub: false, reason: "unavailable", lastSyncAt: settings.current.mailLastSyncAt };
    }
    settingsUi.show(settings.current, auditLines, lastMailStatus);
    await ports.window.setSettingsLayout(true);
  }

  async function openAqHubEisenhower() {
    await ports.window.openAqHubPath("/eisenhower.html");
  }

  async function run(action: WizardAction) {
    const result = await dispatch(action, ports, machine);
    idle.animationLevel = settings.current.animationLevel;
    idle.sleepAfterMs = settings.current.idleSleepMs;
    if (result.ok && "eisDoc" in result && result.eisDoc) {
      matrix.setDoc(result.eisDoc);
      if (action.type === "OPEN_MATRIX") {
        settingsUi.hide();
        document.body.classList.remove("settings-open");
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
    if (result.mailStatus) lastMailStatus = result.mailStatus;
    if (result.ok && "mail" in result && result.mail) {
      pendingMail = result.mail;
    } else if (
      action.type === "MAIL_IGNORE" ||
      action.type === "MAIL_OPEN" ||
      action.type === "MAIL_CREATE_TASK" ||
      action.type === "MAIL_REMIND" ||
      action.type === "MAIL_DRAFT"
    ) {
      pendingMail = null;
    }
    if (!result.ok && result.needsConfirm) {
      pendingAsk = result.action;
      bubbleConfirm.hidden = false;
      bubbleMail.hidden = true;
      speak(result.bubble?.kind || "alert", result.bubble?.text || ui.needsConfirm, 0);
    } else {
      pendingAsk = null;
      bubbleConfirm.hidden = true;
      const stay = Boolean(result.ok && "bubbleActions" in result && result.bubbleActions?.length);
      if (result.bubble?.text) speak(result.bubble.kind, result.bubble.text, stay ? 0 : undefined);
    }
    if (action.type === "PATCH_SETTINGS" && action.patch.characterId && settings.current.characterId !== pack.id) {
      pack = await loadCharacterPack(settings.current.characterId);
      character.dataset.asset = "";
      try {
        await applyCharacterVisual(character, pack, machine.state);
      } catch {
        character.innerHTML = "<p class='hint'>missing pack</p>";
      }
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
    const settingsWereOpen = settingsUi.visible;
    composer.hidden = true;
    ctx.hidden = true;
    settingsUi.hide();
    if (settingsWereOpen) {
      if (matrix.visible) {
        document.body.classList.remove("settings-open");
        void ports.window.setMatrixLayout(true);
      } else {
        void ports.window.setSettingsLayout(false);
      }
    }
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
  if (settings.current.characterId !== pack.id) {
    pack = await loadCharacterPack(settings.current.characterId);
    try {
      await applyCharacterVisual(character, pack, machine.state);
    } catch {
      character.innerHTML = "<p class='hint'>missing pack</p>";
    }
  }
  const loadedSnapshot = {
    firstRunComplete: settings.current.firstRunComplete,
    updatedAt: settings.current.updatedAt,
  };
  idle.sleepAfterMs = settings.current.idleSleepMs;
  idle.animationLevel = settings.current.animationLevel;
  idle.nudge(Date.now());
  if (settings.current.window.x != null && settings.current.window.y != null) {
    lastRoamPos = { x: settings.current.window.x, y: settings.current.window.y };
  }
  if (!settings.current.displayName) {
    await run({ type: "RENAME_DISPLAY", displayName: pack.defaultDisplayName });
  }
  if (shouldShowFirstRun({ ...settings.current, ...loadedSnapshot })) {
    ui = localeCopy(settings.current.language);
    speak("speech", firstRunBubbleText(settings.current, ui), 12_000);
    await run({ type: "PATCH_SETTINGS", patch: { firstRunComplete: true } });
  } else if (shouldMarkFirstRunQuiet({ ...settings.current, ...loadedSnapshot })) {
    await run({ type: "PATCH_SETTINGS", patch: { firstRunComplete: true } });
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
    if (act === "MATRIX") await openAqHubEisenhower();
    if (act === "MAIL") await run({ type: "MAIL_POLL", prompt: true });
    if (act === "SETTINGS") await openSettings();
    if (act === "OPEN_AQHUB") await run({ type: "OPEN_AQHUB" });
  });

  const petHit = el("petHit");
  let skipCharacterClick = false;
  petHit.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    if ((ev.target as HTMLElement).closest("button, input, textarea, select, a")) return;
    idle.nudge(Date.now());
    roam.noteDrag(Date.now());
    if (machine.state !== "DRAGGING") void run({ type: "DRAG_START" });
    if (isTauri) {
      skipCharacterClick = true;
      void getCurrentWindow().startDragging();
      return;
    }
    const origin = lastRoamPos ?? {
      x: Math.round(petHit.getBoundingClientRect().left),
      y: Math.round(petHit.getBoundingClientRect().top),
    };
    const sx = ev.clientX;
    const sy = ev.clientY;
    const onMove = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - sx, e.clientY - sy) >= 4) skipCharacterClick = true;
      const next = { x: Math.round(origin.x + (e.clientX - sx)), y: Math.round(origin.y + (e.clientY - sy)) };
      lastRoamPos = next;
      void ports.window.setPosition(next.x, next.y);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (lastRoamPos && skipCharacterClick) {
        void run({ type: "SET_POSITION", x: lastRoamPos.x, y: lastRoamPos.y });
        void run({ type: "DRAG_END" });
      } else if (machine.state === "DRAGGING") {
        void run({ type: "DRAG_END" });
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
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
    if (skipCharacterClick) {
      skipCharacterClick = false;
      return;
    }
    ev.preventDefault();
    idle.nudge(Date.now());
    openComposer("task");
  });
  character.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
    idle.pause();
    ctx.hidden = false;
    measureAndPlaceMenu(ctx, ev.clientX, ev.clientY, window.innerWidth, window.innerHeight, 320);
  });

  ctx.addEventListener("click", async (ev) => {
    const btn = (ev.target as HTMLElement).closest("button[data-ctx]");
    if (!btn) return;
    const key = btn.getAttribute("data-ctx");
    closeOverlays();
    if (key === "NEW_TASK") openComposer("task");
    if (key === "QUICK_NOTE") openComposer("note");
    if (key === "MATRIX") await openAqHubEisenhower();
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
      await openAqHubEisenhower();
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
  bubbleMail.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest("[data-mail]");
    if (!btn || !pendingMail) return;
    const act = btn.getAttribute("data-mail");
    const m = pendingMail;
    if (act === "open") void run({ type: "MAIL_OPEN", taskId: m.taskId, entryId: m.entryId, query: m.title });
    if (act === "task") {
      void run({
        type: "MAIL_CREATE_TASK",
        title: m.title,
        notes: m.preview,
        taskId: m.taskId,
        entryId: m.entryId,
        fromEmail: m.fromEmail,
      });
    }
    if (act === "remind") void run({ type: "MAIL_REMIND", text: m.title, taskId: m.taskId });
    if (act === "draft") void run({ type: "MAIL_DRAFT", taskId: m.taskId });
    if (act === "ignore") void run({ type: "MAIL_IGNORE", taskId: m.taskId, entryId: m.entryId });
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
    try {
      await win.setIgnoreCursorEvents(false);
    } catch {
      /* older WebView2 builds still hit-test the character pixels */
    }
    let moveTimer: number | undefined;
    await win.onMoved(async (pos) => {
      if (Date.now() < roamQuietUntil) return;
      idle.nudge(Date.now());
      roam.noteDrag(Date.now());
      lastRoamPos = { x: pos.payload.x, y: pos.payload.y };
      if (machine.state !== "DRAGGING") void run({ type: "DRAG_START" });
      window.clearTimeout(moveTimer);
      moveTimer = window.setTimeout(() => {
        void run({ type: "SET_POSITION", x: pos.payload.x, y: pos.payload.y });
        void run({ type: "DRAG_END" });
      }, 400);
    });
  }

  async function tickRoam(now: number) {
    if (roamTickBusy) return;
    roamTickBusy = true;
    try {
      const place = await ports.window.getPlacement();
      const pos = lastRoamPos ?? { x: place.x, y: place.y };
      const overlays = !composer.hidden || settingsUi.visible || matrix.visible || !ctx.hidden;
      const result = roam.tick({
        nowMs: now,
        state: machine.state,
        animationLevel: settings.current.animationLevel,
        roamEnabled: settings.current.roamEnabled,
        position: pos,
        windowSize: { width: place.width, height: place.height },
        workArea: place.workArea,
        forcePause: overlays || idle.isPaused,
      });
      if (!result.move) return;
      lastRoamPos = { x: result.x, y: result.y };
      roamQuietUntil = Date.now() + 220;
      await ports.window.setPosition(result.x, result.y);
      if (result.persist) {
        await settings.save({ window: { ...settings.current.window, x: result.x, y: result.y } });
      }
    } catch {
      /* roam is best-effort; never block the character loop */
    } finally {
      roamTickBusy = false;
    }
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
    void tickRoam(now);
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

  window.setInterval(() => {
    if (settings.current.permissions["outlook.read"] !== "allow") return;
    if (!composer.hidden || settingsUi.visible || matrix.visible || pendingAsk) return;
    if (pendingMail && bubbles.current?.visible) return;
    void run({ type: "MAIL_POLL" });
  }, 45_000);
}

void main();
