import assert from "node:assert/strict";
import test from "node:test";
import { isIgnoredMail, pickRecentMail, taskToMailItem } from "./mail.ts";

const email = {
  id: "T-009",
  title: "عقد موجان",
  source: "email",
  entryId: "eid-1",
  fromEmail: "ops@aqaar.com",
  createdAt: "2026-09-22T08:00:00Z",
};
const older = {
  id: "T-008",
  title: "نشرة",
  source: "email",
  entryId: "eid-0",
  createdAt: "2026-09-21T08:00:00Z",
};
const wizard = { id: "T-001", title: "يدوي", source: "wizard" };

test("taskToMailItem keeps email tasks and skips wizard tasks", () => {
  assert.equal(taskToMailItem(wizard), null);
  const item = taskToMailItem(email);
  assert.equal(item?.taskId, "T-009");
  assert.equal(item?.entryId, "eid-1");
});

test("pickRecentMail returns newest non-ignored email task", () => {
  const picked = pickRecentMail([wizard, older, email], []);
  assert.equal(picked?.taskId, "T-009");
  assert.equal(pickRecentMail([email], ["T-009"]) , null);
  assert.equal(isIgnoredMail(picked!, ["eid-1"]), true);
});

test("slim mail/sync items (id,title,entryId,fromEmail) still map", () => {
  const slim = { id: "T-240", title: "Hello", entryId: "eid-9", fromEmail: "a@b.com" };
  const item = taskToMailItem(slim);
  assert.equal(item?.taskId, "T-240");
  assert.equal(item?.title, "Hello");
  assert.equal(item?.entryId, "eid-9");
  assert.equal(item?.fromEmail, "a@b.com");
});
