import type { WizardAction, WizardActionResult } from "../actions/wizard-action.ts";
import { createTaskViaHub, type AqHubApi } from "../api/aqhub-client.ts";
import { flavourBubble, flavourForQuad, isEisQuad, moveEisItem, type EisQuad } from "../api/eisenhower.ts";
import { mailAlertText, mailUnavailableText, pickRecentMail } from "../api/mail.ts";
import { WizardSettingsStore } from "../settings/wizard-settings.ts";
import {
  WizardStateMachine,
  stateFromVisible,
  type StateContext,
  type WizardStateId,
} from "../state/wizard-state-machine.ts";
import { confirmLabel, decidePermission } from "../ui/permissions.ts";
import { stripSecrets } from "../api/audit.ts";

export interface WindowPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  workArea: { x: number; y: number; width: number; height: number };
}

export interface CharacterWindowPort {
  show(): Promise<void>;
  hide(): Promise<void>;
  openAqHub(): Promise<void>;
  exit(): Promise<void>;
  setPosition(x: number, y: number): Promise<void>;
  getPlacement(): Promise<WindowPlacement>;
  setMatrixLayout(open: boolean): Promise<void>;
  setAlwaysOnTop(on: boolean): Promise<void>;
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
    extra: stripSecrets(extra) as Record<string, unknown>,
  });
}

function fail(action: WizardAction, error: string, machine: WizardStateMachine, ports: WizardPorts): WizardActionResult {
  if (machine.state !== "HIDDEN") machine.enter("ERROR", ctx(ports));
  return { ok: false, action, error, bubble: { kind: "alert", text: error } };
}

/**
 * Action Engine — validate → permission (Allow / Ask / Never) → HTTP → audit → SUCCESS/ERROR.
 * Animations subscribe to the state machine after this returns.
 */
