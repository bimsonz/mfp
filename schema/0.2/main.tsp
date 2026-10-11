import "@typespec/json-schema";

using JsonSchema;

/**
 * MFP, the Model Feedback Protocol, version 0.2: the language a model speaks
 * back to whatever drives it.
 *
 * A message is one report from a model: an intent, a premise it relies on, a
 * decision, an observation, a stance on a precedent, or a verdict it holds as
 * its opinion. A message carries what the model says and nothing a receiver
 * must vouch for: no identifier, author, timestamp, evidence class or
 * signature. The receiver assigns those.
 *
 * This schema is the wire form, for consumers. It is open: a consumer ignores
 * members it does not know. The producer schemas, which close every object, are
 * generated from it.
 */
@jsonSchema("https://bimsonz.github.io/mfp/schema/0.2/")
namespace MFP;

// ─── Scalars ────────────────────────────────────────────────────────────────

/**
 * A named concept in the codebase, as dot-separated segments of lowercase
 * letters, digits and inner hyphens, e.g. `authz.permission-evaluation`. Keys
 * are hierarchical: `authz` is an ancestor of `authz.permission-evaluation`.
 */
@pattern("^[a-z0-9]+(?:[.-][a-z0-9]+)*$")
scalar SubjectKey extends string;

/**
 * Where a proposition holds, as `;`-separated `dimension:atom|atom` parts, e.g.
 * `env:prod|staging;tenant:t1`. A dimension appears at most once. Absent means
 * everywhere.
 */
@pattern("^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*(?:\\|[a-z0-9][a-z0-9._-]*)*(?:;[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*(?:\\|[a-z0-9][a-z0-9._-]*)*)*$")
scalar Scope extends string;

/** A git object id: 40 lowercase hex digits (SHA-1) or 64 (SHA-256). */
@pattern("^(?:[0-9a-f]{40}|[0-9a-f]{64})$")
scalar CommitId extends string;

/** A lowercase token: letters, digits and inner hyphens, e.g. `request-changes`. */
@pattern("^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$")
scalar Token extends string;

/**
 * An identifier the driver gave the model: a message, a tool call, an earlier
 * MFP message or a decision. A model never invents one.
 */
@minLength(1)
scalar Ref extends string;

/** Text a reader is meant to read: at least one non-space character. */
@pattern("\\S")
scalar Text extends string;

// ─── Citations ──────────────────────────────────────────────────────────────

/** A path, and optionally a symbol, in the repository, optionally pinned to a commit. */
model Anchor {
  /** Repository-relative path. */
  @minLength(1)
  path: string;

  /** A symbol within the file, e.g. a function or class name. */
  symbol?: string;

  /** The commit the anchor was read at. Absent means the commit the driver is working against. */
  commit?: CommitId;
}

/** A code location the claim rests on. */
model AnchorCitation {
  kind: "anchor";
  ...Anchor;
}

/** A message in the conversation, by the identifier the driver gave it. */
model MessageCitation {
  kind: "message";
  ref: Ref;
}

/** The result of a tool call, by the call's identifier. */
model ToolResultCitation {
  kind: "tool-result";
  ref: Ref;
}

/** An earlier MFP message, by the identifier its receiver gave it. */
model RecordCitation {
  kind: "record";
  ref: Ref;
}

/** What a claim rests on. */
union Citation {
  anchor: AnchorCitation,
  message: MessageCitation,
  toolResult: ToolResultCitation,
  record: RecordCitation,
}

/** A citation list that must not be empty. */
@minItems(1)
model Citations is Citation[];

// ─── Propositions ───────────────────────────────────────────────────────────

/** The dimension a proposition talks about. Each predicate orders its values; see lattices.md. */
union Predicate {
  "freshness",
  "consistency",
  "cardinality",
  "bound",
  "presence",
  "purity",
  "idempotent",
  "authority",
  "shape",
  "ordering",
  "invariant",
}

/** How a proposition's value sits on its predicate's order. Each predicate takes some of these. */
union Relation {
  "is",
  "at-most",
  "at-least",
  "not",
  "before",
  "after",
}

/** A relation that reads a value on its predicate's order. */
alias OrderRelation = "is" | "at-most" | "at-least" | "not";

