-- Sicherheitsinformationen slice 2: the notification event vocabulary for
-- broadcasts. Enum-only migration (the standing gotcha: a new enum value
-- cannot be referenced in the same migration that adds it), so the generator
-- and the publish gate can use them from the next one onwards.
--
-- BROADCAST_PUBLISHED fires once per recipient at publish time; the two
-- confirmation events are the slice-3 reminders (before the deadline and when
-- it has passed).

ALTER TYPE "NotificationEventType" ADD VALUE 'BROADCAST_PUBLISHED';
ALTER TYPE "NotificationEventType" ADD VALUE 'BROADCAST_CONFIRMATION_DUE_SOON';
ALTER TYPE "NotificationEventType" ADD VALUE 'BROADCAST_CONFIRMATION_OVERDUE';
