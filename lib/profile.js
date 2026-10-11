// Profiles, and the producer schemas built from them.
//
// The wire schema is open: a consumer ignores members it does not know. A
// producer schema is the wire schema with every object closed (only defined
// members, plus vendor-prefixed ones), the open vocabularies closed to a
// profile's tokens, the members it requires made required, and its own members
// typed. Each step only narrows, so every message a producer schema accepts,
// the wire schema accepts too; `checkProfile` refuses any descriptor that would
// need anything else.

import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

/** The base of every MFP 0.2 schema id. */
export const BASE = "https://bimsonz.github.io/mfp/schema/0.2/";

/** The id of the core profile: what a message without `profile` conforms to. */
export const CORE = `${BASE}core`;

/** A vendor-prefixed member name: `<reverse-dns>/<name>`. */
export const EXTENSION = "^[a-z0-9]+(?:-[a-z0-9]+)*(?:\\.[a-z0-9]+(?:-[a-z0-9]+)*)+/[A-Za-z0-9_.-]+$";

/** The message kinds, as the wire schema's `Message` union lists them. */
export const kindsOf = (wire) =>
  wire.$defs.Message.anyOf.map(({ $ref }) => wire.$defs[defName($ref)].properties.kind.const);

/** The open vocabularies a profile may close, as `<kind>.<member>`. */
export const SLOTS = ["verdict.outcome", "observation.category"];

const defName = (ref) => ref.slice(BASE.length).replace(/\.json$/, "");
const kindDef = (kind) => kind[0].toUpperCase() + kind.slice(1);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Reads the wire schema shipped with this package. */
export const loadWire = () =>
  JSON.parse(readFileSync(new URL("../schema/0.2/mfp.schema.json", import.meta.url), "utf8"));

/** Reads the core profile descriptor shipped with this package. */
export const loadCore = () =>
  JSON.parse(readFileSync(new URL("../schema/0.2/core.profile.json", import.meta.url), "utf8"));

/** An Ajv instance holding the given schemas, each addressable by its `$id`. */
export const ajvWith = (...schemas) => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  for (const schema of schemas) ajv.addSchema(schema);
  return ajv;
};

/** The validator for one def of a bundled schema. */
export const validatorFor = (ajv, bundle, def) => {
  const validate = ajv.getSchema(bundle.$defs[def].$id);
  if (validate === undefined) throw new Error(`${def} is not in ${bundle.$id}`);
  return validate;
};

/** The base a profile's producer schema ids live under. */
const baseFor = (profile) => (profile.id === CORE ? `${BASE}producer/` : `${profile.id.replace(/\/$/, "")}/`);

/**
 * Checks a profile descriptor against the wire schema. Returns the problems
 * found, or none. A descriptor with no problems builds a producer schema that
 * only narrows the wire schema.
 */
export const checkProfile = (wire, profile) => {
  const ajv = ajvWith(wire);
  const validate = validatorFor(ajv, wire, "Profile");
  if (!validate(profile)) return validate.errors.map((e) => `descriptor ${e.instancePath || "/"} ${e.message}`);

  const problems = [];
  if (profile.mfp !== wire.$defs.Intent.properties.mfp.const)
    problems.push(`mfp ${profile.mfp} is not this schema's version`);
  const kinds = kindsOf(wire);

  for (const slot of Object.keys(profile.vocabularies ?? {}))
    if (!SLOTS.includes(slot)) problems.push(`vocabulary ${slot}: not an open vocabulary (${SLOTS.join(", ")})`);

  for (const path of profile.require ?? []) {
    const [kind, member, ...rest] = path.split(".");
    const def = kinds.includes(kind) ? wire.$defs[kindDef(kind)] : undefined;
    if (def === undefined || member === undefined || rest.length > 0) {
      problems.push(`require ${path}: not <kind>.<member>`);
    } else if (def.properties[member] === undefined) {
      problems.push(`require ${path}: ${kind} has no member ${member}`);
    } else if (def.required.includes(member)) {
      problems.push(`require ${path}: already required`);
    }
  }

  const seen = new Set();
  for (const member of profile.members ?? []) {
    const key = `${member.kind}.${member.name}`;
    if (profile.prefix === undefined) problems.push(`member ${member.name}: a profile with members needs a prefix`);
    else if (!new RegExp(`^${escape(profile.prefix)}/[A-Za-z0-9_.-]+$`).test(member.name))
      problems.push(`member ${member.name}: not named ${profile.prefix}/<name>`);
    if (seen.has(key)) problems.push(`member ${member.name}: defined twice on ${member.kind}`);
    seen.add(key);
    try {
      ajvWith().compile(member.schema);
    } catch (e) {
      problems.push(`member ${member.name}: schema does not compile: ${e.message}`);
    }
  }
  return problems;
};

