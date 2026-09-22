import assert from "node:assert/strict";
import test from "node:test";
import { isWizardActionType } from "./wizard-action.ts";
import { dispatch, type WizardPorts } from "../engines/action-engine.ts";
import { WizardStateMachine } from "../state/wizard-state-machine.ts";
import { defaultSettings, type WizardSettings } from "../api/aqhub-client.ts";
import type { BoardDoc } from "../api/tasks.ts";
import type { EisDoc } from "../api/eisenhower.ts";

function mockPorts(): {
  ports: WizardPorts;
  store: {
    settings: WizardSettings;
    hidden: boolean;
    opened: boolean;
    docs: BoardDoc[];
    notes: { taskId: string; note: string }[];
    audits: number;
    eis: EisDoc[];
    matrixOpen: boolean;
  };
} {
  const store = {
    settings: defaultSettings(),
    hidden: false,
    opened: false,
    docs: [{ version: 1, title: "Aqaar Command", tasks: [{ id: "T-001", title: "existing" }] }] as BoardDoc[],
    notes: [] as { taskId: string; note: string }[],
    audits: 0,
    auditLines: [] as Record<string, unknown>[],
    eis: [
      {
        items: [
          { id: "E-1", title: "عقد موجان", quad: "inbox", entryId: "keep-me" },
          { id: "E-2", title: "تقرير", quad: "do" },
        ],
      },
    ] as EisDoc[],
    matrixOpen: false,
  };
  const ports: WizardPorts = {
    api: {
      health: async () => ({ ok: true, aqhub: true, version: "0.2.0-p2" }),
      getSettings: async () => store.settings,
      putSettings: async (s) => {
        store.settings = { ...s, updatedAt: "now" };
        return store.settings;
      },
      getTasksDoc: async () => store.docs[store.docs.length - 1],
      putTasksDoc: async (doc) => {
        store.docs.push(doc);
      },
      postBoxNote: async (taskId, note) => {
        store.notes.push({ taskId, note });
      },
      postAudit: async (entry) => {
        store.audits += 1;
        store.auditLines.push(entry);
      },
      getAudit: async () => [],
      getEisDoc: async () => store.eis[store.eis.length - 1],
      putEisDoc: async (doc) => {
        store.eis.push(doc);
      },
    },
    window: {
      show: async () => {
        store.hidden = false;
      },
      hide: async () => {
        store.hidden = true;
      },
      openAqHub: async () => {
        store.opened = true;
      },
      exit: async () => {},
      setPosition: async () => {},
      setMatrixLayout: async (open) => {
        store.matrixOpen = open;
      },
      setAlwaysOnTop: async () => {},
    },
  };
  return { ports, store };
}

test("action type guard", () => {
  assert.equal(isWizardActionType("SHOW"), true);
  assert.equal(isWizardActionType("CREATE_TASK"), true);
  assert.equal(isWizardActionType("approve-send"), false);
});

test("SHOW/HIDE go through engine then state machine — not animation", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  await dispatch({ type: "HIDE" }, ports, sm);
  assert.equal(sm.state, "HIDDEN");
  assert.equal(store.hidden, true);
  await dispatch({ type: "SHOW" }, ports, sm);
  assert.equal(sm.state, "IDLE");
});

test("CREATE_TASK with empty title does not POST", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  const result = await dispatch({ type: "CREATE_TASK", title: "   " }, ports, sm);
  assert.equal(result.ok, false);
  assert.equal(store.docs.length, 1);
  assert.equal(sm.state, "ERROR");
});

test("CREATE_TASK uses GET+POST /api/tasks and does not empty the board", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  const result = await dispatch({ type: "CREATE_TASK", title: "من الساحر" }, ports, sm);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.taskId, "T-002");
  const last = store.docs.at(-1);
  assert.equal(last?.tasks?.[0].id, "T-002");
  assert.equal(last?.tasks?.[1].id, "T-001");
  assert.equal(sm.state, "SUCCESS");
  assert.ok(store.audits >= 1);
});

test("CREATE_NOTE hits box-note after creating a task", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  const result = await dispatch({ type: "CREATE_NOTE", note: "نوت الصندوق" }, ports, sm);
  assert.equal(result.ok, true);
  assert.equal(store.notes[0].note, "نوت الصندوق");
  assert.equal(store.notes[0].taskId, "T-002");
});

test("APPROVE_SEND is denied — no auto-send", async () => {
  const { ports } = mockPorts();
  const sm = new WizardStateMachine();
  const result = await dispatch({ type: "APPROVE_SEND", taskId: "T-001" }, ports, sm);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "permission_denied");
});

test("SET_REMINDER persists on settings, not tasks.json", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  const due = new Date(Date.now() + 60_000).toISOString();
  await dispatch({ type: "SET_REMINDER", text: "راجع العقد", dueAt: due }, ports, sm);
  assert.equal(store.settings.reminders.length, 1);
  assert.equal(store.settings.reminders[0].text, "راجع العقد");
});

test("stub WAND enters without HTTP", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  await dispatch({ type: "ENTER_STUB", state: "WAND" }, ports, sm);
  assert.equal(sm.state, "WAND");
  assert.equal(sm.lastEnterWasStub(), true);
  assert.equal(store.docs.length, 1);
});

test("OPEN_MATRIX loads GET /api/eisenhower and enters MATRIX", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  const result = await dispatch({ type: "OPEN_MATRIX" }, ports, sm);
  assert.equal(result.ok, true);
  assert.equal(sm.state, "MATRIX");
  assert.equal(store.matrixOpen, true);
  if (result.ok) assert.equal(result.eisDoc?.items?.[0].id, "E-1");
});

