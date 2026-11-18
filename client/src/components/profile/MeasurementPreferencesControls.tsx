import { useTranslation } from "react-i18next";
import { PillButton } from "@/components/ui/pill-button";
import { MEASUREMENT_COUNTRIES, resolveMeasurementSystem, type MeasurementPreference } from "@shared/units";

/** Shared controls for the existing account preference; intentionally no store. */
export function MeasurementPreferencesControls({ value, country, onChange, onCountryChange, disabled = false }: {
  value: MeasurementPreference;
  country: string;
  onChange: (value: MeasurementPreference) => void;
  onCountryChange: (country: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("measurementPreferences");
  const resolved = resolveMeasurementSystem(value, country);
  const automatic = value === "auto";
  const systemLabels = { auto: t("auto"), imperial: t("imperial"), metric: t("metric") };
  const countryLabels = {
    US: t("country_US"), CA: t("country_CA"), AU: t("country_AU"),
    UK: t("country_UK"), NZ: t("country_NZ"),
  };
  const selectedCountry = MEASUREMENT_COUNTRIES.includes(country as typeof MEASUREMENT_COUNTRIES[number])
    ? country as typeof MEASUREMENT_COUNTRIES[number] : "US";
  return <fieldset className="min-w-0 space-y-3" disabled={disabled}>
    <legend className="text-white text-sm font-semibold">{t("title")}</legend>
    <div role="group" aria-label={t("country")} className="flex flex-wrap gap-2">
      {MEASUREMENT_COUNTRIES.map(code => <PillButton key={code} type="button"
        aria-pressed={country === code} active={country === code} onClick={() => onCountryChange(code)}>
        {countryLabels[code]}
      </PillButton>)}
    </div>
    <div role="group" aria-label={t("system")} className="flex flex-wrap gap-2">
      {(["auto", "imperial", "metric"] as const).map(mode => <PillButton key={mode} type="button"
        aria-pressed={value === mode} active={value === mode} onClick={() => onChange(mode)}>
        {systemLabels[mode]}
      </PillButton>)}
    </div>
    {automatic && <p className="text-white/70 text-xs" role="status">
      {t("resolved", { system: systemLabels[resolved], country: countryLabels[selectedCountry] })}
    </p>}
    <p className="text-white/50 text-xs">{t("hint")}</p>
  </fieldset>;
}
