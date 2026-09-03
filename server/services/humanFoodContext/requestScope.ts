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

type ContextResolver = (
  input: ResolveHumanFoodContextInput,
) => Promise<HumanFoodContext>;

export interface HumanFoodRequestScope {
  readonly executionState: HumanFoodRequestExecutionState;
  resolve(): Promise<HumanFoodContext>;
}

export function createHumanFoodRequestScope(
  input: ResolveHumanFoodContextInput,
  resolver: ContextResolver = resolveHumanFoodContext,
): HumanFoodRequestScope {
  let resolved: Promise<HumanFoodContext> | null = null;
  const executionState = createHumanFoodRequestExecutionState();

  return {
    executionState,
    resolve() {
      resolved ??= resolver(input);
      return resolved;
    },
  };
}