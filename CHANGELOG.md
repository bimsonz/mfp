# Changelog

Notable changes to MFP. The format is [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The wire version is `major.minor`, and before 1.0 any minor version may break the one before it ([Versions](docs/specification/0.2/extensibility.md#versions)).

## [Unreleased]

## [0.2.2] - 2026-10-14

Documentation and packaging only. The wire, the schemas and the libraries are unchanged.

### Changed

- The `verdict.author` invalid case names an example platform. Its one defect, the `author` member, is unchanged.

## [0.2.1] - 2026-10-14

### Fixed

- The package ships the emit form and the MCP tool inputs, `schema/0.2/emit/` and `schema/0.2/mcp/`, which the README points to: 0.2.0's files left them out. The wire is unchanged.

## [0.2.0] - 2026-10-11

MFP 0.2: the language a model speaks back.

### Removed

- The trust fields, by [proposal 0001](proposals/0001-remove-trust-fields.md): `id`, `author`, `actor`, `at`, `session`, `seq`, `change`, `base`, `evidenceClass`, `supersedes`, `privacy` and `countersig`, and the `derivation` kind. A receiver that keeps records adds those in its own layer.
- The 0.1 schema and examples, from `main`. Their tags keep them.

### Changed

- A message is flat, and its wire version is `0.2`.
- Propositions are a union with one shape per predicate, and premises and effects have separate positions.
- The emit form has no `pattern`, by [proposal 0002](proposals/0002-emit-without-patterns.md). Each grammar is in its description, in words, and as its regular expression if it is anchored. An MCP tool's input inlines its refs unless the kind is recursive, and keeps every description. A structured-output driver also puts the schema in the prompt.

### Added

- Normative lattices for every predicate, with 148 vectors and a reference comparator.
- The extension rule: consumers ignore unknown members, and vendor members carry a reverse-DNS prefix.
- Profiles, which may only narrow the core; the profile check, as a library and as `mfp-profile`; the core profile and its producer schema; and a neutral example profile.
- Absolute, versioned schema ids; BCP 14 language; a security chapter; and the media type `application/vnd.mfp+json`.
- A structured-output schema and an MCP tool per kind, the `toWire` and `toEmit` transform, and the bindings chapter.
- Valid examples and invalid cases for every kind.
- The emit eval, which measures how often models emit valid MFP through each binding, and its runs.
- This changelog, contributing guidelines, a code of conduct, a security policy and the proposals process.

## [0.1.0-pre.3] - 2026-10-10

### Added

- A proposition's unit, and its value grammar.

## [0.1.0-pre.2] - 2026-10-10

### Changed

- A premise's strength is `must` or `should`, where it was `required` or `preferred`. This broke 0.1 records without a version change.

## [0.1.0-pre] - 2026-10-10

### Added

- The MFP 0.1 schema, published as a TypeSpec library.

[Unreleased]: https://github.com/bimsonz/mfp/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/bimsonz/mfp/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/bimsonz/mfp/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/bimsonz/mfp/compare/v0.1.0-pre.3...v0.2.0
[0.1.0-pre.3]: https://github.com/bimsonz/mfp/compare/v0.1.0-pre.2...v0.1.0-pre.3
[0.1.0-pre.2]: https://github.com/bimsonz/mfp/compare/v0.1.0-pre...v0.1.0-pre.2
[0.1.0-pre]: https://github.com/bimsonz/mfp/releases/tag/v0.1.0-pre
