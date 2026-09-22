/** Audit log helpers. Never persist tokens/secrets. */

export const AUDIT_VIEW_LIMIT = 40;

const SECRET_KEY =
  /token|secret|password|authorization|cookie|apikey|api[_-]?key|accessToken|refreshToken|bearer/i;

export interface AuditLine {
  at?: string;
  actor?: string;
  action?: string;
  extra?: Record<string, unknown>;
  [key: string]: unknown;
}

export function stripSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    out[k] = stripSecrets(v);
  }
  return out;
}

export function parseAuditLog(raw: string, limit = AUDIT_VIEW_LIMIT): AuditLine[] {
  const text = String(raw || "").trim();
  if (!text) return [];
  let rows: unknown[] = [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) rows = parsed;
    } catch {
      rows = [];
    }
  }
  if (!rows.length) {
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      try {
        rows.push(JSON.parse(t));
      } catch {
        /* skip malformed */
      }
    }
  }
  const cleaned: AuditLine[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    cleaned.push(stripSecrets(row) as AuditLine);
  }
  const n = Math.max(1, Math.min(200, limit));
  return cleaned.slice(-n).reverse();
}

export function formatAuditLine(line: AuditLine): string {
  const at = String(line.at || "").replace("T", " ").slice(0, 19);
  const actor = String(line.actor || "AQWizard");
  const action = String(line.action || "");
  return [at, actor, action].filter(Boolean).join(" · ");
}
