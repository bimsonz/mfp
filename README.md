# MFP: Model Feedback Protocol

MFP (Model Feedback Protocol) is a small, typed message format for what a model reports back to whatever drives it: its intent, the premises it relies on, its decisions, observations, stances and verdicts. Premises and effects are typed propositions on ordered predicates, so a consumer can tell when one change's effect contradicts what another relies on. Where MCP carries what a model asks of its tools, MFP carries what it reports back, often as MCP tool calls.

Current version: `0.2.3`. See [CHANGELOG.md](CHANGELOG.md).

## Features

- **Six message kinds:** `intent`, `premise`, `decision`, `observation`, `stance` and `verdict`.
- **Typed propositions** on ordered predicates (freshness, consistency, cardinality, bound, authority, shape, ordering and more), with normative lattices and a reference comparator.
- **Claims, never evidence:** a message carries no identifier, author, timestamp, evidence class or signature. A receiver that keeps records adds those in its own layer.
- **Schemas for every use:** a wire schema (JSON Schema 2020-12), a producer schema, and per kind a structured-output schema and an MCP tool.
- **Profiles** that narrow the core for one consumer, with a checker.
- **A TypeSpec library** as the single source of the schemas.

| Kind | Reports |
|---|---|
| `intent` | What the model will do, and what it relies on, before it writes code |
| `premise` | One more thing it relies on |
| `decision` | A choice, why, and the alternatives rejected |
| `observation` | Something it noticed, and what that rests on |
| `stance` | How its work relates to an earlier decision: followed, distinguished, or overrule requested |
| `verdict` | The outcome it thinks the work should have: an opinion, never a ruling |

## Installation

```sh
npm install @bimsonz/mfp
```

## Quick start

A message:

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

Validate a message against `schema/0.2/mfp.schema.json`, as `$defs/Message`. From TypeSpec, import the library:

```tsp
import "@bimsonz/mfp";
```

To have a model report in MFP, give it `schema/0.2/emit/<kind>.schema.json` as a structured-output schema, or offer `schema/0.2/mcp/<kind>.tool.json` as an MCP tool, and run what it emits through `toWire` from `@bimsonz/mfp/emit`. [Bindings](docs/specification/0.2/bindings.md) describes both.

Check a profile and its messages, or generate a profile's emit schemas and tools:

```sh
npx mfp-profile check profile.json [message.json ...]
npx mfp-profile emit profile.json out/
```

## Documentation

- [Specification](docs/specification/0.2/index.md): [messages](docs/specification/0.2/messages.md), [propositions](docs/specification/0.2/propositions.md), [lattices](docs/specification/0.2/lattices.md), [bindings](docs/specification/0.2/bindings.md), [extensibility](docs/specification/0.2/extensibility.md) and [security considerations](docs/specification/0.2/security.md)
- [Migrating from 0.1](docs/specification/0.2/migrating-from-0.1.md)
- [Proposals](proposals/README.md): how MFP changes
- [Changelog](CHANGELOG.md)

## Repository layout

| Path | Contents |
|---|---|
| `docs/specification/0.2/` | The specification |
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
| `proposals/` | How MFP changes, and each proposal |

## Development

```sh
pnpm install
pnpm build          # regenerate the schemas from main.tsp
pnpm conformance    # examples, invalid cases, lattice vectors, profiles, bindings
pnpm check:drift    # fail if a generated schema is stale
pnpm typecheck && pnpm lint
```

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before you open a pull request; a change to what an implementation does starts as a [proposal](proposals/README.md). Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md). Report a vulnerability as [SECURITY.md](SECURITY.md) describes.

## Licence

MIT. See [LICENSE](LICENSE).