/** A relation that reads a value on a predicate with no order between its values. */
alias PointRelation = "is" | "not";

/** A relation that reads a value on a set or type order, where a complement is not meaningful. */
alias RangeRelation = "is" | "at-most" | "at-least";

/**
 * How stale a reader of the subject can be, from least to most:
 * `per-call`, `per-request`, `per-session`, `ttl:<seconds>` and `static`.
 */
@pattern("^(?:per-call|per-request|per-session|static|ttl:[0-9]+(?:\\.[0-9]+)?)$")
scalar FreshnessValue extends string;

/**
 * The effect form "cached at a freshness, evicted on these events":
 * `<freshness> invalidated-on <event>,<event>`, the events sorted, each once.
 */
@pattern("^(?:per-call|per-request|per-session|static|ttl:[0-9]+(?:\\.[0-9]+)?) invalidated-on [a-z0-9]+(?:[.-][a-z0-9]+)*(?:,[a-z0-9]+(?:[.-][a-z0-9]+)*)*$")
scalar InvalidationValue extends string;

/**
 * How strong a reader's view of the subject is, from weakest to strongest:
 * `eventual`, `bounded:<seconds>` (a smaller bound is stronger),
 * `read-your-writes` and `linearizable`.
 */
@pattern("^(?:eventual|read-your-writes|linearizable|bounded:[0-9]+(?:\\.[0-9]+)?)$")
scalar ConsistencyValue extends string;

/** How many times something happens, from strongest guarantee to weakest. */
union CardinalityValue {
  "exactly-once",
  "at-most-once",
  "at-least-once",
  "any",
}

/** A writer of a subject: a name with no spaces or commas. */
@pattern("^[^\\s,]+$")
scalar Writer extends string;

/** A unit of measure, e.g. `ms`, `bytes`, `requests/s`. */
@pattern("^\\S+$")
scalar Unit extends string;

/**
 * A structural type, the value of a `shape` proposition. Objects list their
 * fields; `opaque` names a type the writer could not see into.
 */
union Shape {
  primitive: PrimitiveShape,
  literal: LiteralShape,
  array: ArrayShape,
  `object`: ObjectShape,
  `union`: UnionShape,
  opaque: OpaqueShape,
}

/** `unknown` admits every value and `never` none. */
model PrimitiveShape {
  type: "unknown" | "never" | "string" | "number" | "boolean" | "null";
}

model LiteralShape {
  type: "literal";
  value: string | float64 | boolean;
}

model ArrayShape {
  type: "array";
  items: Shape;
}

model ObjectShape {
  type: "object";
  fields: ShapeField[];
}

model ShapeField {
  @minLength(1)
  name: string;

  shape: Shape;

  /** Whether the field may be absent. */
  optional: boolean;
}

model UnionShape {
  type: "union";
  of: Shape[];
}

model OpaqueShape {
  type: "opaque";

  @minLength(1)
  name: string;
}

/** Fields every proposition carries. */
alias PropositionFields = {
  subject: SubjectKey;
  scope?: Scope;
  anchors?: Anchor[];

  /** A one-line human gloss. */
  gloss?: string;

  cites?: Citation[];
};

/** Fields every premise carries. */
alias PremiseFields = {
  ...PropositionFields;

  /**
   * The holder's kind of reliance, not a confidence. `must`: the holder breaks
   * if the proposition is false. `should`: it degrades. Comparison never reads it.
   */
  strength?: "must" | "should" = "must";
};

model FreshnessPremise {
  ...PremiseFields;
  predicate: "freshness";
  relation: OrderRelation;
  value: FreshnessValue;
}

model ConsistencyPremise {
  ...PremiseFields;
  predicate: "consistency";
  relation: OrderRelation;
  value: ConsistencyValue;
}

model CardinalityPremise {
  ...PremiseFields;
  predicate: "cardinality";
  relation: OrderRelation;
  value: CardinalityValue;
}

model BoundPremise {
  ...PremiseFields;
  predicate: "bound";
  relation: OrderRelation;
  value: float64;
  unit: Unit;
}

model PresencePremise {
  ...PremiseFields;
  predicate: "presence";
  relation: PointRelation;
  value: boolean;
}

model PurityPremise {
  ...PremiseFields;
  predicate: "purity";
  relation: PointRelation;
  value: boolean;
}

