export interface LegalDocument {
  type: string;
  version: number;
}

export const LEGAL_DOCUMENTS = {
  client: [
    { type: "client_coaching_agreement", version: 1 },
    { type: "client_liability_waiver", version: 1 },
    { type: "client_data_consent", version: 1 },
    { type: "nutrition_disclaimer", version: 1 },
  ] as LegalDocument[],

  professional: [
    { type: "coach_professional_agreement", version: 1 },
    { type: "coach_conduct_policy", version: 1 },
    { type: "scope_of_practice", version: 1 },
  ] as LegalDocument[],

  physician: [
    { type: "physician_professional_agreement", version: 1 },
    { type: "physician_conduct_policy", version: 1 },
    { type: "physician_scope_of_practice", version: 1 },
  ] as LegalDocument[],

  patient_physician: [
    { type: "patient_physician_agreement", version: 1 },
    { type: "patient_clinical_data_consent", version: 1 },
    { type: "patient_medical_waiver", version: 1 },
  ] as LegalDocument[],

  attestation: [
    { type: "professional_attestation", version: 1 },
  ] as LegalDocument[],
};

export type LegalFlow = keyof typeof LEGAL_DOCUMENTS;

export function getRequiredDocuments(flow: LegalFlow): LegalDocument[] {
  return LEGAL_DOCUMENTS[flow] || [];
}

export function getCurrentVersion(documentType: string): number | null {
  for (const flow of Object.values(LEGAL_DOCUMENTS)) {
    const doc = flow.find((d) => d.type === documentType);
    if (doc) return doc.version;
  }
  return null;
}
