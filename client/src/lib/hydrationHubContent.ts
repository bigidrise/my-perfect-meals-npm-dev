export const HYDRATION_HUB_TITLE = "My Perfect Hydration Center";

export const HYDRATION_HUB_DESCRIPTION =
  "Personalized fluid support that works with your Nutrition Life Plan.";

export const HYDRATION_HUB_OVERVIEW =
  "My Perfect Hydration Center helps you manage fluids based on what you are trying to accomplish and the nutrition information My Perfect Meals already knows about you.";

export const HYDRATION_HUB_DOORS = [
  {
    id: "everyday",
    title: "Everyday Hydration",
    description: "Make staying hydrated easier and find practical ways to get your fluids in.",
  },
  {
    id: "athletic",
    title: "Athletic Hydration",
    description: "Organize hydration around training, activity, and recovery.",
  },
  {
    id: "sick-day",
    title: "Sick-Day Hydration",
    description: "Get practical fluid support when you are not feeling well, with safety guidance when symptoms may need professional attention.",
  },
  {
    id: "liquid-nutrition",
    title: "Liquid Nutrition Support",
    description: "Organize temporary liquid or fluid instructions from your physician or care team into an easier-to-follow plan.",
  },
] as const;

export const HYDRATION_HUB_CONSIDERED_FOR_YOU =
  "Considered for you means My Perfect Hydration Center used applicable dietary preferences, allergies, nutrition settings, active MPM programs, and professional guidance that the system was authorized and able to verify. It never means that MPM invented a medical requirement.";

export const HYDRATION_HUB_MEDICAL_BOUNDARY =
  "My Perfect Hydration Center does not diagnose or treat illness, independently prescribe fluid or electrolyte requirements, invent Liquid Nutrition instructions, or replace professional care. Current professional instructions remain the source of truth when they apply.";

export const HYDRATION_HUB_ABOUT_SECTIONS = [
  {
    heading: "What My Perfect Hydration Center is",
    text: `${HYDRATION_HUB_DESCRIPTION} ${HYDRATION_HUB_OVERVIEW}`,
  },
  {
    heading: "Choose the door that fits",
    list: HYDRATION_HUB_DOORS.map(({ title, description }) => `${title} — ${description}`),
  },
  {
    heading: "Personalized, without invented targets",
    text: "My Perfect Hydration Center can consider applicable Nutrition Life Plan information, preferences, allergies, active programs, and professional instructions. It can help you log fluids and choose practical support even when no numeric target exists.",
  },
  {
    heading: "What “Considered for you” means",
    text: HYDRATION_HUB_CONSIDERED_FOR_YOU,
  },
  {
    heading: "Professional plans and care",
    text: "When applicable, an authorized clinical Hydration directive or trainer Athletic Hydration coaching may appear in the relevant experience. Follow your care team’s instructions and contact a professional when symptoms or questions require medical attention.",
  },
  {
    heading: "Safety boundary",
    text: HYDRATION_HUB_MEDICAL_BOUNDARY,
  },
] as const;