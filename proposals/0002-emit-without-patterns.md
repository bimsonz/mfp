# 0002: Emit without patterns

- **Type:** Standards Track
- **Status:** Draft
- **Created:** 2026-10-11
- **Author:** Zach Bimson (@bimsonz)
- **Implementation:** e592831
- **Conformance:** T19 in `conformance/emit.test.ts`; the pattern-only cases of T9 (`intent.freshness-typo`, `intent.premise-invalidation`, `intent.short-commit`, `premise.scope-grammar`, `premise.subject-case`)
- **Emit eval:** [`2026-10-11`](../eval/results/2026-10-11/RESULTS.md) before, [`2026-10-11-0002`](../eval/results/2026-10-11-0002/RESULTS.md) after

## Abstract

The emit form drops `pattern`, and leaves it to the wire schema. Each grammar a pattern enforced is stated in its definition's description instead. A driver that uses structured output also puts the emit schema in the prompt. An MCP tool's input inlines its `$ref`s, unless the kind has a recursive definition.

## Motivation

The first emit eval ([`2026-10-11`](../eval/results/2026-10-11/RESULTS.md); five Workers AI models, 18 tasks, three samples, n=270 per mode) found that the emit schemas fail under constrained decoding in ways that schema validity does not show:

- **A `Text` member was forced to one character.** `Text` is `{"type": "string", "pattern": "\\S"}`: at least one non-space character, since a JSON Schema pattern is a search. A constrained decoder matches a pattern against the whole string, so it admitted exactly one. Of the 141 valid `json_schema` messages, 138 had a goal, rationale, summary or argument one character long. Prompt mode had none of 178, and tool mode none of 108. Three `json_schema` messages of 270 were valid and readable.
- **Open-ended grammars ran away.** A pattern that lets a string keep growing, such as a scope or a commit id, let the decoder extend it to the token limit. 43 `json_schema` replies hit the 10,000-token limit: 29 inside a string, and 14 in whitespace, written by a model cut off after one character. 27 more timed out at 120 s on every attempt, all on intent and premise tasks, whose schemas carry those patterns.
- **The model wrote blind.** The provider enforced the schema without showing it to the model: prompts were 132–185 tokens, against about 1,500 with the schema in the prompt. Without its descriptions, a model did not know what a member meant. 23 of the 48 unissued refs were stances that put a word such as `comply` in `decision`, which is the ref of a decision.
- **One model's tools lost their nested types.** `gpt-oss-120b` called the tool every time, but wrote nested objects as prose, and was valid 4 times in 54. Its tool prompts were 363 tokens at the median, against 1,248–1,583 for three other models, which suggests its tool format dropped the `$defs` where those types live. `kimi-k2.6` saw 683 tokens and was valid 53 times in 54, so this is a lead.

## Specification

In [Bindings](../docs/specification/0.2/bindings.md):
- The emit form's keywords no longer include `pattern`. Each definition whose wire form has a pattern states its grammar in its `description`. The wire schema still enforces every pattern when the driver validates what the model emitted.
- A driver that asks for structured output SHOULD also put the emit schema in the prompt.
- An MCP tool's `inputSchema` inlines its `$ref`s, unless the kind has a recursive definition. In the core, intent and premise do: a shape can contain a shape. They keep their `$defs`.

The wire schema, the producer schema and the messages they accept do not change.

Conformance:
- T19 fails if an emit schema or tool has a `pattern`, or if a definition that had one has no description;
- T9's pattern-only cases pass the emit schema and fail on the wire;
- T10 checks which tools are inlined.

## Rationale

- **Why not anchor the patterns?** `[\s\S]*\S[\s\S]*` means the same under search and whole-string matching, and would fix `Text`. But an anchored grammar with no end still runs away, decoders support different subsets of regular expressions, and the driver validates against the wire anyway. Without patterns, the emit form constrains the structure, and the wire checks the strings.
- **Why the schema in the prompt?** A model fills each member from its description. Under constrained decoding a provider may not show the schema at all, so the driver shows it.
- **Why inline only some tools?** A recursive definition cannot be inlined. For the other four, inlining costs little: observation and stance shrink, decision grows by 2%, and verdict, which defines citations twice (in its reasons and at the top), by 54%, to under 5 KB.

## Compatibility

A driver that uses the committed emit schemas and tools needs no change: it validates against the wire as before, and a message valid before is valid after. A driver that relied on the emit schema to reject a malformed string now relies on the wire check, which bindings.md already requires. A tool's input has the same members, and fewer or no `$defs`.

The wire version does not change.

## Security

None. A model can now emit a string the emit schema would have refused. The driver's wire check refuses it, as before, and a receiver never takes standing from a message.

## Results

Run [`2026-10-11-0002`](../eval/results/2026-10-11-0002/RESULTS.md) used the same models, tasks, samples and settings as the baseline, and both runs were scored the same way. Valid before → after, n=270 per mode:

| Mode | What changed | Valid | Readable |
|---|---|---|---|
| prompt | No `pattern` | 178 → 180 | 178 → 180 |
| json_schema | No `pattern`; the schema in the prompt | 141 → 192 | 3 → 192 |
| tool | No `pattern`; refs inlined for four kinds | 108 → 99 | 108 → 99 |

- **`json_schema` is fixed.** No reply ran to the token limit (43 before) and none timed out (27 before). No valid message has a one-character prose member.
- **Prompt mode did not move.**
- **Tool mode did not improve.**
  - The four inlined kinds went from 84/180 to 77/180, and the two that were not inlined from 24/90 to 22/90.
  - `gpt-oss-120b` still writes nested objects as prose (4 → 5 of 54), so dropped `$defs` were not its problem. Inlining stays, because a tool with no `$defs` suits any client, but it has no measured benefit.
  - Most of the fall is one model's observation `category`, which failed 7 times in 9 against 2 before: `flaky test` where a hyphenated token is wanted. The pattern was a cue in the tool that the description has not replaced.

Open before this proposal can be Final: whether to state each grammar's regular expression in its description, so a model that read the pattern still can.

## Not in this proposal

A stance names the decision it is on in `decision`. In the baseline, under `json_schema`, 23 of the 48 unissued refs were stances that wrote a verdict-like word there: `comply`, `overrule`, `agree`. With the schema in the prompt, there were none. The member's description is enough when the model can read it, so this does not need a proposal of its own.
