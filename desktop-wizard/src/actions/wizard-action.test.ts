import assert from "node:assert/strict";
import test from "node:test";
import { isWizardActionType } from "./wizard-action.ts";
import { dispatch, type WizardPorts } from "../engines/action-engine.ts";
import { WizardStateMachine } from "../state/wizard-state-machine.ts";
import { defaultSettings } from "../api/aqhub-client.ts";
import type { BoardDoc } from "../api/tasks.ts";
import type { EisDoc } from "../api/eisenhower.ts";
import type { MailItem, MailStatus, MailSyncResult } from "../api/mail.ts";

function mockPorts() {
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
    chats: [] as { taskId: string; text: string }[],
    opens: [] as { entryId?: string; query?: string }[],
    syncs: 0,
    approveSends: 0,
    mailStatus: { outlook: true, aqhub: true, reason: "", lastSyncAt: "" } as MailStatus,
    syncResult: {
      ok: true,
      outlook: true,
      added: 1,
      scanned: 2,
      unreadTotal: 1,
      items: [] as MailItem[],
    } as MailSyncResult,
    openResult: { ok: true, method: "outlook" } as { ok: boolean; error?: string; method?: string },
    chatResult: { ok: true, suggestedReply: "شكرا لتواصلك — مسودة" } as { ok: boolean; suggestedReply?: string; error?: string },
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
      getMailStatus: async () => store.mailStatus,
      postMailSync: async () => {
        store.syncs += 1;
        return store.syncResult;
      },
      postOpen: async (body) => {
        store.opens.push({ entryId: body.entryId, query: body.query });
        return store.openResult;
      },
      postTaskChat: async (taskId, text) => {
        store.chats.push({ taskId, text });
        return store.chatResult;
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
      openAqHubPath: async () => {},
      exit: async () => {},
      setPosition: async () => {},
      getPlacement: async () => ({
        x: 40,
        y: 40,
        width: 380,
        height: 560,
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      }),
      setMatrixLayout: async (open) => {
        store.matrixOpen = open;
      },
      setSettingsLayout: async () => {},
      setAlwaysOnTop: async () => {},
    },
  };
  return { ports, store };
}

test("action type guard", () => {
  assert.equal(isWizardActionType("SHOW"), true);
  assert.equal(isWizardActionType("CREATE_TASK"), true);
  assert.equal(isWizardActionType("MAIL_POLL"), true);
  assert.equal(isWizardActionType("MAIL_DRAFT"), true);
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
      patch: { language: "en", opacity: 0.7, closeAction: "exit", proactiveBubbles: "low", roamEnabled: false },
    },
    ports,
    sm,
  );
  assert.equal(store.settings.language, "en");
  assert.equal(store.settings.opacity, 0.7);
  assert.equal(store.settings.closeAction, "exit");
  assert.equal(store.settings.roamEnabled, false);
  assert.equal(store.docs.length, 1);
});

test("SET_PERMISSION cannot Allow outlook.send", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  await dispatch({ type: "SET_PERMISSION", capabilityId: "outlook.send", mode: "allow" }, ports, sm);
  assert.equal(store.settings.permissions["outlook.send"], "ask");
});

const EMAIL_TASK = {
  id: "T-009",
  title: "عقد موجان",
  source: "email",
  entryId: "eid-1",
  fromEmail: "ops@aqaar.com",
  notes: "نحتاج رد",
  createdAt: "2026-09-22T08:00:00Z",
};

async function allowOutlook(ports: WizardPorts) {
  const sm = new WizardStateMachine();
  await dispatch({ type: "SET_PERMISSION", capabilityId: "outlook.read", mode: "allow" }, ports, sm);
  await dispatch({ type: "SET_PERMISSION", capabilityId: "outlook.draft", mode: "allow" }, ports, sm);
  return sm;
}

test("MAIL_POLL default Ask does not hit mail APIs", async () => {
  const { ports, store } = mockPorts();
  store.docs.push({ version: 1, title: "Aqaar Command", tasks: [EMAIL_TASK] });
  const sm = new WizardStateMachine();
  const asked = await dispatch({ type: "MAIL_POLL", prompt: true }, ports, sm);
  assert.equal(asked.ok, false);
  if (!asked.ok) {
    assert.equal(asked.needsConfirm, true);
    assert.equal(asked.error, "needs_confirm");
  }
  assert.equal(store.syncs, 0);
  assert.equal(store.chats.length, 0);
});

test("MAIL_POLL Allow shows newest email task and bubble actions", async () => {
  const { ports, store } = mockPorts();
  store.docs.push({
    version: 1,
    title: "Aqaar Command",
    tasks: [{ id: "T-001", title: "يدوي", source: "wizard" }, EMAIL_TASK],
  });
  const sm = await allowOutlook(ports);
  const result = await dispatch({ type: "MAIL_POLL", prompt: true }, ports, sm);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.mail?.taskId, "T-009");
    assert.deepEqual(result.bubbleActions, ["open", "task", "remind", "ignore", "draft"]);
    assert.match(result.bubble?.text || "", /عقد موجان/);
  }
  assert.equal(sm.state, "ALERT");
  assert.ok(store.audits >= 1);
});

