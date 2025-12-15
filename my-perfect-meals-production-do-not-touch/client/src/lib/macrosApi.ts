
// Temporary stub for macrosApi
// This module provides API functions for logging macros

interface MacroEntry {
  date?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  mealType?: string;
}

// Use dynamic base URL so it works on Replit (localhost) and Railway (production)
const API_BASE = typeof window !== "undefined" ? window.location.origin : "";

export async function addBulkMacros(entries: MacroEntry[]): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/macros/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ entries }),
    });

    if (!response.ok) {
      throw new Error(`Failed to add bulk macros: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, ...data };
  } catch (error) {
    console.error('Error adding bulk macros:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function logMacrosToBiometrics(macros: MacroEntry): Promise<{ success: boolean; message?: string }> {
  try {
    console.log('🔵 Attempting to log macros to biometrics:', macros);
    
    const apiUrl = `${API_BASE}/api/biometrics/log`;
    console.log('🔵 API URL:', apiUrl);
    
    const payload = {
      date_iso: macros.date || new Date().toISOString(),
      meal_type: macros.mealType || 'lunch',
      calories_kcal: macros.calories,
      protein_g: macros.protein,
      carbs_g: macros.carbs,
      fat_g: macros.fat,
      source: 'macro-counter',
      title: 'Meal from Macro Counter'
    };
    
    console.log('🔵 Payload:', payload);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important for Railway authentication
      body: JSON.stringify(payload),
    });

    console.log('🔵 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Biometrics log failed:', errorText);
      throw new Error(`Biometrics API failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Biometrics log successful:', data);
    return { success: true, ...data };
  } catch (error) {
    console.error('❌ Error logging macros to biometrics:', error);
    
    // Log the full error details for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to send macros to biometrics. Please try again.',
      timestamp: new Date().toISOString()
    };
  }
}
