// The model-facing forms of MFP: a structured-output schema per kind, an MCP
// tool per kind, and the transform between what a model emits and the wire.
//
// Strict structured-output modes accept only closed objects whose every
// property is required, and treat `const` unevenly. So an emit schema:
// - spells constants as single-value enums;
// - closes every object;
// - makes every property required, an optional one as nullable;
// - is self-contained, with local refs only;
// - uses only portable keywords.
// A model's null means absent: `toWire` drops nulls, and the wire check after
// it enforces what the stripped keywords said.

import { BASE, CORE, kindsOf } from "./profile.js";

/** The keywords an emit schema may use. */
export const PORTABLE = [
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "anyOf",
  "$ref",
  "$defs",
  "description",
  "pattern",
  "minItems",
];

/** What each kind's tool is for: what the model reports, and when to call it. */
const TOOLS = {
  intent: {
    title: "Report an intent",
    description:
      "Report what you are about to do, before you change any code: your goal, the paths you expect to touch, and what you rely on about code you do not own. Call this once at the start of a task, and again if your plan changes.",
  },
  premise: {
    title: "Report a premise",
    description:
      "Report one more thing you rely on about code you do not own, found after you reported your intent. Call this as soon as you start relying on it.",
  },
  decision: {
    title: "Report a decision",
    description:
      "Report a choice you made between real alternatives: what you chose, why, and what you rejected, citing what it rests on. Call this whenever you pick one approach over another that a reviewer might have chosen differently.",
  },
  observation: {
    title: "Report an observation",
    description:
      "Report something you noticed that matters beyond your current step, such as a flaky test, a bug or a risk, citing what it rests on. Call this when you notice it, not at the end of the task.",
  },
  stance: {
    title: "Report a stance on a precedent",
    description:
      "Report how your work relates to an earlier decision you were shown as precedent: followed, distinguished, or overrule requested, with your argument. Call this whenever your work touches a decision you were given.",
  },
  verdict: {
    title: "Report a verdict",
    description:
      "Report the outcome you think a piece of work should have ({outcomes}), with your reasons. It is your opinion and decides nothing. Call this when you finish reviewing a piece of work.",
  },
};

const kindDef = (kind) => kind[0].toUpperCase() + kind.slice(1);
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const NULL = { type: "null" };

/** Strips a nullable wrapper, if there is one. */
const unwrap = (schema) =>
  isObject(schema) && Array.isArray(schema.anyOf) && schema.anyOf.length === 2 && schema.anyOf[1]?.type === "null"
    ? schema.anyOf[0]
    : schema;

/** The `$defs` name an absolute ref points at, under the schema's base. */
const refName = (ref, base) => ref.slice(base.length).replace(/\.json$/, "");

/** A string-literal union, `anyOf: [{type: "string", const: a}, ...]`, as one enum. */
const literalUnion = (node) =>
  Array.isArray(node.anyOf) &&
  node.anyOf.length > 0 &&
  node.anyOf.every((m) => isObject(m) && m.type === "string" && "const" in m && Object.keys(m).length === 2);

/** Rewrites one schema node into the emit form, collecting the defs it refers to. */
const rewrite = (node, base, refs) => {
  if (Array.isArray(node)) return node.map((n) => rewrite(n, base, refs));
  if (!isObject(node)) return node;
  if (literalUnion(node)) {
    const out = { type: "string", enum: node.anyOf.map((m) => m.const) };
    if (node.description !== undefined) out.description = node.description;
    return out;
  }
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "const") out.enum = [value];
    else if (key === "$ref") {
      const name = refName(value, base);
      refs.add(name);
      out.$ref = `#/$defs/${name}`;
    } else if (key === "properties") {
      out.properties = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v, base, refs)]));
    } else if (PORTABLE.includes(key)) out[key] = rewrite(value, base, refs);
  }
  if (out.type === "object" && out.properties !== undefined) {
    const required = new Set(node.required ?? []);
    for (const [name, schema] of Object.entries(out.properties)) {
      if (required.has(name)) continue;
      const { description, ...rest } = schema;
      out.properties[name] = description === undefined ? { anyOf: [rest, NULL] } : { anyOf: [rest, NULL], description };
    }
    out.required = Object.keys(out.properties);
    out.additionalProperties = false;
  }
  return out;
};

/** The base a producer schema's def ids sit under. */
const baseOf = (producer) => {
  const anyId = Object.values(producer.$defs)[0].$id;
  return anyId.slice(0, anyId.lastIndexOf("/") + 1);
};

/** The profile a producer schema was built for, read from its `profile` member. */
const profileOf = (producer) => producer.$defs.Intent.properties.profile.const;

/**
 * The structured-output schema for one kind under a producer schema: the whole
 * message, with `mfp` and `kind` as single-value enums. Under the core profile
 * it has no `profile` member (absent means the core); under another profile,
 * `profile` is a required single-value enum.
 */
