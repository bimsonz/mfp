// A reference comparator for MFP 0.2 propositions, written from
// docs/specification/0.2/lattices.md. The conformance suite runs the lattice
// vectors through it; it is not part of the published package.

export type Region = "within" | "disjoint" | "overlap" | "unrelated";
export type Outcome = "holds" | "holds-in-part" | "contradicts" | "undecided" | "unrelated";
export type Tri = boolean | "unknown";

export type Shape =
  | { type: "unknown" | "never" | "string" | "number" | "boolean" | "null" }
  | { type: "literal"; value: string | number | boolean }
  | { type: "array"; items: Shape }
  | { type: "object"; fields: { name: string; shape: Shape; optional: boolean }[] }
  | { type: "union"; of: Shape[] }
  | { type: "opaque"; name: string };

export type Proposition = {
  subject: string;
  predicate: string;
  relation: string;
  value: unknown;
  unit?: string;
  scope?: string;
};

/** A relation and value on one predicate: the claim a proposition makes. */
export type Claim = { relation: string; value: unknown; unit?: string };

// ─── Subjects and scopes ────────────────────────────────────────────────────

export const isAncestorOrSelf = (ancestor: string, key: string): boolean =>
  ancestor === key || key.startsWith(`${ancestor}.`);

export const subjectsRelated = (a: string, b: string): boolean =>
  isAncestorOrSelf(a, b) || isAncestorOrSelf(b, a);

type ScopeMap = Map<string, Set<string>>;

/** Reads a scope; `undefined` when a dimension repeats, which the schema cannot see. */
export const readScope = (scope: string | undefined): ScopeMap | undefined => {
  const map: ScopeMap = new Map();
  if (scope === undefined) return map;
  for (const part of scope.split(";")) {
    const [dimension, atoms] = part.split(":") as [string, string];
    if (map.has(dimension)) return undefined;
    map.set(dimension, new Set(atoms.split("|")));
  }
  return map;
};

export const scopesIntersect = (a: ScopeMap, b: ScopeMap): boolean =>
  [...a].every(([dimension, atoms]) => {
    const other = b.get(dimension);
    return other === undefined || [...atoms].some((atom) => other.has(atom));
  });

export const scopeCovers = (outer: ScopeMap, inner: ScopeMap): boolean =>
  [...outer].every(([dimension, atoms]) => {
    const constrained = inner.get(dimension);
    return constrained !== undefined && [...constrained].every((atom) => atoms.has(atom));
  });

// ─── Intervals ──────────────────────────────────────────────────────────────

type Interval = { lo: number; hi: number };

const interval = (relation: string, at: number, bottom: number, top: number): Interval =>
  relation === "at-most" ? { lo: bottom, hi: at } : relation === "at-least" ? { lo: at, hi: top } : { lo: at, hi: at };

const intervalRegion = (p: Interval, e: Interval): Region =>
  p.lo <= e.lo && e.hi <= p.hi ? "within" : e.hi < p.lo || p.hi < e.lo ? "disjoint" : "overlap";

/** `not` on an order is decided only against a single value. */
const complementRegion = (p: Claim, e: Claim, same: boolean): Region => {
  if (p.relation === "not" && e.relation === "is") return same ? "disjoint" : "within";
  if (p.relation === "is" && e.relation === "not") return same ? "disjoint" : "overlap";
  if (p.relation === "not" && e.relation === "not") return same ? "within" : "overlap";
  return "overlap";
};

const involvesNot = (p: Claim, e: Claim) => p.relation === "not" || e.relation === "not";

// ─── Freshness ──────────────────────────────────────────────────────────────

type Freshness = "per-call" | "per-request" | "per-session" | "static" | { ttl: number };

const readFreshness = (v: string): Freshness =>
  v.startsWith("ttl:") ? { ttl: Number(v.slice(4)) } : (v as Freshness);

const isTtl = (v: Freshness): v is { ttl: number } => typeof v === "object";

const sameFreshness = (a: Freshness, b: Freshness) =>
  isTtl(a) && isTtl(b) ? a.ttl === b.ttl : a === b;

