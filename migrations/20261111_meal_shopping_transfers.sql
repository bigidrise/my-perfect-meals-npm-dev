-- REVIEW ONLY. Do not run against the shared Development/Production database.
-- No startup hook imports or executes this migration.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '20s';
CREATE TABLE IF NOT EXISTS shopping_transfer_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destination text NOT NULL DEFAULT 'adhoc:inbox',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, owner_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS shopping_transfer_active_cycle
  ON shopping_transfer_cycles(owner_id, destination) WHERE active;
CREATE TABLE IF NOT EXISTS shopping_transfer_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL,
  selection_id text NOT NULL,
  snapshot_hash text NOT NULL,
  snapshot jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(cycle_id, owner_id) REFERENCES shopping_transfer_cycles(id, owner_id),
  UNIQUE(cycle_id, selection_id),
  UNIQUE(id, owner_id)
);
CREATE TABLE IF NOT EXISTS shopping_transfer_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receipt_id uuid NOT NULL,
  item_id uuid REFERENCES shopping_list_items(id) ON DELETE SET NULL,
  applied_quantity numeric NOT NULL CHECK(applied_quantity > 0),
  applied_unit text NOT NULL,
  metadata_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  FOREIGN KEY(receipt_id, owner_id) REFERENCES shopping_transfer_receipts(id, owner_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS shopping_transfer_contribution_receipt ON shopping_transfer_contributions(receipt_id);
CREATE INDEX IF NOT EXISTS shopping_transfer_contribution_item ON shopping_transfer_contributions(item_id);
COMMIT;
