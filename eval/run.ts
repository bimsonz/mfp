// Runs the emit eval: every model × mode × task × sample, through the eval
// Worker (`pnpm eval:worker`), appending each raw response to
// eval/results/<date>/<model>.jsonl. A run resumes: jobs already recorded are
// skipped. Every inference attempt counts towards a hard stop.
//
//   node eval/run.ts [--date YYYY-MM-DD[-label]] [--samples 3] [--models a,b] [--modes prompt,tool]
//                    [--tasks id,id] [--prior N] [--concurrency 8] [--baseline <earlier run>]
//
// --date names the run's directory. --prior counts inference calls made outside
// the harness (e.g. smoke calls) towards the hard stop, and records them.
// --baseline names an earlier run this one is compared with. Members of run.json
// the harness does not set, such as `changes`, are kept.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { buildRequest, MODES, SETTINGS, type Mode, type Task } from "./requests.ts";

export const MODELS = [
  "@cf/moonshotai/kimi-k2.6",
  "@cf/openai/gpt-oss-120b",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/qwen/qwen3-30b-a3b-fp8",
  "@cf/ibm-granite/granite-4.0-h-micro",
];

/** No run makes more inference calls than this, retries included. */
const HARD_STOP = 1000;
const ENDPOINT = "http://localhost:8787/run";
/** Calls in flight at once; long reasoning and runaway calls each hold one for minutes. */
const DEFAULT_CONCURRENCY = 8;

const { values } = parseArgs({
  options: {
    date: { type: "string", default: new Date().toISOString().slice(0, 10) },
    samples: { type: "string", default: "3" },
    models: { type: "string", default: MODELS.join(",") },
    modes: { type: "string", default: MODES.join(",") },
    tasks: { type: "string" },
    prior: { type: "string" },
    concurrency: { type: "string", default: String(DEFAULT_CONCURRENCY) },
    baseline: { type: "string" },
  },
});

const root = new URL("../", import.meta.url);
const dir = new URL(`eval/results/${values.date}/`, root);
mkdirSync(dir, { recursive: true });
const fileFor = (model: string) => new URL(`${model.replaceAll("/", "_").replace(/^@/, "")}.jsonl`, dir);

const allTasks: Task[] = JSON.parse(readFileSync(new URL("eval/tasks.json", root), "utf8")).tasks;
const tasks = values.tasks === undefined ? allTasks : allTasks.filter((t) => values.tasks!.split(",").includes(t.id));
const models = values.models.split(",");
const modes = values.modes.split(",") as Mode[];
const samples = Number(values.samples);

type Job = { model: string; mode: Mode; task: Task; sample: number };
const key = (j: { model: string; mode: string; task: string; sample: number }) => `${j.model}|${j.mode}|${j.task}|${j.sample}`;

const done = new Set<string>();
for (const model of models)
  if (existsSync(fileFor(model)))
    for (const line of readFileSync(fileFor(model), "utf8").split("\n").filter(Boolean)) done.add(key(JSON.parse(line)));

// Interleaved, sample by sample, so that coverage stays even across models and
// modes if the run stops early.
const jobs: Job[] = Array.from({ length: samples }, (_, sample) => sample).flatMap((sample) =>
  tasks.flatMap((task) =>
    modes.flatMap((mode) =>
      models
        .map((model) => ({ model, mode, task, sample }))
        .filter((j) => !done.has(key({ ...j, task: j.task.id }))),
    ),
  ),
);

const run = JSON.parse(existsSync(new URL("run.json", dir)) ? readFileSync(new URL("run.json", dir), "utf8") : "{}");
const wrangler = execFileSync(new URL("node_modules/.bin/wrangler", root).pathname, ["--version"], { encoding: "utf8" }).trim();
const workerConfig = readFileSync(new URL("eval/worker/wrangler.jsonc", root), "utf8");
writeFileSync(
  new URL("run.json", dir),
  `${JSON.stringify(
    {
      ...run,
      date: values.date,
      commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
      models,
      modes,
      samples,
      tasks: allTasks.length,
      settings: { ...SETTINGS, temperature: "not sent (model default)", top_p: "not sent (model default)" },
      wrangler,
      compatibility_date: /"compatibility_date":\s*"([^"]+)"/.exec(workerConfig)?.[1],
      prior: values.prior === undefined ? (run.prior ?? 0) : Number(values.prior),
      attempts: run.attempts ?? 0,
      ...(values.baseline === undefined ? {} : { baseline: values.baseline }),
    },
    null,
    2,
  )}\n`,
);

const prior = values.prior === undefined ? (run.prior ?? 0) : Number(values.prior);
let attempts = run.attempts ?? 0;
const transient = (error: string) => /capacity|rate limit|too many|429|50[234]|timeout|timed out|network|fetch failed/i.test(error);

const infer = async (job: Job) => {
  const input = buildRequest(job.task, job.mode);
  for (let attempt = 1; ; attempt++) {
    if (prior + attempts >= HARD_STOP) throw new Error(`hard stop: ${HARD_STOP} inference calls`);
    attempts++;
    let response: any;
    try {
      response = await (await fetch(ENDPOINT, { method: "POST", body: JSON.stringify({ model: job.model, input }) })).json();
    } catch (e) {
      response = { ok: false, ms: 0, error: `transport: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (response.ok || attempt === 3 || !transient(response.error)) return { response, attempt };
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
};

console.log(`${jobs.length} jobs to run (${done.size} already recorded); ${attempts} attempts so far`);
let next = 0;
let finished = 0;
const worker = async () => {
  while (next < jobs.length) {
    const job = jobs[next++]!;
    const { response, attempt } = await infer(job);
    appendFileSync(
      fileFor(job.model),
      `${JSON.stringify({ model: job.model, mode: job.mode, task: job.task.id, kind: job.task.kind, sample: job.sample, attempt, at: new Date().toISOString(), response })}\n`,
    );
    finished++;
    if (finished % 25 === 0) console.log(`${finished}/${jobs.length} (attempts ${attempts})`);
  }
};
try {
  await Promise.all(Array.from({ length: Number(values.concurrency) }, worker));
} finally {
  const meta = JSON.parse(readFileSync(new URL("run.json", dir), "utf8"));
  writeFileSync(new URL("run.json", dir), `${JSON.stringify({ ...meta, attempts }, null, 2)}\n`);
  console.log(`finished ${finished} jobs; ${attempts} inference attempts in this run's directory`);
}
