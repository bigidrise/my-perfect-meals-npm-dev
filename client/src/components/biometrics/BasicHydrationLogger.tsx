import { useCallback, useEffect, useMemo, useState } from "react";
import { Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PillButton } from "@/components/ui/pill-button";
import { useToast } from "@/hooks/use-toast";
import { useMeasurementSystem } from "@/hooks/useMeasurementSystem";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";
import { useHydrationChoiceLabels } from "@/i18n/useConsumerChoiceLabels";
import { parseMeasurementNumber } from "@shared/units";
import {
  createWaterLog,
  getWaterLogs,
  type WaterLogRow,
} from "@/lib/waterLogsApi";

const ML_PER_OUNCE = 29.5735;
const BEVERAGES = [
  ["water", "Water"],
  ["sparkling", "Sparkling"],
  ["tea", "Tea"],
  ["coffee", "Coffee"],
  ["milk", "Milk"],
  ["juice", "Juice"],
  ["other", "Other"],
] as const;

type Unit = "oz" | "ml";
type BeverageClass = (typeof BEVERAGES)[number][0];

export function BasicHydrationLogger({ userId }: { userId: string }) {
  return <AccountBasicHydrationLogger key={userId} userId={userId} />;
}

function AccountBasicHydrationLogger({ userId }: { userId: string }) {
  const { t } = useConsumerCopy("measurementPreferences");
  const { beverages } = useHydrationChoiceLabels();
  const beverageLabels = { ...beverages, water: t("Water") } as Record<string, string>;
  const { toast } = useToast();
  const system = useMeasurementSystem();
  const [amount, setAmount] = useState(system === "metric" ? String(8 * ML_PER_OUNCE) : "8");
  const [unit, setUnit] = useState<Unit>(system === "metric" ? "ml" : "oz");
  const changeInputUnit = (nextUnit: Unit) => {
    if (nextUnit === unit) return;
    const numeric = parseMeasurementNumber(amount);
    // Keep invalid/unfinished text bound to its old explicit unit.
    if (amount.trim() && numeric === null) return;
    if (numeric !== null) setAmount(String(nextUnit === "ml" ? numeric * ML_PER_OUNCE : numeric / ML_PER_OUNCE));
    setUnit(nextUnit);
  };
  useEffect(() => {
    changeInputUnit(system === "metric" ? "ml" : "oz");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [system]);
  const [beverageClass, setBeverageClass] = useState<BeverageClass>("water");
  const [items, setItems] = useState<WaterLogRow[]>([]);
  const [localDate, setLocalDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    setError("");
    try {
      const page = await getWaterLogs({ limit: 200 });
      setItems(page.items);
      setLocalDate(page.localDate);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message.replace(/^\d+:\s*/, "") : t("Hydration history is unavailable."));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const todayTotalMl = useMemo(
    () => items
      .filter((item) => item.eventLocalDate === localDate)
      .reduce((total, item) => total + Number(item.amountMl || 0), 0),
    [items, localDate],
  );

  const submit = async () => {
    const numericAmount = parseMeasurementNumber(amount);
    if (numericAmount === null || numericAmount <= 0) {
      toast({
        title: t("Enter a fluid amount"),
        description: t("Use a number greater than zero."),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await createWaterLog({ amount: numericAmount, unit, beverageClass });
      await load();
      toast({
        title: t("Fluid logged"),
        description: t("{{amount}} {{unit}} was added to Basic Hydration Tracking.", { amount: numericAmount, unit }),
      });
    } catch (saveError) {
      toast({
        title: t("Could not log fluid"),
        description: saveError instanceof Error ? saveError.message.replace(/^\d+:\s*/, "") : t("Please try again."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const totalDisplay = system === "metric" ? `${Math.round(todayTotalMl)} mL` : `${Math.round(todayTotalMl / ML_PER_OUNCE)} ${t("fluidOunces")}`;
  const showMilliliters = !loading && system === "imperial";
  return (
    <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4" data-testid="basic-hydration-logger">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-sky-300" />
            <h3 className="font-semibold text-white">{t("Basic Hydration Tracking")}</h3>
          </div>
          <p className="mt-1 text-sm text-white/80">
            {t("Log fluids here on any plan. Pro adds personalized hydration intelligence.")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs uppercase tracking-wide text-white/70">{t("Today")}</p>
          <p className="text-lg font-bold text-white" data-testid="basic-hydration-total">
            {loading ? "—" : totalDisplay}
          </p>
          {showMilliliters && <p className="text-xs text-white/70">{todayTotalMl.toLocaleString()} mL</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" aria-label={t("Fluid type")}>
        {BEVERAGES.map(([value, label]) => (
          <PillButton
            key={value}
            type="button"
            active={beverageClass === value}
            variant="sky"
            onClick={() => setBeverageClass(value)}
            data-testid={`basic-hydration-beverage-${value}`}
          >
            {beverageLabels[value] ?? label}
          </PillButton>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          min="0.1"
          step="0.1"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="min-w-0 flex-1 border-white/20 bg-black/30 text-white"
          aria-label={t("Fluid amount")}
          data-testid="basic-hydration-amount"
        />
        <div className="flex gap-1" aria-label={t("Fluid unit")}>
          {(["oz", "ml"] as const).map((value) => (
            <PillButton
              key={value}
              type="button"
              active={unit === value}
              variant="sky"
              onClick={() => changeInputUnit(value)}
              data-testid={`basic-hydration-unit-${value}`}
            >
              {value === "oz" ? t("fluidOunces") : value}
            </PillButton>
          ))}
        </div>
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="shrink-0 bg-sky-600 text-white active:bg-sky-500"
          data-testid="basic-hydration-submit"
        >
          {saving ? t("Logging…") : t("Log fluid")}
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-amber-200">{error}</p>}
    </div>
  );
}