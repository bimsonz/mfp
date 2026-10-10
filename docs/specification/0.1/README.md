# MFP 0.1 specification

**Status:** draft. The normative schema is [`schema/0.1/main.tsp`](../../../schema/0.1/main.tsp); its JSON Schema is [`schema/0.1/schema.json`](../../../schema/0.1/schema.json). Where this text and the schema disagree, the schema wins.

## Records

A record is one claim. Every record carries the envelope fields `mfp` (`"0.1"`), `kind`, `id`, `author`, `at`, `cites` and `payload`, and may carry `change`, `session`, `actor`, `base`, `seq`, `evidenceClass`, `scope`, `supersedes`, `privacy` and `countersig`.

- **Identity.** `id` is globally unique. `change` is a change identifier that survives rebases and squashes. `session` and `seq` address the session message the claim was made in; session messages are immutable.
- **Authorship.** `author.kind` is `agent`, `platform` or `human`. A `derivation` is always `platform`.
- **Citations.** A citation is a session message, a code anchor (a path and symbol pinned to a commit) or another record. `decision` and `verdict` records must cite at least once.
- **Evidence classes.** `proof` (executed by the platform), `ruling` (a deterministic judgement or a human decision), `testimony` (a claim from outside the platform) and `opinion` (any model output). Only proof and rulings may block or clear a change.
- **Derived effects.** An effect found by a deterministic `extractor` is `proof`. One answered by a decision model (`clef`) is `opinion` and always carries its probability `p`. One proposed by a `code-model` is `opinion`.
- **Supersession.** A record replaces another by naming it in `supersedes`; records are never edited.
- **Countersignature.** When a change lands, the platform may add `countersig`: an Ed25519 signature over the record's RFC 8785 canonical JSON.

## Compatibility

`0.1` only grows: new optional fields and new kinds. Consumers ignore fields they do not know. Producers normalise what they emit and omit fields they do not set.
