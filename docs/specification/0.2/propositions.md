# Propositions

A proposition is a typed statement about a subject.
- A **premise** says what the model relies on: "permission evaluation is at most per-request".
- An **effect** says what a change alters: "permissions are now cached per session".

Premises and effects share one shape, so a consumer can compare them: does this effect break that premise? [Lattices](lattices.md) defines the comparison.

## Members

| Member | | |
|---|---|---|
| `subject` | REQUIRED | What the proposition is about: a [subject key](#subjects). |
| `predicate` | REQUIRED | The dimension it talks about: one of the [predicates](#predicates). |
| `relation` | REQUIRED | How `value` sits on the predicate's order. Which relations a predicate takes is in the table below. |
| `value` | REQUIRED | A value of the predicate's type. |
| `unit` | REQUIRED for `bound`, absent otherwise | The unit of a `bound`, e.g. `ms`. |
| `scope` | OPTIONAL | Where it holds: a [scope](#scopes). Absent means everywhere. |
| `anchors` | OPTIONAL | Code locations it is about: `path`, optional `symbol`, optional `commit`. |
| `gloss` | OPTIONAL | A one-line gloss for a person. Comparison never reads it. |
| `cites` | OPTIONAL | [Citations](messages.md#citations) it rests on. |
| `strength` | OPTIONAL, premises only | The holder's kind of reliance, `must` (the default) or `should`. See [strength](#strength). |

## Subjects

A subject key names a concept in the codebase. It is made of dot-separated segments of lowercase letters, digits and inner hyphens, e.g. `authz.permission-evaluation`.

Keys are hierarchical:
- A key is an **ancestor** of every key that extends it by one or more segments: `authz` is an ancestor of `authz.permission-evaluation`.
- Two keys are **related** when one is an ancestor of the other, or they are equal.
- A proposition about a subject also speaks about every subject beneath it.

Keys with a common parent but neither an ancestor of the other, such as `authz.a` and `authz.b`, are unrelated.

## Scopes

A scope narrows where a proposition holds. It is written as `;`-separated parts, each a dimension, a `:`, and `|`-separated atoms: `env:prod|staging;tenant:t1`. Dimensions and atoms are lowercase and begin with a letter or digit.

- A dimension MUST NOT appear twice in one scope.
- A dimension a scope does not mention is unconstrained.
- An absent scope is everywhere.

Two scopes **intersect** when every dimension both constrain shares at least one atom.

A scope `A` **covers** a scope `B` when every dimension `A` constrains is also constrained by `B`, and `B`'s atoms there are among `A`'s. An absent scope covers every scope.

## Predicates

| Predicate | Relations | Value | Says |
|---|---|---|---|
| `freshness` | `is`, `at-most`, `at-least`, `not` | `per-call`, `per-request`, `per-session`, `static`, or `ttl:<seconds>` | How stale a reader of the subject can be |
| `consistency` | `is`, `at-most`, `at-least`, `not` | `eventual`, `bounded:<seconds>`, `read-your-writes`, or `linearizable` | How strong a reader's view of the subject is |
| `cardinality` | `is`, `at-most`, `at-least`, `not` | `exactly-once`, `at-most-once`, `at-least-once`, or `any` | How many times something happens |
| `bound` | `is`, `at-most`, `at-least`, `not` | A number, in `unit` | A numeric limit, e.g. latency |
| `presence` | `is`, `not` | A boolean | Whether the subject exists |
| `purity` | `is`, `not` | A boolean | Whether it is free of side effects |
| `idempotent` | `is`, `not` | A boolean | Whether repeating it changes nothing further |
| `authority` | `is`, `at-most`, `at-least` | An array of writers, each once, in any order | Who writes the subject |
| `shape` | `is`, `at-most`, `at-least` | A [structural type](#structural-types) | The subject's structure |
| `ordering` | `before`, `after` | Another subject key | That the subject, an event, happens before or after another |
| `invariant` | `is` | Free text | Anything else; compared only by a model |

Every seconds parameter (`ttl:<seconds>`, `bounded:<seconds>`) is written as digits, with an optional fraction: `ttl:60`, `bounded:0.5`.

An **effect** may also state freshness in the *invalidation form*:
- the form is `<freshness> invalidated-on <event>,<event>`, with relation `is` or `at-most`;
- it says that a cache serves values at that freshness, and is evicted whenever one of the named events happens, in that event's own handler;
- the events are subject keys, MUST be sorted by code point, and MUST each appear once.

A premise MUST NOT use the invalidation form: a premise states the freshness it relies on.

An `ordering` proposition's subject is the first event of the pair and its value the second: `{subject: "db.migrate", relation: "before", value: "app.deploy"}` says migration happens before deployment. Its value MUST NOT equal its subject.

### Structural types

A `shape` value is a JSON object, one of:

| `type` | Other members | Admits |
|---|---|---|
| `unknown` | | every value |
| `never` | | no value |
| `string`, `number`, `boolean`, `null` | | values of that JSON type |
| `literal` | `value`: a string, number or boolean | exactly that value |
| `array` | `items`: a type | arrays whose every element the type admits |
| `object` | `fields`: a list of `{name, shape, optional}` | objects with those fields; other fields are allowed |
| `union` | `of`: a list of types | values any member admits |
| `opaque` | `name` | a named type the writer could not see into |

Field names MUST be unique within one `fields` list.

## Strength

`strength` says what happens to the holder if the premise is false:
- `must`: the holder breaks;
- `should`: it degrades.

It is a kind of reliance, not a confidence; a model's confidence in a report goes in the message's `confidence`.

Comparison never reads `strength`. A consumer MAY use it to decide what to do about an outcome, e.g. to report a contradicted `should` premise as a warning rather than as a conflict.

## Footprints

A footprint entry names a `path`, an optional `symbol`, and an `op`: `edit`, `create` or `delete`. Paths are repository-relative. A footprint is not a proposition: it says where a change works, not what it relies on or alters.
