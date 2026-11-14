import { describe, expect, it } from "vitest";
import {
  lookupUnEntry,
  TRANSPORT_DEMO_LIST,
  TRANSPORT_LIST_IS_DEMO,
} from "./transport-classification";

describe("lookupUnEntry", () => {
  it("finds an entry, normalising the UN number", () => {
    expect(lookupUnEntry("1090").value?.properShippingName).toBe("ACETONE");
    expect(lookupUnEntry("un 1090").value?.transportClass).toBe("3");
  });
  it("refuses when the entry is not in the loaded list", () => {
    const r = lookupUnEntry("UN9999");
    expect(r.value).toBeNull();
    expect(r.unavailableReason).toContain("UN9999");
  });
  it("uses a supplied (licensed/curated) list over the fixture", () => {
    const r = lookupUnEntry("UN1230", [
      {
        unNumber: "UN1230",
        properShippingName: "METHANOL",
        transportClass: "3",
        labels: ["3", "6.1"],
        specialProvisions: [],
      },
    ]);
    expect(r.value?.properShippingName).toBe("METHANOL");
  });
  it("ships a small curated DEMO list, marked as demo (not ADR-verified)", () => {
    expect(TRANSPORT_LIST_IS_DEMO).toBe(true);
    expect(TRANSPORT_DEMO_LIST.length).toBeGreaterThan(0);
    expect(TRANSPORT_DEMO_LIST.length).toBeLessThanOrEqual(20);
  });
});
