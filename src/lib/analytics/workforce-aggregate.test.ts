import { describe, expect, it } from "vitest";
import { aggregateWorkforce } from "./workforce-aggregate";

describe("aggregateWorkforce", () => {
  it("returns null figures for no rows", () => {
    expect(aggregateWorkforce([])).toEqual({
      headcount: null,
      hoursWorked: null,
    });
  });

  it("sums hours worked across periods and sites (a flow)", () => {
    const r = aggregateWorkforce([
      { siteId: "a", headcount: null, hoursWorked: 10000 },
      { siteId: "a", headcount: null, hoursWorked: 5000 },
      { siteId: "b", headcount: null, hoursWorked: 2000 },
    ]);
    expect(r.hoursWorked).toBe(17000);
  });

  it("averages head-count within a site, then sums across sites (a stock)", () => {
    // Site a: months of 40 and 60 → mean 50. Site b: single 30. Total 80.
    const r = aggregateWorkforce([
      { siteId: "a", headcount: 40, hoursWorked: null },
      { siteId: "a", headcount: 60, hoursWorked: null },
      { siteId: "b", headcount: 30, hoursWorked: null },
    ]);
    expect(r.headcount).toBe(80);
  });

  it("ignores null head-counts when averaging and rounds the sum", () => {
    const r = aggregateWorkforce([
      { siteId: "a", headcount: 45, hoursWorked: 1000 },
      { siteId: "a", headcount: null, hoursWorked: 1000 },
      { siteId: "b", headcount: 10, hoursWorked: null },
    ]);
    // Site a mean = 45 (the null is skipped), site b = 10 → 55.
    expect(r.headcount).toBe(55);
    expect(r.hoursWorked).toBe(2000);
  });

  it("never fabricates a figure: hours null when no row carries hours", () => {
    const r = aggregateWorkforce([
      { siteId: "a", headcount: 45, hoursWorked: null },
    ]);
    expect(r.hoursWorked).toBeNull();
    expect(r.headcount).toBe(45);
  });
});
