# MFP: Model Feedback Protocol

The language a model speaks back to whatever drives it: a small, fixed way for a model to report its intent, premises, decisions, observations, stances and uncertainty.

> MCP carries what a model asks of tools. MFP is what a model reports back, often carried as MCP tool calls.

Status: `0.2.2`, released 2026-10-14.

## A message

```json
{
  "mfp": "0.2",
  "kind": "premise",
  "confidence": "medium",
  "premise": {
    "subject": "authz.permission-evaluation",
    "predicate": "freshness",
    "relation": "at-most",
    "value": "per-request",
    "gloss": "requirePermission re-reads roles on every request"
  }
}
```

| Kind | Reports |
|---|---|
| `intent` | What the model will do, and what it relies on, before it writes code |
| `premise` | One more thing it relies on |
| `decision` | A choice, why, and the alternatives rejected |
| `observation` | Something it noticed, and what that rests on |
| `stance` | How its work relates to an earlier decision: followed, distinguished, or overrule requested |
| `verdict` | The outcome it thinks the work should have: an opinion, never a ruling |

Premises and effects are typed propositions on ordered predicates (freshness, consistency, cardinality, bound, authority, shape, ordering and more), so a consumer can tell whether a change's effect contradicts what another relies on.

## A claim, never evidence

A message carries what the model says, and nothing a receiver must vouch for: no identifier, author, timestamp, evidence class or signature. A receiver that keeps messages as records adds those itself, in its own layer. No content of a message can raise its standing. See [Security considerations](docs/specification/0.2/security.md).

## Layout

| Path | Contents |
|---|---|
| [`docs/specification/0.2/`](docs/specification/0.2/index.md) | The specification |
| `schema/0.2/main.tsp` | The schema source, also published as a TypeSpec library |
| `schema/0.2/mfp.schema.json` | The wire schema (JSON Schema 2020-12), for consumers |
| `schema/0.2/producer.schema.json` | The producer schema: every object closed, the core profile applied |
| `schema/0.2/core.profile.json` | The core profile |
| `schema/0.2/emit/`, `schema/0.2/mcp/` | Per kind: a structured-output schema, and an MCP tool |
| `examples/0.2/` | Valid messages of every kind |
| `examples/profiles/` | A neutral example profile, with its messages |
| `conformance/` | Invalid cases, lattice vectors, and the tests that run them |
| `lib/`, `bin/` | The profile check and the emit transform, as libraries and as `mfp-profile` |
| `eval/` | The emit eval: tasks, harness and results |
| [`proposals/`](proposals/README.md) | How MFP changes, and each proposal |

## Use it

From TypeSpec, add the repository as a dependency, pinned by tag, and import it:

```tsp
import "@bimsonz/mfp";
```

From anything else, validate against `schema/0.2/mfp.schema.json`, as `$defs/Message`.

To have a model report in MFP, give it `schema/0.2/emit/<kind>.schema.json` as a structured-output schema, or offer `schema/0.2/mcp/<kind>.tool.json` as an MCP tool, and run what it emits through `toWire` from `@bimsonz/mfp/emit`. See [Bindings](docs/specification/0.2/bindings.md).

Check a profile, or generate its emit schemas and tools, with:

```sh
pnpm exec mfp-profile check profile.json [message.json ...]
pnpm exec mfp-profile emit profile.json out/
```

## Develop

```sh
pnpm install
pnpm build          # regenerate the schemas from main.tsp
pnpm conformance    # examples, invalid cases, lattice vectors, profiles, bindings
pnpm check:drift    # fail if a generated schema is stale
pnpm typecheck && pnpm lint
```

## Take part

Read [CONTRIBUTING.md](CONTRIBUTING.md) before you open a pull request; a change to what an implementation does starts as a [proposal](proposals/README.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md). Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md). Report a vulnerability as [SECURITY.md](SECURITY.md) says.

MIT licensed. See [LICENSE](LICENSE).
