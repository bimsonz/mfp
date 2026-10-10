import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";

// Every file in examples/0.1 is named *.valid.json or *.invalid.json, and is
// checked against the committed schema as an MfpRecord.
const root = join(import.meta.dirname, "..");
const schema = JSON.parse(readFileSync(join(root, "schema/0.1/schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(schema);
const validate = ajv.getSchema("MfpRecord.json");
if (validate === undefined) throw new Error("MfpRecord.json is not in the bundled schema");

const dir = join(root, "examples/0.1");
const examples = readdirSync(dir).filter((name) => name.endsWith(".json"));

describe("MFP 0.1 examples", () => {
  it("has examples of both kinds to check", () => {
    expect(examples.filter((name) => name.endsWith(".valid.json")).length).toBeGreaterThanOrEqual(2);
    expect(examples.filter((name) => name.endsWith(".invalid.json")).length).toBeGreaterThanOrEqual(2);
  });

  it.each(examples)("%s", (name) => {
    const record = JSON.parse(readFileSync(join(dir, name), "utf8"));
    const ok = validate(record);
    if (name.endsWith(".valid.json")) expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(name.endsWith(".valid.json"));
  });
});
