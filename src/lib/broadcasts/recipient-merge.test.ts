import { describe, expect, it } from "vitest";
import { mergeRecipients, newRecipientsSince } from "./recipient-merge";
import { expandOrgUnitIds } from "./resolve-recipients";

describe("mergeRecipients", () => {
  it("keeps one row per account", () => {
    const rows = mergeRecipients([
      { platformUserId: "u1", audienceId: "a1" },
      { platformUserId: "u1", audienceId: "a2" },
    ]);
    expect(rows).toHaveLength(1);
    // First audience wins the attribution — the earliest reason they were
    // addressed is the one a sender recognises.
    expect(rows[0].audienceId).toBe("a1");
  });
  it("keeps one row per person", () => {
    const rows = mergeRecipients([
      { personId: "p1", audienceId: "a1" },
      { personId: "p1", audienceId: "a2" },
    ]);
    expect(rows).toHaveLength(1);
  });
  it("merges a person and their account into ONE row, account first", () => {
    const rows = mergeRecipients([
      { platformUserId: "u1", personId: "p1", audienceId: "a1" },
      { personId: "p1", audienceId: "a2" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ platformUserId: "u1", personId: "p1" });
  });
  it("merges a person and their account into ONE row, person first", () => {
    const rows = mergeRecipients([
      { personId: "p1", audienceId: "a1" },
      { platformUserId: "u1", personId: "p1", audienceId: "a2" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ platformUserId: "u1", personId: "p1" });
    expect(rows[0].audienceId).toBe("a1");
  });
  it("enriches an account row with the person seen later", () => {
    const rows = mergeRecipients([
      { platformUserId: "u1", audienceId: "a1" },
      { platformUserId: "u1", personId: "p1", audienceId: "a2" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ platformUserId: "u1", personId: "p1" });
  });
  it("keeps different humans apart", () => {
    const rows = mergeRecipients([
      { platformUserId: "u1", audienceId: "a1" },
      { personId: "p2", audienceId: "a1" },
      { platformUserId: "u3", personId: "p3", audienceId: "a1" },
    ]);
    expect(rows).toHaveLength(3);
  });
  it("drops a member with no identity at all", () => {
    expect(mergeRecipients([{ audienceId: "a1" }])).toHaveLength(0);
  });
});

describe("newRecipientsSince", () => {
  it("adds only the people the snapshot does not hold", () => {
    const added = newRecipientsSince(
      [
        { platformUserId: "u1", personId: null },
        { platformUserId: null, personId: "p2" },
      ],
      [
        { platformUserId: "u1", personId: null, audienceId: "a1" },
        { platformUserId: null, personId: "p2", audienceId: "a1" },
        { platformUserId: null, personId: "p3", audienceId: "a1" },
      ],
    );
    expect(added.map((a) => a.personId)).toEqual(["p3"]);
  });
  it("treats a known person as known even when reached via a new account", () => {
    const added = newRecipientsSince(
      [{ platformUserId: null, personId: "p1" }],
      [{ platformUserId: "u1", personId: "p1", audienceId: "a1" }],
    );
    expect(added).toHaveLength(0);
  });
  it("adds nobody when nothing changed", () => {
    expect(
      newRecipientsSince(
        [{ platformUserId: "u1", personId: null }],
        [{ platformUserId: "u1", personId: null, audienceId: "a1" }],
      ),
    ).toHaveLength(0);
  });
});

describe("expandOrgUnitIds", () => {
  // plant → (montage → team-a), lager
  const tree = [
    { id: "plant", parentId: null },
    { id: "montage", parentId: "plant" },
    { id: "team-a", parentId: "montage" },
    { id: "lager", parentId: "plant" },
  ];
  it("includes sub-units, recursively", () => {
    expect([...expandOrgUnitIds(["montage"], tree)].sort()).toEqual([
      "montage",
      "team-a",
    ]);
  });
  it("a plant audience reaches every descendant", () => {
    expect([...expandOrgUnitIds(["plant"], tree)].sort()).toEqual([
      "lager",
      "montage",
      "plant",
      "team-a",
    ]);
  });
  it("does not reach sideways", () => {
    expect([...expandOrgUnitIds(["lager"], tree)]).toEqual(["lager"]);
  });
  it("a leaf expands to itself", () => {
    expect([...expandOrgUnitIds(["team-a"], tree)]).toEqual(["team-a"]);
  });
  it("tolerates an unknown root without inventing members", () => {
    expect([...expandOrgUnitIds(["ghost"], tree)]).toEqual(["ghost"]);
  });
});
