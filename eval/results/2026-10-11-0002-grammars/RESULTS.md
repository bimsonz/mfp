# Emit eval results

Whether models emit MFP 0.2 validly, per kind, through each binding. A response is **valid** when, after `toWire`, it is a message of the task's kind that is valid on the wire and under the core producer schema, and cites only refs the task issued. Each cell is valid/n. See [README.md](../../README.md) for the method.

This is run `2026-10-11-0002-grammars`. Each run's own report is beside its raw responses:

- [`2026-10-11`](../../results/2026-10-11/RESULTS.md): every mode
- [`2026-10-11-0002`](../../results/2026-10-11-0002/RESULTS.md): every mode, against `2026-10-11`
- [`2026-10-11-0002-descriptions`](../../results/2026-10-11-0002-descriptions/RESULTS.md): tool only, against `2026-10-11-0002`
- [`2026-10-11-0002-grammars`](../../results/2026-10-11-0002-grammars/RESULTS.md): tool only, against `2026-10-11-0002-descriptions`

## Findings

This run measures one change, in tool mode only, against run `2026-10-11-0002-descriptions`. Each grammar anchored at both ends (`^…$`) now has its regular expression in its description, beside its words. Text's `\S` stays in words only. The change also reaches the prompt and `json_schema` schemas, which this run did not measure.

Cells are small: 54 per model, 45 per kind.

### F1. The regular expression halves grammar failures, and moves the valid rate a little

- Tool mode went from 110/270 valid to 115/270.
- Schema failures that name a grammar went from 23 to 12. Across the runs so far:
  - 28 with patterns (`2026-10-11`);
  - 39 without them and with descriptions lost (`2026-10-11-0002`);
  - 23 with descriptions in words only (`2026-10-11-0002-descriptions`);
  - 12 with the regular expressions (this run).
- Most were a premise's subject outside the key grammar: 11 before, 5 now (`/premises/*/subject`).
- Premise went from 16/45 to 20/45, and `qwen3-30b` from 31/54 to 35/54. Every other model moved by at most one.
- The valid rate moves less than grammar failures do because the failures that remain in tool mode are not about grammar. `gpt-oss-120b` writes nested objects as prose (7/54). `granite-4.0-h-micro` double-encodes its arguments (0/54).

### Calls

270 inference calls, none retried and none lost. The local Worker did not reload during the run.

## Against `2026-10-11-0002-descriptions`

The same models, tasks, samples and settings as run `2026-10-11-0002-descriptions`, in the modes this run measured, both scored by the same scorer. Each cell is before → after. **Readable** is valid with no prose member one character long.

| Mode | What changed | Valid | Readable | Grammar failures |
|---|---|---|---|---|
| tool | Each whole-string grammar's regular expression in its description, beside its words | 110/270 → 115/270 | 110/270 → 115/270 | 23/270 → 12/270 |

| Model | tool: valid |
|---|---|
| `@cf/moonshotai/kimi-k2.6` | 51/54 → 52/54 |
| `@cf/openai/gpt-oss-120b` | 6/54 → 7/54 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 22/54 → 21/54 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 31/54 → 35/54 |
| `@cf/ibm-granite/granite-4.0-h-micro` | 0/54 → 0/54 |

| Kind | tool: valid |
|---|---|
| intent | 7/45 → 8/45 |
| premise | 16/45 → 20/45 |
| decision | 18/45 → 18/45 |
| observation | 21/45 → 23/45 |
| stance | 25/45 → 25/45 |
| verdict | 23/45 → 21/45 |

The change also reaches modes this run did not measure:

- prompt: Each whole-string grammar's regular expression in its description, beside its words
- json_schema: Each whole-string grammar's regular expression in its description, beside its words

## Run

