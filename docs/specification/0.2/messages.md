# Messages

A message is one report from a model. It is a JSON object whose `kind` says which of six reports it is:

| Kind | Reports |
|---|---|
| `intent` | What the model will do, and what it relies on, before it writes code |
| `premise` | One more thing it relies on, after its intent |
| `decision` | A choice it made, why, and the alternatives it rejected |
| `observation` | Something it noticed, and what that rests on |
| `stance` | How its work relates to an earlier decision it met as precedent |
| `verdict` | The outcome it thinks a piece of work should have: an opinion, never a ruling |

A message is flat: a kind's own members sit beside the common ones, with no envelope.

## Members every message carries

| Member | | |
|---|---|---|
| `mfp` | REQUIRED | The wire version: `"0.2"`. |
| `kind` | REQUIRED | One of the six kinds. |
| `profile` | OPTIONAL | The URI of the [profile](extensibility.md#profiles) the message conforms to. When it is absent, the message conforms to the core profile, `https://bimsonz.github.io/mfp/schema/0.2/core`. |
| `confidence` | OPTIONAL | The model's own confidence in this report: `low`, `medium` or `high`. |
| `cites` | Varies | What the report rests on: a list of [citations](#citations). REQUIRED, with at least one entry, for a `decision` and an `observation`; OPTIONAL otherwise. |

`confidence` is an opinion about an opinion.
- It is coarse on purpose: a model's numeric probabilities are rarely calibrated, and three levels are what a reader can act on.
- A consumer MAY use it to route a report, e.g. to ask a person about a low-confidence decision.
- A consumer MUST NOT treat it as evidence ([Security](security.md#a-message-is-a-claim)).

A message carries nothing a receiver must vouch for: no identifier, author, sender, timestamp, session, sequence number, evidence class, signature or supersession. A producer MUST NOT emit members for any of these. A receiver that needs them assigns them in its own record of the message.

## Kinds

### `intent`

| Member | | |
|---|---|---|
| `goal` | REQUIRED | What the work will achieve, in one or two sentences. |
| `footprint` | OPTIONAL | The paths, and optionally symbols, it expects to touch, each with `op`: `edit`, `create` or `delete`. |
| `premises` | REQUIRED | What it relies on, about code it does not own: a list of [premise propositions](propositions.md). It MAY be empty. |
| `declaredEffects` | OPTIONAL | What it expects to alter: a list of [effect propositions](propositions.md). Advisory: a receiver that can derive effects from the work itself SHOULD prefer what it derives. |

### `premise`

| Member | | |
|---|---|---|
| `premise` | REQUIRED | One premise proposition. |

A `premise` adds to the model's earlier intent. It does not replace or retract anything: how a receiver tracks a model's premises over time is the receiver's concern.

### `decision`

| Member | | |
|---|---|---|
| `question` | OPTIONAL | The question decided. |
| `chosen` | REQUIRED | What was chosen. |
| `rationale` | REQUIRED | Why. |
| `alternatives` | REQUIRED | The options rejected, each with `option` and `reasonRejected`. It MAY be empty. |
| `reversible` | REQUIRED | Whether the choice can be undone cheaply. |
| `cites` | REQUIRED | At least one citation. |

### `observation`

| Member | | |
|---|---|---|
| `category` | REQUIRED | What kind of thing was noticed, as a lowercase token, e.g. `flaky-test`. The core leaves it open; a profile MAY close it to a vocabulary. |
| `importance` | REQUIRED | `low`, `medium` or `high`. |
| `summary` | REQUIRED | What was noticed. |
| `cites` | REQUIRED | At least one citation. |

### `stance`

| Member | | |
|---|---|---|
| `decision` | REQUIRED | The earlier decision, by the identifier the driver gave it. |
| `stance` | REQUIRED | `followed`, `distinguished` (it does not apply here, and why), or `overrule-requested`. |
| `argument` | REQUIRED | Why the decision applies, does not apply, or should be overruled. |

### `verdict`

| Member | | |
|---|---|---|
| `outcome` | REQUIRED | The outcome, as a lowercase token. Under the core profile it is one of `accept`, `revise`, `reject` or `defer`. A profile MAY replace that vocabulary. |
| `reasons` | REQUIRED | At least one reason, each a `summary` with optional `cites`. |
| `residualRisk` | OPTIONAL | What could still go wrong if the outcome is taken. |

A verdict is the model's opinion of an outcome. Whether the outcome happens is the receiver's decision, made on the receiver's own evidence.

The core vocabulary:

| Outcome | The model thinks the work should be |
|---|---|
| `accept` | taken as it is |
| `revise` | changed, then looked at again |
| `reject` | dropped |
| `defer` | left undecided for now |

## Citations

A citation says what a claim rests on. It is an object whose `kind` is one of:

| `kind` | Members | Points at |
|---|---|---|
| `anchor` | `path`; optional `symbol` and `commit` | A path, and optionally a symbol, in the repository. `commit` is a full git object id (40 or 64 lowercase hex digits). Without it, the anchor is read at the commit the driver is working against. |
| `message` | `ref` | A message in the conversation |
| `tool-result` | `ref` | The result of a tool call |
| `record` | `ref` | An earlier MFP message, as its receiver recorded it |

A `ref`, and a stance's `decision`, is an identifier **the driver gave the model**: a message id, a tool call id, a record id. A producer MUST NOT invent one. A consumer MUST treat a ref it did not issue as a defect, never as a pointer to something that exists ([Security](security.md#refs)).