/** The order itself, three-valued: per-session and a TTL are incomparable. */
export const freshnessLeq = (a: string, b: string): Tri => {
  const x = readFreshness(a);
  const y = readFreshness(b);
  if (isTtl(x) && isTtl(y)) return x.ttl <= y.ttl;
  const rank = { "per-call": 0, "per-request": 1, "per-session": 2, static: 3 } as const;
  if (isTtl(x)) return y === "static" ? true : y === "per-session" ? "unknown" : false;
  if (isTtl(y)) return x === "per-call" || x === "per-request" ? true : x === "per-session" ? "unknown" : false;
  return rank[x as keyof typeof rank] <= rank[y as keyof typeof rank];
};

/** A position on the staleness line; per-session's is the unknown `session`. */
const freshnessAt = (v: Freshness, session: number): number =>
  isTtl(v) ? v.ttl : v === "per-call" ? -2 : v === "per-request" ? -1 : v === "per-session" ? session : Infinity;

/**
 * Every placement of per-session that matters against the TTLs in play: below
 * all of them (still above per-request), on each, between each pair, and above
 * all of them.
 */
const sessionPlacements = (ttls: number[]): number[] => {
  const sorted = [...new Set(ttls)].toSorted((a, b) => a - b);
  if (sorted.length === 0) return [0];
  const between = sorted.slice(1).map((n, i) => (sorted[i]! + n) / 2);
  return [-0.5, ...sorted, ...between, sorted.at(-1)! + 1];
};

const plainFreshness = (p: Claim, e: Claim): Region => {
  const pv = readFreshness(p.value as string);
  const ev = readFreshness(e.value as string);
  if (involvesNot(p, e)) {
    const sessionAgainstTtl = (pv === "per-session" && isTtl(ev)) || (isTtl(pv) && ev === "per-session");
    return sessionAgainstTtl ? "overlap" : complementRegion(p, e, sameFreshness(pv, ev));
  }
  const ttls = [pv, ev].filter(isTtl).map((v) => v.ttl);
  const regions = sessionPlacements(ttls).map((session) =>
    intervalRegion(
      interval(p.relation, freshnessAt(pv, session), -2, Infinity),
      interval(e.relation, freshnessAt(ev, session), -2, Infinity),
    ),
  );
  return regions.every((r) => r === regions[0]) ? regions[0]! : "overlap";
};

const INVALIDATION = / invalidated-on /;

/** The events of an invalidation form, or `undefined` when they are unsorted or repeated. */
export const invalidationEvents = (value: string): string[] | undefined => {
  const events = value.split(" invalidated-on ")[1]!.split(",");
  return events.every((k, i) => i === 0 || events[i - 1]! < k) ? events : undefined;
};

const freshnessRegion = (p: Claim, e: Claim): Region => {
  const value = e.value as string;
  if (!INVALIDATION.test(value)) return plainFreshness(p, e);
  const cached = value.split(" invalidated-on ")[0]!;
  // A change that arrives by an evicting event is stale at most meet(cached, per-request).
  const evicted = cached === "per-call" ? "per-call" : "per-request";
  const onEviction = plainFreshness(p, { relation: e.relation, value: evicted });
  const otherwise = plainFreshness(p, { relation: e.relation, value: cached });
  if (onEviction === "disjoint") return "disjoint";
  if (onEviction === "within" && otherwise === "within") return "within";
  return "overlap";
};

// ─── Consistency ────────────────────────────────────────────────────────────

const consistencyAt = (v: string): number =>
  v.startsWith("bounded:") ? -Number(v.slice(8)) : v === "eventual" ? -Infinity : v === "read-your-writes" ? 1 : 2;

export const consistencyLeq = (a: string, b: string): boolean => consistencyAt(a) <= consistencyAt(b);

const consistencyRegion = (p: Claim, e: Claim): Region => {
  const pa = consistencyAt(p.value as string);
  const ea = consistencyAt(e.value as string);
  if (involvesNot(p, e)) return complementRegion(p, e, pa === ea);
  return intervalRegion(interval(p.relation, pa, -Infinity, 2), interval(e.relation, ea, -Infinity, 2));
};

