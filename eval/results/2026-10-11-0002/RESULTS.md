# Emit eval results

Whether models emit MFP 0.2 validly, per kind, through each binding. A response is **valid** when, after `toWire`, it is a message of the task's kind that is valid on the wire and under the core producer schema, and cites only refs the task issued. Each cell is valid/n. See [README.md](../../README.md) for the method.

This is run `2026-10-11-0002`. Each run's own report is beside its raw responses:

- [`2026-10-11`](../../results/2026-10-11/RESULTS.md): every mode
- [`2026-10-11-0002`](../../results/2026-10-11-0002/RESULTS.md): every mode, against `2026-10-11`
- [`2026-10-11-0002-descriptions`](../../results/2026-10-11-0002-descriptions/RESULTS.md): tool only, against `2026-10-11-0002`

## Findings

This run measures proposal 0002 against run `2026-10-11`. It uses the same models, tasks, samples and settings, and both runs are scored by the same scorer. Three things changed, one or more per mode (see "Against `2026-10-11`"):
- the emit schemas and tools lost `pattern`, which affects all three modes;
- the schema now also goes in the prompt (json_schema only);
- tool inputs inline their `$ref`s, except intent and premise (tool only).

Cells are small: 54 per model and mode, 9 per model, mode and kind.

### F1. Under `json_schema`, valid messages now say something

- **Readable `json_schema` messages went from 3/270 to 192/270.** Valid went from 141/270 to 192/270, and no valid message in any mode has a one-character prose member.
- **Nothing runs away now.** No reply hit `max_tokens` (43 before), and none timed out (27 before).
- **The model sees the schema.** Median prompt tokens are now 1,479–1,538 per model, where they were 132–185.
- **Unissued refs went from 48 to 26.** Stances that put a word such as `comply` or `overrule` in `decision` went from 23 to 0. The member was not the defect: a model that can read its description fills it correctly.
- **What still fails** is what prompt mode also gets wrong. A subject outside the key grammar, a premise predicate outside the core, and `granite-4.0-h-micro` citing issued refs with their brackets. The wire check now catches these after decoding.
- **`granite-4.0-h-micro` went from 25/54 valid to 14/54.** Its 25 before were all unreadable, so readable went from 0 to 14.

### F2. Prompt mode did not move

180/270 valid, against 178/270. Each model moved by at most five.

### F3. Tool mode did not improve, and inlining did not help the model it was for

- **99/270 valid, against 108/270.**
  - The four kinds whose tools were inlined went from 84/180 to 77/180.
  - Intent and premise, whose tools were not inlined, went from 24/90 to 22/90.
- **`gpt-oss-120b` went from 4/54 to 5/54.** With no `$defs` left to drop, it still writes nested objects as prose or bare strings (`/cites/* must be object`, `/premise must be object`). The lead that its tool format dropped `$defs` is refuted. Its failure lies elsewhere.
- **Most of the fall is `qwen3-30b`: 33/54 to 26/54.** Its observations' `category` failed 7 times out of 9, against 2 before. It wrote `flaky test` and `technical debt` where the grammar wants a lowercase hyphenated token. In tool mode the pattern was a cue the model could read. The description says the same thing in words, and this model did not follow it. Nine samples are few, but this is the one place where stripping `pattern` plausibly cost something.
- `granite-4.0-h-micro` double-encodes its arguments, as before (0/54).

### F4. The local Worker reloaded once

At 05:02:28Z `wrangler dev` reloaded the local Worker. Its log says only "Reloading local server…". It answered the 23 calls in flight with 503 and a text body, not an inference result, and the harness recorded them as transport failures without retrying them. They were removed from this run and run again. The harness now retries every transport failure. Their 26 attempts still count towards this run's calls.

### Calls and cost

