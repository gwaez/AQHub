import assert from "node:assert/strict";
import test from "node:test";
import { flavourBubble, flavourForQuad, isEisQuad, itemTitle, moveEisItem, normalizeEisItems, type EisDoc } from "./eisenhower.ts";

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

test("normalizeEisItems unwraps ConvertTo-Json value wrapper", () => {
  const real = [
    { id: "E-1", title: "عقد", quad: "inbox" },
    { id: "E-2", title: "تقرير", quad: "do" },
    { id: "E-3", taskId: "T-9", title: "CRM", quad: "sched" },
  ];
  const wrappedArray = [{ value: real, Count: real.length }];
  const wrappedObj = { value: real, Count: real.length };
  assert.equal(normalizeEisItems(wrappedArray).length, 3);
  assert.equal(normalizeEisItems(wrappedObj).length, 3);
  assert.equal(normalizeEisItems(wrappedArray)[0].id, "E-1");
  assert.equal(normalizeEisItems([{ value: "   \n  " }]).length, 0);
  assert.equal(normalizeEisItems(real).length, 3);
});

test("itemTitle never shows undefined", () => {
  assert.equal(itemTitle({ id: "E-1", title: "عقد" }), "عقد");
  assert.equal(itemTitle({ id: "E-1", title: "undefined", taskId: "T-22" }), "T-22");
  assert.equal(itemTitle({ id: "E-1" }), "بدون عنوان");
  assert.equal(itemTitle({ id: "E-1", title: undefined }), "بدون عنوان");
  assert.equal(itemTitle({ id: "E-1", title: "null" }), "بدون عنوان");
});

test("moveEisItem unwraps a wrapped items list first", () => {
  const wrapped = {
    items: [{ value: [{ id: "E-1", title: "عقد", quad: "inbox" }] }],
  } as unknown as EisDoc;
  const { next, item } = moveEisItem(wrapped, "E-1", "do");
  assert.equal(item.quad, "do");
  assert.equal(next.items?.length, 1);
  assert.equal(next.items?.[0].id, "E-1");
});
