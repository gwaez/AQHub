import { cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const from = resolve(root, "../characters");
const to = resolve(root, "../public/characters");
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
console.log("copied character packs -> public/characters");