- The harness counted 838 inference calls, retries and the 26 lost attempts included. The account's Workers AI analytics show 838 inferences of these five models after the first run, all on 11 October between 04:30 and 06:00 UTC: 179,028 neurons, $1.97 at the list price.
- The Cost table below sums the usage each scored response reports: 163,525 neurons, $1.80.

## Against `2026-10-11`

The same models, tasks, samples and settings as run `2026-10-11`, in the modes this run measured, both scored by the same scorer. Each cell is before → after. **Readable** is valid with no prose member one character long.

| Mode | What changed | Valid | Readable |
|---|---|---|---|
| prompt | Emit schema without `pattern`; each grammar is in its description | 178/270 → 180/270 | 178/270 → 180/270 |
| json_schema | Emit schema without `pattern`, and the schema in the system prompt as well as in `response_format` | 141/270 → 192/270 | 3/270 → 192/270 |
| tool | Tool input without `pattern`; `$ref`s inlined for decision, observation, stance and verdict (intent and premise are recursive and keep `$defs`) | 108/270 → 99/270 | 108/270 → 99/270 |

| Model | prompt: valid | json_schema: valid | tool: valid |
|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 53/54 → 53/54 | 31/54 → 52/54 | 53/54 → 49/54 |
| `@cf/openai/gpt-oss-120b` | 49/54 → 50/54 | 25/54 → 47/54 | 4/54 → 5/54 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 31/54 → 36/54 | 34/54 → 43/54 | 18/54 → 19/54 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 38/54 → 35/54 | 26/54 → 36/54 | 33/54 → 26/54 |
| `@cf/ibm-granite/granite-4.0-h-micro` | 7/54 → 6/54 | 25/54 → 14/54 | 0/54 → 0/54 |

| Kind | prompt: valid | json_schema: valid | tool: valid |
|---|---|---|---|
| intent | 18/45 → 17/45 | 18/45 → 19/45 | 8/45 → 6/45 |
| premise | 21/45 → 22/45 | 2/45 → 26/45 | 16/45 → 16/45 |
| decision | 41/45 → 40/45 | 41/45 → 41/45 | 18/45 → 18/45 |
| observation | 36/45 → 36/45 | 38/45 → 34/45 | 21/45 → 12/45 |
| stance | 34/45 → 37/45 | 9/45 → 39/45 | 29/45 → 25/45 |
| verdict | 28/45 → 28/45 | 33/45 → 33/45 | 16/45 → 22/45 |

## Run

| Setting | Value |
|---|---|
| Date | 2026-10-11-0002 |
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
| Inference calls in this run, retries included | 838 |
| Inference calls before it (smoke and dry run, not scored) | 0 |

## Valid rate by mode

| Model | prompt | json_schema | tool |
|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 53/54 (98%) | 52/54 (96%) | 49/54 (91%) |
| `@cf/openai/gpt-oss-120b` | 50/54 (93%) | 47/54 (87%) | 5/54 (9%) |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 36/54 (67%) | 43/54 (80%) | 19/54 (35%) |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 35/54 (65%) | 36/54 (67%) | 26/54 (48%) |
| `@cf/ibm-granite/granite-4.0-h-micro` | 6/54 (11%) | 14/54 (26%) | 0/54 (0%) |
| **All** | **180/270 (67%)** | **192/270 (71%)** | **99/270 (37%)** |

## Valid, but one character of prose

A valid message can still say nothing: every member the emit schema types as `Text` (a goal, a rationale, a summary) needs only one non-space character. Each cell is how many of the valid messages have such a member exactly one character long.

| Model | prompt | json_schema | tool |
|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 0/53 | 0/52 | 0/49 |
| `@cf/openai/gpt-oss-120b` | 0/50 | 0/47 | 0/5 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 0/36 | 0/43 | 0/19 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 0/35 | 0/36 | 0/26 |
| `@cf/ibm-granite/granite-4.0-h-micro` | 0/6 | 0/14 | n=0 |
| **All** | **0/180** | **0/192** | **0/99** |

