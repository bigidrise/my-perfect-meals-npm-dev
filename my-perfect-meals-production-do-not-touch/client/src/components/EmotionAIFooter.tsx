import { Sparkles } from "lucide-react";

export default function EmotionAIFooter() {
  return (
    <div className="fixed bottom-16 left-0 right-0 z-30 pointer-events-none">
      <div className="max-w-7xl mx-auto px-4 pb-2">
        <div className="flex items-center justify-center gap-2 text-xs font-medium">
          <Sparkles className="h-3 w-3 text-orange-500" />
          <span className="text-gradient-primary">Powered by Emotion AI</span>
          <Sparkles className="h-3 w-3 text-orange-500" />
        </div>
      </div>
    </div>
  );
}