// ─── Bound ──────────────────────────────────────────────────────────────────

const boundRegion = (p: Claim, e: Claim): Region => {
  if (p.unit !== e.unit) return "overlap";
  const pv = p.value as number;
  const ev = e.value as number;
  if (involvesNot(p, e)) return complementRegion(p, e, pv === ev);
  return intervalRegion(interval(p.relation, pv, -Infinity, Infinity), interval(e.relation, ev, -Infinity, Infinity));
};

// ─── Finite orders ──────────────────────────────────────────────────────────

export const CARDINALITIES = ["exactly-once", "at-most-once", "at-least-once", "any"];

export const cardinalityLeq = (a: string, b: string): boolean => a === b || a === "exactly-once" || b === "any";

const finiteRegion = <V>(all: V[], leq: (a: V, b: V) => boolean, p: Claim, e: Claim): Region => {
  const region = (c: Claim) =>
    all.filter((x) =>
      c.relation === "at-most"
        ? leq(x, c.value as V)
        : c.relation === "at-least"
          ? leq(c.value as V, x)
          : c.relation === "not"
            ? x !== c.value
            : x === c.value,
    );
  const pr = region(p);
  const er = region(e);
  return er.every((x) => pr.includes(x)) ? "within" : er.some((x) => pr.includes(x)) ? "overlap" : "disjoint";
};

// ─── Authority ──────────────────────────────────────────────────────────────

type WriterRange = { lo: string[]; hi: string[] | "all" };

const writerRange = (c: Claim): WriterRange => {
  const writers = c.value as string[];
  return c.relation === "at-most"
    ? { lo: [], hi: writers }
    : c.relation === "at-least"
      ? { lo: writers, hi: "all" }
      : { lo: writers, hi: writers };
};

const subset = (xs: string[], ys: string[] | "all") => ys === "all" || xs.every((x) => ys.includes(x));

const authorityRegion = (p: Claim, e: Claim): Region => {
  const pr = writerRange(p);
  const er = writerRange(e);
  if (subset(pr.lo, er.lo) && (pr.hi === "all" || (er.hi !== "all" && subset(er.hi, pr.hi)))) return "within";
  const lo = [...pr.lo, ...er.lo];
  const hi = pr.hi === "all" ? er.hi : er.hi === "all" ? pr.hi : pr.hi.filter((w) => (er.hi as string[]).includes(w));
  return subset(lo, hi) ? "overlap" : "disjoint";
};

// ─── Shape ──────────────────────────────────────────────────────────────────

const all = (xs: Tri[]): Tri => (xs.includes(false) ? false : xs.includes("unknown") ? "unknown" : true);
const any = (xs: Tri[]): Tri => (xs.includes(true) ? true : xs.includes("unknown") ? "unknown" : false);

/** Structural assignability of `s` to `t`, with width subtyping on objects. */
export const assignable = (s: Shape, t: Shape): Tri => {
  if (t.type === "unknown" || s.type === "never") return true;
  if (s.type === "union") return all(s.of.map((m) => assignable(m, t)));
  if (t.type === "union") return any(t.of.map((m) => assignable(s, m)));
  if (s.type === "opaque" || t.type === "opaque")
    return s.type === "opaque" && t.type === "opaque" && s.name === t.name ? true : "unknown";
  switch (s.type) {
    case "literal":
      return t.type === "literal" ? t.value === s.value : t.type === typeof s.value;
    case "array":
      return t.type === "array" ? assignable(s.items, t.items) : false;
    case "object": {
      if (t.type !== "object") return false;
      return all(
        t.fields.map((want) => {
          const have = s.fields.find((f) => f.name === want.name);
          if (have === undefined) return want.optional;
          if (have.optional && !want.optional) return false;
          return assignable(have.shape, want.shape);
        }),
      );
    }
    default:
      return s.type === t.type;
  }
};

const fromTri = (t: Tri): Region => (t === true ? "within" : t === false ? "disjoint" : "overlap");

