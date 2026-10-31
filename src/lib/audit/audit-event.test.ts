import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditEvent: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "./audit-event";

describe("recordAuditEvent", () => {
  beforeEach(() => {
    vi.mocked(prisma.auditEvent.create).mockReset();
    vi.mocked(prisma.auditEvent.create).mockResolvedValue({
      id: "a1",
    } as never);
  });

  it("writes an append-only row with nulls defaulted", async () => {
    await recordAuditEvent({
      action: "action.verify",
      entityType: "Action",
      entityId: "act-1",
      actorUserId: "user-1",
      siteId: "site-1",
    });
    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: {
        actorUserId: "user-1",
        action: "action.verify",
        entityType: "Action",
        entityId: "act-1",
        companyId: null,
        siteId: "site-1",
        diff: undefined,
        ipHash: null,
      },
    });
  });

  it("hashes the IP and never stores it in the clear", async () => {
    await recordAuditEvent({
      action: "health_data.read",
      entityType: "IncidentHealthDetail",
      entityId: "h-1",
      ip: "203.0.113.7",
    });
    const call = vi.mocked(prisma.auditEvent.create).mock.calls[0][0];
    const expected = createHash("sha256").update("203.0.113.7").digest("hex");
    expect(call.data.ipHash).toBe(expected);
    expect(JSON.stringify(call.data)).not.toContain("203.0.113.7");
  });
});
