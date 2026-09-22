import assert from "node:assert/strict";
import test from "node:test";
import { mergeTaskIntoDoc, nextTaskId, newWizardTask } from "./tasks.ts";

test("nextTaskId increments T-###", () => {
  assert.equal(nextTaskId([]), "T-001");
  assert.equal(nextTaskId([{ id: "T-016" }, { id: "T-2" }]), "T-017");
});

test("merge prepends without dropping other board fields", () => {
  const doc = mergeTaskIntoDoc(
    { version: 1, title: "Aqaar Command", tasks: [{ id: "T-001", title: "old" }], extra: true },
    newWizardTask("T-002", "from wizard"),
  );
  assert.equal(doc.tasks?.[0].id, "T-002");
  assert.equal(doc.tasks?.[1].id, "T-001");
  assert.equal(doc.title, "Aqaar Command");
  assert.equal((doc as { extra?: boolean }).extra, true);
});