export async function dispatch(
  action: WizardAction,
  ports: WizardPorts,
  machine: WizardStateMachine,
  opts: { confirmed?: boolean } = {},
): Promise<WizardActionResult> {
  const settings = ports.settings ?? new WizardSettingsStore(ports.api);
  ports.settings = settings;
  const c = () => ctx(ports);
  const lang = settings.current.language === "en" ? "en" : "ar";

  if (action.type === "CONFIRM") {
    if (action.pending.type === "CONFIRM" || action.pending.type === "DENY") {
      return fail(action, "bad_confirm", machine, ports);
    }
    await audit(ports, action, { pending: action.pending.type, decided: "confirm" });
    return dispatch(action.pending, ports, machine, { confirmed: true });
  }
  if (action.type === "DENY") {
    await audit(ports, action, { pending: action.pending.type, decided: "deny" });
    return {
      ok: false,
      action,
      error: "permission_denied",
      bubble: { kind: "alert", text: lang === "en" ? "Denied" : "مرفوض" },
    };
  }

  const decision = decidePermission(action.type, settings.current.permissions, opts.confirmed === true);
  if (decision === "never") {
    await audit(ports, action, { decision: "never" });
    return fail(action, "permission_denied", machine, ports);
  }
  if (decision === "ask") {
    await audit(ports, action, { decision: "ask" });
    return {
      ok: false,
      action,
      error: "needs_confirm",
      needsConfirm: true,
      bubble: { kind: "alert", text: confirmLabel(action, lang) },
    };
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
        await ports.window.setAlwaysOnTop(loaded.alwaysOnTop);
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
      case "PATCH_SETTINGS": {
        const saved = await settings.save(action.patch);
        if (action.patch.alwaysOnTop !== undefined) {
          await ports.window.setAlwaysOnTop(saved.alwaysOnTop);
        }
        machine.update(c(), 0);
        await audit(ports, action, { keys: Object.keys(action.patch) });
        return { ok: true, action };
      }
      case "SET_PERMISSION": {
        const next = {
          ...settings.current.permissions,
          [action.capabilityId]: action.mode,
        };
        await settings.save({ permissions: next });
        await audit(ports, action, { capabilityId: action.capabilityId, mode: action.mode });
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
        await audit(ports, action, { decision: "send_not_from_wizard" });
        return fail(action, "send_not_from_wizard", machine, ports);
      }
      case "DELETE_EXTERNAL": {
        await audit(ports, action, { decision: "stub_no_delete", target: action.target || "" });
        machine.enter("SUCCESS", c());
        return {
          ok: true,
          action,
          bubble: {
            kind: "thought",
            text: lang === "en" ? "External delete is not enabled" : "الحذف الخارجي غير مفعّل",
          },
        };
      }
      case "MAIL_POLL": {
        try {
          const status = await ports.api.getMailStatus();
          const doc = await ports.api.getTasksDoc();
          const item = pickRecentMail(doc.tasks, settings.current.mailIgnored);
          const mailStatus = { ...status, lastSyncAt: settings.current.mailLastSyncAt || status.lastSyncAt };
          await audit(ports, action, {
            taskId: item?.taskId || "",
            outlook: status.outlook,
            prompt: Boolean(action.prompt),
          });
          if (item) {
            if (machine.state !== "HIDDEN") machine.enter("ALERT", c());
            return {
              ok: true,
              action,
              mail: item,
              mailStatus,
              bubbleActions: ["open", "task", "remind", "ignore", "draft"],
              bubble: { kind: "alert", text: mailAlertText(item, lang) },
            };
          }
          if (!action.prompt) return { ok: true, action, mailStatus };
          if (!status.outlook) {
            return {
              ok: false,
              action,
              error: "outlook_unavailable",
              mailStatus,
              bubble: { kind: "thought", text: mailUnavailableText(lang) },
            };
          }
          return {
            ok: true,
            action,
            mailStatus,
            bubble: {
              kind: "thought",
              text: lang === "en" ? "No recent mail on the board" : "ما في بريد حديث على اللوحة",
            },
          };
        } catch {
          await audit(ports, action, { error: "outlook_unavailable" });
          return {
            ok: false,
            action,
            error: "outlook_unavailable",
            mailStatus: {
              outlook: false,
              aqhub: false,
              reason: "unavailable",
              lastSyncAt: settings.current.mailLastSyncAt,
            },
            bubble: { kind: "thought", text: mailUnavailableText(lang) },
          };
        }
      }
      case "MAIL_SYNC": {
        const synced = await ports.api.postMailSync();
        await settings.save({ mailLastSyncAt: new Date().toISOString() });
        await audit(ports, action, { added: synced.added, outlook: synced.outlook, error: synced.error || "" });
        if (!synced.ok || synced.outlook === false) {
          return {
            ok: false,
            action,
            error: synced.error || "outlook_unavailable",
            mailStatus: {
              outlook: false,
              aqhub: true,
              reason: synced.error || "unavailable",
              lastSyncAt: settings.current.mailLastSyncAt,
              added: synced.added,
              unreadTotal: synced.unreadTotal,
            },
            bubble: { kind: "thought", text: mailUnavailableText(lang) },
          };
        }
        const doc = await ports.api.getTasksDoc();
        const item = synced.items[0] || pickRecentMail(doc.tasks, settings.current.mailIgnored);
        if (machine.state !== "HIDDEN") machine.enter(item ? "ALERT" : "SUCCESS", c());
        return {
          ok: true,
          action,
          mail: item || undefined,
          mailStatus: {
            outlook: true,
            aqhub: true,
            reason: "",
            lastSyncAt: settings.current.mailLastSyncAt,
            added: synced.added,
            unreadTotal: synced.unreadTotal,
          },
          bubbleActions: item ? ["open", "task", "remind", "ignore", "draft"] : undefined,
          bubble: item
            ? { kind: "alert", text: mailAlertText(item, lang) }
            : { kind: "speech", text: lang === "en" ? "No new mail tasks" : "ما في بريد جديد على اللوحة" },
        };
      }
      case "MAIL_OPEN": {
        const opened = await ports.api.postOpen({
          entryId: action.entryId || "",
          query: action.query || "",
        });
        await audit(ports, action, { taskId: action.taskId || "", ok: opened.ok, method: opened.method || "" });
        if (!opened.ok) {
          return {
            ok: false,
            action,
            error: opened.error || "open_failed",
            bubble: {
              kind: "thought",
              text: lang === "en" ? "Could not open Outlook — use AQHub instead." : "تعذر فتح Outlook — افتح AQHub.",
            },
          };
        }
        if (machine.state !== "HIDDEN") machine.enter("SUCCESS", c());
        return { ok: true, action, bubble: { kind: "speech", text: lang === "en" ? "Opened in Outlook" : "اتفتح في Outlook" } };
      }
      case "MAIL_CREATE_TASK": {
        const title = action.title.trim();
        if (!title) return fail(action, "title_required", machine, ports);
        const doc = await ports.api.getTasksDoc();
        const existing = (doc.tasks || []).find((t) => String(t.id) === (action.taskId || ""));
        if (existing?.id) {
          await audit(ports, action, { taskId: String(existing.id), reused: true });
          machine.enter("SUCCESS", c());
          return {
            ok: true,
            action,
            taskId: String(existing.id),
            bubble: { kind: "speech", text: lang === "en" ? `Already on the board as ${existing.id}` : `موجود على اللوحة ${existing.id}` },
          };
        }
        machine.enter("WORKING", c());
        const created = await createTaskViaHub(ports.api, title, action.notes || "", {
          source: "email",
          sourceRef: action.fromEmail || "AQWizard mail",
          entryId: action.entryId || "",
          fromEmail: action.fromEmail || "",
          tags: ["wizard", "email"],
        });
        await audit(ports, action, { taskId: created.id });
        machine.enter("SUCCESS", c());
        return {
          ok: true,
          action,
          taskId: created.id,
          bubble: { kind: "speech", text: lang === "en" ? `Task ${created.id} saved` : `اتسجل التاسك ${created.id}` },
        };
      }
      case "MAIL_REMIND": {
        const text = action.text.trim();
        if (!text) return fail(action, "text_required", machine, ports);
        const dueAt = action.dueAt || new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const id = "R-" + Date.now().toString(36);
        const reminders = [...settings.current.reminders, { id, text, dueAt, fired: false }];
        await settings.save({ reminders });
        await audit(ports, action, { id, taskId: action.taskId || "" });
        machine.enter("SUCCESS", c());
        return { ok: true, action, bubble: { kind: "speech", text: lang === "en" ? "Reminder saved" : "التذكير اتسجل" } };
      }
      case "MAIL_IGNORE": {
        const extra = [action.taskId, action.entryId].filter(Boolean) as string[];
        const mailIgnored = [...new Set([...settings.current.mailIgnored, ...extra])].slice(-200);
        await settings.save({ mailIgnored });
        await audit(ports, action, { taskId: action.taskId || "" });
        if (machine.state !== "HIDDEN") machine.enter("IDLE", c());
        return { ok: true, action, bubble: { kind: "thought", text: lang === "en" ? "Ignored" : "تم التجاهل" } };
      }
      case "MAIL_DRAFT": {
        const chat = await ports.api.postTaskChat(action.taskId, "draft");
        await audit(ports, action, { taskId: action.taskId, ok: chat.ok });
        if (!chat.ok) {
          return {
            ok: false,
            action,
            error: chat.error || "draft_failed",
            bubble: {
              kind: "thought",
              text: lang === "en" ? "Draft unavailable — open the task in AQHub." : "المسودة غير متاحة — افتح المهمة في AQHub.",
            },
          };
        }
        const preview = (chat.suggestedReply || "").trim().slice(0, 180);
        if (machine.state !== "HIDDEN") machine.enter("SUCCESS", c());
        return {
          ok: true,
          action,
          bubble: {
            kind: "speech",
            text: preview
              ? (lang === "en" ? "Draft ready (not sent): " : "المسودة جاهزة (ما انرسلت): ") + preview
              : lang === "en"
                ? "Draft prepared in AQHub — not sent."
                : "اتحضّرت المسودة في AQHub — بدون إرسال.",
          },
        };
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
