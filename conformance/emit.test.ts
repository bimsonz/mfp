import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bindings, emitSchema, mcpTool, PORTABLE, toEmit, toWire } from "../lib/emit.js";
import { ajvWith, kindsOf, loadWire, producerSchema, validatorFor } from "../lib/profile.js";
import { jsonFiles, readJson, root } from "./support.ts";

// The model-facing forms: one structured-output schema and one MCP tool per kind,
// and the transform between what a model emits and the wire.
const wire = loadWire();
const producer = producerSchema(wire, readJson("schema/0.2/core.profile.json"));
const kinds = kindsOf(wire);
const generated = bindings(wire, producer);
const ajv = ajvWith(wire, producer);
const onWire = validatorFor(ajv, wire, "Message");
const asProduced = validatorFor(ajv, producer, "Message");
const verdict = (validate: (m: unknown) => boolean, m: unknown) => ({ valid: validate(m), errors: (validate as any).errors ?? [] });
const VALID = { valid: true, errors: [] };
const emitValidator = (schema: object) => ajvWith().compile(schema);
const examples = jsonFiles("examples/0.2");
const invalid = jsonFiles("conformance/0.2/invalid");

/** Every schema node in a tree, with its JSON Pointer. */
const nodes = function* (node: unknown, at = ""): Generator<[string, any]> {
  if (Array.isArray(node)) {
    for (const [i, n] of node.entries()) yield* nodes(n, `${at}/${i}`);
  } else if (node !== null && typeof node === "object") {
    yield [at, node];
    for (const [k, v] of Object.entries(node)) {
      if (k === "properties" || k === "$defs") for (const [name, s] of Object.entries(v as object)) yield* nodes(s, `${at}/${k}/${name}`);
      else if (typeof v === "object") yield* nodes(v, `${at}/${k}`);
    }
  }
};

/** What a strict structured-output mode would refuse in a schema. */
const strictProblems = (schema: any): string[] => {
  const problems: string[] = [];
  if (schema.type !== "object") problems.push("root is not an object");
  for (const [at, node] of nodes(schema)) {
    for (const key of Object.keys(node))
      if (!PORTABLE.includes(key)) problems.push(`${at}: keyword ${key}`);
    if ("const" in node) problems.push(`${at}: const`);
    if (node.type === "object") {
      if (node.additionalProperties !== false) problems.push(`${at}: object not closed`);
      const keys = Object.keys(node.properties ?? {}).toSorted();
      if (JSON.stringify(keys) !== JSON.stringify([...(node.required ?? [])].toSorted()))
        problems.push(`${at}: required is not every property`);
    }
    if (typeof node.$ref === "string") {
      if (!node.$ref.startsWith("#/$defs/")) problems.push(`${at}: ref ${node.$ref} is not local`);
      else if (schema.$defs?.[node.$ref.slice(8)] === undefined) problems.push(`${at}: ref ${node.$ref} does not resolve`);
    }
  }
  return problems;
};

describe("committed emit schemas and tools", () => {
  it.each(generated)("$kind matches what the build generates", ({ kind, schema, tool }) => {
    expect(readJson(`schema/0.2/emit/${kind}.schema.json`)).toEqual(schema);
    expect(readJson(`schema/0.2/mcp/${kind}.tool.json`)).toEqual(tool);
  });
});

describe("T7: emit schemas work in strict structured-output modes", () => {
  it.each(generated)("$kind", ({ kind, schema }) => {
    expect(strictProblems(schema)).toEqual([]);
    expect(schema.properties.mfp).toMatchObject({ type: "string", enum: ["0.2"] });
    expect(schema.properties.kind).toMatchObject({ type: "string", enum: [kind] });
  });
});

describe("T8: the transform round-trips every valid example", () => {
  it.each(examples)("%s", (_, message) => {
    const schema = emitSchema(producer, message.kind);
    const output = toEmit(message, schema);
    expect(verdict(emitValidator(schema), output)).toEqual(VALID);
    expect(toWire(output)).toEqual(message);
  });
});

describe("T9: an emit schema admits nothing a producer must not emit", () => {
  // Defects only a keyword the emit form strips (minLength, uniqueItems, format)
  // could catch; the wire check after toWire catches them. None today.
  const STRIPPED_ONLY: string[] = [];
  it.each(invalid.filter(([name]) => !STRIPPED_ONLY.includes(name)))("%s", (_, c) => {
    const schema = emitSchema(producer, c.message.kind);
    expect(emitValidator(schema)(toEmit(c.message, schema))).toBe(false);
  });
});

