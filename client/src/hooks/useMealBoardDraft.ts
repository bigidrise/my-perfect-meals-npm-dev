import { useCallback, useEffect, useRef } from 'react';
import type { WeekBoard } from '@/lib/boardApi';

interface MealBoardDraftOptions {
  userId?: string | number;
  builderId: string;
  weekStartISO: string;
}

interface DraftMeta {
  savedAt: number;
  userId: string;
  builderId: string;
  weekStartISO: string;
  boardHash: string;
}

const MAX_AGE = 24 * 60 * 60 * 1000;
const DEBOUNCE_MS = 1000;

function getDraftKey(options: MealBoardDraftOptions): string {
  const userId = options.userId || 'guest';
  return `mpm_board_draft_${userId}_${options.builderId}_${options.weekStartISO}`;
}

function getMetaKey(options: MealBoardDraftOptions): string {
  return `${getDraftKey(options)}_meta`;
}

function normalizeMeal(m: any) {
  return {
    id: m.id,
    title: m.title,
    servings: m.servings,
    nutrition: m.nutrition,
    ingredients: (m.ingredients || []).map((i: any) => 
      typeof i === 'string' ? i : (i.item || i.name || JSON.stringify(i))
    ),
    instructions: Array.isArray(m.instructions) 
      ? m.instructions 
      : (m.instructions ? [m.instructions] : []),
  };
}

function computeBoardHash(board: WeekBoard): string {
  try {
    const days = board.days || {};
    const normalized: Record<string, any> = {};
    
    for (const dayKey of Object.keys(days).sort()) {
      const day = days[dayKey];
      if (day) {
        normalized[dayKey] = {
          breakfast: (day.breakfast || []).map(normalizeMeal),
          lunch: (day.lunch || []).map(normalizeMeal),
          dinner: (day.dinner || []).map(normalizeMeal),
          snacks: (day.snacks || []).map(normalizeMeal),
        };
      }
    }
    
    const str = JSON.stringify(normalized);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  } catch {
    return `fallback-${Date.now()}`;
  }
}

export function useMealBoardDraft(
  options: MealBoardDraftOptions,
  board: WeekBoard | null,
  setBoard: (board: any) => void,
  hookLoading: boolean,
  hookBoard: any
) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef(options);
  const initializedRef = useRef(false);
  const draftRestoredRef = useRef(false);
  const dirtyRef = useRef(false);
  const lastSavedHashRef = useRef<string>('');
  const initialBoardHashRef = useRef<string>('');
  optionsRef.current = options;

  const saveDraftImmediate = useCallback((boardToSave: WeekBoard) => {
    const opts = optionsRef.current;
    const draftKey = getDraftKey(opts);
    const metaKey = getMetaKey(opts);
    const hash = computeBoardHash(boardToSave);

    if (hash === lastSavedHashRef.current) {
      return;
    }

    try {
      const meta: DraftMeta = {
        savedAt: Date.now(),
        userId: String(opts.userId || 'guest'),
        builderId: opts.builderId,
        weekStartISO: opts.weekStartISO,
        boardHash: hash,
      };

      localStorage.setItem(draftKey, JSON.stringify(boardToSave));
      localStorage.setItem(metaKey, JSON.stringify(meta));
      lastSavedHashRef.current = hash;
      console.log(`💾 [MPM Board Draft] Saved draft (${hash})`);
    } catch (error) {
      console.error('[MPM Board Draft] Failed to save draft:', error);
    }
  }, []);

  const saveDraft = useCallback((boardToSave: WeekBoard) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      saveDraftImmediate(boardToSave);
    }, DEBOUNCE_MS);
  }, [saveDraftImmediate]);

  const clearDraft = useCallback(() => {
    const opts = optionsRef.current;
    const draftKey = getDraftKey(opts);
    const metaKey = getMetaKey(opts);

    try {
      localStorage.removeItem(draftKey);
      localStorage.removeItem(metaKey);
      lastSavedHashRef.current = '';
      console.log('🗑️ [MPM Board Draft] Draft cleared');
    } catch (error) {
      console.error('[MPM Board Draft] Failed to clear draft:', error);
    }
  }, []);

  useEffect(() => {
    if (hookLoading || initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    const draftKey = getDraftKey(options);
    const metaKey = getMetaKey(options);

    try {
      const metaJson = localStorage.getItem(metaKey);
      const dataJson = localStorage.getItem(draftKey);

      if (!metaJson || !dataJson) {
        console.log('📋 [MPM Board Draft] No draft found, using server data');
        return;
      }

      const meta: DraftMeta = JSON.parse(metaJson);
      const age = Date.now() - meta.savedAt;

      if (age > MAX_AGE) {
        console.log(`🗑️ [MPM Board Draft] Draft expired (${Math.round(age / 1000 / 60)} min old), clearing`);
        localStorage.removeItem(draftKey);
        localStorage.removeItem(metaKey);
        return;
      }

      const savedBoard: WeekBoard = JSON.parse(dataJson);
      const savedHash = computeBoardHash(savedBoard);
      const serverHash = hookBoard ? computeBoardHash(hookBoard) : '';

      if (savedHash !== serverHash) {
        console.log(`✅ [MPM Board Draft] Restored draft from ${Math.round(age / 1000)} seconds ago`);
        console.log(`   Draft hash: ${savedHash}, Server hash: ${serverHash}`);
        setBoard(savedBoard);
        lastSavedHashRef.current = savedHash;
        initialBoardHashRef.current = savedHash;
        draftRestoredRef.current = true;
      } else {
        console.log('📋 [MPM Board Draft] Draft matches server, no restore needed');
        if (hookBoard) {
          initialBoardHashRef.current = serverHash;
        }
      }
    } catch (error) {
      console.error('[MPM Board Draft] Failed to restore draft:', error);
    }
  }, [hookLoading, hookBoard, options.userId, options.builderId, options.weekStartISO, setBoard]);

  useEffect(() => {
    if (board && initializedRef.current) {
      const currentHash = computeBoardHash(board);
      
      if (!initialBoardHashRef.current) {
        initialBoardHashRef.current = currentHash;
      } else if (currentHash !== initialBoardHashRef.current && !dirtyRef.current) {
        console.log('✏️ [MPM Board Draft] Board modified - marking as dirty');
        dirtyRef.current = true;
      }
      
      saveDraft(board);
    }
  }, [board, saveDraft]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && board) {
        saveDraftImmediate(board);
        console.log('💾 [MPM Board Draft] Saved draft on visibility change (app backgrounded)');
      }
    };

    const handleBeforeUnload = () => {
      if (board) {
        saveDraftImmediate(board);
        console.log('💾 [MPM Board Draft] Saved draft before unload');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [board, saveDraftImmediate]);

  return { 
    saveDraft, 
    clearDraft,
    isDraftActive: () => draftRestoredRef.current,
    skipServerSync: () => {
      if (!initializedRef.current) return false;
      if (draftRestoredRef.current) return true;
      if (dirtyRef.current) return true;
      return false;
    },
    markClean: () => {
      dirtyRef.current = false;
      if (board) {
        initialBoardHashRef.current = computeBoardHash(board);
      }
    },
  };
}
