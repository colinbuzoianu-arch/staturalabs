import { revalidatePath } from "next/cache";
import { MeNav } from "@/components/me-nav";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import type { RequirementSourceType } from "@/generated/prisma/enums";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import type { InstructionCellStatus } from "@/lib/people/instruction-status";
import {
  confirmSelfInstruction,
  getSelfInstructions,
  getSelfPerson,
} from "@/lib/people/self-service";

const STATUS_TONE: Record<InstructionCellStatus, BadgeTone> = {
  valid: "low",
  "due-soon": "moderate",
  overdue: "high",
  missing: "neutral",
};

// P17 §5: the employee's own-instruction view — required instructions with
// status + the "why", a self-confirm button for document-read instructions,
// and open training invitations.
export default async function MyInstructionsPage() {
  const user = await requireAuthenticatedUser();
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).selfService;
  const person = await getSelfPerson(user);

  const nav = (
    <MeNav
      labels={{
        navOverview: dict.navOverview,
        navInstructions: dict.navInstructions,
        navDocuments: dict.navDocuments,
        navIncidents: dict.navIncidents,
      }}
      hasPerson={person !== null}
    />
  );

  if (!person) {
    return (
      <div className="mx-auto max-w-3xl">
        {nav}
        <EmptyState title={dict.noPersonLinked} />
      </div>
    );
  }

  const { instructions, invitations } = await getSelfInstructions(person);

  async function confirmAction(formData: FormData) {
    "use server";
    const u = await requireAuthenticatedUser();
    const requirementTypeId = formData.get("requirementTypeId");
    if (typeof requirementTypeId === "string" && requirementTypeId.length > 0) {
      await confirmSelfInstruction({ user: u, requirementTypeId });
    }
    revalidatePath("/app/me/instructions");
  }

  const statusLabel = (s: InstructionCellStatus) =>
    s === "valid"
      ? dict.statusValid
      : s === "due-soon"
        ? dict.statusDueSoon
        : s === "overdue"
          ? dict.statusOverdue
          : dict.statusMissing;

  const sourceLabel = (t: RequirementSourceType) =>
    t === "WORKSTATION"
      ? dict.sourceWorkstation
      : t === "ORG_UNIT"
        ? dict.sourceOrgUnit
        : t === "PROCESS"
          ? dict.sourceProcess
          : dict.sourceSubstance;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {nav}
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.instructionsHeading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {dict.instructionsIntro}
        </p>
      </div>

      <Card>
        <CardBody>
          {instructions.length === 0 ? (
            <EmptyState title={dict.instructionsEmpty} />
          ) : (
            <ul className="divide-y divide-border">
              {instructions.map((i) => (
                <li
                  key={i.requirementTypeId}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_TONE[i.status]}>
                        {statusLabel(i.status)}
                      </Badge>
                      <span className="font-medium text-foreground">
                        {i.title}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-foreground-subtle">
                      {dict.reasonLabel}{" "}
                      {[...new Set(i.sourceTypes.map(sourceLabel))].join(", ")}
                      {i.validUntil
                        ? ` · ${dict.validUntilLabel} ${i.validUntil
                            .toISOString()
                            .slice(0, 10)}`
                        : ""}
                    </p>
                  </div>
                  {i.selfConfirmable && (
                    <form action={confirmAction} className="shrink-0">
                      <input
                        type="hidden"
                        name="requirementTypeId"
                        value={i.requirementTypeId}
                      />
                      <button
                        type="submit"
                        className="rounded-[var(--radius-md)] bg-accent px-3 py-1.5 text-sm font-medium text-white"
                      >
                        {dict.confirmReceivedButton}
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={dict.invitationsHeading} />
        <CardBody>
          {invitations.length === 0 ? (
            <EmptyState title={dict.invitationsEmpty} />
          ) : (
            <ul className="divide-y divide-border">
              {invitations.map((inv) => (
                <li key={inv.sessionId} className="py-3 text-sm">
                  <div className="font-medium text-foreground">{inv.title}</div>
                  <div className="text-xs text-foreground-subtle">
                    {dict.invitationDateLabel}:{" "}
                    {inv.date.toISOString().slice(0, 10)}
                    {inv.location
                      ? ` · ${dict.invitationLocationLabel}: ${inv.location}`
                      : ""}{" "}
                    · {dict.invitationTrainerLabel}: {inv.instructor}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
