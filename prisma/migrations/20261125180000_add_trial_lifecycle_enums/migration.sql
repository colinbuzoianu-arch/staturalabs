-- P18 A.4/A.5: the trial lifecycle event vocabulary. Enum-only migration per
-- the standing gotcha.
--
-- TRIAL_EXPIRING_SOON fires 7 and 2 days before expiry (the two lead times
-- are the dedupe key's business, not the enum's); TRIAL_EXPIRED fires once a
-- trial has been locked. Both go to the trial's administrator with a copy to
-- the founder, through the one P5 notification service.

ALTER TYPE "NotificationEventType" ADD VALUE 'TRIAL_EXPIRING_SOON';
ALTER TYPE "NotificationEventType" ADD VALUE 'TRIAL_EXPIRED';