const shapeRegion = (p: Claim, e: Claim): Region => {
  const ps = p.value as Shape;
  const es = e.value as Shape;
  if (e.relation === "is") {
    if (p.relation === "at-most") return fromTri(assignable(es, ps));
    if (p.relation === "at-least") return fromTri(assignable(ps, es));
    return fromTri(all([assignable(es, ps), assignable(ps, es)]));
  }
  if (e.relation === p.relation) {
    const inside = e.relation === "at-most" ? assignable(es, ps) : assignable(ps, es);
    if (inside === true) return "within";
  }
  return "overlap";
};

/** Whether a shape repeats a field name anywhere, which the schema cannot see. */
export const repeatsField = (s: Shape): boolean => {
  switch (s.type) {
    case "array":
      return repeatsField(s.items);
    case "union":
      return s.of.some(repeatsField);
    case "object":
      return (
        new Set(s.fields.map((f) => f.name)).size !== s.fields.length || s.fields.some((f) => repeatsField(f.shape))
      );
    default:
      return false;
  }
};

// ─── Ordering ───────────────────────────────────────────────────────────────

/** The pair an ordering names, first event first. */
const pair = (p: Proposition): [string, string] =>
  p.relation === "before" ? [p.subject, p.value as string] : [p.value as string, p.subject];

/**
 * Rewrites an ordering proposition so that its subject is the lesser of its two
 * events (by code point), turning `before` into `after` where that swaps them.
 */
export const normaliseOrdering = (p: Proposition): Proposition => {
  if (p.predicate !== "ordering") return p;
  const [first, second] = pair(p);
  return first < second
    ? { ...p, subject: first, relation: "before", value: second }
    : { ...p, subject: second, relation: "after", value: first };
};

const orderingRegion = (p: Proposition, e: Proposition): Region => {
  const [pf, ps] = pair(p);
  const [ef, es] = pair(e);
  return pf === ef && ps === es ? "within" : pf === es && ps === ef ? "disjoint" : "unrelated";
};

// ─── Comparison ─────────────────────────────────────────────────────────────

/** How an effect's claim sits against a premise's, on one predicate. */
export const region = (predicate: string, p: Claim, e: Claim): Region => {
  switch (predicate) {
    case "freshness":
      return freshnessRegion(p, e);
    case "consistency":
      return consistencyRegion(p, e);
    case "bound":
      return boundRegion(p, e);
    case "cardinality":
      return finiteRegion(CARDINALITIES, cardinalityLeq, p, e);
    case "presence":
    case "purity":
    case "idempotent":
      return finiteRegion([true, false], (a, b) => a === b, p, e);
    case "authority":
      return authorityRegion(p, e);
    case "shape":
      return shapeRegion(p, e);
    default:
      return "overlap";
  }
};

/** A proposition the schema accepts but a rule it cannot express refuses. */
const unreadable = (p: Proposition): boolean =>
  readScope(p.scope) === undefined ||
  (p.predicate === "ordering" && p.value === p.subject) ||
  (p.predicate === "freshness" && INVALIDATION.test(p.value as string) && invalidationEvents(p.value as string) === undefined) ||
  (p.predicate === "shape" && repeatsField(p.value as Shape));

/** Compares what a premise relies on with what an effect alters. */
export const compare = (premiseIn: Proposition, effectIn: Proposition): Outcome => {
  const premise = normaliseOrdering(premiseIn);
  const effect = normaliseOrdering(effectIn);
  if (!subjectsRelated(premise.subject, effect.subject)) return "unrelated";
  if (unreadable(premise) || unreadable(effect)) return "undecided";
  const ps = readScope(premise.scope)!;
  const es = readScope(effect.scope)!;
  if (!scopesIntersect(ps, es)) return "unrelated";
  if (premise.predicate === "invariant" || effect.predicate === "invariant") return "undecided";
  if (premise.predicate !== effect.predicate) return "unrelated";
  const r = premise.predicate === "ordering" ? orderingRegion(premise, effect) : region(premise.predicate, premise, effect);
  if (r === "within")
    return isAncestorOrSelf(effect.subject, premise.subject) && scopeCovers(es, ps) ? "holds" : "holds-in-part";
  return r === "disjoint" ? "contradicts" : r === "overlap" ? "undecided" : "unrelated";
};
