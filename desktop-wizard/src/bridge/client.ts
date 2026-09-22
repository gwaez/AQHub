import { assertSafePayload, type ChatBridgePayload } from "./payload.ts";

export interface BridgePostResult {
  ok: boolean;
  status: number;
  reply: string;
  error?: string;
  queued?: boolean;
}

export interface BridgeHttp {
  fetch(url: string, init: RequestInit): Promise<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
  }>;
}

export function defaultBridgeHttp(): BridgeHttp {
  return { fetch: (url, init) => fetch(url, init) };
}

function parseReply(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    if (typeof body.reply === "string") return body.reply;
    if (typeof body.text === "string") return body.text;
    if (typeof body.message === "string") return body.message;
  } catch {
    return text.slice(0, 2000);
  }
  return text.slice(0, 400);
}

/**
 * POST the chat payload to the configured webhook.
 * Secret travels only as X-AQWizard-Secret — never in the JSON body.
 */
export async function postBridge(
  url: string,
  payload: ChatBridgePayload,
  secret = "",
  http: BridgeHttp = defaultBridgeHttp(),
): Promise<BridgePostResult> {
  const safe = assertSafePayload(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/plain",
  };
  if (secret) headers["X-AQWizard-Secret"] = secret;
  try {
    const res = await http.fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(safe),
    });
    const raw = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        reply: "",
        error: `http_${res.status}`,
      };
    }
    return { ok: true, status: res.status, reply: parseReply(raw) };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      reply: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
