# Emit eval results

Whether models emit MFP 0.2 validly, per kind, through each binding. A response is **valid** when, after `toWire`, it is a message of the task's kind that is valid on the wire and under the core producer schema, and cites only refs the task issued. Each cell is valid/n. See [README.md](../../README.md) for the method.

This is run `2026-10-11-0002-descriptions`. Each run's own report is beside its raw responses:

- [`2026-10-11`](../../results/2026-10-11/RESULTS.md): every mode
- [`2026-10-11-0002`](../../results/2026-10-11-0002/RESULTS.md): every mode, against `2026-10-11`
- [`2026-10-11-0002-descriptions`](../../results/2026-10-11-0002-descriptions/RESULTS.md): tool only, against `2026-10-11-0002`
- [`2026-10-11-0002-grammars`](../../results/2026-10-11-0002-grammars/RESULTS.md): tool only, against `2026-10-11-0002-descriptions`

## Findings

This run measures one fix, in tool mode only, against run `2026-10-11-0002`. That run's tools inlined their `$ref`s, but where a member had its own description, inlining dropped the description of the type the member referred to. The observation tool's `category` still said what kind of thing was noticed, but no longer that it is "a lowercase token: letters, digits and inner hyphens". The stance tool lost what a ref and a piece of text are. The other inlined tools lost nothing. An inlined member now keeps both descriptions, and the suite fails if an inlined tool loses one.

Cells are small: 54 per model, 45 per kind.

### F1. The tool regression in `2026-10-11-0002` was the dropped descriptions

- Tool mode: 99/270 valid before, 110/270 after. The first run, with patterns, had 108/270.
- Observation: 12/45 before, 21/45 after, the first run's figure.
- `category` failures fell from 20 to 0 across all models; the first run had 9. Its grammar, in words, was enough once the model could read it.
- `qwen3-30b`'s observations went from 2/9 valid to 9/9; the first run had 7/9.
- So stripping `pattern` did not cost tool mode anything. Losing the descriptions did.

### F2. What did not move

- Stance stayed at 25/45. `qwen3-30b` is 4/9, against 9/9 in the first run. Four of its five stance failures are refs cited with their brackets, which no description in the tool touches. The fifth is an anchor's commit that is not a full object id.
- `gpt-oss-120b` is at 6/54, and still writes nested objects as prose.
- `granite-4.0-h-micro` still double-encodes its arguments: 0/54.

### Calls

270 inference calls, none retried and none lost. The local Worker did not reload during the run.

## Against `2026-10-11-0002`

The same models, tasks, samples and settings as run `2026-10-11-0002`, in the modes this run measured, both scored by the same scorer. Each cell is before → after. **Readable** is valid with no prose member one character long.

| Mode | What changed | Valid | Readable | Grammar failures |
|---|---|---|---|---|
| tool | An inlined tool keeps the description of each type it inlines (observation and stance had lost theirs) | 99/270 → 110/270 | 99/270 → 110/270 | 39/270 → 23/270 |

| Model | tool: valid |
|---|---|
| `@cf/moonshotai/kimi-k2.6` | 49/54 → 51/54 |
| `@cf/openai/gpt-oss-120b` | 5/54 → 6/54 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 19/54 → 22/54 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 26/54 → 31/54 |
| `@cf/ibm-granite/granite-4.0-h-micro` | 0/54 → 0/54 |

| Kind | tool: valid |
|---|---|
| intent | 6/45 → 7/45 |
| premise | 16/45 → 16/45 |
| decision | 18/45 → 18/45 |
| observation | 12/45 → 21/45 |
| stance | 25/45 → 25/45 |
| verdict | 22/45 → 23/45 |

## Run

| Setting | Value |
|---|---|
| Date | 2026-10-11-0002-descriptions |
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
| `@cf/moonshotai/kimi-k2.6` | 51/54 (94%) |
| `@cf/openai/gpt-oss-120b` | 6/54 (11%) |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 22/54 (41%) |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 31/54 (57%) |
| `@cf/ibm-granite/granite-4.0-h-micro` | 0/54 (0%) |
| **All** | **110/270 (41%)** |

## Valid, but one character of prose

A valid message can still say nothing: every member the emit schema types as `Text` (a goal, a rationale, a summary) needs only one non-space character. Each cell is how many of the valid messages have such a member exactly one character long.

