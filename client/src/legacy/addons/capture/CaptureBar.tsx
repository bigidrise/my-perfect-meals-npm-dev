// ADD-ONLY
import React, { useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CapturedItem = {
  name: string;            // displayName
  quantity: number;        // e.g., 3
  unit?: string | null;    // e.g., "cup", "egg"
  brand?: string | null;
  barcode?: string | null;
  foodId?: string | null;  // if resolved
};

export default function CaptureBar({
  onCaptured,
  className,
}: {
  onCaptured: (items: CapturedItem[]) => void;
  className?: string;
}) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  async function handleParse(input: string) {
    // Simple parser for demo - parses comma-separated items with optional quantities
    const cleanInput = input.replace(/^hey\s+chef\s*/i, '').trim();
    const itemStrings = cleanInput.split(',').map(s => s.trim()).filter(Boolean);
    
    const items: CapturedItem[] = itemStrings.map((itemStr) => {
      // Extract quantity and unit if present (e.g., "3 avocados", "1 cup milk")
      const match = itemStr.match(/^(\d+(?:\.\d+)?)\s*(cup|cups|tbsp|tsp|oz|lb|lbs|piece|pieces|slice|slices)?\s*(.+)$/i);
      
      if (match) {
        const [, quantity, unit, name] = match;
        return {
          name: name.trim(),
          quantity: parseFloat(quantity),
          unit: unit?.toLowerCase() || null,
        };
      }
      
      // No quantity specified, default to 1
      return {
        name: itemStr,
        quantity: 1,
        unit: null,
      };
    });
    
    onCaptured(items);
  }

  return (
    <div className={className || "fixed bottom-0 inset-x-0 bg-white/90 border-t p-2 flex gap-2 items-center z-40"}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 border rounded px-3 py-2"
        placeholder='Say or type: "milk, whole-wheat bread, low-fat mozzarella, 3 avocados"'
      />
      <button
        type="button"
        className="border rounded px-3 py-2"
        onClick={() => text.trim() && handleParse(text.trim())}
      >
        Review
      </button>
      <Button
        variant={isRecording ? "destructive" : "outline"}
        size="sm"
        onClick={async () => {
          if (isRecording) {
            setIsRecording(false);
            return;
          }
          
          try {
            // Simple voice recording demo - in a real app you'd use the VoiceRecorder component
            setIsRecording(true);
            setTimeout(() => {
              setIsRecording(false);
              const mockTranscript = "milk, 3 apples, whole wheat bread";
              setText(mockTranscript);
            }, 2000); // Mock 2-second recording
          } catch (error) {
            setIsRecording(false);
            console.error("Voice recording failed:", error);
          }
        }}
      >
        {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
    </div>
  );
}