import assert from "node:assert/strict";
import test from "node:test";
import { flavourBubble, flavourForQuad, isEisQuad, moveEisItem, type EisDoc } from "./eisenhower.ts";

const doc: EisDoc = {
  items: [
    { id: "E-1", title: "عقد", quad: "inbox", entryId: "keep-me" },
    { id: "E-2", title: "تقرير", quad: "do" },
  ],
  extra: true,
};

test("moveEisItem changes one quad and keeps other items + extra fields", () => {
  const { next, prevQuad, item } = moveEisItem(doc, "E-1", "sched");
  assert.equal(prevQuad, "inbox");
  assert.equal(item.quad, "sched");
  assert.equal(next.items?.[0].quad, "sched");
  assert.equal(next.items?.[0].entryId, "keep-me");
  assert.equal(next.items?.[1].id, "E-2");
  assert.equal((next as { extra?: boolean }).extra, true);
});

test("moveEisItem never drops the list on missing id", () => {
  assert.throws(() => moveEisItem(doc, "nope", "do"), /item_not_found/);
});

test("flavours match Eisenhower verbs", () => {
  assert.equal(flavourForQuad("do"), "DO");
  assert.equal(flavourForQuad("sched"), "SCHEDULE");
  assert.equal(flavourForQuad("deleg"), "DELEGATE");
  assert.equal(flavourForQuad("elim"), "ELIMINATE");
  assert.ok(flavourBubble("do", "عقد").includes("افعل الآن"));
  assert.ok(isEisQuad("trash"));
});
