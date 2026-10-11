import { describe, expect, it } from "vitest";
import * as reference from "./reference/compare.ts";
import { jsonFiles, readJson } from "./support.ts";

// The lattice vectors, run through the reference comparator. Their expected
// values were derived by hand from the specification, not from the reference.
const regions = jsonFiles("conformance/0.2/lattices").filter(
  ([name]) => name !== "comparison.json" && name !== "order.json",
);
const comparison = readJson("conformance/0.2/lattices/comparison.json");
const order = readJson("conformance/0.2/lattices/order.json");

const leq = (predicate: string, a: string, b: string): reference.Tri =>
  predicate === "freshness"
    ? reference.freshnessLeq(a, b)
    : predicate === "consistency"
      ? reference.consistencyLeq(a, b)
      : reference.cardinalityLeq(a, b);

describe("region vectors", () => {
  for (const [file, { cases }] of regions) {
    const rows: [string, any][] = cases.map((c: any, i: number) => [`${file} #${i}`, c]);
    it.each(rows)("%s", (_, c) => {
      expect(reference.region(c.predicate, c.premise, c.effect)).toBe(c.region);
    });
  }
});

describe("comparison vectors", () => {
  const rows: [string, any][] = comparison.cases.map((c: any) => [c.description, c]);
  it.each(rows)("%s", (_, c) => {
    expect(reference.compare(c.premise, c.effect)).toBe(c.outcome);
  });
});

describe("orders", () => {
  const rows: [string, any][] = order.leq.map((c: any) => [`${c.predicate}: ${c.lower} ≤ ${c.upper}`, c]);
  it.each(rows)("%s", (_, c) => {
    expect(leq(c.predicate, c.lower, c.upper)).toBe(c.leq);
  });

  // The Hasse covers, closed reflexively and transitively, are exactly the order.
  for (const [predicate, covers] of Object.entries<[string, string][]>(order.covers)) {
    const nodes = [...new Set(covers.flat())];
    const value = (node: string) => order.representatives[node] ?? node;
    const holds = (a: string, b: string) => leq(predicate, a, b) === true;
    const below = (a: string, b: string): boolean =>
      a === b || covers.some(([lower, upper]) => lower === a && below(upper, b));
    it(`${predicate}: the covers' closure is the order`, () => {
      const disagreements = nodes.flatMap((a) =>
        nodes.filter((b) => below(a, b) !== (leq(predicate, value(a), value(b)) === true)).map((b) => `${a} ≤ ${b}`),
      );
      expect(disagreements).toEqual([]);
    });
    it(`${predicate}: the order is antisymmetric and transitive`, () => {
      const values = nodes.map(value);
      const violations = values.flatMap((a) =>
        values.flatMap((b) => [
          ...(a !== b && holds(a, b) && holds(b, a) ? [`${a} = ${b}`] : []),
          ...values.filter((c) => holds(a, b) && holds(b, c) && !holds(a, c)).map((c) => `${a} ≤ ${b} ≤ ${c}`),
        ]),
      );
      expect(violations).toEqual([]);
    });
  }
});
