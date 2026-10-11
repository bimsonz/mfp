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
