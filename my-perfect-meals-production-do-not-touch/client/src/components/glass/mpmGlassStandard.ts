/**
 * MPM Glass Design Standard
 * 
 * This file documents the official My Perfect Meals glass design system.
 * All new components MUST follow these patterns for Apple-ready consistency.
 * 
 * PAGE BACKGROUND (Required for all pages):
 * min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav
 */

/** 
 * Glass Levels - Use these exact Tailwind classes for consistency
 */
export const MPM_GLASS = {
  /** Light glass - for buttons, inputs, small interactive elements */
  light: "bg-black/20 backdrop-blur-md border border-white/20",
  
  /** Medium glass - for cards, sections, containers */
  medium: "bg-black/30 backdrop-blur-lg border border-white/10",
  
  /** Heavy glass - for headers, fixed elements, prominent sections */
  heavy: "bg-black/40 backdrop-blur-md border-b border-white/10",
  
  /** Dialog/Modal glass - for overlays and modals */
  dialog: "bg-black/90 backdrop-blur-lg border border-white/20",
  
  /** Overlay backdrop - for modal backgrounds */
  overlay: "bg-black/70 backdrop-blur-sm",
} as const;

/**
 * Page Background - The signature orange/black gradient
 */
export const MPM_PAGE_BG = "min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav";

/**
 * Text Colors - Consistent opacity levels
 */
export const MPM_TEXT = {
  /** Primary text - titles, important content */
  primary: "text-white",
  /** Secondary text - body, descriptions */
  secondary: "text-white/90",
  /** Muted text - labels, captions */
  muted: "text-white/60",
  /** Subtle text - hints, placeholders */
  subtle: "text-white/50",
} as const;

/**
 * Macro Progress Colors - For countdown bars and indicators
 * Based on percentage of daily target consumed
 */
export const MPM_MACRO_COLORS = {
  /** Under 90% consumed - plenty remaining */
  safe: {
    bg: "bg-emerald-500",
    text: "text-emerald-400",
    border: "border-emerald-500/50",
  },
  /** 90-99% consumed - getting close */
  warning: {
    bg: "bg-yellow-500",
    text: "text-yellow-400",
    border: "border-yellow-500/50",
  },
  /** 100%+ consumed - at or over limit */
  over: {
    bg: "bg-pink-500",
    text: "text-pink-400",
    border: "border-pink-500/50",
  },
  /** Danger state (future clinical use) */
  danger: {
    bg: "bg-red-500",
    text: "text-red-400",
    border: "border-red-500/50",
  },
} as const;

/**
 * Per-Macro Color Scheme - Unique colors for each macro type
 */
export const MPM_MACRO_IDENTITY = {
  protein: {
    base: "text-blue-400",
    icon: "text-blue-400",
    bg: "bg-blue-500",
  },
  carbs: {
    base: "text-green-400",
    icon: "text-green-400",
    bg: "bg-green-500",
  },
  fat: {
    base: "text-yellow-400",
    icon: "text-yellow-400",
    bg: "bg-yellow-500",
  },
  calories: {
    base: "text-orange-400",
    icon: "text-orange-400",
    bg: "bg-orange-500",
  },
} as const;

/**
 * Button Styles - Primary CTA styling
 */
export const MPM_BUTTON = {
  /** Primary orange CTA button */
  primary: "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl px-6 py-3 shadow-lg transition-all",
  /** Secondary glass button */
  secondary: "bg-black/20 backdrop-blur-md border border-white/20 text-white hover:bg-black/30 rounded-xl px-6 py-3 transition-all",
  /** Ghost button for subtle actions */
  ghost: "bg-transparent hover:bg-white/10 text-white/80 hover:text-white rounded-xl px-4 py-2 transition-all",
} as const;

/**
 * Card Styles - Standard card treatments
 */
export const MPM_CARD = {
  /** Standard glass card */
  base: "bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl text-white",
  /** Interactive card with hover state */
  interactive: "bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl text-white hover:bg-black/40 hover:border-white/20 transition-all cursor-pointer",
  /** Highlighted/selected card */
  selected: "bg-black/40 backdrop-blur-lg border border-orange-500/50 rounded-2xl shadow-xl text-white",
} as const;

/**
 * Toast Styles - Success/error notifications
 */
export const MPM_TOAST = {
  /** Success toast */
  success: "bg-black/80 backdrop-blur-lg border border-emerald-500/50 rounded-xl text-white",
  /** Error toast */
  error: "bg-black/80 backdrop-blur-lg border border-red-500/50 rounded-xl text-white",
  /** Info toast */
  info: "bg-black/80 backdrop-blur-lg border border-orange-500/50 rounded-xl text-white",
} as const;

/**
 * Sticky Footer Styles - For macro countdown bar
 */
export const MPM_STICKY_FOOTER = {
  /** Container for sticky footer */
  container: "fixed bottom-0 left-0 right-0 z-40",
  /** Glass background for footer */
  glass: "bg-black/30 backdrop-blur-lg border-t border-white/10",
  /** Safe area padding for iOS */
  safeArea: "pb-safe-nav",
  /** Standard content padding - clears shopping aggregate bar */
  content: "px-4 pt-2 pb-12",
} as const;

/**
 * Helper function to get macro progress color based on percentage
 */
export function getMacroProgressColor(consumed: number, target: number): keyof typeof MPM_MACRO_COLORS {
  if (target <= 0) return "safe";
  const percentage = (consumed / target) * 100;
  if (percentage >= 100) return "over";
  if (percentage >= 90) return "warning";
  return "safe";
}

/**
 * Helper function to format remaining macro value
 */
export function formatRemainingMacro(consumed: number, target: number): string {
  const remaining = target - consumed;
  if (remaining < 0) {
    return `+${Math.abs(remaining).toFixed(0)} over`;
  }
  return `${remaining.toFixed(0)} left`;
}
