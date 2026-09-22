import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { itemTitle, normalizeEisItems } from "../api/eisenhower.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (name: string) => readFileSync(join(repoRoot, name), "utf8");

function assertAscii(label: string, text: string) {
  for (let i = 0; i < text.length; i++) {
    assert.ok(text.charCodeAt(i) < 128, `${label} non-ascii at ${i}`);
  }
}

function braceBalance(text: string) {
  let n = 0;
  for (const ch of text) {
    if (ch === "{") n++;
    else if (ch === "}") n--;
    if (n < 0) return n;
  }
  return n;
}

test("Eis-Json.ps1 encodes items as a JSON array of objects", () => {
  const helper = read("wizard/Eis-Json.ps1");
  assertAscii("Eis-Json.ps1", helper);
  assert.equal(braceBalance(helper), 0);
  assert.match(helper, /function Test-EisCrmSource/);
  assert.match(helper, /function Test-EisInboxQuad/);
  assert.match(helper, /function Get-EisItemsWithoutInboxCrm/);
  assert.match(helper, /function Test-EisWouldWipeOrganization/);
  assert.match(helper, /eis_refuse_overwrite/);
  assert.match(helper, /function Get-EisNormalizedItems/);
  assert.match(helper, /function Test-EisRawCorrupt/);
  assert.match(helper, /function Save-EisDoc/);
  assert.match(helper, /function Read-EisDoc/);
  assert.match(helper, /System\.Collections\.ArrayList/);
  assert.match(helper, /return\s*,\s*\(New-Object System\.Collections\.ArrayList\)/);
  assert.match(helper, /if \(\$taskId\) \{ return \$true \}/);
  assert.doesNotMatch(helper, /if \(\$taskId -and \$title\) \{ return \$true \}/);
  assert.match(helper, /'"items":' \+ \$itemsJson/);
  assert.match(helper, /function ConvertTo-EisNoteTimelineJson/);
  assert.match(helper, /'"noteTimeline":'/);
  assert.match(helper, /function ConvertTo-EisJsonString/);
  assert.match(helper, /function ConvertTo-EisObjectJson/);
  assert.match(helper, /Get-EisItemsWithoutInboxCrm \(Get-EisNormalizedItems \$Payload\)/);
  assert.match(helper, /New-Object System\.Text\.UTF8Encoding \$false/);
  assert.match(helper, /\$Path \+ '\.tmp'/);
  assert.match(helper, /\[IO\.File\]::WriteAllText\(\$tmp, \$json, \$utf8\)/);
  assert.doesNotMatch(helper, /ConvertTo-Json/);
});

