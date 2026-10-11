// Scores a run's raw responses and writes its report, results/<run>/RESULTS.md.
// The latest run's report is also eval/RESULTS.md.
//
//   node eval/summarize.ts [--date <run>]
//
// Every rate is printed with its n. Scoring happens here, not in the run, so a
// scoring fix rescores the same responses without new inference. A run whose
// run.json names a baseline is compared with it, rescored the same way.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { Mode, Task } from "./requests.ts";
import { CLASSES, type Class, NO_CITATION, oneCharacterProse, score } from "./score.ts";

/** USD per 1,000 neurons, the Workers AI price on the run date. */
const USD_PER_KILONEURON = 0.011;

const root = new URL("../", import.meta.url);
const runs = readdirSync(new URL("eval/results/", root)).toSorted();
const { values } = parseArgs({ options: { date: { type: "string", default: runs.at(-1) } } });
const dirOf = (date: string) => new URL(`eval/results/${date}/`, root);
const dir = dirOf(values.date!);
const run = JSON.parse(readFileSync(new URL("run.json", dir), "utf8"));
const tasks: Task[] = JSON.parse(readFileSync(new URL("eval/tasks.json", root), "utf8")).tasks;
const kinds = [...new Set(tasks.map((t) => t.kind))];
const modes: Mode[] = run.modes;

type Row = {
  model: string;
  mode: Mode;
  task: Task;
  class: Class;
  detail?: string;
  /** A valid message with a prose member one character long. */
  thin: boolean;
  attempts: number;
  neurons: number;
  inTokens: number;
  outTokens: number;
};
const load = (from: URL): Row[] =>
  readdirSync(from)
    .filter((f) => f.endsWith(".jsonl"))
    .flatMap((f) => readFileSync(new URL(f, from), "utf8").split("\n").filter(Boolean))
    .map((line) => {
      const r = JSON.parse(line);
      const task = tasks.find((t) => t.id === r.task)!;
      const s = score(task, r.mode, r.response);
      const usage = r.response.output?.usage ?? {};
      return {
        model: r.model,
        mode: r.mode,
        task,
        class: s.class,
        detail: s.detail,
        thin: s.class === "valid" && oneCharacterProse(task.kind, s.message).length > 0,
        attempts: r.attempt,
        neurons: usage.neurons ?? 0,
        inTokens: usage.prompt_tokens ?? 0,
        outTokens: usage.completion_tokens ?? 0,
      };
    });
const rows = load(dir);
const before = run.baseline === undefined ? [] : load(dirOf(run.baseline));

const models: string[] = run.models.filter((m: string) => rows.some((r) => r.model === m));
const cell = (xs: Row[]) => {
  const valid = xs.filter((r) => r.class === "valid").length;
  return xs.length === 0 ? "n=0" : `${valid}/${xs.length} (${Math.round((100 * valid) / xs.length)}%)`;
};
const thinCell = (xs: Row[]) => {
  const valid = xs.filter((r) => r.class === "valid");
  return valid.length === 0 ? "n=0" : `${valid.filter((r) => r.thin).length}/${valid.length}`;
};
const where = (p: Partial<{ model: string; mode: Mode; kind: string }>, from = rows) =>
  from.filter((r) => (p.model === undefined || r.model === p.model) && (p.mode === undefined || r.mode === p.mode) && (p.kind === undefined || r.task.kind === p.kind));

const lines: string[] = [];
const out = (s = "") => lines.push(s);
const table = (head: string[], body: string[][]) => {
  out(`| ${head.join(" | ")} |`);
  out(`|${head.map(() => "---").join("|")}|`);
  for (const row of body) out(`| ${row.join(" | ")} |`);
  out();
};

out("# Emit eval results");
out();
out(
  "Whether models emit MFP 0.2 validly, per kind, through each binding. A response is **valid** when, after `toWire`, it is a message of the task's kind that is valid on the wire and under the core producer schema, and cites only refs the task issued. Each cell is valid/n. See [README.md]({eval}README.md) for the method.",
);
out();
out(`This is run \`${values.date}\`. Each run's own report is \`results/<run>/RESULTS.md\`, beside its raw responses.`);
out();
// What the numbers show, written by whoever ran the eval, from results/<date>/notes.md.
if (existsSync(new URL("notes.md", dir))) {
  out("## Findings");
  out();
  out(readFileSync(new URL("notes.md", dir), "utf8").trim());
  out();
}

if (run.baseline !== undefined) {
  const readable = (xs: Row[]) => xs.filter((r) => r.class === "valid" && !r.thin).length;
  const valid = (xs: Row[]) => xs.filter((r) => r.class === "valid").length;
  const change = (f: (xs: Row[]) => number, p: Parameters<typeof where>[0]) => {
    const [a, b] = [where(p, before), where(p)];
    return `${f(a)}/${a.length} → ${f(b)}/${b.length}`;
  };
  out(`## Against \`${run.baseline}\``);
  out();
  out(
    `The same models, tasks, samples and settings as run \`${run.baseline}\`, both scored by the same scorer. Each cell is before → after. **Readable** is valid with no prose member one character long.`,
  );
  out();
  table(
    ["Mode", "What changed", "Valid", "Readable"],
    modes.map((mode) => [mode, run.changes?.[mode] ?? "nothing", change(valid, { mode }), change(readable, { mode })]),
  );
  table(
    ["Model", ...modes.map((mode) => `${mode}: valid`)],
    models.map((m) => [`\`${m}\``, ...modes.map((mode) => change(valid, { model: m, mode }))]),
  );
}

