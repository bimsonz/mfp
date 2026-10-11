// Generates every committed schema from schema/0.2/main.tsp: the wire schema
// (TypeSpec's bundle, given its absolute id), the core producer schema, and the
// core's structured-output schema and MCP tool for each kind.
// CI runs this and fails if any generated file differs from what is committed.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { bindings } from "../lib/emit.js";
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
const producer = producerSchema(wire, loadCore());
write("producer.schema.json", producer);

for (const dir of ["emit", "mcp"]) {
  rmSync(out(dir), { recursive: true, force: true });
  mkdirSync(out(dir));
}
for (const { kind, schema, tool } of bindings(wire, producer)) {
  write(`emit/${kind}.schema.json`, schema);
  write(`mcp/${kind}.tool.json`, tool);
}
