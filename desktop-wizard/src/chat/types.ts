export type ChatMode = "chat" | "execute";

export interface ChatLine {
  id: string;
  role: "user" | "wizard" | "system";
  text: string;
  mode?: ChatMode;
  at: string;
}

export function nextLineId(now = Date.now()): string {
  return "L-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}
