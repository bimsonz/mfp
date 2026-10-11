#!/usr/bin/env node
// mfp-profile check <profile.json> [message.json ...]
//
// Checks that a profile only narrows MFP's core, and that each message given
// conforms to it. Exits 1 and lists the problems if anything fails.
import { readFileSync } from "node:fs";
import { checkMessages, checkProfile, loadWire } from "../lib/profile.js";

const [command, profilePath, ...messagePaths] = process.argv.slice(2);
if (command !== "check" || profilePath === undefined) {
  console.error("usage: mfp-profile check <profile.json> [message.json ...]");
  process.exit(2);
}

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const wire = loadWire();
const profile = read(profilePath);
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
