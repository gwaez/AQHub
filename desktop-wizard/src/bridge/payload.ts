import type { ChatMode } from "../chat/types.ts";

/** Outbound webhook body. Never include secrets, CRM tokens, or mailbox contents. */
export interface ChatBridgePayload {
  text: string;
  mode: ChatMode;
  characterId: string;
  technicalId: string;
  timestamp: string;
  agentId?: string;
}

const FORBIDDEN_KEYS = /secret|token|password|authorization|cookie|apikey|api[_-]?key|accessToken|refreshToken|bearer/i;

export function buildChatPayload(input: {
  text: string;
  mode: ChatMode;
  characterId: string;
  technicalId: string;
  timestamp?: string;
  agentId?: string;
}): ChatBridgePayload {
  const payload: ChatBridgePayload = {
    text: String(input.text || "").trim().slice(0, 4000),
    mode: input.mode === "execute" ? "execute" : "chat",
    characterId: String(input.characterId || "").slice(0, 80),
    technicalId: String(input.technicalId || "AQWizard").slice(0, 80),
    timestamp: input.timestamp || new Date().toISOString(),
  };
  const agentId = (input.agentId || "").trim();
  if (agentId) payload.agentId = agentId.slice(0, 80);
  return payload;
}

export function assertSafePayload(payload: ChatBridgePayload): ChatBridgePayload {
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_KEYS.test(key)) {
      throw new Error("payload_must_not_include_secrets");
    }
  }
  return payload;
}
