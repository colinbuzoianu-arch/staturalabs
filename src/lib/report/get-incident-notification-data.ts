import "server-only";

import type {
  BodyRegionCoarse,
  IncidentType,
  InjuryType,
} from "@/generated/prisma/enums";
import { resolveIncidentNotification } from "@/lib/incidents/statutory-notification";
import { prisma } from "@/lib/prisma";

// P10d §D.4 data for the pre-filled authority data sheet. Reads only the COARSE
// injury fields of the health sub-compartment (injuryType / bodyRegion /
// incapacityDays / fatal) — never the encrypted free-text (diagnosis etc.), so
// this needs no health_data.read. Involved persons' names ARE included: the
// statutory notification legally requires the injured person's identity (the
// §3.18 "people compartment for a named statutory duty" case).

export type IncidentNotificationData = {
  company: { name: string };
  site: { name: string; address: string | null; country: string };
  incident: {
    type: IncidentType;
    occurredAt: Date;
    locationText: string | null;
    title: string;
    description: string;
  };
  duty: Awaited<ReturnType<typeof resolveIncidentNotification>>;
  involved: {
    firstName: string;
    lastName: string;
    role: string;
    injuryType: InjuryType | null;
    bodyRegion: BodyRegionCoarse | null;
    incapacityDays: number | null;
    fatal: boolean;
  }[];
  submission: {
    status: string;
    submittedAt: Date | null;
    referenceNumber: string | null;
  } | null;
};

export async function getIncidentNotificationData(
  incidentId: string,
): Promise<IncidentNotificationData | null> {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: {
      company: { select: { name: true } },
      site: { select: { name: true, address: true, country: true } },
      statutoryNotification: true,
      involvedPersons: {
        orderBy: { createdAt: "asc" },
        include: {
          person: { select: { firstName: true, lastName: true } },
          // Coarse health fields only — NOT the *Enc free-text columns.
          healthDetail: {
            select: {
              injuryType: true,
              bodyRegion: true,
              incapacityDays: true,
              fatal: true,
            },
          },
        },
      },
    },
  });
  if (!incident) return null;

  const anyFatal = incident.involvedPersons.some(
    (ip) => ip.healthDetail?.fatal,
  );
  const duty = await resolveIncidentNotification({
    country: incident.site.country,
    type: incident.type,
    occurredAt: incident.occurredAt,
    fatal: anyFatal,
  });

  return {
    company: incident.company,
    site: incident.site,
    incident: {
      type: incident.type,
      occurredAt: incident.occurredAt,
      locationText: incident.locationText,
      title: incident.title,
      description: incident.description,
    },
    duty,
    involved: incident.involvedPersons.map((ip) => ({
      firstName: ip.person.firstName,
      lastName: ip.person.lastName,
      role: ip.role,
      injuryType: ip.healthDetail?.injuryType ?? null,
      bodyRegion: ip.healthDetail?.bodyRegion ?? null,
      incapacityDays: ip.healthDetail?.incapacityDays ?? null,
      fatal: ip.healthDetail?.fatal ?? false,
    })),
    submission: incident.statutoryNotification
      ? {
          status: incident.statutoryNotification.status,
          submittedAt: incident.statutoryNotification.submittedAt,
          referenceNumber: incident.statutoryNotification.referenceNumber,
        }
      : null,
  };
}
