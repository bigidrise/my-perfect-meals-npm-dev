import { useConsumerCopy } from "@/i18n/useConsumerCopy";

/** Display names only. Condition keys, activation rules and authored text stay intact. */
export const CLINICAL_SUPPORT_RESOURCE_KEYS: Record<string, string> = {
  "Active Clinical Supports:": "metabolicBuilder.activeClinical",
  "Hormonal & Metabolic:": "metabolicBuilder.hormonalMetabolic",
  "Active Protocol:": "Active Protocol:",
  "Anti-Inflammatory": "metabolicBuilder.clinicalAntiInflam",
  "Anti-Inflammatory (optional)": "Anti-Inflammatory (optional)",
  "Cardiac Health": "metabolicBuilder.clinicalCardiac",
  "Kidney Disease": "metabolicBuilder.clinicalKidney",
  "Liver Support": "metabolicBuilder.clinicalLiverSupport",
  "Liver Disease": "metabolicBuilder.clinicalLiverDisease",
  "Oncology Support": "metabolicBuilder.clinicalOncology",
  "Thyroid Support": "metabolicBuilder.clinicalThyroid",
  "Alpha-gal Syndrome": "Alpha-gal Syndrome",
  "Hashimoto's": "metabolicBuilder.hormonalHashimotos",
  "Hypothyroid": "metabolicBuilder.hormonalHypothyroid",
  "Hyperthyroid": "metabolicBuilder.hormonalHyperthyroid",
  "Menopause": "metabolicBuilder.hormonalMenopause",
  "Perimenopause": "metabolicBuilder.hormonalPerimenopause",
  "Metabolic Recovery": "metabolicBuilder.hormonalMetabolicRecovery",
};

export function ClinicalSupportLabel({ label }: { label: string }) {
  const { t } = useConsumerCopy();
  const key = Object.prototype.hasOwnProperty.call(CLINICAL_SUPPORT_RESOURCE_KEYS, label)
    ? CLINICAL_SUPPORT_RESOURCE_KEYS[label] : null;
  return <>{key ? t(key, { defaultValue: label }) : label}</>;
}
