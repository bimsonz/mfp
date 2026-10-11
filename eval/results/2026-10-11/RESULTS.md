# Emit eval results

Whether models emit MFP 0.2 validly, per kind, through each binding. A response is **valid** when, after `toWire`, it is a message of the task's kind that is valid on the wire and under the core producer schema, and cites only refs the task issued. Each cell is valid/n. See [README.md](../../README.md) for the method.

This is run `2026-10-11`. Each run's own report is beside its raw responses:

- [`2026-10-11`](../../results/2026-10-11/RESULTS.md): every mode
- [`2026-10-11-0002`](../../results/2026-10-11-0002/RESULTS.md): every mode, against `2026-10-11`
- [`2026-10-11-0002-descriptions`](../../results/2026-10-11-0002-descriptions/RESULTS.md): tool only, against `2026-10-11-0002`

## Findings

Each cell below is small: 9 responses per model, mode and kind (3 tasks × 3 samples), and 54 per model and mode. A difference of one or two in a cell is noise.

### F1. One model needs room to reason

In the dry run, `max_tokens` 4096 truncated `kimi-k2.6` in every mode, because its reasoning runs past 4K tokens. This run sends 10000 to every model. `llama-3.3-70b`'s 24K context limits how far that can rise.

### F2. Under `json_schema`, the emit schemas yield valid messages that say nothing

- **A `Text` member is forced to one character.** The emit schemas type prose (a goal, a rationale, a summary, an argument) as `Text`, which is `{"type": "string", "pattern": "\\S"}`. JSON Schema's `pattern` is unanchored, so `\S` means "at least one non-space character". The constrained decoder behind `response_format` matches a pattern against the whole string, so it allows exactly one character. The result: `"rationale": "C"`.
  - Of the 141 valid `json_schema` messages, 138 have a prose member exactly one character long (see "Valid, but one character of prose"). No valid message in the other two modes has one.
  - So `json_schema`'s 52% is schema validity only. Three of its 270 messages are both valid and readable.
- **Open-ended patterns run away.** A pattern that allows a string to keep growing, such as a scope or a commit id, lets the decoder keep extending it: `…_and_2557_and_255…`, `-0.2-0.2-0.2…`, commit hex past 64 characters.
- **A model cut off mid-thought writes whitespace.** Forced to close a string after one character, a model often keeps going in the only place the grammar leaves open, the whitespace between tokens, until it hits the cap.
- **Counts.**
  - 43 `json_schema` replies hit `max_tokens` (`finish_reason` `length`, 10,000 tokens): 29 ended inside a string, 14 in whitespace.
  - Another 27 timed out at 120 s on all three attempts (error 3046): `llama-3.3-70b` 15 and `granite-4.0-h-micro` 12, all on intent and premise tasks, whose schemas carry the subject and scope patterns. They are the bulk of the provider errors. A timeout returns no text, so the runaway behind them is likely but not shown.
- **The model writes blind.** Workers AI does not put the schema in front of the model in this mode: median prompt tokens are 132–185 per model, against about 1,500 in prompt mode, where the schema is in the system prompt. Without the descriptions, stances put a word such as `"comply"`, `"overrule"` or `"agree"` in `decision`, which is the ref of the decision the stance is on. That accounts for 23 of this mode's 48 unissued refs.
- `gpt-oss-120b` and `qwen3-30b` emit members in alphabetical order under `json_schema`.

Proposal 0002, emit without patterns, takes this up: it strips `pattern` from the emit schemas (the wire keeps enforcing it), and has drivers put the schema's descriptions in the prompt under constrained decoding.

### F3. Tool mode depends on how each model's tool format renders the schema

