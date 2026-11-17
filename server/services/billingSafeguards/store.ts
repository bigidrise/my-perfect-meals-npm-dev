import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { BillingSafetyError, subjectKey, type BillingSubject } from "./subjects";

export interface CheckoutOperation {
  operation_id: string;
  subject_key: string;
  account_id: string;
  livemode: boolean;
  plan_key: string;
  request_payload: Record<string, any>;
  customer_id: string | null;
  session_id: string | null;
  state: string;
  created_at: Date;
}
export interface OperationInput {
  subject: BillingSubject;
  accountId: string;
  livemode: boolean;
  planKey: string;
  payload: Record<string, any>;
}

/** No application-db import. Callers must explicitly provide their database. */
export class CheckoutOperationStore {
  constructor(readonly pool: Pick<Pool, "query" | "connect">) {}

  async claim(input: OperationInput): Promise<CheckoutOperation> {
    const key = subjectKey(input.subject);
    // Retiring a checkout must not retire its subject's canonical customer.
    const { rows: history } = await this.pool.query(
      `SELECT DISTINCT customer_id FROM billing_checkout_operations
       WHERE account_id=$1 AND livemode=$2 AND subject_key=$3 AND customer_id IS NOT NULL`,
      [input.accountId, input.livemode, key],
    );
    if (history.length > 1) {
      throw new BillingSafetyError("BILLING_CUSTOMER_REVIEW_REQUIRED", "Conflicting historical billing customers require review.");
    }
    const customerId = history[0]?.customer_id ?? input.payload.customer ?? null;
    if (customerId && input.payload.customer && customerId !== input.payload.customer) {
      throw new BillingSafetyError("BILLING_CANONICAL_CUSTOMER_CHANGED", "The canonical billing customer changed; manual review is required.");
    }
    const payload: Record<string, any> = { ...input.payload, ...(customerId ? { customer: customerId } : {}) };
    if (customerId) delete payload.customer_email;
    // The partial UNIQUE index, not a process-local mutex, arbitrates first creation.
    await this.pool.query(
      `INSERT INTO billing_checkout_operations
       (operation_id,subject_key,subject,account_id,livemode,plan_key,request_payload,customer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
      [randomUUID(), key, JSON.stringify(input.subject), input.accountId, input.livemode,
        input.planKey, JSON.stringify(payload), customerId],
    );
    const { rows } = await this.pool.query(
      `SELECT * FROM billing_checkout_operations
       WHERE account_id=$1 AND livemode=$2 AND subject_key=$3 AND retired_at IS NULL`,
      [input.accountId, input.livemode, key],
    );
    const row = rows[0] as CheckoutOperation | undefined;
    if (!row) throw new BillingSafetyError("BILLING_RESERVATION_UNAVAILABLE", "Billing reservation requires review.", 503);
    return row;
  }

  async bindCustomer(op: CheckoutOperation, customerId: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE billing_checkout_operations SET customer_id=$2,updated_at=now()
       WHERE operation_id=$1 AND retired_at IS NULL AND (customer_id IS NULL OR customer_id=$2)
       RETURNING operation_id`, [op.operation_id, customerId],
    );
    if (result.rowCount !== 1) throw new BillingSafetyError("BILLING_IDENTITY_CONFLICT", "Checkout customer changed; do not pay again.");
  }

  async bindSession(op: CheckoutOperation, sessionId: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE billing_checkout_operations SET session_id=$2,state='open',updated_at=now()
       WHERE operation_id=$1 AND retired_at IS NULL AND state IN ('reserved','open')
       AND (session_id IS NULL OR session_id=$2) RETURNING operation_id`,
      [op.operation_id, sessionId],
    );
    if (result.rowCount !== 1) throw new BillingSafetyError("BILLING_SESSION_CONFLICT", "Checkout needs verification; do not pay again.");
  }

  async review(op: CheckoutOperation): Promise<void> {
    await this.pool.query(
      `UPDATE billing_checkout_operations SET state='review_required',updated_at=now()
       WHERE operation_id=$1 AND retired_at IS NULL`, [op.operation_id],
    );
  }

  async retire(op: CheckoutOperation): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE billing_checkout_operations SET state='retired',retired_at=now(),updated_at=now()
       WHERE operation_id=$1 AND session_id=$2 AND retired_at IS NULL RETURNING operation_id`,
      [op.operation_id, op.session_id],
    );
    return result.rowCount === 1;
  }
}
