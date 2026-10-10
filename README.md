# MFP: Model Feedback Protocol

An open format for the claims a model makes about its work: intents, premises, decisions, observations, stances, verdicts and derivations. Every claim is attributed and cites its sources.

> MCP is how a model asks. MFP is how a model accounts for itself.

Status: `mfp/0.1`, in draft.

## Claims, not facts

An MFP record is a **claim**: something an author asserts, which a reader may weigh. Raw facts (pushes, test runs, tool calls) are not MFP records; they already live in git and in a platform's operation log, and records cite them instead. Every record states its **author**, which is an agent, a platform or a human, so a platform's interpretation never reads as something an agent said.

| Kind | Claim |
|---|---|
| `intent` | What a change will do, and the premises it relies on |
| `premise` | One more thing a change relies on |
| `decision` | A choice, its rationale and the alternatives rejected. Must cite |
| `observation` | Something noticed, with evidence |
| `stance` | How a change relates to an earlier decision: followed, distinguished, or overrule requested |
| `verdict` | An outcome for a change, with the evidence behind it. Must cite |
| `derivation` | The effects a platform derived from a diff, each with its method and evidence class. Platform-authored |

`effect` is a payload shape, not a kind: an intent *declares* effects (advisory), a derivation *derives* them.

## Layout

| Path | Contents |
|---|---|
| `schema/0.1/main.tsp` | The schema source, also published as a TypeSpec library |
| `schema/0.1/schema.json` | The JSON Schema (2020-12), generated from `main.tsp` and committed |
| `docs/specification/0.1/` | The specification |
| `examples/0.1/` | Example records, each named `*.valid.json` or `*.invalid.json` |
| `conformance/` | Checks every example against the schema |
| `proposals/` | Proposed changes |

## Use it

From TypeSpec, add the repository as a dependency pinned by tag and import it:

```jsonc
// package.json
"@bimsonz/mfp": "github:bimsonz/mfp#v0.1.0-pre"
```

```tsp
import "@bimsonz/mfp";
```

From anything else, validate against `schema/0.1/schema.json`; the record type is `$defs/MfpRecord`.

## Develop

```sh
pnpm install
pnpm build:schema   # regenerate schema.json from main.tsp
pnpm conformance    # validate every example
pnpm check:drift    # fail if schema.json is stale
```

MIT licensed. See [LICENSE](LICENSE).
