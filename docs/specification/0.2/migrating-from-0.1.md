# Migrating from 0.1

0.1 was a record format: a platform's stored claims, each with an envelope of identity, authorship and evidence. 0.2 is the language a model speaks: what the model says, and nothing a receiver must vouch for. A platform that stored 0.1 records keeps that layer, as its own record around a 0.2 message.

0.1 was only ever published as pre-releases (`v0.1.0-pre`, `-pre.2`, `-pre.3`). Its tags still resolve.

## The envelope

| 0.1 | 0.2 |
|---|---|
| `mfp: "0.1"` | `mfp: "0.2"` |
| `kind` | `kind`. The kinds are the same, except `derivation`, which is gone. |
| `payload: {...}` | The payload's members sit at the top level of the message. |
| `id`, `at`, `session`, `seq`, `change`, `base` | Gone. The receiver assigns and records these. |
| `author`, `actor` | Gone. The receiver knows who sent a message, and on whose behalf. |
| `evidenceClass` | Gone. Only the receiver assigns standing ([Security](security.md)). |
| `supersedes` | Gone. How a receiver chains its records is its own concern. |
| `countersig` | Gone. A receiver signs its own record of the message. |
| `privacy` | Gone. Privacy is the receiver's policy. |
| `scope` (on the envelope) | Gone. A proposition's own `scope` remains. |
| | New: optional `profile` and `confidence`. |

## Citations

| 0.1 | 0.2 |
|---|---|
| `{kind: "anchor", anchor: {path, symbol, commit}}` | `{kind: "anchor", path, symbol, commit}`, flattened. `commit` is optional, and when present is a full object id (40 or 64 hex digits). |
| `{kind: "message", session, seq}` | `{kind: "message", ref}`: the identifier the driver gave the message. |
| `{kind: "record", id}` | `{kind: "record", ref}` |
| | New: `{kind: "tool-result", ref}`. |

## Propositions

| 0.1 | 0.2 |
|---|---|
| `Proposition` | `PremiseProposition` in premise positions, `EffectProposition` in effect positions. Each is a union of one shape per predicate, which fixes its relations and value type. |
| `strength` on any proposition | On premises only. |
| `authority` value `"a,b"` | An array: `["a", "b"]`. |
| `shape` value: a JSON-encoded string | A JSON object in the [structural type language](propositions.md#structural-types). |
| `bound` without `unit` | `unit` is required. |
| `cardinality` values, unspecified | `exactly-once`, `at-most-once`, `at-least-once` or `any`. |
| Lattice orders, unspecified | Normative: [Lattices](lattices.md). |

## Kinds

| 0.1 | 0.2 |
|---|---|
| `intent.revision` | Gone. A receiver numbers revisions. |
| `premise.proposition` | `premise.premise`. |
| `observation.evidence: Evidence[]` | `observation.cites`, at least one. |
| `stance.argument`, optional | Required, for every stance. |
| `verdict.outcome`: `land`, `bounce`, `park`, `hold`, `supersede` | An open token. The core vocabulary is `accept`, `revise`, `reject` and `defer`; a platform's own outcomes belong in its [profile](extensibility.md#profiles). |
| `verdict.reasons: Evidence[]` | `reasons: [{summary, cites?}]`, at least one. |
| `verdict.cost` | Gone. Cost is telemetry, not a claim. |
| `derivation`, `DerivedEffect`, `EvidenceClass`, `EvidenceSource`, `Evidence` | Gone. A platform's derivations and evidence are its own records. |

## The TypeSpec library

`import "@bimsonz/mfp";` still provides the namespace `MFP`. The names that remain are:
- `FootprintEntry`, `Anchor` and `Citation`;
- `Predicate` and `Relation`, now as unions with the same members;
- `PremiseProposition` and `EffectProposition`;
- one message model per kind (`Intent`, `Premise`, `Decision`, `Observation`, `Stance`, `Verdict`) and their union, `Message`;
- `Profile`.

`Proposition`, `Evidence`, `EvidenceClass`, `EvidenceSource`, `MfpRecord` and the per-kind `*Record` models are gone.
