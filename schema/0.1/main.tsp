import "@typespec/json-schema";

using JsonSchema;

/**
 * MFP, the Model Feedback Protocol, version 0.1.
 *
 * MFP records **claims**: what an author intends, relies on, decided,
 * observed, derived or concluded. It does not record raw facts such as
 * pushes, test runs or tool calls; those already live in git and in a
 * platform's operation log. Every record names its author explicitly
 * (agent, platform or human) and cites what it rests on.
 */
@jsonSchema
namespace MFP;

// ─── Shared shapes ──────────────────────────────────────────────────────────

/** Who made the claim. A platform-derived record never reads as something an agent said. */
model Author {
  kind: "agent" | "platform" | "human";

  /** The author's stable identifier within the producing platform. */
  @minLength(1)
  id: string;
}

/** What produced the record on the author's behalf. */
model Actor {
  /** The harness the agent ran in, e.g. a coding assistant or a hosted runner. */
  harness?: string;

  /** The model identifier, pinned to a revision where the provider allows. */
  `model`?: string;
}

/** A code symbol pinned to a commit. */
model Anchor {
  /** Repository-relative path. */
  @minLength(1)
  path: string;

  /** A symbol within the file, e.g. a function or class name. */
  symbol?: string;

  /** The commit the anchor was resolved against. */
  @minLength(4)
  commit: string;
}

/** A pointer to what a claim rests on. */
union Citation {
  message: MessageCitation,
  anchor: AnchorCitation,
  record: RecordCitation,
}

/** A numbered message in a session. Session messages are immutable. */
model MessageCitation {
  kind: "message";
  session: string;

  @minValue(0)
  seq: int32;
}

model AnchorCitation {
  kind: "anchor";
  anchor: Anchor;
}

/** Another MFP record, by id. */
model RecordCitation {
  kind: "record";
  id: string;
}

/**
 * How much weight a piece of evidence carries. Only proof and rulings may
 * block or clear a change; testimony and opinion only route work.
 */
enum EvidenceClass {
  /** Something the platform executed. */
  proof,

  /** A deterministic judgement over derived facts, or a human decision. */
  ruling,

  /** A claim from outside the platform. */
  testimony,

  /** Any model output. */
  opinion,
}

/** Where a piece of evidence came from. A separate axis from its class. */
enum EvidenceSource {
  source,
  `tool-result`,
  `prior-record`,
  external,
  reasoning,
}

model Evidence {
  class: EvidenceClass;
  source?: EvidenceSource;

  /** A reference to the evidence itself: a probe run, a test result, a message. */
  @minLength(1)
  ref: string;

  at: utcDateTime;
  scope?: string;
}

/** The dimension a proposition talks about. Each predicate orders its values on a lattice. */
enum Predicate {
  freshness,
  cardinality,
  ordering,
  consistency,
  shape,
  presence,
  authority,
  purity,
  idempotent,
  bound,

  /** Free-form; compared only by a model, so it never blocks without a probe. */
  invariant,
}

/** How a proposition's value relates to the predicate's lattice. */
enum Relation {
  `is`,
  `at-most`,
  `at-least`,
  not,
  before,
  after,
}

/**
 * A typed statement about a subject. Premises (what a change relies on) and
 * effects (what a change alters) share this shape; two propositions with the
 * same subject and predicate can be compared.
 */
model Proposition {
  /** A named concept in the codebase, e.g. `authz.permission-evaluation`. */
  @minLength(1)
  subject: string;

  predicate: Predicate;
  relation: Relation;

  /** A lattice element (e.g. `per-request`), a number for `bound`, or a boolean for `purity`. */
  value: string | float64 | boolean;

  /** Where the proposition holds, e.g. a route prefix or tenant class. */
  scope?: string;

  anchors?: Anchor[];

  /** A one-line human gloss. */
  gloss?: string;

  /** Whether the holder breaks (`required`) or merely degrades (`preferred`) if it is false. */
  strength?: "required" | "preferred";

  cites?: Citation[];
}

/** A path or symbol a change edits, creates or deletes. */
model FootprintEntry {
  @minLength(1)
  path: string;

  symbol?: string;
  `op`: "edit" | "create" | "delete";
}

model Privacy {
  class: "public" | "internal" | "restricted";
  redactions?: Redaction[];
}

model Redaction {
  /** A JSON Pointer into the record. */
  pointer: string;

  reason: string;
}

// ─── Payloads ───────────────────────────────────────────────────────────────

/** What an agent declares before writing code. Each revision is immutable. */
model Intent {
  @minValue(1)
  revision: int32;

  @minLength(1)
  goal: string;

  footprint?: FootprintEntry[];

  /** What the change relies on, about code it does not own. */
  premises: Proposition[];

  /** Effects the agent expects to cause. Advisory only: effects are derived, never trusted. */
  declaredEffects?: Proposition[];
}

/** A single premise claimed after the intent, e.g. when relying on one more subject. */
model Premise {
  proposition: Proposition;
}

