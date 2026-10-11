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
