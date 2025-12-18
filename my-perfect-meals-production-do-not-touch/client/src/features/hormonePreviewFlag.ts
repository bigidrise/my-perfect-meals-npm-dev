// Feature flag for Hormone Preview Clinical Recipes
// Controls visibility of doctor review recipe boards

export const HORMONE_PREVIEW_ENABLED = 
  import.meta.env.VITE_FEATURE_HORMONE_PREVIEW === "true";
