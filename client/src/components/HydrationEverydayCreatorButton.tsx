import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { createHydrationHandoff } from "@/lib/hydrationApi";

/** Shared direct entry: choosing a barrier is never required to open the Creator. */
export default function HydrationEverydayCreatorButton({
  navigate,
  className = "mt-4 bg-sky-400 text-slate-950 hover:bg-sky-300",
  testId = "everyday-hydration-creator",
}: {
  navigate: (path: string) => void;
  className?: string;
  testId?: string;
}) {
  const { toast } = useToast();
  const inFlight = useRef(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  const open = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setOpening(true);
    setError("");
    try {
      const handoff = await createHydrationHandoff({
        door: "everyday",
        description: "Create a practical Everyday Hydration beverage. Preserve all saved dietary and safety constraints and do not invent a medical fluid target.",
      });
      if (!handoff.token) throw new Error("The Hydration handoff was unavailable.");
      navigate(`/lifestyle/beverage-creator?${new URLSearchParams({ hydrationHandoff: handoff.token })}`);
    } catch (failure) {
      const detail = failure instanceof Error ? failure.message.replace(/^\d+:\s*/, "") : "Please try again.";
      setError(`Could not open the Creator. ${detail}`);
      toast({ title: "Could not open the Creator", description: detail, variant: "destructive" });
    } finally {
      inFlight.current = false;
      setOpening(false);
    }
  };

  return (
    <div>
      <Button onClick={() => void open()} disabled={opening} aria-busy={opening} className={className} data-testid={testId}>
        {opening ? "Opening Creator…" : "Create a Hydration Beverage"}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-rose-200">{error}</p>}
    </div>
  );
}
