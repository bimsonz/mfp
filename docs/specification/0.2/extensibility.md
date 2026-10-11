# Extensibility

## Versions

A message names its version in `mfp`, as `major.minor`. This is version `0.2`.

- **Before 1.0**, any minor version may break the one before it.
  - A consumer MUST reject a message whose version it does not implement.
- **From 1.0**, a minor version only adds: new optional members, new kinds, new predicates and new values. A consumer that implements `M.n` and receives `M.m` with `m > n`:
  - MUST process it as `M.n`;
  - MUST ignore members it does not know;
  - MUST ignore messages of kinds it does not know;
  - MUST treat a proposition with a predicate or value it does not know as unreadable.

  A new major version may break anything.

The version is also part of every schema's identifier: each schema lives under `https://bimsonz.github.io/mfp/schema/<version>/`. Every `$defs` entry has an absolute `$id` under that base, e.g. `https://bimsonz.github.io/mfp/schema/0.2/Intent.json`, so a schema can be loaded beside another version's without collision.

## Unknown members

A consumer MUST ignore any member it does not recognise, at any depth of a message. It MUST NOT reject a message for carrying one, and MUST NOT let one change how it reads the members it does recognise. The wire schema is open for this reason: it accepts members it does not define.

A producer MUST NOT emit a member that neither this specification nor its profile defines, unless the member is a [vendor extension](#vendor-extensions). The producer schemas close every object to enforce this: they accept defined members and vendor extensions only, so a misspelt member such as `strenght` fails there, although a consumer would ignore it.

## Vendor extensions

A member that this specification does not define MUST be named `<prefix>/<name>`:
- `<prefix>` is a reverse-DNS name the vendor controls, of at least two labels, each of lowercase letters, digits and inner hyphens, e.g. `org.example.review`;
- `<name>` is letters, digits, `_`, `.` and `-`.

Names without a `/` are reserved for this specification.

An extension MUST NOT change the meaning of any member this specification defines: a consumer that ignores every extension still reads the message correctly.

An extension MUST NOT carry standing: no evidence class, signature, authorship or approval ([Security](security.md#a-message-is-a-claim)).

## Profiles

A profile narrows the core for one domain. It may only narrow: every message valid under a profile is valid on the wire. A profile can do three things:
- **Close an open vocabulary.** The open vocabularies are `verdict.outcome` and `observation.category`. Each is closed to a non-empty set of tokens, replacing the core vocabulary where there is one.
- **Require optional members**, named `<kind>.<member>`, e.g. `intent.footprint`.
- **Define members under its own prefix,** each with a JSON Schema for its value, and optionally required.

A profile cannot widen anything. It cannot:
- add values to a closed set;
- relax a constraint;
- define an unprefixed member;
- define a member under another vendor's prefix.

### The descriptor

A profile is published as a JSON descriptor, valid against `$defs/Profile` in the wire schema:

| Member | | |
|---|---|---|
| `id` | REQUIRED | The profile's URI. Whoever controls the URI publishes the profile. |
| `mfp` | REQUIRED | The version it narrows: `"0.2"`. |
| `title` | REQUIRED | A name for people. |
| `prefix` | REQUIRED when `members` is present | The reverse-DNS prefix its members are named under. |
| `vocabularies` | OPTIONAL | The open vocabularies it closes: `{"verdict.outcome": [...], "observation.category": [...]}`. |
| `require` | OPTIONAL | The optional core members it requires. |
| `members` | OPTIONAL | Its members: each `kind`, `name` (`<prefix>/<name>`), `schema`, and optional `required`. |

A message conforms to a profile when:
- it names the profile's `id` in `profile`;
- it is valid on the wire;
- it is valid against the profile's **producer schema**.

The producer schema is the wire schema with every object closed, and then:
- each closed vocabulary set;
- each required member made required;
- each of the profile's members typed;
- any member under the profile's prefix that the profile does not define refused, since it is a misspelling.

The **core profile**, `https://bimsonz.github.io/mfp/schema/0.2/core`, is what a message without `profile` conforms to. Its descriptor is [`schema/0.2/core.profile.json`](../../../schema/0.2/core.profile.json): it closes `verdict.outcome` to `accept`, `revise`, `reject` and `defer`. Its producer schema is committed as [`producer.schema.json`](../../../schema/0.2/producer.schema.json).

### The profile check

A profile MUST pass the profile check, which the package ships as a command and as a library:

```sh
pnpm exec mfp-profile check profile.json [message.json ...]
```

```js
import { checkProfile, checkMessages, loadWire } from "@bimsonz/mfp/profile";
const problems = checkProfile(loadWire(), profile); // [] when it only narrows
```

The check refuses a descriptor that:
- does not validate;
- names another MFP version;
- closes a vocabulary the core does not leave open;
- requires a member the kind lacks or already requires;
- names a member outside its own prefix, or defines one twice;
- gives a member a schema that does not compile.

Given messages, it then checks each against the wire schema and the profile's producer schema. Every narrowing a passing descriptor can express builds a producer schema that accepts only wire-valid messages.

A profile belongs to whoever publishes it. This repository holds only the core profile and a neutral example: [`examples/profiles/code-review`](../../../examples/profiles/code-review/profile.json).

## Media type and files

An MFP message is a JSON document, using the media type `application/vnd.mfp+json`. This media type is not registered with IANA: until it is, it is a provisional name, and a receiver SHOULD also accept `application/json`.

The optional `profile` parameter names the message's profile ([RFC 6906](https://www.rfc-editor.org/rfc/rfc6906)):

```
Content-Type: application/vnd.mfp+json; profile="https://example.org/mfp/profiles/code-review/0.2"
```

When the parameter and the message's `profile` member disagree, the member wins.

- **Files.** A file holding one message uses the extension `.mfp.json`.
- **Sequences.** A sequence of messages MAY be stored as JSON Lines, one message per line, with the extension `.mfp.jsonl`.
