# Contributing to MFP

MFP is judged by whether models emit it reliably, and by whether two implementations agree on what a message means. Every change is held to both.

## What needs a proposal

A change to what a conforming implementation does needs a [proposal](proposals/README.md) first: the wire schema, the emit form, a binding, the lattices, or normative text. Open the proposal as its own pull request.

A typo, a clarification that changes no behaviour, a new example or a new conformance case for existing behaviour does not need one. Open a pull request.

## Set up

```sh
pnpm install
pnpm build          # regenerate the schemas from schema/0.2/main.tsp
pnpm conformance    # the whole suite
pnpm check:drift    # fail if a generated schema is stale
pnpm typecheck && pnpm lint
```

`schema/0.2/main.tsp` is the source. Every JSON schema under `schema/0.2/` is generated from it and committed; edit the source, run `pnpm build`, and commit both.

## What a change must carry

- **A check that fails without it.** A rule in the specification has a conformance case. A new invalid case has exactly one defect, and the single operation that fixes it. Before you trust a check, break what it checks and watch it fail.
- **A measurement, if a model sees it.** A change to the emit form, a tool or a binding is measured by the [emit eval](eval/README.md) against the previous run, and the report is committed with the change.
- **The changelog.** Add a line under `Unreleased` in [CHANGELOG.md](CHANGELOG.md).

## Commits

Write each commit message as an account of what changed and why.

## Conduct and security

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md). Report a security problem privately, as [SECURITY.md](SECURITY.md) says, never in a public issue.

## Licence

MFP is MIT licensed. A contribution is made under the same licence.