## prompt: valid rate by kind

| Model | intent | premise | decision | observation | stance | verdict |
|---|---|---|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 8/9 (89%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) |
| `@cf/openai/gpt-oss-120b` | 5/9 (56%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 3/9 (33%) | 1/9 (11%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 5/9 (56%) |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 1/9 (11%) | 3/9 (33%) | 9/9 (100%) | 9/9 (100%) | 8/9 (89%) | 5/9 (56%) |
| `@cf/ibm-granite/granite-4.0-h-micro` | 0/9 (0%) | 0/9 (0%) | 4/9 (44%) | 0/9 (0%) | 2/9 (22%) | 0/9 (0%) |
| **All** | **17/45 (38%)** | **22/45 (49%)** | **40/45 (89%)** | **36/45 (80%)** | **37/45 (82%)** | **28/45 (62%)** |

## json_schema: valid rate by kind

| Model | intent | premise | decision | observation | stance | verdict |
|---|---|---|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 7/9 (78%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) |
| `@cf/openai/gpt-oss-120b` | 5/9 (56%) | 9/9 (100%) | 9/9 (100%) | 8/9 (89%) | 9/9 (100%) | 7/9 (78%) |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 3/9 (33%) | 4/9 (44%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) | 9/9 (100%) |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 4/9 (44%) | 4/9 (44%) | 8/9 (89%) | 8/9 (89%) | 4/9 (44%) | 8/9 (89%) |
| `@cf/ibm-granite/granite-4.0-h-micro` | 0/9 (0%) | 0/9 (0%) | 6/9 (67%) | 0/9 (0%) | 8/9 (89%) | 0/9 (0%) |
| **All** | **19/45 (42%)** | **26/45 (58%)** | **41/45 (91%)** | **34/45 (76%)** | **39/45 (87%)** | **33/45 (73%)** |

## tool: valid rate by kind

| Model | intent | premise | decision | observation | stance | verdict |
|---|---|---|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 6/9 (67%) | 9/9 (100%) | 9/9 (100%) | 8/9 (89%) | 8/9 (89%) | 9/9 (100%) |
| `@cf/openai/gpt-oss-120b` | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 5/9 (56%) | 0/9 (0%) |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 0/9 (0%) | 3/9 (33%) | 0/9 (0%) | 2/9 (22%) | 8/9 (89%) | 6/9 (67%) |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 0/9 (0%) | 4/9 (44%) | 9/9 (100%) | 2/9 (22%) | 4/9 (44%) | 7/9 (78%) |
| `@cf/ibm-granite/granite-4.0-h-micro` | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) | 0/9 (0%) |
| **All** | **6/45 (13%)** | **16/45 (36%)** | **18/45 (40%)** | **12/45 (27%)** | **25/45 (56%)** | **22/45 (49%)** |

## Outcomes by class

Every response falls in exactly one class. In tool mode, `no-call` (the model answered without calling the tool) is a salience problem, separate from invalid output.

| Model | Mode | n | valid | invalid-json | schema | unissued-ref | no-call | wrong-call | provider-error |
|---|---|---|---|---|---|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | prompt | 54 | 53 | 0 | 1 | 0 | 0 | 0 | 0 |
| `@cf/moonshotai/kimi-k2.6` | json_schema | 54 | 52 | 0 | 2 | 0 | 0 | 0 | 0 |
| `@cf/moonshotai/kimi-k2.6` | tool | 54 | 49 | 0 | 5 | 0 | 0 | 0 | 0 |
| `@cf/openai/gpt-oss-120b` | prompt | 54 | 50 | 0 | 4 | 0 | 0 | 0 | 0 |
| `@cf/openai/gpt-oss-120b` | json_schema | 54 | 47 | 3 | 4 | 0 | 0 | 0 | 0 |
| `@cf/openai/gpt-oss-120b` | tool | 54 | 5 | 0 | 48 | 0 | 0 | 1 | 0 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | prompt | 54 | 36 | 0 | 18 | 0 | 0 | 0 | 0 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | json_schema | 54 | 43 | 0 | 11 | 0 | 0 | 0 | 0 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | tool | 54 | 19 | 0 | 29 | 6 | 0 | 0 | 0 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | prompt | 54 | 35 | 0 | 19 | 0 | 0 | 0 | 0 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | json_schema | 54 | 36 | 0 | 11 | 7 | 0 | 0 | 0 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | tool | 54 | 26 | 0 | 23 | 3 | 2 | 0 | 0 |
| `@cf/ibm-granite/granite-4.0-h-micro` | prompt | 54 | 6 | 2 | 21 | 25 | 0 | 0 | 0 |
| `@cf/ibm-granite/granite-4.0-h-micro` | json_schema | 54 | 14 | 0 | 21 | 19 | 0 | 0 | 0 |
| `@cf/ibm-granite/granite-4.0-h-micro` | tool | 54 | 0 | 52 | 1 | 0 | 1 | 0 | 0 |

## Tool mode: calls

| Model | Called the tool | Valid among calls |
|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 54/54 | 49/54 |
| `@cf/openai/gpt-oss-120b` | 54/54 | 5/54 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 54/54 | 19/54 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 52/54 | 26/52 |
| `@cf/ibm-granite/granite-4.0-h-micro` | 53/54 | 0/53 |

## Decision and observation: required citations

Decisions and observations must cite at least once. How many of their schema failures name `cites` at all, and how many cite nothing:

| Kind | Mode | n | schema failures | naming cites | citing nothing |
|---|---|---|---|---|---|
| decision | prompt | 45 | 4 | 0 | 0 |
| decision | json_schema | 45 | 0 | 0 | 0 |
| decision | tool | 45 | 18 | 13 | 0 |
| observation | prompt | 45 | 1 | 0 | 0 |
| observation | json_schema | 45 | 3 | 0 | 0 |
| observation | tool | 45 | 22 | 9 | 0 |

## Most common schema failures

| Count | First error |
|---|---|
| 54 | `/premises/*/subject must match pattern "^[a-z0-9]+(?:[.-][a-z0-9]+)*$"` |
| 29 | `/cites/* must be object` |
| 23 | `/category must match pattern "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$"` |
| 22 | `/premise/predicate must be equal to constant` |
| 14 | `/footprint must be array` |
| 10 | `/premise must be object` |
| 9 | `/premise/subject must match pattern "^[a-z0-9]+(?:[.-][a-z0-9]+)*$"` |
| 8 | `/premises/*/predicate must be equal to constant` |
| 7 | `/reasons/*/cites/*/commit must match pattern "^(?:[0-9a-f]{40}\|[0-9a-f]{64})$"` |
| 6 | `/reasons/*/cites/* must be object` |
| 5 | `/premise must have required property 'subject'` |
| 5 | `/reversible must be boolean` |
| 4 | `/alternatives/* must have required property 'reasonRejected'` |
| 4 | `/cites/*/commit must match pattern "^(?:[0-9a-f]{40}\|[0-9a-f]{64})$"` |
| 4 | `/alternatives must be array` |

## Cost

Neurons are as Workers AI reported them per response; USD at $0.011 per 1,000 neurons. Smoke and dry-run calls are not included.

| Model | Input tokens | Output tokens | Neurons | USD |
|---|---|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | 570717 | 259834 | 109954 | 1.21 |
| `@cf/openai/gpt-oss-120b` | 507436 | 73342 | 21146 | 0.23 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 731376 | 24480 | 24518 | 0.27 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 662017 | 112992 | 6505 | 0.07 |
| `@cf/ibm-granite/granite-4.0-h-micro` | 663417 | 37279 | 1401 | 0.02 |
| **All** | 3134963 | 507927 | 163525 | 1.80 |
