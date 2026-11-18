import { useMeasurementSystem } from "@/hooks/useMeasurementSystem";
import { formatQuantity } from "@/lib/formatQuantity";

/** Recipe/list display only; never use its rounded text as an input or payload. */
export function MeasurementQuantity({ amount, unit }: {
  amount: string | number | null | undefined;
  unit?: string | null;
}) {
  const system = useMeasurementSystem();
  return <>{formatQuantity(amount, unit, system)}</>;
}
