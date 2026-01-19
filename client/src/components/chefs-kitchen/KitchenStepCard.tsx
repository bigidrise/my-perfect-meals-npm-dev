import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { UtensilsCrossed, Pencil, Check, X } from "lucide-react";

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
  onEdit?: () => void;
  canEdit?: boolean;
  placeholder?: string;
  inputType?: "textarea" | "buttons";
  buttonOptions?: string[];
  equipmentList?: string[];
  onInputFocus?: () => void;
  otherEnabled?: boolean;
  otherPlaceholder?: string;
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
  onEdit,
  canEdit = true,
  placeholder,
  inputType = "textarea",
  buttonOptions = [],
  equipmentList,
  onInputFocus,
  otherEnabled = false,
  otherPlaceholder = "Type your answer...",
}: KitchenStepCardProps) {
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherValue, setOtherValue] = useState("");

  const handleOtherClick = () => {
    onInputFocus?.();
    setShowOtherInput(true);
    setValue("");
  };

  const handleOtherCancel = () => {
    setShowOtherInput(false);
    setOtherValue("");
  };

  const handleOtherConfirm = () => {
    if (otherValue.trim()) {
      setValue(otherValue.trim());
      setShowOtherInput(false);
    }
  };

  const isOtherValue = otherEnabled && value && !buttonOptions.includes(value);

  return (
    <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-white">{stepTitle}</h3>
          </div>
          {isLocked && canEdit && onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 text-xs text-white/60 hover:text-white/90 transition px-2 py-1 rounded-lg hover:bg-white/10"
            >
              <Pencil className="h-3 w-3" />
              Change
            </button>
          )}
        </div>

        {isLocked ? (
          <div className="rounded-xl border border-white/20 bg-black/40 p-3">
            <p className="text-sm text-white/90 font-medium flex items-center gap-2">
              <Check className="h-4 w-4 text-lime-500 flex-shrink-0" />
              {summaryText}
            </p>
          </div>
        ) : (
          <>
            {!hasListened && (
              <button
                className={`w-full py-3 rounded-xl border text-white font-medium transition ${
                  isPlaying
                    ? "bg-green-900/40 border-green-500/40"
                    : "bg-gradient-to-r from-orange-600 to-amber-500 border-orange-400/50 hover:from-orange-500 hover:to-amber-400 animate-pulse"
                }`}
                onClick={onListen}
                disabled={isPlaying}
                data-testid={`button-listen-${stepTitle.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {isPlaying ? "Speaking..." : "👉 Press to Start"}
              </button>
            )}

            {hasListened && (
              <>
                {equipmentList && equipmentList.length > 0 && (
                  <div className="rounded-xl border border-white/20 bg-black/40 p-3 space-y-2">
                    <p className="text-xs text-white/60 font-medium">You'll need:</p>
                    <ul className="space-y-1">
                      {equipmentList.map((item, i) => (
                        <li key={i} className="text-sm text-white/90 flex items-center gap-2">
                          <span className="text-lime-500">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <label className="block text-sm text-white">{question}</label>

                {inputType === "textarea" ? (
                  <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onFocus={onInputFocus}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 bg-black text-white placeholder:text-white/50 border border-white/30 rounded-lg h-20 resize-none text-sm"
                    maxLength={300}
                  />
                ) : showOtherInput ? (
                  <div className="space-y-2">
                    <textarea
                      value={otherValue}
                      onChange={(e) => setOtherValue(e.target.value)}
                      onFocus={onInputFocus}
                      placeholder={otherPlaceholder}
                      className="w-full px-3 py-2 bg-black text-white placeholder:text-white/50 border border-orange-500/50 rounded-lg h-20 resize-none text-sm focus:ring-1 focus:ring-orange-500"
                      maxLength={200}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleOtherCancel}
                        className="flex-1 py-2 rounded-lg border border-white/20 text-white/70 text-sm hover:bg-white/10 transition flex items-center justify-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                      <button
                        onClick={handleOtherConfirm}
                        disabled={!otherValue.trim()}
                        className="flex-1 py-2 rounded-lg bg-orange-600 text-white text-sm hover:bg-orange-500 transition disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <Check className="h-3 w-3" />
                        Use This
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {buttonOptions.map((option) => (
                        <button
                          key={option}
                          onClick={() => {
                            onInputFocus?.();
                            setValue(option);
                          }}
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
                    {otherEnabled && (
                      <button
                        onClick={handleOtherClick}
                        className={`w-full py-2 rounded-lg border text-sm transition ${
                          isOtherValue
                            ? "bg-orange-600 text-white border-orange-600"
                            : "bg-black/40 text-orange-400 border-orange-500/30 hover:bg-orange-950/30"
                        }`}
                      >
                        {isOtherValue ? `Custom: "${value}"` : "Other..."}
                      </button>
                    )}
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
