-- Optional gender + pooling preferences (see src/utils/genderRules.js).
ALTER TABLE "users" ADD COLUMN "gender" TEXT;
ALTER TABLE "users" ADD COLUMN "women_only_groups" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "driver_preference" TEXT NOT NULL DEFAULT 'any';

-- A group started by a student who asked for women-only groups.
ALTER TABLE "groups" ADD COLUMN "women_only" BOOLEAN NOT NULL DEFAULT false;

-- A member waived their "female driver" preference for this ride.
ALTER TABLE "group_members" ADD COLUMN "allow_any_driver" BOOLEAN NOT NULL DEFAULT false;
