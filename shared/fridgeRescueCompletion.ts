/** Additive Development response metadata; no recipe or clinical data is stored. */
export interface FridgeRescueCompletion {
  requestedCount: number;
  returnedCount: number;
  partial: boolean;
  attempts: number;
  maxAttempts: number;
  reasonCodes: string[];
  message: string | null;
}

export function describeFridgeRescueShortfall(
  returnedCount: number,
  requestedCount: number,
  reasonCodes: readonly string[],
  language: string = "en",
): string | null {
  if (returnedCount >= requestedCount) return null;

  if (language.toLowerCase().split("-")[0] === "es") {
    const reasons = new Set(reasonCodes);
    const explanations: string[] = [];

    if (reasons.has("CANDIDATES_REJECTED")) {
      explanations.push("algunas opciones no pudieron verificarse según tus requisitos de ingredientes, alimentación, nutrición o seguridad");
    }
    if (reasons.has("DUPLICATE_CANDIDATES")) {
      explanations.push("algunas opciones repitieron el mismo plato");
    }
    if (reasons.has("GENERATOR_SHORTFALL")) {
      explanations.push("se generaron menos opciones de las solicitadas");
    }
    if (reasons.has("REPLENISHMENT_UNAVAILABLE")) {
      explanations.push("no se pudo completar la generación o verificación de opciones adicionales");
    }
    if (reasons.has("CLIENT_DIET_FILTERED")) {
      explanations.push("las opciones adicionales no coincidían con tu dieta seleccionada");
    }

    const explanation = explanations.length
      ? explanations.join("; ")
      : "no se pudieron verificar más platos distintos con tus requisitos actuales";

    return `Se muestran ${returnedCount} de ${requestedCount} opciones solicitadas: ${explanation}. No se flexibilizó ningún requisito para completar las opciones restantes.`;
  }
  const reasons = new Set(reasonCodes);
  const explanations: string[] = [];
  if (reasons.has("CANDIDATES_REJECTED")) {
    explanations.push("some candidates could not be verified against your ingredient, dietary, nutrition, or safety requirements");
  }
  if (reasons.has("DUPLICATE_CANDIDATES")) explanations.push("some choices repeated the same meal");
  if (reasons.has("GENERATOR_SHORTFALL")) explanations.push("generation returned fewer candidates than requested");
  if (reasons.has("REPLENISHMENT_UNAVAILABLE")) explanations.push("additional generation or verification could not be completed");
  if (reasons.has("CLIENT_DIET_FILTERED")) explanations.push("additional choices did not match your selected diet");
  const explanation = explanations.length
    ? explanations.join("; ")
    : "no more distinct meals could be verified with your current requirements";
  return `Showing ${returnedCount} of ${requestedCount} requested choices: ${explanation}. No requirements were relaxed to fill the remaining choices.`;
}
