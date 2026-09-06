import type {
  HumanFoodContext,
} from "../../../shared/humanFoodContext";
import {
  resolveHumanFoodContext,
  type ResolveHumanFoodContextInput,
} from "./resolveHumanFoodContext";
import {
  createHumanFoodRequestExecutionState,
  type HumanFoodRequestExecutionState,
} from "./requestExecutionState";
import {
  commitAdvisoryOverrideToken,
  rollbackAdvisoryOverrideToken,
} from "../safetyPinService";

type ContextResolver = (
  input: ResolveHumanFoodContextInput,
) => Promise<HumanFoodContext>;

export interface HumanFoodRequestScope {
  readonly executionState: HumanFoodRequestExecutionState;
  resolve(): Promise<HumanFoodContext>;
  /** Consume the claimed acknowledgement after successful action execution. */
  completeAuthorization(): Promise<void>;
  /** Restore the claimed acknowledgement when execution fails before success. */
  releaseAuthorization(): Promise<void>;
}

export function createHumanFoodRequestScope(
  input: ResolveHumanFoodContextInput,
  resolver: ContextResolver = resolveHumanFoodContext,
): HumanFoodRequestScope {
  let resolved: Promise<HumanFoodContext> | null = null;
  let authorizationSettled = false;
  const executionState = createHumanFoodRequestExecutionState();

  return {
    executionState,
    resolve() {
      resolved ??= resolver(input);
      return resolved;
    },
    async completeAuthorization() {
      if (authorizationSettled) return;
      const context = await this.resolve();
      if (context.authorization.status === "authorized" && input.advisoryOverrideToken) {
        commitAdvisoryOverrideToken(input.advisoryOverrideToken);
        authorizationSettled = true;
      }
    },
    async releaseAuthorization() {
      if (authorizationSettled) return;
      const context = await this.resolve();
      if (context.authorization.status === "authorized" && input.advisoryOverrideToken) {
        rollbackAdvisoryOverrideToken(input.advisoryOverrideToken);
        authorizationSettled = true;
      }
    },
  };
}