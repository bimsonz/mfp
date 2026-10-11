import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const root = join(import.meta.dirname, "..");

export const readJson = (path: string): any => JSON.parse(readFileSync(join(root, path), "utf8"));

/** The JSON files in a directory of the repo, by name. */
export const jsonFiles = (dir: string): [string, any][] =>
  readdirSync(join(root, dir))
    .filter((name) => name.endsWith(".json"))
    .toSorted()
    .map((name) => [name, readJson(join(dir, name))]);

export type PatchOp =
  | { op: "add" | "replace"; path: string; value: unknown }
  | { op: "remove"; path: string }
  | { op: "move"; from: string; path: string };

const tokens = (pointer: string) =>
  pointer
    .split("/")
    .slice(1)
    .map((t) => t.replaceAll("~1", "/").replaceAll("~0", "~"));

const parentOf = (doc: any, pointer: string): [any, string] => {
  const path = tokens(pointer);
  const last = path.pop()!;
  return [path.reduce((node, key) => node[key], doc), last];
};

const put = (doc: any, pointer: string, value: unknown, replace: boolean) => {
  const [parent, key] = parentOf(doc, pointer);
  if (Array.isArray(parent) && !replace) parent.splice(key === "-" ? parent.length : Number(key), 0, value);
  else {
    if (replace && !(key in parent)) throw new Error(`replace: ${pointer} does not exist`);
    parent[key] = value;
  }
};

const take = (doc: any, pointer: string): unknown => {
  const [parent, key] = parentOf(doc, pointer);
  if (!(key in parent)) throw new Error(`remove: ${pointer} does not exist`);
  const value = parent[key];
  if (Array.isArray(parent)) parent.splice(Number(key), 1);
  else delete parent[key];
  return value;
};

/** Applies an RFC 6902 patch (add, remove, replace, move) to a copy of `doc`. */
export const applyPatch = (doc: unknown, patch: PatchOp[]): any => {
  const copy = structuredClone(doc);
  for (const op of patch) {
    if (op.op === "add") put(copy, op.path, op.value, false);
    else if (op.op === "replace") put(copy, op.path, op.value, true);
    else if (op.op === "remove") take(copy, op.path);
    else if (op.op === "move") put(copy, op.path, take(copy, op.from), false);
  }
  return copy;
};
