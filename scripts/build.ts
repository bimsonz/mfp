// Generates every committed schema from schema/0.2/main.tsp: the wire schema
// (TypeSpec's bundle, given its absolute id) and the core producer schema.
// CI runs this and fails if any generated file differs from what is committed.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, loadCore, producerSchema } from "../lib/profile.js";

const root = new URL("../", import.meta.url);
const out = (path: string) => new URL(`schema/0.2/${path}`, root);
const write = (path: string, value: unknown) => writeFileSync(out(path), `${JSON.stringify(value, null, 2)}\n`);

execFileSync("tsp", ["compile", "schema/0.2/main.tsp", "--config", "tspconfig.yaml", "--pretty=false"], {
  cwd: root,
  stdio: ["ignore", "ignore", "inherit"],
});

const wire = JSON.parse(readFileSync(out("mfp.schema.json"), "utf8"));
wire.$id = `${BASE}mfp.schema.json`;
write("mfp.schema.json", wire);
write("producer.schema.json", producerSchema(wire, loadCore()));