| Setting | Value |
|---|---|
| Date | 2026-10-11-0002-grammars |
| Models | `@cf/moonshotai/kimi-k2.6`, `@cf/openai/gpt-oss-120b`, `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, `@cf/qwen/qwen3-30b-a3b-fp8`, `@cf/ibm-granite/granite-4.0-h-micro` |
| Modes | tool |
| Tasks | 18 (6 kinds × 3) |
| Samples per task | 3 |
| max_tokens | 10000 |
| temperature | not sent (model default) |
| top_p | not sent (model default) |
| Wrangler | `4.149.0` |
| Worker compatibility_date | 2026-09-01 |
| Responses scored | 270 |
| Inference calls in this run, retries included | 270 |
| Inference calls before it (smoke and dry run, not scored) | 0 |

## Valid rate by mode

| Model | tool |
|---|---|
| `@cf/moonshotai/kimi-k2.6` | 52/54 (96%) |
| `@cf/openai/gpt-oss-120b` | 7/54 (13%) |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 21/54 (39%) |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 35/54 (65%) |
| `@cf/ibm-granite/granite-4.0-h-micro` | 0/54 (0%) |
| **All** | **115/270 (43%)** |

## Valid, but one character of prose

A valid message can still say nothing: every member the emit schema types as `Text` (a goal, a rationale, a summary) needs only one non-space character. Each cell is how many of the valid messages have such a member exactly one character long.

| Model | tool |
|---|---|
| `@cf/moonshotai/kimi-k2.6` | 0/52 |
| `@cf/openai/gpt-oss-120b` | 0/7 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 0/21 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 0/35 |
| `@cf/ibm-granite/granite-4.0-h-micro` | n=0 |
| **All** | **0/115** |

## tool: valid rate by kind

| Model | intent | premise | decision | observation | stance | verdict |
|---|---|---|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 8/9 (89%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 8/9 (89%) |
| `@cf/openai/gpt-oss-120b` | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 6/9 (67%) | 1/9 (11%) |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 0/9 (0%) | 5/9 (56%) | 0/9 (0%) | 5/9 (56%) | 6/9 (67%) | 5/9 (56%) |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 0/9 (0%) | 6/9 (67%) | 9/9 (100%) | 9/9 (100%) | 4/9 (44%) | 7/9 (78%) |
| `@cf/ibm-granite/granite-4.0-h-micro` | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) |
| **All** | **8/45 (18%)** | **20/45 (44%)** | **18/45 (40%)** | **23/45 (51%)** | **25/45 (56%)** | **21/45 (47%)** |

## Outcomes by class

Every response falls in exactly one class. In tool mode, `no-call` (the model answered without calling the tool) is a salience problem, separate from invalid output.

| Model | Mode | n | valid | invalid-json | schema | unissued-ref | no-call | wrong-call | provider-error |
|---|---|---|---|---|---|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | tool | 54 | 52 | 0 | 2 | 0 | 0 | 0 | 0 |
| `@cf/openai/gpt-oss-120b` | tool | 54 | 7 | 0 | 46 | 0 | 0 | 1 | 0 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | tool | 54 | 21 | 0 | 22 | 11 | 0 | 0 | 0 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | tool | 54 | 35 | 0 | 14 | 4 | 1 | 0 | 0 |
| `@cf/ibm-granite/granite-4.0-h-micro` | tool | 54 | 0 | 51 | 2 | 0 | 1 | 0 | 0 |

## Tool mode: calls

| Model | Called the tool | Valid among calls |
|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 54/54 | 52/54 |
| `@cf/openai/gpt-oss-120b` | 54/54 | 7/54 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 54/54 | 21/54 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 53/54 | 35/53 |
| `@cf/ibm-granite/granite-4.0-h-micro` | 53/54 | 0/53 |

## Decision and observation: required citations

Decisions and observations must cite at least once. How many of their schema failures name `cites` at all, and how many cite nothing:

| Kind | Mode | n | schema failures | naming cites | citing nothing |
|---|---|---|---|---|---|
| decision | tool | 45 | 18 | 12 | 0 |
| observation | tool | 45 | 9 | 9 | 0 |

## Most common schema failures

| Count | First error |
|---|---|
| 21 | `/cites/* must be object` |
| 17 | `/footprint must be array` |
| 11 | `/premise must be object` |
| 6 | `/reversible must be boolean` |
| 6 | `/reasons/*/cites/* must be object` |
| 5 | `/premises/*/subject must match pattern "^[a-z0-9]+(?:[.-][a-z0-9]+)*$"` |
| 4 | `/premises/* must have required property 'subject'` |
| 3 | `/alternatives must be array` |
| 3 | `/premise/predicate must be equal to constant` |
| 2 | `/premise/subject must match pattern "^[a-z0-9]+(?:[.-][a-z0-9]+)*$"` |
| 2 | `/premises/*/predicate must be equal to constant` |
| 2 | `/reasons/*/cites must be array` |
| 2 | `/reasons/*/cites/*/commit must match pattern "^(?:[0-9a-f]{40}\|[0-9a-f]{64})$"` |
| 1 | `/premise/cites/* must be object` |
| 1 | `/cites/* must have required property 'path'` |

## Cost

Neurons are as Workers AI reported them per response; USD at $0.011 per 1,000 neurons. Smoke and dry-run calls are not included.

| Model | Input tokens | Output tokens | Neurons | USD |
|---|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 96465 | 69835 | 28187 | 0.31 |
| `@cf/openai/gpt-oss-120b` | 22019 | 12594 | 1559 | 0.02 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 254622 | 7822 | 8392 | 0.09 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 186621 | 41454 | 2126 | 0.02 |
| `@cf/ibm-granite/granite-4.0-h-micro` | 189102 | 13261 | 426 | 0.00 |
| **All** | 748829 | 144966 | 40691 | 0.45 |