test("MAIL_POLL silent skip when no item; prompt shows unavailable thought without ERROR", async () => {
  const { ports, store } = mockPorts();
  store.mailStatus = { outlook: false, aqhub: true, reason: "outlook_not_running", lastSyncAt: "" };
  const sm = await allowOutlook(ports);
  const silent = await dispatch({ type: "MAIL_POLL" }, ports, sm);
  assert.equal(silent.ok, true);
  if (silent.ok) assert.equal(silent.mail, undefined);
  assert.notEqual(sm.state, "ERROR");
  const prompted = await dispatch({ type: "MAIL_POLL", prompt: true }, ports, sm);
  assert.equal(prompted.ok, false);
  if (!prompted.ok) {
    assert.equal(prompted.error, "outlook_unavailable");
    assert.equal(prompted.bubble?.kind, "thought");
  }
  assert.notEqual(sm.state, "ERROR");
});

test("MAIL_SYNC unavailable is a thought bubble — no crash, no approve-send", async () => {
  const { ports, store } = mockPorts();
  store.syncResult = {
    ok: false,
    outlook: false,
    added: 0,
    scanned: 0,
    unreadTotal: 0,
    items: [],
    error: "outlook_not_running",
  };
  const sm = await allowOutlook(ports);
  const result = await dispatch({ type: "MAIL_SYNC" }, ports, sm);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.mailStatus?.outlook, false);
    assert.equal(result.bubble?.kind, "thought");
  }
  assert.equal(store.syncs, 1);
  assert.equal(store.chats.length, 0);
  assert.equal(store.approveSends, 0);
  assert.notEqual(sm.state, "ERROR");
  assert.ok(store.settings.mailLastSyncAt);
});

test("MAIL_OPEN uses POST /api/open", async () => {
  const { ports, store } = mockPorts();
  const sm = await allowOutlook(ports);
  const result = await dispatch({ type: "MAIL_OPEN", taskId: "T-009", entryId: "eid-1", query: "عقد" }, ports, sm);
  assert.equal(result.ok, true);
  assert.equal(store.opens[0]?.entryId, "eid-1");
});

test("MAIL_CREATE_TASK reuses the existing email board task", async () => {
  const { ports, store } = mockPorts();
  store.docs.push({ version: 1, title: "Aqaar Command", tasks: [EMAIL_TASK] });
  const sm = await allowOutlook(ports);
  const result = await dispatch(
    { type: "MAIL_CREATE_TASK", title: "عقد موجان", taskId: "T-009", entryId: "eid-1", fromEmail: "ops@aqaar.com" },
    ports,
    sm,
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.taskId, "T-009");
  assert.equal(store.docs.length, 2);
});

test("MAIL_IGNORE persists in wizard-settings, not tasks.json", async () => {
  const { ports, store } = mockPorts();
  store.docs.push({ version: 1, title: "Aqaar Command", tasks: [EMAIL_TASK] });
  const sm = await allowOutlook(ports);
  const ignored = await dispatch({ type: "MAIL_IGNORE", taskId: "T-009", entryId: "eid-1" }, ports, sm);
  assert.equal(ignored.ok, true);
  assert.ok(store.settings.mailIgnored.includes("T-009"));
  assert.equal(store.docs.at(-1)?.tasks?.[0].id, "T-009");
  const polled = await dispatch({ type: "MAIL_POLL", prompt: true }, ports, sm);
  assert.equal(polled.ok, true);
  if (polled.ok) assert.equal(polled.mail, undefined);
});

test("MAIL_REMIND writes wizard-settings reminders", async () => {
  const { ports, store } = mockPorts();
  const sm = await allowOutlook(ports);
  const result = await dispatch({ type: "MAIL_REMIND", text: "عقد موجان", taskId: "T-009" }, ports, sm);
  assert.equal(result.ok, true);
  assert.equal(store.settings.reminders.length, 1);
  assert.equal(store.settings.reminders[0].text, "عقد موجان");
  assert.equal(store.docs.length, 1);
});

test("MAIL_DRAFT posts /api/task/chat draft and never approve-send", async () => {
  const { ports, store } = mockPorts();
  const sm = await allowOutlook(ports);
  const asked = await dispatch({ type: "MAIL_DRAFT", taskId: "T-009" }, ports, sm);
  assert.equal(asked.ok, true);
  assert.equal(store.chats.length, 1);
  assert.equal(store.chats[0].text, "draft");
  assert.equal(store.approveSends, 0);
  if (asked.ok) assert.match(asked.bubble?.text || "", /مسودة|Draft|ما انرسلت|not sent/i);
});

test("MAIL_DRAFT default Ask waits; Never blocks HTTP", async () => {
  const { ports, store } = mockPorts();
  const sm = new WizardStateMachine();
  const asked = await dispatch({ type: "MAIL_DRAFT", taskId: "T-009" }, ports, sm);
  assert.equal(asked.ok, false);
  if (!asked.ok) assert.equal(asked.needsConfirm, true);
  assert.equal(store.chats.length, 0);
  await dispatch({ type: "SET_PERMISSION", capabilityId: "outlook.draft", mode: "never" }, ports, sm);
  const blocked = await dispatch({ type: "MAIL_DRAFT", taskId: "T-009" }, ports, sm);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.error, "permission_denied");
  assert.equal(store.chats.length, 0);
});
