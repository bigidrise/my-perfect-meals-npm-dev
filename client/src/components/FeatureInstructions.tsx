import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface FeatureInstructionsProps {
  steps: string[];
}

export function FeatureInstructions({ steps }: FeatureInstructionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-3">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full bg-white/5 hover:bg-white/10 border border-white/20 text-white justify-between group"
          data-testid="button-feature-instructions"
        >
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            <span className="font-semibold">How to Use This Feature</span>
          </span>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 transition-transform" />
          ) : (
            <ChevronDown className="h-4 w-4 transition-transform" />
          )}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-3">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <ol className="space-y-3 text-white/90">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-sm font-semibold">
                  {index + 1}
                </div>
                <div className="flex-1 pt-0.5">{step}</div>
              </li>
            ))}
          </ol>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