model IdempotentPremise {
  ...PremiseFields;
  predicate: "idempotent";
  relation: PointRelation;
  value: boolean;
}

model AuthorityPremise {
  ...PremiseFields;
  predicate: "authority";
  relation: RangeRelation;

  @uniqueItems
  value: Writer[];
}

model ShapePremise {
  ...PremiseFields;
  predicate: "shape";
  relation: RangeRelation;
  value: Shape;
}

/** The subject is the first event of the pair and the value the second. */
model OrderingPremise {
  ...PremiseFields;
  predicate: "ordering";
  relation: "before" | "after";
  value: SubjectKey;
}

/** Free text, compared only by a model. */
model InvariantPremise {
  ...PremiseFields;
  predicate: "invariant";
  relation: "is";
  value: Text;
}

/** What a model relies on about code it does not own. */
union PremiseProposition {
  freshness: FreshnessPremise,
  consistency: ConsistencyPremise,
  cardinality: CardinalityPremise,
  bound: BoundPremise,
  presence: PresencePremise,
  purity: PurityPremise,
  idempotent: IdempotentPremise,
  authority: AuthorityPremise,
  shape: ShapePremise,
  ordering: OrderingPremise,
  invariant: InvariantPremise,
}

model FreshnessEffect {
  ...PropositionFields;
  predicate: "freshness";
  relation: OrderRelation;
  value: FreshnessValue;
}

/** Only an effect takes the invalidation form: a premise states the freshness it relies on. */
model InvalidationEffect {
  ...PropositionFields;
  predicate: "freshness";
  relation: "is" | "at-most";
  value: InvalidationValue;
}

model ConsistencyEffect {
  ...PropositionFields;
  predicate: "consistency";
  relation: OrderRelation;
  value: ConsistencyValue;
}

model CardinalityEffect {
  ...PropositionFields;
  predicate: "cardinality";
  relation: OrderRelation;
  value: CardinalityValue;
}

model BoundEffect {
  ...PropositionFields;
  predicate: "bound";
  relation: OrderRelation;
  value: float64;
  unit: Unit;
}

model PresenceEffect {
  ...PropositionFields;
  predicate: "presence";
  relation: PointRelation;
  value: boolean;
}

model PurityEffect {
  ...PropositionFields;
  predicate: "purity";
  relation: PointRelation;
  value: boolean;
}

model IdempotentEffect {
  ...PropositionFields;
  predicate: "idempotent";
  relation: PointRelation;
  value: boolean;
}

model AuthorityEffect {
  ...PropositionFields;
  predicate: "authority";
  relation: RangeRelation;

  @uniqueItems
  value: Writer[];
}

model ShapeEffect {
  ...PropositionFields;
  predicate: "shape";
  relation: RangeRelation;
  value: Shape;
}

/** The subject is the first event of the pair and the value the second. */
model OrderingEffect {
  ...PropositionFields;
  predicate: "ordering";
  relation: "before" | "after";
  value: SubjectKey;
}

/** Free text, compared only by a model. */
model InvariantEffect {
  ...PropositionFields;
  predicate: "invariant";
  relation: "is";
  value: Text;
}

/** What a model expects a change to alter. */
union EffectProposition {
  freshness: FreshnessEffect,
  invalidation: InvalidationEffect,
  consistency: ConsistencyEffect,
  cardinality: CardinalityEffect,
  bound: BoundEffect,
  presence: PresenceEffect,
  purity: PurityEffect,
  idempotent: IdempotentEffect,
  authority: AuthorityEffect,
  shape: ShapeEffect,
  ordering: OrderingEffect,
  invariant: InvariantEffect,
}

/** A path or symbol a change edits, creates or deletes. */
model FootprintEntry {
  @minLength(1)
  path: string;

  symbol?: string;
  `op`: "edit" | "create" | "delete";
}

// ─── Messages ───────────────────────────────────────────────────────────────

/** Members every message carries. */
model MessageFields<Kind extends string> {
  /** The wire version. */
  mfp: "0.2";

  kind: Kind;

  /** The profile the message conforms to, by URI. Absent means the core profile. */
  @format("uri")
  profile?: string;

  /** The model's own confidence in this report. An opinion about an opinion: it never carries weight. */
  confidence?: "low" | "medium" | "high";
}

