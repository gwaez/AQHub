import type { ChatBridgePayload } from "./payload.ts";
import type { KvPort } from "./secret-store.ts";
import { browserKv } from "./secret-store.ts";

const QUEUE_KEY = "aqwizard.chat.outboundQueue";
const MAX_QUEUE = 40;

export interface QueuedOutbound {
  payload: ChatBridgePayload;
  queuedAt: string;
}

function readAll(kv: KvPort): QueuedOutbound[] {
  const raw = kv.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row === "object" && row.payload) as QueuedOutbound[];
  } catch {
    return [];
  }
}

function writeAll(kv: KvPort, rows: QueuedOutbound[]): void {
  kv.setItem(QUEUE_KEY, JSON.stringify(rows.slice(-MAX_QUEUE)));
}

export function enqueueOutbound(payload: ChatBridgePayload, kv: KvPort = browserKv()): QueuedOutbound {
  const item: QueuedOutbound = { payload, queuedAt: new Date().toISOString() };
  const next = [...readAll(kv), item];
  writeAll(kv, next);
  return item;
}

export function peekOutboundQueue(kv: KvPort = browserKv()): QueuedOutbound[] {
  return readAll(kv);
}

export function takeOutboundQueue(kv: KvPort = browserKv()): QueuedOutbound[] {
  const rows = readAll(kv);
  kv.removeItem(QUEUE_KEY);
  return rows;
}
