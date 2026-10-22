-- Las FK van escritas a mano y el esquema de Prisma no las declara: una migración generada propone
-- borrarlas, y ese `DROP CONSTRAINT` hay que quitarlo a mano.

CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "body_time" TIMESTAMPTZ(6),
    "link_label" TEXT NOT NULL,
    "target_kind" TEXT,
    "target_params" JSONB,
    "recipient_user_id" UUID,
    "recipient_role" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notifications_one_recipient" CHECK (num_nonnulls("recipient_user_id", "recipient_role") = 1),
    CONSTRAINT "notifications_event_key_format" CHECK ("event_key" ~ '^[a-z_]+\.[a-z_]+$'),
    CONSTRAINT "notifications_tone_values" CHECK ("tone" IN ('success', 'warning', 'danger')),
    -- `{hora}` en el texto y el instante que representa van siempre juntos.
    CONSTRAINT "notifications_body_time_matches_body"
      CHECK (("body_time" IS NULL) = (position('{hora}' in "body") = 0))
);

CREATE TABLE "notification_reads" (
    "notification_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("notification_id", "user_id")
);

CREATE UNIQUE INDEX "notifications_company_id_dedupe_key_key" ON "notifications"("company_id", "dedupe_key");

CREATE UNIQUE INDEX "notifications_id_company_id_key" ON "notifications"("id", "company_id");

CREATE INDEX "notifications_company_id_recipient_user_id_created_at_id_idx"
  ON "notifications"("company_id", "recipient_user_id", "created_at" DESC, "id" DESC);

CREATE INDEX "notifications_company_id_recipient_role_created_at_id_idx"
  ON "notifications"("company_id", "recipient_role", "created_at" DESC, "id" DESC);

CREATE INDEX "notifications_company_id_created_at_idx" ON "notifications"("company_id", "created_at");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey"
  FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Por nombre: renombrar un rol arrastra sus avisos, y borrar uno con avisos no se puede.
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_role_fkey"
  FOREIGN KEY ("recipient_role") REFERENCES "roles"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_company_id_fkey"
  FOREIGN KEY ("notification_id", "company_id") REFERENCES "notifications"("id", "company_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
ALTER TABLE "notification_reads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_reads" FORCE ROW LEVEL SECURITY;