test("MOVE_EIS_ITEM GET-merge-POST keeps other items and linkage", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  const result = await dispatch({ type: "MOVE_EIS_ITEM", id: "E-1", quad: "do" }, ports, sm);
  assert.equal(result.ok, true);
  const last = store.eis.at(-1);
  assert.equal(last?.items?.[0].quad, "do");
  assert.equal(last?.items?.[0].entryId, "keep-me");
  assert.equal(last?.items?.[1].id, "E-2");
  if (result.ok) {
    assert.equal(result.flavour, "DO");
    assert.equal(result.returnTo, "MATRIX");
  }
});

test("TRASH_EIS_ITEM defaults to Ask then confirm executes soft-delete", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  const asked = await dispatch({ type: "TRASH_EIS_ITEM", id: "E-2" }, ports, sm);
  assert.equal(asked.ok, false);
  if (!asked.ok) {
    assert.equal(asked.error, "needs_confirm");
    assert.equal(asked.needsConfirm, true);
  }
  assert.equal(store.eis.length, 1);
  const trashed = await dispatch({ type: "CONFIRM", pending: { type: "TRASH_EIS_ITEM", id: "E-2" } }, ports, sm);
  assert.equal(trashed.ok, true);
  assert.equal(store.eis.at(-1)?.items?.find((i) => i.id === "E-2")?.quad, "trash");
  assert.equal(store.eis.at(-1)?.items?.length, 2);
  if (trashed.ok) assert.equal(trashed.undo?.prevQuad, "do");
  await dispatch({ type: "UNDO_TRASH", id: "E-2", prevQuad: "do" }, ports, sm);
  assert.equal(store.eis.at(-1)?.items?.find((i) => i.id === "E-2")?.quad, "do");
});

test("Never CREATE_TASK blocks HTTP", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  await dispatch({ type: "SET_PERMISSION", capabilityId: "board.create_task", mode: "never" }, ports, sm);
  const result = await dispatch({ type: "CREATE_TASK", title: "ممنوع" }, ports, sm);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "permission_denied");
  assert.equal(store.docs.length, 1);
});

test("Ask CREATE_TASK then CONFIRM posts once", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  await dispatch({ type: "SET_PERMISSION", capabilityId: "board.create_task", mode: "ask" }, ports, sm);
  const asked = await dispatch({ type: "CREATE_TASK", title: "بعد التأكيد" }, ports, sm);
  assert.equal(asked.ok, false);
  assert.equal(store.docs.length, 1);
  const done = await dispatch({ type: "CONFIRM", pending: { type: "CREATE_TASK", title: "بعد التأكيد" } }, ports, sm);
  assert.equal(done.ok, true);
  assert.equal(store.docs.length, 2);
});

test("DENY leaves the board unchanged", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  await dispatch({ type: "SET_PERMISSION", capabilityId: "board.create_task", mode: "ask" }, ports, sm);
  await dispatch({ type: "CREATE_TASK", title: "لا" }, ports, sm);
  const denied = await dispatch({ type: "DENY", pending: { type: "CREATE_TASK", title: "لا" } }, ports, sm);
  assert.equal(denied.ok, false);
  assert.equal(store.docs.length, 1);
});

test("APPROVE_SEND stays denied even after confirm — no auto-send", async () => {
  const { ports } = mockPorts();
  const sm = new WizardStateMachine();
  await dispatch({ type: "SET_PERMISSION", capabilityId: "outlook.send", mode: "ask" }, ports, sm);
  const asked = await dispatch({ type: "APPROVE_SEND", taskId: "T-001" }, ports, sm);
  assert.equal(asked.ok, false);
  if (!asked.ok) assert.equal(asked.needsConfirm, true);
  const confirmed = await dispatch({ type: "CONFIRM", pending: { type: "APPROVE_SEND", taskId: "T-001" } }, ports, sm);
  assert.equal(confirmed.ok, false);
  if (!confirmed.ok) assert.equal(confirmed.error, "send_not_from_wizard");
});

test("DELETE_EXTERNAL Never blocks; Ask+confirm is a no-op stub", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  const blocked = await dispatch({ type: "DELETE_EXTERNAL", target: "mail" }, ports, sm);
  assert.equal(blocked.ok, false);
  await dispatch({ type: "SET_PERMISSION", capabilityId: "delete.external", mode: "ask" }, ports, sm);
  const asked = await dispatch({ type: "DELETE_EXTERNAL", target: "mail" }, ports, sm);
  assert.equal(asked.ok, false);
  const done = await dispatch({ type: "CONFIRM", pending: { type: "DELETE_EXTERNAL", target: "mail" } }, ports, sm);
  assert.equal(done.ok, true);
  assert.equal(store.docs.length, 1);
});

test("PATCH_SETTINGS persists P9 fields on wizard settings, not tasks", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  await dispatch(
    {
      type: "PATCH_SETTINGS",
      patch: { language: "en", opacity: 0.7, closeAction: "exit", proactiveBubbles: "low" },
    },
    ports,
    sm,
  );
  assert.equal(store.settings.language, "en");
  assert.equal(store.settings.opacity, 0.7);
  assert.equal(store.settings.closeAction, "exit");
  assert.equal(store.docs.length, 1);
});

test("SET_PERMISSION cannot Allow outlook.send", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  await dispatch({ type: "SET_PERMISSION", capabilityId: "outlook.send", mode: "allow" }, ports, sm);
  assert.equal(store.settings.permissions["outlook.send"], "ask");
});