test("Start-Board Eisenhower GET/POST/feed use Save-EisDoc not ConvertTo-Json wrap", () => {
  const src = read("Start-Board.ps1");
  assertAscii("Start-Board.ps1", src);
  assert.equal(braceBalance(src), 0);
  assert.match(src, /wizard\/Eis-Json\.ps1/);
  assert.match(src, /function Invoke-EisAutoFeed/);
  assert.match(src, /\$items = New-EisArrayList/);
  assert.match(src, /Save-EisDoc \$outObj \$eisenhowerPath/);
  assert.match(src, /Save-EisDoc \$payload \$eisenhowerPath/);
  assert.match(src, /Save-EisDoc \$incoming \$eisenhowerPath/);
  assert.match(src, /Read-EisDoc \$eisenhowerPath/);
  assert.match(src, /Get-EisNormalizedItems/);
  assert.match(src, /boxNote/);
  assert.match(src, /noteTimeline/);
  assert.match(src, /Test-EisCrmSource/);
  assert.match(src, /Test-EisInboxQuad/);
  assert.match(src, /incomingCrmInbox/);
  assert.match(src, /existing_quads_preserved/);
  assert.match(src, /never reset existing quads/);
  assert.doesNotMatch(src, /if \(\$real\.Count -eq 0\)/);
  assert.doesNotMatch(src, /WriteAllText\(\$eisenhowerPath, \(\$payload \| ConvertTo-Json/);
  assert.doesNotMatch(src, /\$outObj \| ConvertTo-Json -Depth 10/);
  assert.doesNotMatch(src, /\$outJson = \(\$incoming \| ConvertTo-Json/);
  assert.doesNotMatch(src, /\$arr = New-Object object\[\] \$items\.Count/);
});

test("eisenhower.html live filters apply without Apply and notes are a chat timeline", () => {
  const eis = read("eisenhower.html");
  assert.match(eis, /id="filterModeTabs"/);
  assert.doesNotMatch(eis, /id="filterMode"(?!Tabs)/);
  assert.match(eis, /function isLiveMode/);
  assert.match(eis, /function bindFilterUi/);
  assert.match(eis, /function onFilterChange/);
  assert.match(eis, /if \(isLiveMode\(\)\)/);
  assert.match(eis, /committed = clone\(draft\)/);
  assert.match(eis, /id="noteChat"/);
  assert.match(eis, /id="noteCompose"/);
  assert.match(eis, /id="noteSend"/);
  assert.match(eis, /function sendNoteChat/);
  assert.match(eis, /function appendItemNote/);
  assert.match(eis, /function ensureNoteTimeline/);
  assert.match(eis, /noteTimeline/);
  assert.match(eis, /latestNoteText/);
  assert.match(eis, /isEisCrmSource\(t\)/);
  assert.doesNotMatch(eis, /\/api\/task\/approve-send/);
  assert.doesNotMatch(eis, /\/api\/task\/chat/);
});

test("eisenhower.html import skips CRM and never renders title undefined", () => {
  const eis = read("eisenhower.html");
  assert.match(eis, /function itemTitle/);
  assert.match(eis, /function normalizeEisItems/);
  assert.match(eis, /function isEisCrmSource/);
  assert.match(eis, /function rejectInboxCrm/);
  assert.match(eis, /بدون عنوان/);
  assert.match(eis, /rejectInboxCrm\(normalizeEisItems\(j\.items\)\)/);
  assert.match(eis, /escapeHtml\(itemTitle\(it\)\)/);
  assert.match(eis, /isEisCrmSource\(t\)/);
  assert.match(eis, /md_units\|md_unit\|md_offers/);
  assert.doesNotMatch(eis, /escapeHtml\(it\.title\|\|''\)/);
});

test("wrapped sample fixture unwraps to three titled items and keeps quads", () => {
  const j = JSON.parse(read("data/eisenhower.wrapped.sample.json")) as { items: unknown };
  const items = normalizeEisItems(j.items);
  assert.equal(items.length, 3);
  assert.ok(items.every((it) => it.id && itemTitle(it) !== "بدون عنوان"));
  assert.ok(items.every((it) => itemTitle(it) !== "undefined"));
  assert.equal(itemTitle(items[0]), "Inbox sample");
  assert.equal(items.find((i) => i.id === "E-sample-do")?.quad, "do");
  assert.equal(items.find((i) => i.id === "E-sample-sched")?.quad, "sched");
  assert.equal(items.find((i) => i.id === "E-sample-inbox")?.quad, "inbox");
  const saved = JSON.stringify({ items });
  assert.match(saved, /"items":\[\{"id"/);
  assert.doesNotMatch(saved, /"items":\[\{"value"/);
});

test("UTF-8 JSON save keeps Arabic titles and a real items array", () => {
  const items = [
    { id: "E-ar", title: "عقد تجاري", source: "task", quad: "do" },
    { id: "E-crm", title: "CRM Unit", source: "crm", quad: "inbox" },
  ];
  const cleaned = items.filter((it) => !(String(it.quad) === "inbox" && String(it.source) === "crm"));
  const json = JSON.stringify({ items: cleaned });
  const round = JSON.parse(Buffer.from(json, "utf8").toString("utf8")) as { items: Array<{ title: string; quad: string }> };
  assert.equal(round.items.length, 1);
  assert.equal(round.items[0].title, "عقد تجاري");
  assert.equal(round.items[0].quad, "do");
  assert.match(json, /"items":\[\{/);
  assert.doesNotMatch(json, /"value":\[/);
});
