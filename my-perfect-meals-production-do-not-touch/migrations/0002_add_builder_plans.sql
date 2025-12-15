
CREATE TABLE builder_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  builder_key text NOT NULL,
  days int NOT NULL,
  plan jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_active_builder_user
  ON builder_plans (user_id, builder_key, is_active)
  WHERE is_active = true;
