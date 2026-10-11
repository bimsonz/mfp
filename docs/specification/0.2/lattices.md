# Lattices

Each predicate orders its values. This document defines those orders, the set of values a proposition denotes, and how a comparator compares a premise with an effect. It is normative for comparators: two comparators given the same pair of valid propositions MUST produce the same outcome. The vectors in [`conformance/0.2/lattices/`](../../../conformance/0.2/lattices) are part of this definition.

Comparison is defined so that it errs towards *undecided*. Where a rule below answers `overlap` though a cleverer reading could decide, that is deliberate: implementations agree, and an undecided pair goes to evidence rather than to a guess.

## Regions

A proposition's relation and value denote a **region**: the set of values on its predicate's order that it allows.

| Relation | Region |
|---|---|
| `is v` | `{v}` |
| `at-most v` | every value at or below `v` |
| `at-least v` | every value at or above `v` |
| `not v` | every value except `v` |

A premise's region is what its holder relies on. An effect's region is a sound over-approximation of what the code can now do. Comparing the two on one predicate gives a **region relation**:

| Region relation | Meaning |
|---|---|
| `within` | The effect's region lies inside the premise's: every behaviour the effect allows satisfies the premise. |
| `disjoint` | The regions do not meet: no behaviour the effect allows satisfies the premise. |
| `overlap` | Neither can be shown by the rules below. |
| `unrelated` | The two claims are about different things (only `ordering` produces this). |

Several predicates below are decided on **intervals**. An interval `[lo, hi]` is placed on the extended real line by the predicate's positions, with the predicate's own bottom `⊥` and top `⊤`:
- `at-most v` is `[⊥, pos(v)]`;
- `at-least v` is `[pos(v), ⊤]`;
- `is v` is `[pos(v), pos(v)]`.

For a premise interval `P` and an effect interval `E`:
- `within` if `P.lo ≤ E.lo` and `E.hi ≤ P.hi`;
- otherwise `disjoint` if `E.hi < P.lo` or `P.hi < E.lo`;
- otherwise `overlap`.

The **complement rule** decides any claim with `not` on an ordered predicate. It is decided only against a single value, where `same` means the two values are equal:

| Premise | Effect | Region relation |
|---|---|---|
| `not v` | `is x` | `disjoint` if same, else `within` |
| `is v` | `not x` | `disjoint` if same, else `overlap` |
| `not v` | `not x` | `within` if same, else `overlap` |
| `not v` | `at-most x` or `at-least x` | `overlap` |
| `at-most v` or `at-least v` | `not x` | `overlap` |

## freshness

Freshness is staleness: a higher value is staler. Positions:

| Value | Position |
|---|---|
| `per-call` | −2 |
| `per-request` | −1 |
| `ttl:n` | `n` |
| `per-session` | unknown: above `per-request`, below `static`, and incomparable with every `ttl:n` |
| `static` | +∞ |

`⊥` is −2 and `⊤` is +∞. The order's covers (Hasse diagram):

```
per-call → per-request → per-session → static
                       → ttl:n       → static        (ttl:n ≤ ttl:m iff n ≤ m)
```

Two values are **equal** when they are the same name, or both TTLs with equal numbers (`ttl:10` equals `ttl:10.0`).

For a premise and an effect, neither in the invalidation form:
1. **With `not`:** if one value is `per-session` and the other a TTL, the relation is `overlap`. Otherwise apply the complement rule.
2. **Without `not`, with no `per-session`:** decide on intervals.
3. **Without `not`, with `per-session` on either side:** decide on intervals under every placement of `per-session`'s position against the TTLs the two claims name. The placements are: below all of them (still above −1), equal to each, between each adjacent pair, and above all of them. With no TTLs, there is one placement. If every placement gives the same relation, that is the relation; otherwise it is `overlap`.

### The invalidation form

An effect `c invalidated-on events`, with relation `r` (`is` or `at-most`), is decided against a premise in two parts:
- **evicted:** a change that arrives by one of the events is at most as stale as `e`, where `e` is `per-call` if `c` is `per-call`, and `per-request` otherwise. Let `A` be the relation of the premise to the effect `r e`.
- **cached:** any other change is as stale as `c`. Let `B` be the relation of the premise to the effect `r c`.

The relation is:
- `disjoint` if `A` is `disjoint`;
- `within` if `A` and `B` are both `within`;
- `overlap` otherwise.

## consistency

Consistency is strength: a higher value is stronger. Positions:

| Value | Position |
|---|---|
| `eventual` | −∞ |
| `bounded:t` | −t (a smaller bound is stronger) |
| `read-your-writes` | 1 |
| `linearizable` | 2 |

`⊥` is −∞ and `⊤` is 2. The order is total:

```
eventual → bounded:t → read-your-writes → linearizable     (bounded:t ≤ bounded:u iff t ≥ u)
```

Two values are equal when their positions are. A claim with `not` is decided by the complement rule; any other claim is decided on intervals.

## cardinality

Cardinality is ordered by guarantee: `exactly-once` is the strongest and `any` the weakest. `at-most-once` and `at-least-once` are incomparable.

```
exactly-once → at-most-once  → any
             → at-least-once → any
```

The order is finite, so regions are computed exactly, `not` included. With `R(P)` and `R(E)` the two regions:
- `within` if `R(E) ⊆ R(P)`;
- `overlap` if they meet;
- `disjoint` otherwise.

A retry (`is at-least-once`) is therefore `disjoint` from a reliance on `at-most at-most-once`.

## presence, purity, idempotent

The values are `true` and `false`, with no order between them. `is v` is `{v}` and `not v` is the other value. Regions are compared exactly, as for cardinality.

