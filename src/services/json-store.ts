import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) {
    ensureParentDir(filePath);
    writeFileSync(filePath, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export function writeJsonFile<T>(filePath: string, value: T): void {
  ensureParentDir(filePath);
  writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}
