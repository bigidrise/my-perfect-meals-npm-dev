-- Durable authentication verification throttle state.
-- Apply through the deployment migration process; this artifact is never run
-- from application startup.
CREATE TABLE IF NOT EXISTS "auth_attempt_throttles" (
  "subject" varchar(80) NOT NULL,
  "scope" varchar(64) NOT NULL,
  "failure_count" integer NOT NULL DEFAULT 0,
  "window_started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "locked_until" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL DEFAULT now() + interval '24 hours',
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "auth_attempt_throttles_subject_scope_pk"
    PRIMARY KEY ("subject", "scope")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_attempt_throttles_locked_until_idx"
  ON "auth_attempt_throttles" USING btree ("locked_until");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_attempt_throttles_expires_at_idx"
  ON "auth_attempt_throttles" USING btree ("expires_at");
--> statement-breakpoint
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "auth_token_mfa_verified_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "auth_security_version" integer NOT NULL DEFAULT 0;