model Alternative {
  @minLength(1)
  option: string;

  @minLength(1)
  reasonRejected: string;
}

model Decision {
  question?: string;

  @minLength(1)
  chosen: string;

  @minLength(1)
  rationale: string;

  alternatives: Alternative[];
  reversible: boolean;
}

model Observation {
  @minLength(1)
  category: string;

  importance: "low" | "medium" | "high";

  @minLength(1)
  summary: string;

  evidence: Evidence[];
}

/** How a change relates to an earlier decision it encountered as precedent. */
model Stance {
  /** The id of the decision record. */
  @minLength(1)
  decision: string;

  stance: "followed" | "distinguished" | "overrule-requested";

  /** Required in practice for `distinguished` and `overrule-requested`. */
  argument?: string;
}

model Cost {
  /** Wall-clock milliseconds. */
  ms?: int64;

  /** Model tokens consumed. */
  tokens?: int64;

  /** Spend in US dollars. */
  usd?: float64;
}

model Verdict {
  outcome: "land" | "bounce" | "park" | "hold" | "supersede";

  @minItems(1)
  reasons: Evidence[];

  residualRisk?: string;
  cost?: Cost;
}

/** The fields every derived effect carries. */
model DerivedEffectBase {
  proposition: Proposition;

  /** Code locations the derivation rests on. */
  @minItems(1)
  anchors: Anchor[];

  /** Whether the change's author had declared this effect. */
  declared: boolean;

  /** A premise or tenet this effect contradicts, by reference. */
  contradicts?: string;
}

/** Found by a deterministic extractor: proof. */
model ExtractedEffect {
  ...DerivedEffectBase;
  method: "extractor";
  evidenceClass: EvidenceClass.proof;
}

/** Answered by a decision model: opinion, always with its probability. */
model DecisionModelEffect {
  ...DerivedEffectBase;
  method: "clef";
  evidenceClass: EvidenceClass.opinion;

  @minValue(0)
  @maxValue(1)
  p: float64;
}

/** Proposed by a code model: opinion. */
model CodeModelEffect {
  ...DerivedEffectBase;
  method: "code-model";
  evidenceClass: EvidenceClass.opinion;

  @minValue(0)
  @maxValue(1)
  p?: float64;
}

union DerivedEffect {
  extracted: ExtractedEffect,
  decisionModel: DecisionModelEffect,
  codeModel: CodeModelEffect,
}

/**
 * What a platform derived from a diff. A derivation interprets a fact, so it
 * is a claim; each effect carries how it was derived and its evidence class.
 */
model Derivation {
  /** The commit the diff was taken at. */
  @minLength(4)
  commit: string;

  @minItems(1)
  effects: DerivedEffect[];
}

// ─── Records ────────────────────────────────────────────────────────────────

/** A citation list that must not be empty: decisions and verdicts cite what they rest on. */
@minItems(1)
model NonEmptyCitations is Citation[];

/** The fields every record carries. */
model Envelope<
  Kind extends string,
  Payload,
  AuthorType extends Author | PlatformAuthor = Author,
  Cites extends Citation[] = Citation[]
> {
  /** The protocol version. */
  mfp: "0.1";

  kind: Kind;

  /** Globally unique, e.g. a ULID. */
  @minLength(1)
  id: string;

  /** The change this claim is about: a Change-Id that survives rebases. */
  change?: string;

  /** The session the claim was made in. */
  session?: string;

  author: AuthorType;
  actor?: Actor;
  at: utcDateTime;

  /** The base commit the claim was made against. */
  base?: string;

  /** Position within the session, when the record came from one. */
  @minValue(0)
  seq?: int32;

  cites: Cites;
  evidenceClass?: EvidenceClass;
  scope?: string;

  /** The id of a record this one replaces. */
  supersedes?: string;

  privacy?: Privacy;

  /** The platform's Ed25519 signature over the RFC 8785 canonical record, added when the change lands. */
  countersig?: string;

  payload: Payload;
}

model IntentRecord is Envelope<"intent", Intent>;
model PremiseRecord is Envelope<"premise", Premise>;
model ObservationRecord is Envelope<"observation", Observation>;
model StanceRecord is Envelope<"stance", Stance>;
model DecisionRecord is Envelope<"decision", Decision, Author, NonEmptyCitations>;
model VerdictRecord is Envelope<"verdict", Verdict, Author, NonEmptyCitations>;

/** Derivations are always platform-authored. */
model DerivationRecord is Envelope<"derivation", Derivation, PlatformAuthor>;

model PlatformAuthor {
  kind: "platform";

  @minLength(1)
  id: string;
}

/** Any MFP 0.1 record. */
union MfpRecord {
  intent: IntentRecord,
  premise: PremiseRecord,
  decision: DecisionRecord,
  observation: ObservationRecord,
  stance: StanceRecord,
  verdict: VerdictRecord,
  derivation: DerivationRecord,
}
