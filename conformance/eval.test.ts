import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toEmit } from "../lib/emit.js";
import { kindsOf, loadWire } from "../lib/profile.js";
import { buildRequest, MODES, PREAMBLE, type Task } from "../eval/requests.ts";
import { NO_CITATION, oneCharacterProse, type Response, refsOf, score } from "../eval/score.ts";
import { readJson, root } from "./support.ts";

// The emit eval's tasks, requests and scoring. The live run needs a Workers AI
// account and is not run here; everything it depends on is.
const tasks: Task[] = readJson("eval/tasks.json").tasks;
const kinds = kindsOf(loadWire());
const committedText = (path: string) => readFileSync(join(root, path), "utf8");

describe("T12: tasks", () => {
  it.each(kinds)("%s has at least three tasks", (kind) => {
    expect(tasks.filter((t) => t.kind === kind).length).toBeGreaterThanOrEqual(3);
  });
  it("has unique ids, each named after its kind", () => {
    expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length);
    for (const t of tasks) expect(t.id.split(".")[0]).toBe(t.kind);
  });
  it.each(tasks.map((t): [string, Task] => [t.id, t]))("%s issues exactly the refs its situation shows", (_, task) => {
    const shown = [...task.situation.matchAll(/\[([a-z]+_\d+)\]/g)].map(([, ref]) => ref);
    expect([...new Set(shown)].toSorted()).toEqual([...task.issued].toSorted());
  });
  // Recorded responses are published as they came back, so an error that carries
  // a stack trace would publish the paths of the machine that ran the eval.
  const results = join(root, "eval/results");
  const recorded = readdirSync(results, { recursive: true, encoding: "utf8" }).filter((f) => /\.(jsonl?|md)$/.test(f));
  it("has recorded results to check", () => expect(recorded.length).toBeGreaterThan(0));
  it.each(recorded)("%s records no local file paths", (f) => {
    expect(readFileSync(join(results, f), "utf8")).not.toMatch(/file:\/\/|\/Users\/|\/home\/|\/private\//);
  });
});

/** Each task's request in one mode, as test rows. */
const rows = (mode: (typeof MODES)[number]) => tasks.map((task): [string, any, Task] => [task.id, buildRequest(task, mode), task]);

describe("T14: requests carry the committed schemas, unmodified", () => {
  it.each(MODES.flatMap((mode) => rows(mode)))("%s shares the preamble, task and settings", (_, request, task) => {
    expect(request.messages[0].content.startsWith(PREAMBLE)).toBe(true);
    expect(request.messages[1].content).toContain(task.situation);
    expect(request.max_tokens).toBeGreaterThan(0);
  });

  it.each(rows("prompt"))("prompt %s embeds the committed emit schema's bytes", (_, request, task) => {
    // The very bytes committed, not a re-serialisation.
    expect(request.messages[0].content.endsWith(committedText(`schema/0.2/emit/${task.kind}.schema.json`))).toBe(true);
    expect([request.response_format, request.tools]).toEqual([undefined, undefined]);
  });

  it.each(rows("json_schema"))("json_schema %s passes the committed emit schema, and shows it", (_, request, task) => {
    expect(request.messages[0].content.endsWith(committedText(`schema/0.2/emit/${task.kind}.schema.json`))).toBe(true);
    expect(request.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: `mfp_${task.kind}`, strict: true, schema: readJson(`schema/0.2/emit/${task.kind}.schema.json`) },
    });
    expect(request.tools).toBeUndefined();
  });

  it.each(rows("tool"))("tool %s offers the committed MCP tool", (_, request, task) => {
    const tool = readJson(`schema/0.2/mcp/${task.kind}.tool.json`);
    expect(request.tools).toEqual([
      { type: "function", function: { name: tool.name, description: tool.description, parameters: tool.inputSchema } },
    ]);
    expect(request.response_format).toBeUndefined();
  });
});

// A valid message for a task, in the form a model emits it.
const task = tasks.find((t) => t.id === "decision.permission-cache")!;
const message = {
  mfp: "0.2",
  kind: "decision",
  chosen: "Keep permission checks per request",
  rationale: "Revocation must take effect immediately, and per-request checks cost 4 ms",
  alternatives: [{ option: "Cache per session", reasonRejected: "A removed collaborator keeps access until the session ends" }],
  reversible: true,
  cites: [{ kind: "tool-result", ref: "call_11" }],
};
const emitted = toEmit(message, readJson("schema/0.2/emit/decision.schema.json"));
const toolArgs = toEmit(message, readJson("schema/0.2/mcp/decision.tool.json").inputSchema);
const reply = (content: string | null, extra: object = {}): Response => ({
  ok: true,
  ms: 1,
  output: { choices: [{ message: { content, ...extra }, finish_reason: "stop" }] },
});
const call = (name: string, args: unknown) => reply(null, { tool_calls: [{ type: "function", function: { name, arguments: args } }] });

