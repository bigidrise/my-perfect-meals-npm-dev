import { useEffect } from "react";
import { useCopilot } from "@/components/copilot/CopilotContext";

export const useWalkthroughTarget = (id: string) => {
  const { registerTarget, unregisterTarget } = useCopilot();

  useEffect(() => {
    registerTarget(id);

    return () => unregisterTarget(id);
  }, [id, registerTarget, unregisterTarget]);
};
