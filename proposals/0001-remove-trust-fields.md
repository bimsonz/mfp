# 0001: Remove the trust fields

- **Type:** Standards Track
- **Status:** Final
- **Created:** 2026-10-11
- **Author:** Zach Bimson (@bimsonz)
- **Implementation:** 3645470
- **Conformance:** `intent.evidence-class`, `verdict.author`

## Abstract

MFP 0.1 was a record format: each message carried the platform's view of it (who wrote it, when, in which session, how much it counted as evidence, and a signature). MFP 0.2 removes all of that. A message is what a model reports, and nothing a receiver must vouch for. A receiver that keeps messages as records adds identity, time, standing and signatures in its own layer.

## Motivation

An external review of 0.1 found that the schema let a producer assert its own standing:
- an agent's intent could label itself `proof`, the strongest evidence class;
- an agent could author a verdict that decides the outcome of a change, with reasons labelled `proof`;
- authorship, and the party an agent acted for, were whatever the message said;
- `countersig` was a bare string, with no encoding, no key and no definition of the bytes signed, and adding one edited a record meant to be immutable.

Each is a field whose value a receiver cannot take from the sender. Who sent a message, when, and how much it counts are facts the receiver knows or decides. A field for them in the message invites a model to claim them.

## Specification

The wire version is `0.2`. These members of 0.1 are gone: `id`, `author`, `actor`, `at`, `session`, `seq`, `change`, `base`, `evidenceClass`, `supersedes`, `privacy` and `countersig`. So is the `derivation` kind, which only a platform could author.

A message is flat: `mfp`, `kind`, an optional `profile` and `confidence`, `cites`, and the kind's own members ([Messages](../docs/specification/0.2/messages.md)). `confidence` is the model's opinion of its own report, and never carries weight.

A producer MUST NOT emit a removed member; the core producer schema closes every object, so it refuses one. A consumer ignores one, as it ignores any unknown member ([Extensibility](../docs/specification/0.2/extensibility.md)).

## Rationale

A receiver that keeps messages as records can wrap each in an envelope it signs, such as an in-toto Statement with a DSSE signature, recording who sent it, when, and the standing the receiver gives it. That layer is the receiver's, and MFP does not define it. Keeping it out lets MFP stay small enough for a model to emit reliably, and stops a message from carrying a claim about itself.

## Compatibility

Breaking. A 0.1 record is not a 0.2 message. [Migrating from 0.1](../docs/specification/0.2/migrating-from-0.1.md) maps each removed member to where it now belongs.

## Security

A message's content can no longer raise its own standing. [Security considerations](../docs/specification/0.2/security.md) says what a receiver may and may not take from one.