/** Every object schema in a schema tree, depth first. */
const objects = function* (node) {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) yield* objects(item);
    return;
  }
  if (node.type === "object" && node.properties !== undefined) yield node;
  for (const value of Object.values(node)) yield* objects(value);
};

/** The defs that describe profiles, not messages: a producer schema leaves them out. */
const DESCRIPTOR_DEFS = ["Profile", "ProfileMember", "Prefix"];

/**
 * The producer schema for a profile: the wire schema, with every object closed
 * and the profile applied. Its ids sit under the profile's own base, so it can
 * be loaded beside the wire schema.
 */
export const producerSchema = (wire, profile) => {
  const problems = checkProfile(wire, profile);
  if (problems.length > 0) throw new Error(`profile ${profile.id}: ${problems.join("; ")}`);
  const base = baseFor(profile);
  const schema = JSON.parse(JSON.stringify(wire).replaceAll(BASE, base));
  schema.$id = profile.id === CORE ? `${BASE}producer.schema.json` : `${base}producer.schema.json`;
  for (const name of DESCRIPTOR_DEFS) delete schema.$defs[name];

  // Close every object: only defined members and vendor-prefixed ones.
  for (const node of objects(schema.$defs)) {
    node.additionalProperties = false;
    node.patternProperties = { [EXTENSION]: true };
  }

  const def = (kind) => schema.$defs[kindDef(kind)];
  for (const kind of kindsOf(wire)) {
    const own = def(kind);
    own.properties.profile =
      profile.id === CORE
        ? { const: CORE, description: own.properties.profile.description }
        : { const: profile.id, description: own.properties.profile.description };
    if (profile.id !== CORE) own.required.push("profile");
  }

  for (const [slot, tokens] of Object.entries(profile.vocabularies ?? {})) {
    const [kind, member] = slot.split(".");
    const { description } = def(kind).properties[member];
    def(kind).properties[member] = { type: "string", enum: tokens, description };
  }

  for (const path of profile.require ?? []) {
    const [kind, member] = path.split(".");
    def(kind).required.push(member);
  }

  const ownMembers = new Map();
  for (const member of profile.members ?? []) {
    def(member.kind).properties[member.name] = member.schema;
    if (member.required) def(member.kind).required.push(member.name);
    ownMembers.set(member.kind, [...(ownMembers.get(member.kind) ?? []), member.name]);
  }

  // A member under the profile's own prefix that it does not define is a misspelling.
  if (profile.prefix !== undefined) {
    for (const node of objects(schema.$defs)) {
      const defined = Object.keys(node.properties)
        .filter((name) => name.startsWith(`${profile.prefix}/`))
        .map((name) => escape(name.slice(profile.prefix.length + 1)));
      const unless = defined.length === 0 ? "" : `(?!(?:${defined.join("|")})$)`;
      node.patternProperties[`^${escape(profile.prefix)}/${unless}`] = false;
    }
  }
  return schema;
};

/**
 * Checks messages that claim to conform to a profile: each must name the
 * profile (or, for the core, name none), and be valid under both the wire
 * schema and the profile's producer schema. Returns the problems found.
 */
export const checkMessages = (wire, profile, messages) => {
  const producer = producerSchema(wire, profile);
  const ajv = ajvWith(wire, producer);
  const kinds = kindsOf(wire);
  // Validate against the message's own kind where it names one, so the errors are about that kind.
  const defFor = (message) => (kinds.includes(message?.kind) ? kindDef(message.kind) : "Message");
  const problems = [];
  for (const [name, message] of messages) {
    const named = message?.profile ?? CORE;
    if (named !== profile.id) problems.push(`${name}: names profile ${named}, not ${profile.id}`);
    const onWire = validatorFor(ajv, wire, defFor(message));
    if (!onWire(message)) problems.push(`${name}: not valid on the wire: ${ajv.errorsText(onWire.errors)}`);
    const asProduced = validatorFor(ajv, producer, defFor(message));
    if (!asProduced(message))
      problems.push(`${name}: not valid under ${profile.id}: ${ajv.errorsText(asProduced.errors)}`);
  }
  return problems;
};