describe("T13: scoring gives each response exactly one class", () => {
  const cases: [string, (typeof MODES)[number], Response, string][] = [
    ["a reply that is the message", "json_schema", reply(JSON.stringify(emitted)), "valid"],
    ["a reply fenced as JSON", "prompt", reply(`\`\`\`json\n${JSON.stringify(emitted)}\n\`\`\``), "valid"],
    ["a message inside prose", "prompt", reply(`Here is my decision:\n${JSON.stringify(emitted)}`), "invalid-json"],
    ["no reply text", "prompt", reply(null), "invalid-json"],
    ["a reply that is a JSON array", "json_schema", reply(JSON.stringify([emitted])), "invalid-json"],
    ["a nested null, dropped by toWire", "json_schema", reply(JSON.stringify({ ...emitted, question: null })), "valid"],
    ["a message of another kind", "json_schema", reply(JSON.stringify({ ...emitted, kind: "observation" })), "schema"],
    ["a decision with no citation", "json_schema", reply(JSON.stringify({ ...emitted, cites: [] })), "schema"],
    ["a member a producer must not emit", "json_schema", reply(JSON.stringify({ ...emitted, evidenceClass: "proof" })), "schema"],
    ["a tool call with arguments as a JSON string", "tool", call("mfp_decision", JSON.stringify(toolArgs)), "valid"],
    ["a tool call with arguments as an object", "tool", call("mfp_decision", toolArgs), "valid"],
    ["a tool call with double-encoded arguments", "tool", call("mfp_decision", JSON.stringify(JSON.stringify(toolArgs))), "invalid-json"],
    ["a tool call with a nested array as a string", "tool", call("mfp_decision", { ...toolArgs, alternatives: JSON.stringify(toolArgs.alternatives) }), "schema"],
    ["a call to another tool", "tool", call("mfp_observation", toolArgs), "wrong-call"],
    ["no tool call in tool mode", "tool", reply("I decided to keep checks per request."), "no-call"],
    ["a provider failure", "tool", { ok: false, ms: 1, error: "JSON Mode couldn't be met" }, "provider-error"],
  ];
  it.each(cases)("%s", (_, mode, response, expected) => {
    expect(score(task, mode, response).class).toBe(expected);
  });

  it.each([
    ["an empty cites", { ...emitted, cites: [] }],
    ["no cites at all", { ...emitted, cites: undefined }],
  ])("tells a decision with %s apart from a malformed one", (_, uncited) => {
    expect(score(task, "json_schema", reply(JSON.stringify(uncited))).detail).toMatch(NO_CITATION);
    const malformed = { ...emitted, cites: ["call_11"] };
    expect(score(task, "json_schema", reply(JSON.stringify(malformed))).detail).not.toMatch(NO_CITATION);
  });
  it("names the prose a valid message leaves one character long", () => {
    const thin = { ...message, rationale: "C", alternatives: [{ option: "c", reasonRejected: " C " }] };
    expect(score(task, "json_schema", reply(JSON.stringify(toEmit(thin, readJson("schema/0.2/emit/decision.schema.json"))))).class).toBe("valid");
    expect(oneCharacterProse("decision", thin)).toEqual(["/rationale", "/alternatives/0/option", "/alternatives/0/reasonRejected"]);
    expect(oneCharacterProse("decision", message)).toEqual([]);
  });
  it("leaves a one-character proposition value alone", () => {
    const premise = { kind: "premise", premise: { subject: "queue.workers", predicate: "cardinality", relation: "at-most", value: "5" } };
    expect(oneCharacterProse("premise", premise)).toEqual([]);
  });
});

describe("T15: a ref the driver never issued is a defect", () => {
  it("scores a message citing an unissued ref as unissued-ref", () => {
    const invented = { ...emitted, cites: [{ kind: "tool-result", ref: "call_99" }] };
    expect(score(task, "json_schema", reply(JSON.stringify(invented)))).toMatchObject({ class: "unissued-ref", detail: "call_99" });
  });
  it("checks refs at any depth, and a stance's decision", () => {
    expect(
      refsOf({ kind: "stance", decision: "dec_09", cites: [{ kind: "record", ref: "rec_1" }], premise: { cites: [{ kind: "message", ref: "msg_7" }] } }).toSorted(),
    ).toEqual(["dec_09", "msg_7", "rec_1"]);
  });
  it("does not read an anchor's path as a ref", () => {
    expect(refsOf({ kind: "decision", cites: [{ kind: "anchor", path: "src/a.ts" }] })).toEqual([]);
  });
});
