# MFP 0.2

**Status:** draft. MFP, the Model Feedback Protocol, is the language a model speaks back to whatever drives it. This version is `0.2`.

MCP carries what a model asks of tools. MFP is what a model reports back, often carried as MCP tool calls.

## What MFP is

A model working on a task has things to report besides its output:
- what it intends to do;
- what it relies on;
- what it decided, and what it rejected;
- what it noticed;
- how its work relates to earlier decisions;
- what outcome it thinks the work should have.

MFP gives each of those reports a small, fixed shape, so that a driver can read them reliably and compare them with each other.

A driver is any harness, platform or tool that runs a model or receives what it says.

MFP is judged by one thing: **whether models emit it reliably.** Its vocabulary is small, and its schemas work as they are for structured output and for MCP tool input.

## What MFP is not

An MFP message is a model's claim. It carries no identity, no authorship, no timestamp, no evidence class and no signature.

A receiver that keeps messages as records adds all of those itself, in its own layer: for example by wrapping each message in a signed attestation. The receiver knows who sent a message, when, and what it weighs; the model does not, and MFP never asks it to say. See [Security considerations](security.md).

## Documents

| Document | Contents |
|---|---|
| [Messages](messages.md) | The six kinds of message, their members, and citations |
| [Propositions](propositions.md) | Typed statements about a subject: premises and effects |
| [Lattices](lattices.md) | How each predicate orders its values, and how two propositions compare |
| [Extensibility](extensibility.md) | Versioning, unknown members, vendor extensions, profiles, the media type |
| [Security considerations](security.md) | Why a message is never evidence, and what a consumer must not trust |
| [Migrating from 0.1](migrating-from-0.1.md) | What changed, member by member |

## Schemas

The normative schema source is [`schema/0.2/main.tsp`](../../../schema/0.2/main.tsp). Two JSON Schemas (2020-12) are generated from it and committed:

| Schema | `$id` | For |
|---|---|---|
| [`mfp.schema.json`](../../../schema/0.2/mfp.schema.json) | `https://bimsonz.github.io/mfp/schema/0.2/mfp.schema.json` | **Consumers.** The wire form. Open: it accepts members it does not define, as consumers must ignore them. |
| [`producer.schema.json`](../../../schema/0.2/producer.schema.json) | `https://bimsonz.github.io/mfp/schema/0.2/producer.schema.json` | **Producers.** The wire form with every object closed and the core profile applied. |

A message is valid when it validates against `$defs/Message` of the wire schema. Where this text and the schema disagree, the schema wins.

Some rules here cannot be expressed in JSON Schema. Each one is stated as a requirement on the producer, and as what a consumer does when a producer breaks it.

## Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY" and "OPTIONAL" in these documents are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/info/bcp14) ([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)) when, and only when, they appear in all capitals, as shown here.

A *member* is a name and value in a JSON object ([RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)).

## Conformance

MFP defines four conformance classes. An implementation names the ones it claims.

- **Producer:** emits messages.
  - Every message it emits MUST be valid against the producer schema of its profile (the core profile's when it names none).
  - It MUST also meet the rules in these documents that a schema cannot check.
- **Consumer:** reads messages.
  - It MUST accept every message that is valid against the wire schema.
  - It MUST ignore members it does not recognise ([Extensibility](extensibility.md#unknown-members)).
  - It MUST NOT give a message standing from its own content ([Security](security.md#a-message-is-a-claim)).
- **Comparator:** a consumer that compares propositions. It MUST produce the outcomes [Lattices](lattices.md) defines for every pair of valid propositions.
- **Profile:** a document that narrows the core for one domain.
  - It MUST pass the profile check in [Extensibility](extensibility.md#profiles).

The conformance suite in [`conformance/`](../../../conformance) holds:
- valid and invalid messages for every kind, each invalid message with exactly one defect and the single operation that fixes it;
- the lattice vectors, each with the outcome a comparator must produce;
- the profile check, run against an example profile.
