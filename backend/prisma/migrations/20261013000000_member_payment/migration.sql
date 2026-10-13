-- The rider completed the payment step for this ride (resumable "payment pending").
ALTER TABLE "group_members" ADD COLUMN "paid_at" TIMESTAMPTZ;
ALTER TABLE "group_members" ADD COLUMN "payment_method" TEXT;
