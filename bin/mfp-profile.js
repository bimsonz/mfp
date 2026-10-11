#!/usr/bin/env node
// mfp-profile check <profile.json> [message.json ...]
//   Checks that a profile only narrows MFP's core, and that each message given
//   conforms to it. Exits 1 and lists the problems if anything fails.
// mfp-profile emit <profile.json> <dir>
//   Writes the profile's structured-output schemas to <dir>/emit and its MCP
//   tools to <dir>/mcp, one per kind.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bindings } from "../lib/emit.js";
import { checkMessages, checkProfile, loadWire, producerSchema } from "../lib/profile.js";

const USAGE = "usage: mfp-profile check <profile.json> [message.json ...]\n       mfp-profile emit <profile.json> <dir>";
const [command, profilePath, ...rest] = process.argv.slice(2);
if (!["check", "emit"].includes(command) || profilePath === undefined || (command === "emit" && rest.length !== 1)) {
  console.error(USAGE);
  process.exit(2);
}

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const wire = loadWire();
const profile = read(profilePath);

if (command === "emit") {
  const problems = checkProfile(wire, profile);
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  const [dir] = rest;
  for (const sub of ["emit", "mcp"]) mkdirSync(join(dir, sub), { recursive: true });
  for (const { kind, schema, tool } of bindings(wire, producerSchema(wire, profile))) {
    writeFileSync(join(dir, "emit", `${kind}.schema.json`), `${JSON.stringify(schema, null, 2)}\n`);
    writeFileSync(join(dir, "mcp", `${kind}.tool.json`), `${JSON.stringify(tool, null, 2)}\n`);
  }
  console.log(`${profile.id}: wrote emit/ and mcp/ to ${dir}`);
  process.exit(0);
}

const messagePaths = rest;
let problems = checkProfile(wire, profile);
if (problems.length === 0 && messagePaths.length > 0)
  problems = checkMessages(
    wire,
    profile,
    messagePaths.map((path) => [path, read(path)]),
  );

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
console.log(`${profile.id}: narrows MFP ${profile.mfp}; ${messagePaths.length} message(s) conform`);