## bound

A bound is a number in a unit. Units are compared as written: two bounds in different units are never converted, and their relation is `overlap`.

In one unit:
- a claim with `not` is decided by the complement rule, with numeric equality;
- any other claim is decided on intervals over the real line, with `⊥` −∞ and `⊤` +∞.

## authority

Authority is the set of writers, ordered by inclusion. A region is an interval of writer sets, where `⊤` is every writer:
- `at-most W` is the interval from the empty set to `W`;
- `at-least W` is the interval from `W` to `⊤`;
- `is W` is the interval from `W` to `W`.

For a premise interval `[Plo, Phi]` and an effect interval `[Elo, Ehi]`:
- `within` if `Plo ⊆ Elo` and `Ehi ⊆ Phi` (only `⊤` is inside `⊤`);
- otherwise `overlap` if `Plo ∪ Elo ⊆ Phi ∩ Ehi`;
- otherwise `disjoint`.

`at-most [w]` says `w` is the only writer.

## shape

Shapes are ordered by structural assignability. `A(s, t)` says whether every value `s` admits is admitted by `t`, as `true`, `false` or `unknown`. The first rule that applies decides:

1. If `t` is `unknown`, or `s` is `never`: `true`.
2. If `s` is a union: combine `A(m, t)` over its members with *all*.
3. If `t` is a union: combine `A(s, m)` over its members with *any*.
4. If either is `opaque`: `true` if both are opaque with the same name, otherwise `unknown`.
5. If `s` is a literal:
   - against a literal `t`: whether the two values are equal;
   - otherwise: whether `t`'s type is the literal's JSON type.
6. If `s` is an array: if `t` is an array, `A(s.items, t.items)`; otherwise `false`.
7. If `s` is an object and `t` is not: `false`. If both are objects, combine over `t`'s fields with *all*, where for each field:
   - if `s` lacks it: whether `t`'s field is optional;
   - if `s`'s field is optional and `t`'s is not: `false`;
   - otherwise: `A` of the two fields' shapes.
8. Otherwise: whether `s` and `t` have the same `type`.

*All* is `false` if any input is `false`, else `unknown` if any is `unknown`, else `true`. *Any* is `true` if any input is `true`, else `unknown` if any is `unknown`, else `false`.

`at-most T` says the subject's type is assignable to `T`: what a reader relies on. `at-least T` says `T` is assignable to the subject's type: what a writer relies on passing.

The region relation maps `true` to `within`, `false` to `disjoint` and `unknown` to `overlap`. It is computed as follows:

| Premise | Effect | Region relation |
|---|---|---|
| `at-most T` | `is X` | `A(X, T)` |
| `at-least T` | `is X` | `A(T, X)` |
| `is T` | `is X` | *all* of `A(X, T)` and `A(T, X)` |
| `at-most T` | `at-most X` | `within` if `A(X, T)` is `true`, else `overlap` |
| `at-least T` | `at-least X` | `within` if `A(T, X)` is `true`, else `overlap` |
| any other pairing | | `overlap` |

## ordering

An ordering proposition names a pair of events, first and second.

Before comparing, a comparator MUST rewrite each ordering proposition into its **canonical form**:
- the subject is the lesser of the two events by code point;
- the relation is `before` or `after` as needed to keep the pair's meaning;
- the value is the other event.

So `deploy after migrate` and `migrate before deploy` both become `{subject: "deploy", relation: "after", value: "migrate"}`.

For two canonical orderings:
- `within` if they name the same pair in the same order;
- `disjoint` if they name the same pair in the opposite order;
- `unrelated` otherwise.

## invariant

An invariant is free text. No rule here decides it: only a model or a person can.

## Comparing a premise with an effect

A comparator compares a premise `P` with an effect `E`, both valid propositions, in this order. The first step that answers decides.

1. Rewrite any ordering into its canonical form.
2. If the subjects are not related: **unrelated**.
3. If either proposition is [unreadable](#unreadable-propositions): **undecided**.
4. If the scopes do not intersect: **unrelated**.
5. If either predicate is `invariant`: **undecided**.
6. If the predicates differ: **unrelated**.
7. Take the region relation, from the predicate's rules above:
   - `within`: **holds** if `E`'s subject is `P`'s or an ancestor of it, and `E`'s scope covers `P`'s; otherwise **holds-in-part**;
   - `disjoint`: **contradicts**;
   - `overlap`: **undecided**;
   - `unrelated`: **unrelated**.

| Outcome | Meaning |
|---|---|
| `holds` | The effect satisfies the premise across everything the premise relies on. |
| `holds-in-part` | It satisfies the premise, but speaks for only part of the premise's subject or scope. |
| `contradicts` | Where both speak, nothing the effect allows satisfies the premise. |
| `undecided` | These rules cannot settle it. Only evidence can: a test, a person, or a model's judgement taken as opinion. |
| `unrelated` | They are about different things. |

`strength`, `gloss`, `anchors` and `cites` never affect the outcome. What a consumer does about an outcome is its own concern: for example, it might:
- raise a conflict for a contradicted `must` premise;
- send a notice for a contradicted `should` premise;
- run a test for an undecided pair.

### Unreadable propositions

Some rules cannot be expressed in the schema. A proposition that is valid against the schema but breaks one of them is **unreadable**:
- a scope that repeats a dimension;
- an invalidation form whose events are not sorted, or repeat;
- an ordering whose value is its own subject;
- a shape that repeats a field name in any one `fields` list.

A producer MUST NOT emit one.

A comparator MUST NOT repair one: no reordering, deduplication or folding. Against a proposition on a related subject, it is undecided (step 3).
