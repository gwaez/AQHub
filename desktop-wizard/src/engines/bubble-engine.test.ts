import assert from "node:assert/strict";
import test from "node:test";
import { BubbleEngine } from "./bubble-engine.ts";

test("RTL speech bubble then auto-hides", () => {
  const b = new BubbleEngine();
  const view = b.show({ kind: "speech", text: "مرحبا", dir: "rtl" }, 0);
  assert.equal(view.dir, "rtl");
  assert.equal(view.visible, true);
  assert.equal(b.tick(1000)?.visible, true);
  assert.equal(b.tick(6000)?.visible, false);
});

test("alert lasts longer than speech default", () => {
  const b = new BubbleEngine();
  b.show({ kind: "alert", text: "موعد" }, 0);
  assert.equal(b.tick(5000)?.visible, true);
  assert.equal(b.tick(8000)?.visible, false);
});

test("thought kind is stored for CSS", () => {
  const b = new BubbleEngine();
  assert.equal(b.show({ kind: "thought", text: "همم" }).kind, "thought");
});
