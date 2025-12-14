import * as React from "react";

type HeightInputProps = {
  /** total height in inches (preferred for storage) */
  valueInches?: number;
  /** called whenever height changes */
  onChange?: (nextInches: number, nextCm: number, feet: number, inchesRemainder: number) => void;
  /** show a quick metric toggle */
  allowMetricToggle?: boolean;
  /** optional label */
  label?: string;
  /** compact mode for tight screens */
  compact?: boolean;
};

const FEET_OPTIONS = [4, 5, 6, 7]; // adjust as you like
const INCHES_OPTIONS = Array.from({ length: 12 }, (_, i) => i); // 0..11

function inchesToFeetIn(inches: number | undefined) {
  const safe = Math.max(0, Math.round(inches ?? 0));
  return { ft: Math.floor(safe / 12), inch: safe % 12 };
}
function feetInToInches(ft: number, inch: number) {
  return ft * 12 + inch;
}
function inchesToCm(inches: number) {
  return Math.round(inches * 2.54);
}
function cmToInches(cm: number) {
  return Math.round(cm / 2.54);
}

export default function HeightInput({
  valueInches,
  onChange,
  allowMetricToggle = true,
  label = "Height",
  compact = false,
}: HeightInputProps) {
  const { ft: initFt, inch: initIn } = inchesToFeetIn(valueInches);
  const [mode, setMode] = React.useState<"imperial" | "metric">("imperial");
  const [feet, setFeet] = React.useState<number>(FEET_OPTIONS.includes(initFt) ? initFt : 5);
  const [inch, setInch] = React.useState<number>(INCHES_OPTIONS.includes(initIn) ? initIn : 8);
  const [cm, setCm] = React.useState<number>(() => inchesToCm(feetInToInches(feet, inch)));

  const emit = React.useCallback(
    (nextFeet: number, nextInch: number) => {
      const total = feetInToInches(nextFeet, nextInch);
      onChange?.(total, inchesToCm(total), nextFeet, nextInch);
    },
    [onChange]
  );

  // Initialize with default 5'8" if no value provided
  React.useEffect(() => {
    if (!valueInches || valueInches === 0) {
      emit(feet, inch); // Emit the default 5'8" (68 inches)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync when prop changes from outside
  React.useEffect(() => {
    if (typeof valueInches === "number" && valueInches > 0) {
      const { ft, inch } = inchesToFeetIn(valueInches);
      setFeet(FEET_OPTIONS.includes(ft) ? ft : ft || 5);
      setInch(INCHES_OPTIONS.includes(inch) ? inch : 0);
      setCm(inchesToCm(valueInches));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueInches]);

  const wrapperCls =
    "rounded-2xl border border-white/15 bg-black/40 text-white p-3 " +
    (compact ? "space-y-2" : "space-y-3");

  return (
    <div className={wrapperCls}>
      <label className="block text-sm font-medium text-white/90 mb-1">{label}</label>

      {/* Mode toggle (optional) */}
      {allowMetricToggle && (
        <div className="flex items-center gap-2 text-xs text-white/70">
          <button
            type="button"
            onClick={() => setMode("imperial")}
            className={`px-2 py-1 rounded-md border ${
              mode === "imperial"
                ? "bg-white/15 border-white/30"
                : "bg-transparent border-white/10 hover:bg-white/5"
            }`}
          >
            ft/in
          </button>
          <button
            type="button"
            onClick={() => setMode("metric")}
            className={`px-2 py-1 rounded-md border ${
              mode === "metric"
                ? "bg-white/15 border-white/30"
                : "bg-transparent border-white/10 hover:bg-white/5"
            }`}
          >
            cm
          </button>
        </div>
      )}

      {mode === "imperial" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="block text-xs text-white/70 mb-1">Feet</span>
            <select
              value={feet}
              onChange={(e) => {
                const nextFeet = Number(e.target.value);
                setFeet(nextFeet);
                emit(nextFeet, inch);
                setCm(inchesToCm(feetInToInches(nextFeet, inch)));
              }}
              className="w-full rounded-lg bg-black/30 border border-white/20 p-2 text-white"
              aria-label="Feet"
            >
              {FEET_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f} ft
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="block text-xs text-white/70 mb-1">Inches</span>
            <select
              value={inch}
              onChange={(e) => {
                const nextIn = Number(e.target.value);
                setInch(nextIn);
                emit(feet, nextIn);
                setCm(inchesToCm(feetInToInches(feet, nextIn)));
              }}
              className="w-full rounded-lg bg-black/30 border border-white/20 p-2 text-white"
              aria-label="Inches"
            >
              {INCHES_OPTIONS.map((i) => (
                <option key={i} value={i}>
                  {i} in
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div>
          <span className="block text-xs text-white/70 mb-1">Centimeters</span>
          <input
            type="number"
            inputMode="numeric"
            min={100}
            max={250}
            step={1}
            value={cm}
            onChange={(e) => {
              const nextCm = Number(e.target.value || 0);
              setCm(nextCm);
              const totalIn = cmToInches(nextCm);
              const { ft, inch } = inchesToFeetIn(totalIn);
              setFeet(ft);
              setInch(inch);
              onChange?.(totalIn, nextCm, ft, inch);
            }}
            className="w-full rounded-lg bg-black/30 border border-white/20 p-2 text-white"
            placeholder="e.g., 178"
            aria-label="Centimeters"
          />
          <div className="text-xs text-white/60 mt-1">
            ≈ {feet} ft {inch} in
          </div>
        </div>
      )}
    </div>
  );
}
