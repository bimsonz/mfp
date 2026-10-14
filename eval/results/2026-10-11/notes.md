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
- The account's Workers AI analytics show 922 inferences of these five models, all on 11 October between 03:00 and 05:00 UTC. They total 199,803 neurons, $2.20 at the list price.
- The Cost table below sums the usage each scored response reports: 186,507 neurons, $2.05. The 100 attempts that reported none are not in it: retried attempts and the 29 provider errors.
