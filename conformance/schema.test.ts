import { describe, expect, it } from "vitest";
import { ajvWith, CORE, kindsOf, loadWire, producerSchema, validatorFor } from "../lib/profile.js";
import { applyPatch, jsonFiles, readJson } from "./support.ts";

// The wire schema is what a consumer validates with; the core producer schema
// closes every object and the core vocabularies, for what a producer emits.
const wire = loadWire();
const core = readJson("schema/0.2/core.profile.json");
const producer = producerSchema(wire, core);
const ajv = ajvWith(wire, producer);
const onWire = validatorFor(ajv, wire, "Message");
const asProduced = validatorFor(ajv, producer, "Message");

const valid = jsonFiles("examples/0.2");
const invalid = jsonFiles("conformance/0.2/invalid");
const kindOf = (name: string) => name.split(".")[0]!;

/** A validation result that shows its errors when an assertion on it fails. */
const verdict = (validate: typeof onWire, message: unknown) => ({ valid: validate(message), errors: validate.errors ?? [] });
const VALID = { valid: true, errors: [] };

describe("the committed producer schema", () => {
  it("is the one the core profile builds", () => {
    expect(readJson("schema/0.2/producer.schema.json")).toEqual(producer);
  });
  it("names the core profile", () => {
    expect(core.id).toBe(CORE);
  });
});

describe("valid examples", () => {
  it.each(valid)("%s is valid on the wire and as produced", (_, message) => {
    expect(verdict(onWire, message)).toEqual(VALID);
    expect(verdict(asProduced, message)).toEqual(VALID);
  });
});

describe("invalid cases", () => {
  it.each(invalid)("%s has exactly the one defect it names", (_, c) => {
    expect(["wire", "core"]).toContain(c.against);
    // It fails where it says it fails: a wire defect everywhere, a core defect
    // only for producers, since a consumer ignores what it does not know.
    expect(asProduced(c.message)).toBe(false);
    expect(onWire(c.message)).toBe(c.against === "core");
    // One operation fixes it, so it has one defect, not several.
    expect(c.fix).toHaveLength(1);
    const fixed = applyPatch(c.message, c.fix);
    expect(verdict(onWire, fixed)).toEqual(VALID);
    expect(verdict(asProduced, fixed)).toEqual(VALID);
  });
});

describe("coverage", () => {
  const kinds = kindsOf(wire);
  it("reads six kinds from the schema", () => {
    expect(kinds).toEqual(["intent", "premise", "decision", "observation", "stance", "verdict"]);
  });
  it.each(kinds)("%s has a valid example and an invalid case", (kind) => {
    expect(valid.filter(([name]) => kindOf(name) === kind).length).toBeGreaterThan(0);
    expect(invalid.filter(([name]) => kindOf(name) === kind).length).toBeGreaterThan(0);
  });
  it("names every file after a kind the schema has", () => {
    for (const [name, message] of valid) expect(message.kind).toBe(kindOf(name));
    for (const [name, c] of invalid) expect(c.message.kind).toBe(kindOf(name));
  });
});
