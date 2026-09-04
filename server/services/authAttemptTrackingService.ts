import { pool } from "../db";
import {
  createAuthAttemptTracker,
  type AuthAttemptQueryClient,
} from "./authAttemptTracker";

/**
 * Application singleton for durable authentication verification throttling.
 * The table is provisioned exclusively through migrations/0014_auth_attempt_throttles.sql.
 */
export const authAttemptTracker = createAuthAttemptTracker(pool as unknown as AuthAttemptQueryClient);