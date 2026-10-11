// Scores one model response. Each response gets exactly one class:
//
//   valid           after toWire, valid on the wire and under the core producer
//                   schema, citing only refs the task issued
//   invalid-json    no JSON object where the mode needs one
//   schema          a JSON object, but not a valid message of the task's kind
//   unissued-ref    a valid message citing a ref the task never issued
//   no-call         tool mode: the model called no tool (a salience problem,
//                   not a schema one)
//   wrong-call      tool mode: the model called some other tool
//   provider-error  the inference failed
import { toWire } from "../lib/emit.js";
import { ajvWith, loadCore, loadWire, producerSchema, validatorFor } from "../lib/profile.js";
import { emitText, type Mode, type Task } from "./requests.ts";

export type Class =
  | "valid"
  | "invalid-json"
  | "schema"
  | "unissued-ref"
  | "no-call"
  | "wrong-call"
  | "provider-error";

export const CLASSES: Class[] = [
  "valid",
  "invalid-json",
  "schema",
  "unissued-ref",
  "no-call",
  "wrong-call",
  "provider-error",
];

export type Score = { class: Class; detail?: string; message?: unknown };

/** What the Worker returns for one inference. */
export type Response = { ok: true; ms: number; output: any } | { ok: false; ms: number; error: string };

const wire = loadWire();
const producer = producerSchema(wire, loadCore());
const ajv = ajvWith(wire, producer);
const kindDef = (kind: string) => kind[0]!.toUpperCase() + kind.slice(1);

const choice = (output: any) => output?.choices?.[0];

/** The reply's text, from an OpenAI-style completion or the older `response` form. */
export const replyText = (output: any): string | undefined => {
  const content = choice(output)?.message?.content;
  if (typeof content === "string") return content;
  if (typeof output?.response === "string") return output.response;
  if (output?.response !== undefined && output?.response !== null) return JSON.stringify(output.response);
  return undefined;
};

/** The tool calls in a reply, with their arguments as sent. */
export const toolCalls = (output: any): { name: string; arguments: unknown }[] =>
  (choice(output)?.message?.tool_calls ?? output?.tool_calls ?? []).map((call: any) => ({
    name: call?.function?.name ?? call?.name,
    arguments: call?.function?.arguments ?? call?.arguments,
  }));

/** A reply that is one JSON object, optionally inside one Markdown code fence. */
export const parseReply = (text: string): unknown => {
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/.exec(text.trim());
  try {
    const value = JSON.parse(fenced === null ? text.trim() : fenced[1]!);
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

/** Every ref a message cites, and a stance's decision. */
export const refsOf = (message: unknown): string[] => {
  const refs: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node !== null && typeof node === "object") {
      const n = node as Record<string, unknown>;
      if (typeof n.ref === "string" && ["message", "tool-result", "record"].includes(n.kind as string)) refs.push(n.ref);
      Object.values(n).forEach(walk);
    }
  };
  walk(message);
  const m = message as Record<string, unknown>;
  if (m.kind === "stance" && typeof m.decision === "string") refs.push(m.decision);
  return refs;
};

/** The members a kind's emit schema types as `Text`, prose a reader reads. A proposition's `value` is left out: "5" is a whole value. */
const proseKeys = (kind: string): Set<string> => {
  const keys = new Set<string>();
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node !== null && typeof node === "object") {
      const properties = (node as { properties?: Record<string, unknown> }).properties ?? {};
      for (const [key, schema] of Object.entries(properties))
        if (key !== "value" && JSON.stringify(schema).includes('"#/$defs/Text"')) keys.add(key);
      Object.values(node).forEach(walk);
    }
  };
  walk(JSON.parse(emitText(kind)));
  return keys;
};

/** The paths of a message's prose members that are one character long: valid, and empty of content. */
export const oneCharacterProse = (kind: string, message: unknown): string[] => {
  const keys = proseKeys(kind);
  const paths: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}/${i}`));
    else if (node !== null && typeof node === "object")
      for (const [key, value] of Object.entries(node)) {
        if (keys.has(key) && typeof value === "string" && value.trim().length === 1) paths.push(`${path}/${key}`);
        walk(value, `${path}/${key}`);
      }
  };
  walk(message, "");
  return paths;
};

/** A schema failure's detail when a message that must cite cites nothing. */
export const NO_CITATION = /\/cites must NOT have fewer than 1 items|must have required property 'cites'/;

const errorsOf = (validate: { errors?: unknown }) =>
  ((validate.errors ?? []) as { instancePath: string; message?: string }[])
    .slice(0, 3)
    .map((e) => `${e.instancePath || "/"} ${e.message}`)
    .join("; ");

/** Validates a wire message as the task's kind, on the wire and as produced. */
const judge = (task: Task, message: unknown): Score => {
  const kind = (message as { kind?: unknown })?.kind;
  if (kind !== task.kind) return { class: "schema", detail: `kind is ${JSON.stringify(kind)}, not ${task.kind}`, message };
  const onWire = validatorFor(ajv, wire, kindDef(task.kind));
  if (!onWire(message)) return { class: "schema", detail: `wire: ${errorsOf(onWire)}`, message };
  const asProduced = validatorFor(ajv, producer, kindDef(task.kind));
  if (!asProduced(message)) return { class: "schema", detail: `producer: ${errorsOf(asProduced)}`, message };
  const unissued = refsOf(message).filter((ref) => !task.issued.includes(ref));
  if (unissued.length > 0) return { class: "unissued-ref", detail: unissued.join(", "), message };
  return { class: "valid", message };
};

export const score = (task: Task, mode: Mode, response: Response): Score => {
  if (!response.ok) return { class: "provider-error", detail: response.error };
  const { output } = response;
  const finish = choice(output)?.finish_reason;

  if (mode === "tool") {
    const calls = toolCalls(output);
    if (calls.length === 0) return { class: "no-call", detail: finish === undefined ? undefined : `finish_reason ${finish}` };
    const call = calls[0]!;
    if (call.name !== `mfp_${task.kind}`) return { class: "wrong-call", detail: String(call.name) };
    let args = call.arguments;
    if (typeof args === "string") {
      try {
        args = JSON.parse(args);
      } catch {
        return { class: "invalid-json", detail: "tool arguments are not JSON" };
      }
    }
    if (args === null || typeof args !== "object" || Array.isArray(args))
      return { class: "invalid-json", detail: `tool arguments are a JSON ${typeof args}, not an object` };
    return judge(task, toWire(args, { kind: task.kind }));
  }

  const text = replyText(output);
  if (text === undefined || text.trim() === "")
    return { class: "invalid-json", detail: `no reply text${finish === undefined ? "" : ` (finish_reason ${finish})`}` };
  const parsed = parseReply(text);
  if (parsed === undefined)
    return { class: "invalid-json", detail: `reply is not one JSON object${finish === "length" ? " (finish_reason length)" : ""}` };
  return judge(task, toWire(parsed));
};
