import type { WizardAction, WizardActionResult } from "../actions/wizard-action.ts";
import { createTaskViaHub, type AqHubApi } from "../api/aqhub-client.ts";
import { flavourBubble, flavourForQuad, isEisQuad, moveEisItem, type EisQuad } from "../api/eisenhower.ts";
import { WizardSettingsStore } from "../settings/wizard-settings.ts";
import {
  WizardStateMachine,
  stateFromVisible,
  type StateContext,
  type WizardStateId,
} from "../state/wizard-state-machine.ts";
import { allowAction } from "../ui/permissions.ts";

export interface CharacterWindowPort {
  show(): Promise<void>;
  hide(): Promise<void>;
  openAqHub(): Promise<void>;
  exit(): Promise<void>;
  setPosition(x: number, y: number): Promise<void>;
  setMatrixLayout(open: boolean): Promise<void>;
}

export interface WizardPorts {
  api: AqHubApi;
  window: CharacterWindowPort;
  settings?: WizardSettingsStore;
}

function ctx(ports: WizardPorts): StateContext {
  const s = ports.settings?.current;
  return {
    displayName: s?.displayName || "",
    scale: s?.window.scale ?? 1,
    nowMs: Date.now(),
    animationLevel: s?.animationLevel || "normal",
  };
}

async function audit(ports: WizardPorts, action: WizardAction, extra: Record<string, unknown> = {}) {
  await ports.api.postAudit({
    at: new Date().toISOString(),
    actor: "AQWizard",
    action: "wizard." + action.type.toLowerCase(),
    extra,
  });
}

function fail(action: WizardAction, error: string, machine: WizardStateMachine, ports: WizardPorts): WizardActionResult {
  if (machine.state !== "HIDDEN") machine.enter("ERROR", ctx(ports));
  return { ok: false, action, error, bubble: { kind: "alert", text: error } };
}

/**
 * Action Engine — validate → permission stub → HTTP → audit stub → SUCCESS/ERROR.
 * Animations subscribe to the state machine after this returns.
 */
