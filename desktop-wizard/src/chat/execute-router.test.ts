import assert from "node:assert/strict";
import test from "node:test";
import { routeExecute } from "./execute-router.ts";

test("execute maps show/hide/eisenhower/task in Arabic and English", () => {
  assert.deepEqual(routeExecute("إظهار"), { kind: "action", action: { type: "SHOW" } });
  assert.deepEqual(routeExecute("اظهر"), { kind: "action", action: { type: "SHOW" } });
  assert.deepEqual(routeExecute("show"), { kind: "action", action: { type: "SHOW" } });
  assert.deepEqual(routeExecute("إخفاء"), { kind: "action", action: { type: "HIDE" } });
  assert.deepEqual(routeExecute("hide to tray"), { kind: "action", action: { type: "HIDE" } });
  assert.deepEqual(routeExecute("أيزنهاور"), { kind: "action", action: { type: "OPEN_EISENHOWER" } });
  assert.deepEqual(routeExecute("افتح Eisenhower"), { kind: "action", action: { type: "OPEN_EISENHOWER" } });
  assert.deepEqual(routeExecute("/matrix"), { kind: "action", action: { type: "OPEN_EISENHOWER" } });
  assert.deepEqual(routeExecute("فتح AQHub"), { kind: "action", action: { type: "OPEN_AQHUB" } });
  assert.equal(routeExecute("إعدادات").kind, "open_settings");
  assert.equal(routeExecute("open settings").kind, "open_settings");
  const task = routeExecute("تاسك: عقد موجان");
  assert.deepEqual(task, { kind: "action", action: { type: "CREATE_TASK", title: "عقد موجان" } });
  assert.deepEqual(routeExecute("task: follow up"), {
    kind: "action",
    action: { type: "CREATE_TASK", title: "follow up" },
  });
});

test("execute never routes send-email or CRM tokens", () => {
  assert.deepEqual(routeExecute("أرسل البريد"), { kind: "blocked", reason: "send" });
  assert.deepEqual(routeExecute("approve-send"), { kind: "blocked", reason: "send" });
  assert.deepEqual(routeExecute("send email now"), { kind: "blocked", reason: "send" });
  assert.deepEqual(routeExecute("crm token"), { kind: "blocked", reason: "crm" });
  assert.deepEqual(routeExecute("accessToken"), { kind: "blocked", reason: "crm" });
});

test("unknown execute returns a hint, not an action", () => {
  const u = routeExecute("حذف كل شيء");
  assert.equal(u.kind, "unknown");
  if (u.kind === "unknown") {
    assert.match(u.hintAr, /أيزنهاور/);
    assert.match(u.hintEn, /Eisenhower/);
  }
});
