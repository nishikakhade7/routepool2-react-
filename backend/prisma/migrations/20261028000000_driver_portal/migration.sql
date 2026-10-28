-- Driver portal: driver accounts, their uploaded documents, and their trips.
CREATE TABLE "drivers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "driver_code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "gender" TEXT,
  "plate_number" TEXT NOT NULL,
  "vehicle_model" TEXT NOT NULL,
  "vehicle_colour" TEXT,
  "seats" INTEGER NOT NULL DEFAULT 3,
  "online" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "drivers_email_key" ON "drivers"("email");
CREATE UNIQUE INDEX "drivers_driver_code_key" ON "drivers"("driver_code");
CREATE UNIQUE INDEX "drivers_plate_number_key" ON "drivers"("plate_number");

CREATE TABLE "driver_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "driver_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "stored_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMPTZ,
  "note" TEXT,
  CONSTRAINT "driver_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "driver_documents_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "driver_documents_driver_id_uploaded_at_idx" ON "driver_documents"("driver_id", "uploaded_at");

CREATE TABLE "driver_trips" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "group_id" UUID NOT NULL,
  "driver_id" UUID NOT NULL,
  "plate_number" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "declined_at" TIMESTAMPTZ,
  "accepted_at" TIMESTAMPTZ,
  "heading_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "driver_trips_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "driver_trips_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "driver_trips_group_id_driver_id_key" ON "driver_trips"("group_id", "driver_id");