/** What a model will do, and what it relies on, before it writes code. */
model Intent {
  ...MessageFields<"intent">;

  /** What the change will achieve, in one or two sentences. */
  goal: Text;

  /** The paths and symbols it expects to edit, create or delete. */
  footprint?: FootprintEntry[];

  /** What it relies on, about code it does not own. */
  premises: PremiseProposition[];

  /** Effects it expects to cause. A receiver derives effects; these are advisory. */
  declaredEffects?: EffectProposition[];

  cites?: Citation[];
}

/** One more thing the model relies on, after its intent. */
model Premise {
  ...MessageFields<"premise">;
  premise: PremiseProposition;
  cites?: Citation[];
}

model Alternative {
  option: Text;
  reasonRejected: Text;
}

/** A choice the model made, why, and what it rejected. */
model Decision {
  ...MessageFields<"decision">;
  question?: string;
  chosen: Text;
  rationale: Text;
  alternatives: Alternative[];
  reversible: boolean;
  cites: Citations;
}

/** Something the model noticed, and what it rests on. */
model Observation {
  ...MessageFields<"observation">;

  /** What kind of thing was noticed. Open in the core; a profile may close it. */
  category: Token;

  importance: "low" | "medium" | "high";
  summary: Text;
  cites: Citations;
}

/** How the model's work relates to an earlier decision it met as precedent. */
model Stance {
  ...MessageFields<"stance">;

  /** The decision, by the identifier the driver gave it. */
  decision: Ref;

  stance: "followed" | "distinguished" | "overrule-requested";

  /** Why the decision applies, does not apply, or should be overruled. */
  argument: Text;

  cites?: Citation[];
}

model Reason {
  summary: Text;
  cites?: Citation[];
}

/** The outcome the model thinks a piece of work should have. An opinion, never a ruling. */
model Verdict {
  ...MessageFields<"verdict">;

  /**
   * The outcome, as a token. The core profile's vocabulary is `accept`,
   * `revise`, `reject` and `defer`; a profile may replace it.
   */
  outcome: Token;

  @minItems(1)
  reasons: Reason[];

  /** What could still go wrong if the outcome is taken. */
  residualRisk?: string;

  cites?: Citation[];
}

/** Any MFP 0.2 message. */
union Message {
  intent: Intent,
  premise: Premise,
  decision: Decision,
  observation: Observation,
  stance: Stance,
  verdict: Verdict,
}

// ─── Profiles ───────────────────────────────────────────────────────────────

/**
 * A reverse-DNS name a vendor controls, e.g. `org.example.review`. A
 * profile's members are named `<prefix>/<name>`.
 */
@pattern("^[a-z0-9]+(?:-[a-z0-9]+)*(?:\\.[a-z0-9]+(?:-[a-z0-9]+)*)+$")
scalar Prefix extends string;

/** A message member a profile adds, under its own prefix. */
model ProfileMember {
  /** `<kind>`: the message kind the member belongs to. */
  kind: "intent" | "premise" | "decision" | "observation" | "stance" | "verdict";

  /** `<prefix>/<name>`. */
  @minLength(1)
  name: string;

  /** A JSON Schema for the member's value. */
  schema: unknown;

  /** Whether a message of that kind must carry it. */
  required?: boolean = false;
}

/**
 * A profile: a named narrowing of the core for one domain. It may close the
 * open vocabularies, require optional members, and add members under its
 * prefix. It can only narrow: every message valid under a profile is valid
 * under the core wire schema.
 */
model Profile {
  /** The profile's URI. Messages name it in `profile`. */
  @format("uri")
  id: string;

  /** The MFP version the profile narrows. */
  mfp: "0.2";

  title: Text;

  /** The prefix its members are named under. Required when it defines members. */
  prefix?: Prefix;

  /** The open vocabularies it closes, each to a non-empty set of tokens. */
  vocabularies?: {
    @minItems(1) @uniqueItems `verdict.outcome`?: Token[];
    @minItems(1) @uniqueItems `observation.category`?: Token[];
  };

  /** Optional core members it requires, as `<kind>.<member>`, e.g. `intent.footprint`. */
  require?: string[];

  members?: ProfileMember[];
}
