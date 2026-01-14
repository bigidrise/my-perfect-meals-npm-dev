import { Card, CardContent } from "@/components/ui/card";
import { UtensilsCrossed } from "lucide-react";

interface KitchenStepCardProps {
  stepTitle: string;
  question: string;
  summaryText: string;
  value: string;
  setValue: (v: string) => void;
  hasListened: boolean;
  isLocked: boolean;
  isPlaying: boolean;
  onListen: () => void;
  onSubmit: () => void;
  placeholder?: string;
  inputType?: "textarea" | "buttons";
  buttonOptions?: string[];
}

export function KitchenStepCard({
  stepTitle,
  question,
  summaryText,
  value,
  setValue,
  hasListened,
  isLocked,
  isPlaying,
  onListen,
  onSubmit,
  placeholder,
  inputType = "textarea",
  buttonOptions = [],
}: KitchenStepCardProps) {
  return (
    <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-white">{stepTitle}</h3>
        </div>

        {isLocked ? (
          <div className="rounded-xl border border-white/20 bg-black/40 p-3">
            <p className="text-sm text-white/90 font-medium">{summaryText}</p>
          </div>
        ) : (
          <>
            {!hasListened && (
              <button
                className={`w-full py-3 rounded-xl border text-white font-medium transition ${
                  isPlaying
                    ? "bg-green-900/40 border-green-500/40"
                    : "bg-black/40 border-white/20 hover:bg-black/50"
                }`}
                onClick={onListen}
                disabled={isPlaying}
                data-testid={`button-listen-${stepTitle.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {isPlaying ? "Speaking..." : "Listen to Chef"}
              </button>
            )}

            {hasListened && (
              <>
                <label className="block text-sm text-white">{question}</label>

                {inputType === "textarea" ? (
                  <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 bg-black text-white placeholder:text-white/50 border border-white/30 rounded-lg h-20 resize-none text-sm"
                    maxLength={300}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {buttonOptions.map((option) => (
                      <button
                        key={option}
                        onClick={() => setValue(option)}
                        className={`py-2 rounded-lg border text-sm transition ${
                          value === option
                            ? "bg-lime-600 text-black border-lime-600"
                            : "bg-black/40 text-white border-white/20 hover:bg-black/50"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  disabled={!value.trim() || isPlaying}
                  className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold text-sm disabled:opacity-50 transition"
                  onClick={onSubmit}
                  data-testid={`button-submit-${stepTitle.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  Continue
                </button>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
