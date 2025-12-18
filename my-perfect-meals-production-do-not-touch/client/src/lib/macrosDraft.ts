// Temporary stub for macrosDraft
// This module provides functionality for managing draft macro entries

interface MacroDraft {
  id?: string;
  date: string;
  mealType?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  note?: string;
}

const DRAFT_STORAGE_KEY = 'macrosDraft';

export function saveDraft(draft: MacroDraft): void {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch (error) {
    console.error('Failed to save macros draft:', error);
  }
}

export function readDraft(): MacroDraft | null {
  try {
    const data = localStorage.getItem(DRAFT_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get macros draft:', error);
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear macros draft:', error);
  }
}

export function hasDraft(): boolean {
  return readDraft() !== null;
}