export const emitSchema = (producer, kind) => {
  const base = baseOf(producer);
  const refs = new Set();
  const root = rewrite(producer.$defs[kindDef(kind)], base, refs);
  if (profileOf(producer) === CORE) {
    delete root.properties.profile;
    root.required = root.required.filter((name) => name !== "profile");
  } else {
    root.properties.profile = { ...unwrap(root.properties.profile), description: "The profile this message conforms to." };
  }
  const defs = {};
  for (let pending = [...refs]; pending.length > 0; pending = [...refs].filter((name) => !(name in defs))) {
    for (const name of pending) defs[name] = rewrite(producer.$defs[name], base, refs);
  }
  return { ...root, $defs: Object.fromEntries(Object.entries(defs).toSorted(([a], [b]) => a.localeCompare(b))) };
};

/** The members a binding supplies, so a tool's input leaves them out. */
export const BINDING_MEMBERS = ["mfp", "kind", "profile"];

/**
 * The MCP tool for one kind: its input is the kind's emit schema without the
 * members the binding supplies, and its result the identifier the receiver
 * gave the message.
 */
export const mcpTool = (producer, kind) => {
  const schema = emitSchema(producer, kind);
  const { $defs, properties, required, ...rest } = schema;
  const inputSchema = {
    ...rest,
    properties: Object.fromEntries(Object.entries(properties).filter(([name]) => !BINDING_MEMBERS.includes(name))),
    required: required.filter((name) => !BINDING_MEMBERS.includes(name)),
    $defs,
  };
  const outcomes = kind === "verdict" ? unwrap(properties.outcome).enum : undefined;
  const { title, description } = TOOLS[kind];
  return {
    name: `mfp_${kind}`,
    title,
    description: outcomes === undefined ? description : description.replace("{outcomes}", outcomes.join(", ")),
    inputSchema,
    outputSchema: {
      type: "object",
      properties: {
        ref: {
          type: "string",
          description: "The identifier the receiver gave this report. Cite it later as {kind: \"record\", ref}.",
        },
      },
      required: ["ref"],
      additionalProperties: false,
    },
    annotations: { title, readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  };
};

/** Every emit schema and tool for a producer schema, by kind. */
export const bindings = (wire, producer) =>
  kindsOf(wire).map((kind) => ({ kind, schema: emitSchema(producer, kind), tool: mcpTool(producer, kind) }));

const dropNulls = (value) => {
  if (Array.isArray(value)) return value.map(dropNulls);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => [k, dropNulls(v)]),
  );
};

/**
 * What a model emitted, as a wire message: nulls dropped, at any depth. For an
 * MCP tool call, pass the binding's `kind` (and `profile`, under one) to supply
 * the members the tool's input leaves out.
 */
export const toWire = (output, binding) => {
  const message = dropNulls(output);
  if (binding === undefined) return message;
  const supplied = { mfp: "0.2", kind: binding.kind };
  if (binding.profile !== undefined && binding.profile !== CORE) supplied.profile = binding.profile;
  return { ...supplied, ...message };
};

const resolve = (schema, root) =>
  isObject(schema) && typeof schema.$ref === "string" ? resolve(root.$defs[schema.$ref.slice("#/$defs/".length)], root) : schema;

/** Whether a value can belong to one arm of a union: its members are the arm's, and its enums match. */
const fits = (value, arm, root) => {
  if (!isObject(value) || arm.properties === undefined) return !isObject(value);
  return Object.entries(value).every(([name, v]) => {
    const member = arm.properties[name];
    if (member === undefined) return false;
    const target = resolve(unwrap(member), root);
    return !Array.isArray(target.enum) || target.enum.includes(v);
  });
};

const project = (value, schema, root, top) => {
  const node = resolve(unwrap(schema), root);
  if (Array.isArray(node.anyOf)) {
    const arm = node.anyOf.map((a) => resolve(a, root)).find((a) => fits(value, a, root));
    return arm === undefined ? value : project(value, arm, root, top);
  }
  if (Array.isArray(value)) return node.items === undefined ? value : value.map((v) => project(v, node.items, root, false));
  if (!isObject(value) || node.properties === undefined) return value;
  const defined = Object.entries(node.properties).map(([name, member]) => [
    name,
    value[name] === undefined ? null : project(value[name], member, root, false),
  ]);
  // Anything else stays, so the schema can refuse it; only what the binding supplies goes.
  const others = Object.entries(value).filter(
    ([name]) => !(name in node.properties) && !(top && BINDING_MEMBERS.includes(name)),
  );
  return Object.fromEntries([...defined, ...others]);
};

/**
 * A wire message in the form an emit schema or tool input expects: every member
 * the schema defines, null where the message has none. The members a binding
 * supplies (`mfp`, `kind`, `profile`) are left out where the schema lacks them;
 * any other member is kept, for the schema to refuse. The inverse of `toWire`,
 * for examples and tests.
 */
export const toEmit = (message, schema) => project(message, schema, schema, true);

/** Re-exported so a caller can tell the core's emit schemas from a profile's. */
export { BASE, CORE };
