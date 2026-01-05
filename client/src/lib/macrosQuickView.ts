// macrosQuickView module for temporary macro data preview
// Used by "Add to Macros" buttons to pass meal data to biometrics page

export interface QuickView {
  protein: number;
  carbs: number;
  starchyCarbs?: number;
  fibrousCarbs?: number;
  fat: number;
  calories: number;
  dateISO: string;
  mealSlot: "breakfast" | "lunch" | "dinner" | "snacks" | null;
  expiresAt: number; // timestamp when this data expires
}

interface QuickViewInput {
  protein: number;
  carbs: number;
  starchyCarbs?: number;
  fibrousCarbs?: number;
  fat: number;
  calories: number;
  dateISO: string;
  mealSlot?: "breakfast" | "lunch" | "dinner" | "snacks" | null;
}

export function setQuickView(macros: QuickViewInput): void {
  // Store the macro data in localStorage for quick view
  // Add expiration time (midnight tonight)
  try {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    
    const quickView: QuickView = {
      ...macros,
      mealSlot: macros.mealSlot ?? null,
      expiresAt: midnight.getTime()
    };
    
    localStorage.setItem('macrosQuickView', JSON.stringify(quickView));
    console.log('✅ Quick View set:', quickView);
  } catch (error) {
    console.error('Failed to set quick view macros:', error);
  }
}

export function getQuickView(): QuickView | null {
  try {
    const data = localStorage.getItem('macrosQuickView');
    if (!data) return null;
    
    const parsed = JSON.parse(data) as QuickView;
    
    // Check if expired
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      console.log('⏰ Quick View expired, clearing');
      clearQuickView();
      return null;
    }
    
    console.log('✅ Quick View retrieved:', parsed);
    return parsed;
  } catch (error) {
    console.error('Failed to get quick view macros:', error);
    return null;
  }
}

export function clearQuickView(): void {
  try {
    localStorage.removeItem('macrosQuickView');
    console.log('🧹 Quick View cleared');
  } catch (error) {
    console.error('Failed to clear quick view macros:', error);
  }
}