- Of 270 tool-mode requests, 266 called `mfp_<kind>`. Three answered without calling it (`qwen3-30b`), and one called a `get_file` tool it was never offered (`gpt-oss-120b`).
- `kimi-k2.6`: 53/54.
- `gpt-oss-120b`: 4/54. It writes nested objects as prose or as bare refs (`"premise": "The permissions service answers within 50 ms…"`, `"cites": ["call_11"]`). Its tool-mode prompts are a median 363 tokens. `llama-3.3-70b`, `qwen3-30b` and `granite-4.0-h-micro` send 1,248–1,583. That fits its tool rendering dropping the `$defs` where the nested types live. But `kimi-k2.6`'s prompts are 683 tokens and it does well, so this is a lead, not a finding. Inlining `$ref`s in the tool's parameters would test it.
- `llama-3.3-70b`: 18/54.
  - In 13 of its 24 schema failures, it sends a nested array as a JSON string (`"footprint": "[{…}]"`).
  - In all 12 of its unissued-ref failures, it cites issued refs with their brackets (`"[call_25]"`).
- `qwen3-30b`: 33/54. 13 of its 18 schema failures are a premise's subject, either missing or outside the key grammar, or a predicate outside the core.
- `granite-4.0-h-micro`: 0/54. In 52 calls the arguments are double-encoded: a JSON string of a JSON string.

### F4. Prompt mode is the strongest binding

- 178/270 valid (66%), and no valid prompt-mode message has a one-character prose member. `kimi-k2.6` is 53/54 and `gpt-oss-120b` 49/54.
- The commonest failure across the run is a subject outside the key grammar `^[a-z0-9]+(?:[.-][a-z0-9]+)*$`. Where the grammar wants lower-case words joined by dots or dashes, models write a symbol, a path or a phrase: `handleInvoicePaid`, `src/authz/check.ts`, `mobile client`, `startup_column`.
- In 17 of its 23 prompt-mode failures, `llama-3.3-70b` writes `cites` entries as bare strings.
- In all 25 of its prompt-mode unissued-ref failures, `granite-4.0-h-micro` cites issued refs with their brackets, although the preamble says to cite without them. They count as unissued refs.

### F5. The required citation cost nothing

Decisions and observations must cite at least once. The "citing nothing" column is 0 in every mode: no decision or observation failed for lack of a citation. Every failure that names `cites` is a malformed citation, either a bare string or an array sent as a string.

### F6. Provider errors

There are 29:
- the 27 `json_schema` timeouts above;
- one internal error on `kimi-k2.6` (`json_schema`, after three attempts);
- one internal server error (8005) on `gpt-oss-120b` in prompt mode.

### Calls and cost

- The harness counted 920 inference calls: 881 in this run, retries included, and 39 before it (the smoke test and the dry run).
- The account's Workers AI analytics show 922 inferences of these five models, all on 11 October between 03:00 and 05:00 UTC, with no other use since 1 October. They total 199,803 neurons, $2.20 at the list price.
- The Cost table below sums the usage each scored response reports: 186,507 neurons, $2.05. The 100 attempts that reported none are not in it: retried attempts and the 29 provider errors.

## Run

