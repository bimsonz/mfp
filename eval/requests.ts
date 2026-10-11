// Builds the request for one task in one mode. Every request carries the
// committed model-facing schemas, unmodified: the eval measures what MFP ships.
import { readFileSync } from "node:fs";

export type Mode = "prompt" | "json_schema" | "tool";
export const MODES: Mode[] = ["prompt", "json_schema", "tool"];

export type Task = { id: string; kind: string; situation: string; issued: string[] };

/** The settings every request sends. Temperature and top_p are not sent: each model's default applies. */
export const SETTINGS = { max_tokens: 10000 } as const;

const committed = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/** The committed structured-output schema for a kind, as its exact bytes. */
export const emitText = (kind: string): string => committed(`schema/0.2/emit/${kind}.schema.json`);

/** The committed MCP tool for a kind. */
export const toolFor = (kind: string): { name: string; description: string; inputSchema: object } =>
  JSON.parse(committed(`schema/0.2/mcp/${kind}.tool.json`));

export const PREAMBLE =
  "You are a coding agent. The system that runs you reads your reports in MFP, the Model Feedback Protocol, version 0.2. Identifiers it has issued to you appear in square brackets, like [call_01]. Cite only those, by the identifier without its brackets.";

const instruction = (kind: string, mode: Mode): string =>
  mode === "prompt"
    ? `Reply with exactly one JSON object and nothing else: an MFP ${kind} message that is valid against this JSON Schema.\n\n${emitText(kind)}`
    : mode === "json_schema"
      ? `Reply with an MFP ${kind} message.`
      : `Report it by calling the ${toolFor(kind).name} tool.`;

/** The `input` for `env.AI.run`: chat messages, the shared settings, and the mode's schema or tool. */
export const buildRequest = (task: Task, mode: Mode): Record<string, unknown> => {
  const request: Record<string, unknown> = {
    messages: [
      { role: "system", content: `${PREAMBLE}\n\n${instruction(task.kind, mode)}` },
      { role: "user", content: `${task.situation}\n\nReport your ${task.kind}.` },
    ],
    ...SETTINGS,
  };
  if (mode === "json_schema")
    request.response_format = {
      type: "json_schema",
      json_schema: { name: `mfp_${task.kind}`, strict: true, schema: JSON.parse(emitText(task.kind)) },
    };
  if (mode === "tool") {
    const { name, description, inputSchema } = toolFor(task.kind);
    request.tools = [{ type: "function", function: { name, description, parameters: inputSchema } }];
  }
  return request;
};