| Model | tool |
|---|---|
| `@cf/moonshotai/kimi-k2.6` | 0/51 |
| `@cf/openai/gpt-oss-120b` | 0/6 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 0/22 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 0/31 |
| `@cf/ibm-granite/granite-4.0-h-micro` | n=0 |
| **All** | **0/110** |

## tool: valid rate by kind

| Model | intent | premise | decision | observation | stance | verdict |
|---|---|---|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 6/9 (67%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) |
| `@cf/openai/gpt-oss-120b` | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 6/9 (67%) | 0/9 (0%) |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 0/9 (0%) | 4/9 (44%) | 1/9 (11%) | 3/9 (33%) | 6/9 (67%) | 8/9 (89%) |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 1/9 (11%) | 3/9 (33%) | 8/9 (89%) | 9/9 (100%) | 4/9 (44%) | 6/9 (67%) |
| `@cf/ibm-granite/granite-4.0-h-micro` | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) |
| **All** | **7/45 (16%)** | **16/45 (36%)** | **18/45 (40%)** | **21/45 (47%)** | **25/45 (56%)** | **23/45 (51%)** |

## Outcomes by class

Every response falls in exactly one class. In tool mode, `no-call` (the model answered without calling the tool) is a salience problem, separate from invalid output.

| Model | Mode | n | valid | invalid-json | schema | unissued-ref | no-call | wrong-call | provider-error |
|---|---|---|---|---|---|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | tool | 54 | 51 | 0 | 3 | 0 | 0 | 0 | 0 |
| `@cf/openai/gpt-oss-120b` | tool | 54 | 6 | 1 | 45 | 0 | 0 | 2 | 0 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | tool | 54 | 22 | 0 | 21 | 10 | 1 | 0 | 0 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | tool | 54 | 31 | 0 | 16 | 4 | 3 | 0 | 0 |
| `@cf/ibm-granite/granite-4.0-h-micro` | tool | 54 | 0 | 50 | 1 | 0 | 3 | 0 | 0 |

## Tool mode: calls

| Model | Called the tool | Valid among calls |
|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 54/54 | 51/54 |
| `@cf/openai/gpt-oss-120b` | 54/54 | 6/54 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 53/54 | 22/53 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 51/54 | 31/51 |
| `@cf/ibm-granite/granite-4.0-h-micro` | 51/54 | 0/51 |

## Decision and observation: required citations

Decisions and observations must cite at least once. How many of their schema failures name `cites` at all, and how many cite nothing:

| Kind | Mode | n | schema failures | naming cites | citing nothing |
|---|---|---|---|---|---|
| decision | tool | 45 | 17 | 12 | 0 |
| observation | tool | 45 | 9 | 9 | 0 |

## Most common schema failures

| Count | First error |
|---|---|
| 18 | `/cites/* must be object` |
| 11 | `/premises/*/subject must match pattern "^[a-z0-9]+(?:[.-][a-z0-9]+)*$"` |
| 10 | `/premise must be object` |
| 10 | `/footprint must be array` |
| 6 | `/reasons/*/cites/* must be object` |
| 5 | `/premise/predicate must be equal to constant` |
| 4 | `/reversible must be boolean` |
| 3 | `/alternatives/*/reasonRejected must match pattern "\S"` |
| 3 | `/alternatives must be array` |
| 2 | `/premise must have required property 'subject'` |
| 2 | `/premises/*/predicate must be equal to constant` |
| 2 | `/premises/* must have required property 'subject'` |
| 2 | `/reasons/*/cites/*/commit must match pattern "^(?:[0-9a-f]{40}\|[0-9a-f]{64})$"` |
| 1 | `/premise/subject must match pattern "^[a-z0-9]+(?:[.-][a-z0-9]+)*$"` |
| 1 | `/declaredEffects/*/subject must match pattern "^[a-z0-9]+(?:[.-][a-z0-9]+)*$"` |

## Cost

Neurons are as Workers AI reported them per response; USD at $0.011 per 1,000 neurons. Smoke and dry-run calls are not included.

| Model | Input tokens | Output tokens | Neurons | USD |
|---|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 90876 | 75231 | 29028 | 0.32 |
| `@cf/openai/gpt-oss-120b` | 21771 | 12460 | 1542 | 0.02 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 247593 | 7670 | 8174 | 0.09 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 179989 | 37166 | 1965 | 0.02 |
| `@cf/ibm-granite/granite-4.0-h-micro` | 182010 | 14057 | 423 | 0.00 |
| **All** | 722239 | 146584 | 41132 | 0.45 |