| Setting | Value |
|---|---|
| Date | 2026-10-11 |
| Models | `@cf/moonshotai/kimi-k2.6`, `@cf/openai/gpt-oss-120b`, `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, `@cf/qwen/qwen3-30b-a3b-fp8`, `@cf/ibm-granite/granite-4.0-h-micro` |
| Modes | prompt, json_schema, tool |
| Tasks | 18 (6 kinds × 3) |
| Samples per task | 3 |
| max_tokens | 10000 |
| temperature | not sent (model default) |
| top_p | not sent (model default) |
| Wrangler | `4.149.0` |
| Worker compatibility_date | 2026-09-01 |
| Responses scored | 810 |
| Inference calls in this run, retries included | 881 |
| Inference calls before it (smoke and dry run, not scored) | 39 |

## Valid rate by mode

| Model | prompt | json_schema | tool |
|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 53/54 (98%) | 31/54 (57%) | 53/54 (98%) |
| `@cf/openai/gpt-oss-120b` | 49/54 (91%) | 25/54 (46%) | 4/54 (7%) |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 31/54 (57%) | 34/54 (63%) | 18/54 (33%) |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 38/54 (70%) | 26/54 (48%) | 33/54 (61%) |
| `@cf/ibm-granite/granite-4.0-h-micro` | 7/54 (13%) | 25/54 (46%) | 0/54 (0%) |
| **All** | **178/270 (66%)** | **141/270 (52%)** | **108/270 (40%)** |

## Valid, but one character of prose

A valid message can still say nothing: every member the emit schema types as `Text` (a goal, a rationale, a summary) needs only one non-space character. Each cell is how many of the valid messages have such a member exactly one character long.

| Model | prompt | json_schema | tool |
|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 0/53 | 30/31 | 0/53 |
| `@cf/openai/gpt-oss-120b` | 0/49 | 25/25 | 0/4 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 0/31 | 34/34 | 0/18 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 0/38 | 24/26 | 0/33 |
| `@cf/ibm-granite/granite-4.0-h-micro` | 0/7 | 25/25 | n=0 |
| **All** | **0/178** | **138/141** | **0/108** |

## prompt: valid rate by kind

| Model | intent | premise | decision | observation | stance | verdict |
|---|---|---|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 8/9 (89%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) |
| `@cf/openai/gpt-oss-120b` | 5/9 (56%) | 8/9 (89%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 3/9 (33%) | 1/9 (11%) | 9/9 (100%) | 9/9 (100%) | 7/9 (78%) | 2/9 (22%) |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 2/9 (22%) | 3/9 (33%) | 9/9 (100%) | 9/9 (100%) | 7/9 (78%) | 8/9 (89%) |
| `@cf/ibm-granite/granite-4.0-h-micro` | 0/9 (0%) | 0/9 (0%) | 5/9 (56%) | 0/9 (0%) | 2/9 (22%) | 0/9 (0%) |
| **All** | **18/45 (40%)** | **21/45 (47%)** | **41/45 (91%)** | **36/45 (80%)** | **34/45 (76%)** | **28/45 (62%)** |

## json_schema: valid rate by kind

| Model | intent | premise | decision | observation | stance | verdict |
|---|---|---|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 4/9 (44%) | 0/9 (0%) | 7/9 (78%) | 9/9 (100%) | 3/9 (33%) | 8/9 (89%) |
| `@cf/openai/gpt-oss-120b` | 2/9 (22%) | 0/9 (0%) | 9/9 (100%) | 9/9 (100%) | 0/9 (0%) | 5/9 (56%) |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 3/9 (33%) | 0/9 (0%) | 9/9 (100%) | 9/9 (100%) | 4/9 (44%) | 9/9 (100%) |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 5/9 (56%) | 2/9 (22%) | 7/9 (78%) | 4/9 (44%) | 0/9 (0%) | 8/9 (89%) |
| `@cf/ibm-granite/granite-4.0-h-micro` | 4/9 (44%) | 0/9 (0%) | 9/9 (100%) | 7/9 (78%) | 2/9 (22%) | 3/9 (33%) |
| **All** | **18/45 (40%)** | **2/45 (4%)** | **41/45 (91%)** | **38/45 (84%)** | **9/45 (20%)** | **33/45 (73%)** |

## tool: valid rate by kind

| Model | intent | premise | decision | observation | stance | verdict |
|---|---|---|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 8/9 (89%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) |
| `@cf/openai/gpt-oss-120b` | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 4/9 (44%) | 0/9 (0%) |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 0/9 (0%) | 5/9 (56%) | 0/9 (0%) | 5/9 (56%) | 7/9 (78%) | 1/9 (11%) |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 0/9 (0%) | 2/9 (22%) | 9/9 (100%) | 7/9 (78%) | 9/9 (100%) | 6/9 (67%) |
| `@cf/ibm-granite/granite-4.0-h-micro` | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) |
| **All** | **8/45 (18%)** | **16/45 (36%)** | **18/45 (40%)** | **21/45 (47%)** | **29/45 (64%)** | **16/45 (36%)** |

## Outcomes by class

Every response falls in exactly one class. In tool mode, `no-call` (the model answered without calling the tool) is a salience problem, separate from invalid output.

| Model | Mode | n | valid | invalid-json | schema | unissued-ref | no-call | wrong-call | provider-error |
|---|---|---|---|---|---|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | prompt | 54 | 53 | 0 | 1 | 0 | 0 | 0 | 0 |
| `@cf/moonshotai/kimi-k2.6` | json_schema | 54 | 31 | 16 | 0 | 6 | 0 | 0 | 1 |
| `@cf/moonshotai/kimi-k2.6` | tool | 54 | 53 | 0 | 1 | 0 | 0 | 0 | 0 |
| `@cf/openai/gpt-oss-120b` | prompt | 54 | 49 | 0 | 4 | 0 | 0 | 0 | 1 |
| `@cf/openai/gpt-oss-120b` | json_schema | 54 | 25 | 18 | 3 | 8 | 0 | 0 | 0 |
| `@cf/openai/gpt-oss-120b` | tool | 54 | 4 | 0 | 49 | 0 | 0 | 1 | 0 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | prompt | 54 | 31 | 0 | 23 | 0 | 0 | 0 | 0 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | json_schema | 54 | 34 | 0 | 0 | 5 | 0 | 0 | 15 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | tool | 54 | 18 | 0 | 24 | 12 | 0 | 0 | 0 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | prompt | 54 | 38 | 0 | 15 | 1 | 0 | 0 | 0 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | json_schema | 54 | 26 | 16 | 0 | 12 | 0 | 0 | 0 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | tool | 54 | 33 | 0 | 18 | 0 | 3 | 0 | 0 |
| `@cf/ibm-granite/granite-4.0-h-micro` | prompt | 54 | 7 | 1 | 21 | 25 | 0 | 0 | 0 |
| `@cf/ibm-granite/granite-4.0-h-micro` | json_schema | 54 | 25 | 0 | 0 | 17 | 0 | 0 | 12 |
| `@cf/ibm-granite/granite-4.0-h-micro` | tool | 54 | 0 | 52 | 2 | 0 | 0 | 0 | 0 |

## Tool mode: calls

| Model | Called the tool | Valid among calls |
|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 54/54 | 53/54 |
| `@cf/openai/gpt-oss-120b` | 54/54 | 4/54 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 54/54 | 18/54 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 51/54 | 33/51 |
| `@cf/ibm-granite/granite-4.0-h-micro` | 54/54 | 0/54 |

## Decision and observation: required citations

Decisions and observations must cite at least once. How many of their schema failures name `cites` at all, and how many cite nothing:

| Kind | Mode | n | schema failures | naming cites | citing nothing |
|---|---|---|---|---|---|
| decision | prompt | 45 | 4 | 0 | 0 |
| decision | json_schema | 45 | 0 | 0 | 0 |
| decision | tool | 45 | 18 | 15 | 0 |
| observation | prompt | 45 | 1 | 0 | 0 |
| observation | json_schema | 45 | 0 | 0 | 0 |
| observation | tool | 45 | 12 | 10 | 0 |

## Most common schema failures

| Count | First error |
|---|---|
| 34 | `/premises/*/subject must match pattern "^[a-z0-9]+(?:[.-][a-z0-9]+)*$"` |
| 26 | `/cites/* must be object` |
| 15 | `/footprint must be array` |
| 14 | `/premise/predicate must be equal to constant` |
| 11 | `/premise must be object` |
| 9 | `/alternatives/* must be object` |
| 9 | `/category must match pattern "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$"` |
| 8 | `/reasons/* must be object` |
| 6 | `/alternatives must be array` |
| 4 | `/premise/subject must match pattern "^[a-z0-9]+(?:[.-][a-z0-9]+)*$"` |
| 4 | `/alternatives/* must have required property 'reasonRejected'` |
| 4 | `/reasons/*/cites/*/commit must match pattern "^(?:[0-9a-f]{40}\|[0-9a-f]{64})$"` |
| 3 | `/reversible must be boolean` |
| 2 | `/premise must have required property 'subject'` |
| 2 | `/cites must be array` |

## Cost

Neurons are as Workers AI reported them per response; USD at $0.011 per 1,000 neurons. Smoke and dry-run calls are not included.

| Model | Input tokens | Output tokens | Neurons | USD |
|---|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 343248 | 356502 | 136690 | 1.50 |
| `@cf/openai/gpt-oss-120b` | 271906 | 179588 | 20896 | 0.23 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 507150 | 22443 | 18121 | 0.20 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 440235 | 254139 | 9781 | 0.11 |
| `@cf/ibm-granite/granite-4.0-h-micro` | 439917 | 33514 | 1019 | 0.01 |
| **All** | 2002456 | 846186 | 186507 | 2.05 |
