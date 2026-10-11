import { describe, expect, it } from "vitest";
import { ajvWith, checkMessages, checkProfile, loadWire, producerSchema, validatorFor } from "../lib/profile.js";
import { applyPatch, jsonFiles, readJson } from "./support.ts";

const wire = loadWire();
const dir = "examples/profiles/code-review";
const profile = readJson(`${dir}/profile.json`);
const examples = jsonFiles(dir).filter(([name]) => name !== "profile.json");
const invalid = jsonFiles(`${dir}/invalid`);

describe("the code-review example profile", () => {
  it("is a narrowing the check accepts", () => {
    expect(checkProfile(wire, profile)).toEqual([]);
  });
  it("has examples of more than one kind, all valid on the wire and under it", () => {
    expect(new Set(examples.map(([, m]) => m.kind)).size).toBeGreaterThan(1);
    expect(checkMessages(wire, profile, examples)).toEqual([]);
  });
  it.each(invalid)("%s fails only under the profile, and one operation fixes it", (_, c) => {
    expect(c.against).toBe("profile");
    expect(c.fix).toHaveLength(1);
    const producer = producerSchema(wire, profile);
    const ajv = ajvWith(wire, producer);
    expect(validatorFor(ajv, producer, "Message")(c.message)).toBe(false);
    expect(validatorFor(ajv, wire, "Message")(c.message)).toBe(true);
    expect(checkMessages(wire, profile, [["fixed", applyPatch(c.message, c.fix)]])).toEqual([]);
  });
});

describe("the profile check refuses what would not narrow", () => {
  const broken: [string, (p: any) => void, RegExp][] = [
    ["a member outside its prefix", (p) => (p.members[0].name = "blocking"), /not named org\.example\.code-review\/<name>/],
    ["another vendor's prefix", (p) => (p.members[0].name = "com.other/blocking"), /not named/],
    ["members with no prefix", (p) => delete p.prefix, /needs a prefix/],
    ["a member defined twice", (p) => p.members.push({ ...p.members[0] }), /defined twice/],
    ["a member schema that does not compile", (p) => (p.members[0].schema = { type: "nope" }), /does not compile/],
    ["requiring a member the kind lacks", (p) => p.require.push("verdict.author"), /has no member author/],
    ["requiring what is already required", (p) => p.require.push("verdict.outcome"), /already required/],
    ["a vocabulary slot the core lacks", (p) => (p.vocabularies["verdict.reasons"] = ["x"]), /not an open vocabulary/],
    ["a vocabulary token the slot's grammar refuses", (p) => (p.vocabularies["verdict.outcome"] = ["Approve"]), /descriptor/],
    ["another MFP version", (p) => (p.mfp = "0.1"), /descriptor/],
  ];
  it.each(broken)("%s", (_, breakIt, problem) => {
    const p = structuredClone(profile);
    breakIt(p);
    expect(checkProfile(wire, p).join("\n")).toMatch(problem);
  });
});
