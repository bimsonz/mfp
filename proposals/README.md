# Proposals

A proposal is how MFP changes. Any change to what a conforming implementation does needs one: the wire schema, the emit form, a binding, the lattices, the conformance suite's meaning, or this process. A typo, a clarification that changes no behaviour, or a new example does not.

The process follows the Specification Enhancement Proposals of the Model Context Protocol.

## Types

| Type | Changes |
|---|---|
| Standards Track | What an implementation does: the schemas, the bindings, or normative text |
| Process | How MFP is run, such as this process |
| Informational | Nothing normative: guidance, a design note, a record of a decision |

## Statuses

```
Draft → In-Review → Accepted → Final
```

| Status | Means |
|---|---|
| Draft | Being written. Anyone may open one. |
| In-Review | Complete, and open for comment |
| Accepted | A maintainer has agreed to it, pending its implementation |
| Final | Implemented, on `main`, and shown to work. See below. |
| Rejected | Declined, with the reason recorded in the proposal |
| Withdrawn | Its author stopped pursuing it |
| Superseded | Replaced by a later proposal, which it names |

A Standards Track proposal is **Final** only when all of these hold:
- its change is merged, and the proposal names the commit;
- the conformance suite has cases that fail without the change, and the proposal names them;
- if the change touches anything a model emits or reads (the emit form, a tool, a binding), an emit-eval run measures it against the run before, and the proposal links the report.

A Process or Informational proposal is Final once it is merged.

## Writing one

1. Copy [`0000-template.md`](0000-template.md) to `NNNN-short-title.md`, with the next free number.
2. Fill in the header and every section. Say what breaks, and for whom.
3. Open a pull request with the proposal alone, as a Draft. Move it to In-Review when it is complete.
4. Once it is Accepted, implement it in a pull request that cites it, then mark it Final with the evidence above.

The maintainers are the repository's owners. One of them accepts or rejects a proposal, with the reason in the proposal.

## Index

| Number | Title | Type | Status |
|---|---|---|---|
| [0001](0001-remove-trust-fields.md) | Remove the trust fields | Standards Track | Final |
| [0002](0002-emit-without-patterns.md) | Emit without patterns | Standards Track | Draft |