export async function dispatch(
  action: WizardAction,
  ports: WizardPorts,
  machine: WizardStateMachine,
): Promise<WizardActionResult> {
  const settings = ports.settings ?? new WizardSettingsStore(ports.api);
  ports.settings = settings;
  const c = () => ctx(ports);

  if (!allowAction(action.type)) {
    return fail(action, "permission_denied", machine, ports);
  }

  try {
    switch (action.type) {
      case "SHOW": {
        await ports.window.show();
        await settings.save({ visible: true });
        machine.enter("IDLE", c());
        return { ok: true, action };
      }
      case "HIDE": {
        await ports.window.hide();
        await settings.save({ visible: false });
        machine.enter("HIDDEN", c());
        return { ok: true, action };
      }
      case "OPEN_AQHUB": {
        await ports.window.openAqHub();
        await audit(ports, action);
        return { ok: true, action, bubble: { kind: "speech", text: "فتحت AQHub" } };
      }
      case "EXIT": {
        await ports.window.exit();
        return { ok: true, action };
      }
      case "RENAME_DISPLAY": {
        const name = action.displayName.trim();
        if (!name) return fail(action, "displayName_required", machine, ports);
        await settings.save({ displayName: name });
        machine.update(c(), 0);
        return { ok: true, action };
      }
      case "SET_SCALE": {
        await settings.save({ window: { ...settings.current.window, scale: action.scale } });
        machine.update(c(), 0);
        return { ok: true, action };
      }
      case "SET_POSITION": {
        await ports.window.setPosition(action.x, action.y);
        await settings.save({ window: { ...settings.current.window, x: action.x, y: action.y } });
        return { ok: true, action };
      }
      case "PING_HEALTH": {
        const health = await ports.api.health();
        return { ok: true, action, health };
      }
      case "LOAD_SETTINGS": {
        const loaded = await settings.load();
        machine.enter(stateFromVisible(loaded.visible), c());
        if (loaded.visible) await ports.window.show();
        else await ports.window.hide();
        if (loaded.window.x != null && loaded.window.y != null) {
          await ports.window.setPosition(loaded.window.x, loaded.window.y);
        }
        return { ok: true, action };
      }
      case "WATCH": {
        if (machine.state !== "HIDDEN") machine.enter("WATCHING", c());
        return { ok: true, action };
      }
      case "IDLE": {
        if (machine.state !== "HIDDEN") machine.enter("IDLE", c());
        return { ok: true, action };
      }
      case "SLEEP": {
        if (machine.state !== "HIDDEN") machine.enter("SLEEPING", c());
        return { ok: true, action };
      }
      case "THINK": {
        if (machine.state !== "HIDDEN") machine.enter("THINKING", c());
        return { ok: true, action };
      }
      case "SPEAK": {
        if (machine.state !== "HIDDEN") machine.enter("SPEAKING", c());
        return { ok: true, action, bubble: { kind: "speech", text: action.text || "" } };
      }
      case "ALERT": {
        if (machine.state !== "HIDDEN") machine.enter("ALERT", c());
        return { ok: true, action, bubble: { kind: "alert", text: action.text } };
      }
      case "DRAG_START": {
        if (machine.state !== "HIDDEN") machine.enter("DRAGGING", c());
        return { ok: true, action };
      }
      case "DRAG_END": {
        if (machine.state === "DRAGGING") machine.enter("IDLE", c());
        return { ok: true, action };
      }
      case "SET_ANIMATION_LEVEL": {
        await settings.save({ animationLevel: action.level });
        machine.update(c(), 0);
        return { ok: true, action };
      }
      case "SET_SLEEP_MS": {
        await settings.save({ idleSleepMs: action.ms });
        return { ok: true, action };
      }
      case "CREATE_TASK": {
        const title = action.title.trim();
        if (!title) return fail(action, "title_required", machine, ports);
        machine.enter("WORKING", c());
        const created = await createTaskViaHub(ports.api, title, action.notes || "");
        await audit(ports, action, { taskId: created.id });
        machine.enter("SUCCESS", c());
        return {
          ok: true,
          action,
          taskId: created.id,
          bubble: { kind: "speech", text: `اتسجل التاسك ${created.id}` },
        };
      }
      case "CREATE_NOTE": {
        const note = action.note.trim();
        if (!note) return fail(action, "note_required", machine, ports);
        machine.enter("WORKING", c());
        let taskId = action.taskId?.trim() || "";
        if (!taskId) {
          const title = note.split(/\n/)[0].slice(0, 80) || "ملاحظة الساحر";
          const created = await createTaskViaHub(ports.api, title, note);
          taskId = created.id;
        }
        await ports.api.postBoxNote(taskId, note);
        await audit(ports, action, { taskId });
        machine.enter("SUCCESS", c());
        return {
          ok: true,
          action,
          taskId,
          bubble: { kind: "thought", text: `اتحفظت الملاحظة على ${taskId}` },
        };
      }
      case "SET_REMINDER": {
        const text = action.text.trim();
        if (!text) return fail(action, "text_required", machine, ports);
        if (!action.dueAt) return fail(action, "dueAt_required", machine, ports);
        const id = "R-" + Date.now().toString(36);
        const reminders = [...settings.current.reminders, { id, text, dueAt: action.dueAt, fired: false }];
        await settings.save({ reminders });
        await audit(ports, action, { id });
        machine.enter("SUCCESS", c());
        return { ok: true, action, bubble: { kind: "speech", text: "التذكير اتسجل" } };
      }
      case "OPEN_MATRIX": {
        machine.enter("WORKING", c());
        const eisDoc = await ports.api.getEisDoc();
        await ports.window.setMatrixLayout(true);
        await audit(ports, action, { count: eisDoc.items?.length || 0 });
        machine.enter("MATRIX", c());
        return { ok: true, action, eisDoc, returnTo: "MATRIX" };
      }
      case "CLOSE_MATRIX": {
        await ports.window.setMatrixLayout(false);
        if (machine.state !== "HIDDEN") machine.enter("IDLE", c());
        return { ok: true, action, returnTo: "IDLE" };
      }
      case "MOVE_EIS_ITEM": {
        if (!action.id.trim()) return fail(action, "id_required", machine, ports);
        if (!isEisQuad(action.quad)) return fail(action, "bad_quad", machine, ports);
        machine.enter("WORKING", c());
        const current = await ports.api.getEisDoc();
        const moved = moveEisItem(current, action.id, action.quad);
        await ports.api.putEisDoc(moved.next);
        await audit(ports, action, { id: action.id, quad: action.quad, flavour: flavourForQuad(action.quad) });
        machine.enter("SUCCESS", c());
        return {
          ok: true,
          action,
          eisDoc: moved.next,
          flavour: flavourForQuad(action.quad),
          bubble: { kind: "speech", text: flavourBubble(action.quad, String(moved.item.title || "")) },
          returnTo: "MATRIX",
        };
      }
      case "TRASH_EIS_ITEM": {
        if (!action.id.trim()) return fail(action, "id_required", machine, ports);
        machine.enter("WORKING", c());
        const current = await ports.api.getEisDoc();
        const moved = moveEisItem(current, action.id, "trash");
        await ports.api.putEisDoc(moved.next);
        await audit(ports, action, { id: action.id, prevQuad: moved.prevQuad });
        machine.enter("TRASH", c());
        return {
          ok: true,
          action,
          eisDoc: moved.next,
          flavour: "TRASH",
          undo: { id: action.id, prevQuad: moved.prevQuad },
          bubble: { kind: "alert", text: flavourBubble("trash", String(moved.item.title || "")) + " — تراجع؟" },
          returnTo: "MATRIX",
        };
      }
      case "UNDO_TRASH": {
        const quad: EisQuad = isEisQuad(action.prevQuad) ? action.prevQuad : "inbox";
        machine.enter("WORKING", c());
        const current = await ports.api.getEisDoc();
        const moved = moveEisItem(current, action.id, quad === "trash" ? "inbox" : quad);
        await ports.api.putEisDoc(moved.next);
        await audit(ports, action, { id: action.id, quad: moved.item.quad });
        machine.enter("SUCCESS", c());
        return {
          ok: true,
          action,
          eisDoc: moved.next,
          bubble: { kind: "speech", text: "تم التراجع" },
          returnTo: "MATRIX",
        };
      }
      case "ENTER_STUB": {
        machine.enter(action.state as WizardStateId, c());
        return { ok: true, action, bubble: { kind: "thought", text: `${action.state} لاحقًا` } };
      }
      case "APPROVE_SEND": {
        return fail(action, "permission_denied", machine, ports);
      }
      default: {
        const _never: never = action;
        return fail(_never, "unknown_action", machine, ports);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (machine.state !== "HIDDEN") machine.enter("ERROR", c());
    return { ok: false, action, error: message, bubble: { kind: "alert", text: message } };
  }
}
