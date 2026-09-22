/** Local-only secret storage. Never write this into wizard-settings.json or git. */

export interface KvPort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PREFIX = "aqwizard.bridge.secret:";

export function memoryKv(): KvPort {
  const map = new Map<string, string>();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

export function browserKv(): KvPort {
  try {
    if (typeof localStorage === "undefined") return memoryKv();
    return localStorage;
  } catch {
    return memoryKv();
  }
}

function keyFor(secretRef: string): string {
  const ref = secretRef.trim() || "wizard-bridge";
  return PREFIX + ref;
}

export function readBridgeSecret(secretRef: string, kv: KvPort = browserKv()): string {
  return kv.getItem(keyFor(secretRef)) || "";
}

export function writeBridgeSecret(secretRef: string, secret: string, kv: KvPort = browserKv()): void {
  const key = keyFor(secretRef);
  const value = secret.trim();
  if (!value) kv.removeItem(key);
  else kv.setItem(key, value.slice(0, 500));
}

export function hasBridgeSecret(secretRef: string, kv: KvPort = browserKv()): boolean {
  return Boolean(readBridgeSecret(secretRef, kv));
}
