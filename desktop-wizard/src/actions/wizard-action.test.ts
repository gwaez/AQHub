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
      postAudit: async () => {
        store.audits += 1;
      },
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

test("TRASH_EIS_ITEM is soft-delete with undo, not purge", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  const trashed = await dispatch({ type: "TRASH_EIS_ITEM", id: "E-2" }, ports, sm);
  assert.equal(trashed.ok, true);
  assert.equal(store.eis.at(-1)?.items?.find((i) => i.id === "E-2")?.quad, "trash");
  assert.equal(store.eis.at(-1)?.items?.length, 2);
  if (trashed.ok) assert.equal(trashed.undo?.prevQuad, "do");
  await dispatch({ type: "UNDO_TRASH", id: "E-2", prevQuad: "do" }, ports, sm);
  assert.equal(store.eis.at(-1)?.items?.find((i) => i.id === "E-2")?.quad, "do");
});
