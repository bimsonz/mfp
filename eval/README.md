# The emit eval

MFP is judged by whether models emit it reliably. This eval measures that.

It asks real models to report in MFP, for a fixed set of coding tasks, through each [binding](../docs/specification/0.2/bindings.md), and measures how often what they emit is a valid message. The results are in [RESULTS.md](RESULTS.md).

## What it runs

- **Tasks.** [`tasks.json`](tasks.json) holds 18 short coding situations, three for each kind of message. Each names the kind of report it asks for, and the identifiers the driver issued (`[call_01]`, `[dec_02]`), which are the only refs a report may cite.
- **Modes.** Every request carries the committed schemas, byte for byte ([`requests.ts`](requests.ts)):

  | Mode | The model is given |
  |---|---|
  | `prompt` | The kind's emit schema in the system prompt, and an instruction to reply with one JSON object only. No constrained decoding. |
  | `json_schema` | The kind's emit schema as `response_format` (structured output), and the same schema in the system prompt, as [bindings.md](../docs/specification/0.2/bindings.md#structured-output) asks. |
  | `tool` | The kind's MCP tool as a function, and the instruction to report by calling it. The model may also answer without calling it. |

- **Models.** Each runs through the Workers AI binding of a local Worker ([`worker/`](worker)) under `wrangler dev`, which runs inference on the account wrangler is logged in to. Nothing is deployed.
- **Settings.** `max_tokens` is the same for every request. Temperature and `top_p` are not sent, so each model's default applies. Each task is sampled several times per model and mode.

## What counts as valid

[`score.ts`](score.ts) gives every response exactly one class:

| Class | |
|---|---|
| `valid` | After `toWire`, a message of the task's kind that is valid on the wire and under the core producer schema, citing only refs the task issued |
| `invalid-json` | No JSON object where the mode needs one: no reply, prose around the JSON, or tool arguments that are not an object |
| `schema` | A JSON object, but not a valid message of the task's kind |
| `unissued-ref` | A valid message that cites a ref the task never issued |
| `no-call` | Tool mode: the model answered without calling the tool |
| `wrong-call` | Tool mode: the model called another tool |
| `provider-error` | The inference failed |

In prompt mode, a reply may be fenced as a Markdown code block, but nothing else may surround the JSON.

In tool mode, `no-call` is reported apart from invalid output: it says the tool was not salient enough, not that its schema failed.

A valid message can still be empty: a member typed `Text` needs only one non-space character. RESULTS.md counts how many valid messages have a prose member exactly one character long, beside the valid rate rather than inside it.

Scoring runs over the recorded responses, so a change to scoring rescores a run without new inference. The conformance suite tests the tasks, the requests and the scorer (`conformance/eval.test.ts`). The live run is not part of CI.

## Run it

```sh
CLOUDFLARE_ACCOUNT_ID=<account> pnpm eval:worker     # terminal 1: the Worker, under wrangler dev
pnpm eval:run -- --date 2026-10-11 --samples 3        # terminal 2: resumable; stops at 1,000 calls
pnpm eval:summarize -- --date 2026-10-11             # writes results/2026-10-11/RESULTS.md, and RESULTS.md for the latest run
```

Raw responses are kept in `results/<run>/<model>.jsonl`, with the run's settings in `results/<run>/run.json` and its report in `results/<run>/RESULTS.md`.

A run that tests a change names the run it is compared with: `--baseline 2026-10-11`. Its `run.json` says, under `changes`, what changed in each mode, and its report puts each mode's valid rate before and after side by side.
