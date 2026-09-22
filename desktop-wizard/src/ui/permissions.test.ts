import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPABILITIES,
  allowAction,
  coerceMode,
  decidePermission,
  defaultPermissionMap,
  normalizePermissionMap,
} from "./permissions.ts";

test("capability catalog has the brief defaults", () => {
  const map = defaultPermissionMap();
  assert.equal(map["character.window"], "allow");
  assert.equal(map["aqhub.open"], "allow");
  assert.equal(map["settings.local"], "allow");
  assert.equal(map["board.create_task"], "allow");
  assert.equal(map["board.create_note"], "allow");
  assert.equal(map["board.reminder"], "allow");
  assert.equal(map["eisenhower.move"], "allow");
  assert.equal(map["eisenhower.trash"], "ask");
  assert.equal(map["outlook.read"], "ask");
  assert.equal(map["outlook.draft"], "ask");
  assert.equal(map["outlook.send"], "never");
  assert.equal(map["delete.external"], "never");
  assert.equal(map["uia.magic_wand"], "never");
  assert.equal(map["crm.tokens"], "never");
  assert.ok(CAPABILITIES.every((c) => c.modes.includes(c.defaultMode)));
});

test("Allow passes, Never blocks, Ask waits", () => {
  const perms = defaultPermissionMap();
  assert.equal(decidePermission("CREATE_TASK", perms), "allow");
  assert.equal(decidePermission("TRASH_EIS_ITEM", perms), "ask");
  assert.equal(decidePermission("TRASH_EIS_ITEM", perms, true), "allow");
  assert.equal(decidePermission("MAIL_POLL", perms), "ask");
  assert.equal(decidePermission("MAIL_DRAFT", perms), "ask");
  assert.equal(decidePermission("MAIL_POLL", perms, true), "allow");
  assert.equal(decidePermission("APPROVE_SEND", perms), "never");
  assert.equal(allowAction("SHOW", perms), true);
  assert.equal(allowAction("APPROVE_SEND", perms), false);
});

test("Outlook Send / Delete External cannot be Allow", () => {
  const outlook = CAPABILITIES.find((c) => c.id === "outlook.send");
  const del = CAPABILITIES.find((c) => c.id === "delete.external");
  assert.ok(outlook && del);
  assert.equal(coerceMode(outlook, "allow"), "ask");
  assert.equal(coerceMode(del, "allow"), "ask");
  const map = normalizePermissionMap({ "outlook.send": "allow", "delete.external": "allow" });
  assert.equal(map["outlook.send"], "ask");
  assert.equal(map["delete.external"], "ask");
});

test("UIA and CRM stay Never", () => {
  const map = normalizePermissionMap({ "uia.magic_wand": "allow", "crm.tokens": "ask" });
  assert.equal(map["uia.magic_wand"], "never");
  assert.equal(map["crm.tokens"], "never");
});

test("settings.local cannot leave Allow", () => {
  const map = normalizePermissionMap({ "settings.local": "never" });
  assert.equal(map["settings.local"], "allow");
});
