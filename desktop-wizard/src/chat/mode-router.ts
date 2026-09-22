import { isBridgeLinked, type WizardBridgeConfig } from "../bridge/config.ts";
import { buildChatPayload, type ChatBridgePayload } from "../bridge/payload.ts";
import { routeExecute, type ExecuteRoute } from "./execute-router.ts";
import type { ChatMode } from "./types.ts";

export type RoutedOutbound =
  | { mode: "execute"; execute: ExecuteRoute }
  | { mode: "chat"; payload: ChatBridgePayload; linked: boolean };

export function routeOutbound(opts: {
  mode: ChatMode;
  text: string;
  characterId: string;
  technicalId: string;
  agentId?: string;
  timestamp?: string;
  bridge?: WizardBridgeConfig | null;
}): RoutedOutbound {
  const text = opts.text.trim();
  if (opts.mode === "execute") {
    return { mode: "execute", execute: routeExecute(text) };
  }
  const payload = buildChatPayload({
    text,
    mode: "chat",
    characterId: opts.characterId,
    technicalId: opts.technicalId,
    agentId: opts.agentId,
    timestamp: opts.timestamp,
  });
  return {
    mode: "chat",
    payload,
    linked: isBridgeLinked(opts.bridge),
  };
}
