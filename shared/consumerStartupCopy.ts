/** Tiny EN/ES first-paint copy shared by the pre-module splash and i18next. */
export const startupEnglish = {
  loading: "Loading your personalized experience…",
  failed: "My Perfect Meals could not finish starting. Reload to try again, or view the public page. Technical details are available in the browser console.",
  reload: "Reload",
  publicPage: "View public page",
  label: "My Perfect Meals startup",
  publicTitle: "AI-Powered Personalized Meal Planning | My Perfect Meals",
} as const;

export const startupSpanish: Record<keyof typeof startupEnglish, string> = {
  loading: "Cargando tu experiencia personalizada…",
  failed: "My Perfect Meals no pudo terminar de iniciarse. Recarga para intentarlo de nuevo o consulta la página pública. Los detalles técnicos están disponibles en la consola del navegador.",
  reload: "Recargar",
  publicPage: "Ver página pública",
  label: "Inicio de My Perfect Meals",
  publicTitle: "Planificación personalizada de comidas con IA | My Perfect Meals",
};

export const startupPhraseTranslations = Object.fromEntries(
  Object.entries(startupEnglish).map(([key, phrase]) => [phrase, startupSpanish[key as keyof typeof startupEnglish]]),
);