out("## Run");
out();
table(
  ["Setting", "Value"],
  [
    ["Date", String(run.date)],
    ["Models", models.map((m) => `\`${m}\``).join(", ")],
    ["Modes", modes.join(", ")],
    ["Tasks", `${run.tasks} (${kinds.length} kinds × ${run.tasks / kinds.length})`],
    ["Samples per task", String(run.samples)],
    ["max_tokens", String(run.settings.max_tokens)],
    ["temperature", String(run.settings.temperature)],
    ["top_p", String(run.settings.top_p)],
    ["Wrangler", `\`${run.wrangler}\``],
    ["Worker compatibility_date", String(run.compatibility_date)],
    ["Responses scored", String(rows.length)],
    ["Inference calls in this run, retries included", String(rows.reduce((a, r) => a + r.attempts, 0))],
    ["Inference calls before it (smoke and dry run, not scored)", String(run.prior)],
  ],
);

out("## Valid rate by mode");
out();
table(
  ["Model", ...modes],
  [...models.map((m) => [`\`${m}\``, ...modes.map((mode) => cell(where({ model: m, mode })))]), ["**All**", ...modes.map((mode) => `**${cell(where({ mode }))}**`)]],
);

out("## Valid, but one character of prose");
out();
out("A valid message can still say nothing: every member the emit schema types as `Text` (a goal, a rationale, a summary) needs only one non-space character. Each cell is how many of the valid messages have such a member exactly one character long.");
out();
table(
  ["Model", ...modes],
  [
    ...models.map((m) => [`\`${m}\``, ...modes.map((mode) => thinCell(where({ model: m, mode })))]),
    ["**All**", ...modes.map((mode) => `**${thinCell(where({ mode }))}**`)],
  ],
);

for (const mode of modes) {
  out(`## ${mode}: valid rate by kind`);
  out();
  table(
    ["Model", ...kinds],
    [...models.map((m) => [`\`${m}\``, ...kinds.map((kind) => cell(where({ model: m, mode, kind })))]), ["**All**", ...kinds.map((kind) => `**${cell(where({ mode, kind }))}**`)]],
  );
}

out("## Outcomes by class");
out();
out("Every response falls in exactly one class. In tool mode, `no-call` (the model answered without calling the tool) is a salience problem, separate from invalid output.");
out();
table(
  ["Model", "Mode", "n", ...CLASSES],
  models.flatMap((m) =>
    modes.map((mode) => {
      const xs = where({ model: m, mode });
      return [`\`${m}\``, mode, String(xs.length), ...CLASSES.map((c) => String(xs.filter((r) => r.class === c).length))];
    }),
  ),
);

out("## Tool mode: calls");
out();
table(
  ["Model", "Called the tool", "Valid among calls"],
  models.map((m) => {
    const xs = where({ model: m, mode: "tool" });
    const called = xs.filter((r) => r.class !== "no-call" && r.class !== "provider-error");
    const valid = called.filter((r) => r.class === "valid").length;
    return [`\`${m}\``, `${called.length}/${xs.length}`, called.length === 0 ? "n=0" : `${valid}/${called.length}`];
  }),
);

out("## Decision and observation: required citations");
out();
out("Decisions and observations must cite at least once. How many of their schema failures name `cites` at all, and how many cite nothing:");
out();
table(
  ["Kind", "Mode", "n", "schema failures", "naming cites", "citing nothing"],
  ["decision", "observation"].flatMap((kind) =>
    modes.map((mode) => {
      const xs = where({ kind, mode });
      const schema = xs.filter((r) => r.class === "schema");
      const count = (re: RegExp) => String(schema.filter((r) => re.test(r.detail ?? "")).length);
      return [kind, mode, String(xs.length), String(schema.length), count(/cites/), count(NO_CITATION)];
    }),
  ),
);

out("## Most common schema failures");
out();
const reasons = new Map<string, number>();
for (const r of rows.filter((x) => x.class === "schema")) {
  const first = (r.detail ?? "").replace(/^(wire|producer): /, "").split("; ")[0]!.replace(/\/\d+/g, "/*");
  reasons.set(first, (reasons.get(first) ?? 0) + 1);
}
table(
  ["Count", "First error"],
  [...reasons].toSorted((a, b) => b[1] - a[1]).slice(0, 15).map(([reason, n]) => [String(n), `\`${reason.replaceAll("|", "\\|")}\``]),
);

out("## Cost");
out();
out(`Neurons are as Workers AI reported them per response; USD at $${USD_PER_KILONEURON} per 1,000 neurons. Smoke and dry-run calls are not included.`);
out();
const sum = (xs: Row[], f: (r: Row) => number) => xs.reduce((a, r) => a + f(r), 0);
table(
  ["Model", "Input tokens", "Output tokens", "Neurons", "USD"],
  [...models.map((m) => where({ model: m })), rows].map((xs, i) => [
    i < models.length ? `\`${models[i]}\`` : "**All**",
    String(sum(xs, (r) => r.inTokens)),
    String(sum(xs, (r) => r.outTokens)),
    sum(xs, (r) => r.neurons).toFixed(0),
    ((sum(xs, (r) => r.neurons) / 1000) * USD_PER_KILONEURON).toFixed(2),
  ]),
);

const report = `${lines.join("\n").trimEnd()}\n`;
writeFileSync(new URL("RESULTS.md", dir), report.replaceAll("{eval}", "../../"));
const latest = values.date === runs.at(-1);
if (latest) writeFileSync(new URL("eval/RESULTS.md", root), report.replaceAll("{eval}", ""));
console.log(`scored ${rows.length} responses from ${values.date}; wrote results/${values.date}/RESULTS.md${latest ? " and eval/RESULTS.md" : ""}`);