describe("T10: MCP tools", () => {
  it.each(generated)("$kind is a tool whose input is the emit schema less the binding's members", ({ kind, schema, tool }) => {
    expect(tool.name).toMatch(/^[A-Za-z0-9_.-]{1,128}$/);
    expect(tool.name).toBe(`mfp_${kind}`);
    expect(strictProblems(tool.inputSchema)).toEqual([]);
    expect(strictProblems(tool.outputSchema)).toEqual([]);
    // The binding supplies these, so the model is never asked for them.
    const supplied = ["mfp", "kind", "profile"];
    const without = Object.fromEntries(Object.entries(schema.properties).filter(([n]) => !supplied.includes(n)));
    expect(tool.inputSchema.properties).toEqual(without);
    expect(tool.inputSchema.required).toEqual(Object.keys(without));
    expect(tool.inputSchema.$defs).toEqual(schema.$defs);
  });

  it.each(generated)("$kind says what the model reports and when to call it", ({ tool }) => {
    expect(tool.description).toMatch(/^Report /);
    expect(tool.description).toMatch(/\bCall this (once|as soon as|whenever|when)\b/);
    expect(tool.description.split(/\s+/).length).toBeGreaterThanOrEqual(20);
    expect(tool.description).not.toMatch(/\{|\}/);
    expect(tool.title).toMatch(/^Report /);
  });

  it("gives every tool its own description", () => {
    expect(new Set(generated.map(({ tool }) => tool.description)).size).toBe(kinds.length);
  });

  it.each(examples)("a call carrying %s becomes a producer-valid message", (_, message) => {
    const tool = mcpTool(producer, message.kind);
    const args = toEmit(message, tool.inputSchema);
    expect(verdict(emitValidator(tool.inputSchema), args)).toEqual(VALID);
    const received = toWire(args, { kind: message.kind });
    expect(verdict(onWire, received)).toEqual(VALID);
    expect(verdict(asProduced, received)).toEqual(VALID);
    expect(received).toEqual(message);
  });
});

describe("T11: a profile's vocabulary and members reach the model", () => {
  const dir = "examples/profiles/code-review";
  const profile = readJson(`${dir}/profile.json`);
  const narrowed = producerSchema(wire, profile);
  const profileExamples = jsonFiles(dir).filter(([name]) => name !== "profile.json");

  it("closes the verdict's outcome to the profile's tokens and requires its member", () => {
    const schema = emitSchema(narrowed, "verdict");
    expect(schema.properties.outcome.enum).toEqual(profile.vocabularies["verdict.outcome"]);
    expect(schema.properties["org.example.code-review/blocking"]).toEqual({ type: "boolean" });
    expect(schema.properties.profile).toMatchObject({ type: "string", enum: [profile.id] });
    expect(strictProblems(schema)).toEqual([]);
  });

  it("names the profile's outcomes in the verdict tool", () => {
    expect(mcpTool(narrowed, "verdict").description).toContain("approve, request-changes, comment");
  });

  it.each(profileExamples)("%s round-trips through the profile's emit schema and tool", (_, message) => {
    const schema = emitSchema(narrowed, message.kind);
    const output = toEmit(message, schema);
    expect(verdict(emitValidator(schema), output)).toEqual(VALID);
    expect(toWire(output)).toEqual(message);
    const tool = mcpTool(narrowed, message.kind);
    expect(toWire(toEmit(message, tool.inputSchema), { kind: message.kind, profile: profile.id })).toEqual(message);
  });
});

describe("the worked examples in bindings.md", () => {
  // The doc's JSON blocks, in order: request, reply, wire message, tools/list,
  // tools/call, result. Each that holds data is checked against the schemas.
  const doc = readFileSync(join(root, "docs/specification/0.2/bindings.md"), "utf8");
  const blocks = [...doc.matchAll(/```json\n([\s\S]*?)```/g)].map(([, body]) => JSON.parse(body!));
  const [request, reply, message, list, call, result] = blocks;
  const schema = emitSchema(producer, "premise");
  const tool = mcpTool(producer, "premise");

  it("has the six blocks it describes", () => {
    expect(blocks).toHaveLength(6);
    expect(request.response_format.json_schema.name).toBe("mfp_premise");
  });
  it("shows a reply the emit schema accepts, and the wire message toWire makes of it", () => {
    expect(verdict(emitValidator(schema), reply)).toEqual(VALID);
    expect(toWire(reply)).toEqual(message);
    expect(verdict(asProduced, message)).toEqual(VALID);
  });
  it("shows the tool as the committed definition has it", () => {
    const { inputSchema, ...shown } = list.tools[0];
    const { inputSchema: _, ...committed } = tool;
    expect(shown).toEqual(committed);
    expect(inputSchema).toBe("<schema/0.2/mcp/premise.tool.json#/inputSchema>");
  });
  it("shows a call the tool accepts, which becomes the same wire message", () => {
    expect(call.params.name).toBe(tool.name);
    expect(verdict(emitValidator(tool.inputSchema), call.params.arguments)).toEqual(VALID);
    expect(toWire(call.params.arguments, { kind: "premise" })).toEqual(message);
  });
  it("shows a result the tool's output schema accepts", () => {
    expect(verdict(emitValidator(tool.outputSchema), result.result.structuredContent)).toEqual(VALID);
    expect(JSON.parse(result.result.content[0].text)).toEqual(result.result.structuredContent);
  });
});
