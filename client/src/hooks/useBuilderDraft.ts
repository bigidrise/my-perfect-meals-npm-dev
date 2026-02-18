import { useState, useEffect, useCallback, useRef } from 'react';

interface DraftOptions {
  userId?: string | number;
  builderId: string;
  routeContext?: string;
  maxAge?: number;
}

interface DraftMeta {
  savedAt: number;
  userId: string;
  builderId: string;
  routeContext: string;
}

interface UseBuilderDraftResult<T> {
  draft: T | null;
  saveDraft: (data: T) => void;
  clearDraft: () => void;
  hasDraft: boolean;
  draftAge: number | null;
}

const DEFAULT_MAX_AGE = 24 * 60 * 60 * 1000;
const DEBOUNCE_MS = 500;

function getDraftKey(options: DraftOptions): string {
  const userId = options.userId || 'guest';
  const route = options.routeContext || 'default';
  return `mpm_draft_${userId}_${options.builderId}_${route}`;
}

function getMetaKey(options: DraftOptions): string {
  return `${getDraftKey(options)}_meta`;
}

export function useBuilderDraft<T>(options: DraftOptions): UseBuilderDraftResult<T> {
  const { maxAge = DEFAULT_MAX_AGE } = options;
  const [draft, setDraft] = useState<T | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftAge, setDraftAge] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const draftKey = getDraftKey(options);
    const metaKey = getMetaKey(options);

    try {
      const metaJson = localStorage.getItem(metaKey);
      const dataJson = localStorage.getItem(draftKey);

      if (!metaJson || !dataJson) {
        setDraft(null);
        setHasDraft(false);
        setDraftAge(null);
        return;
      }

      const meta: DraftMeta = JSON.parse(metaJson);
      const age = Date.now() - meta.savedAt;

      if (age > maxAge) {
        console.log(`🗑️ [MPM Draft] Draft expired (${Math.round(age / 1000 / 60)} min old), clearing`);
        localStorage.removeItem(draftKey);
        localStorage.removeItem(metaKey);
        setDraft(null);
        setHasDraft(false);
        setDraftAge(null);
        return;
      }

      const data: T = JSON.parse(dataJson);
      console.log(`✅ [MPM Draft] Restored draft from ${Math.round(age / 1000)} seconds ago`);
      setDraft(data);
      setHasDraft(true);
      setDraftAge(age);
    } catch (error) {
      console.error('[MPM Draft] Failed to restore draft:', error);
      setDraft(null);
      setHasDraft(false);
      setDraftAge(null);
    }
  }, [options.userId, options.builderId, options.routeContext, maxAge]);

  const saveDraftImmediate = useCallback((data: T) => {
    const opts = optionsRef.current;
    const draftKey = getDraftKey(opts);
    const metaKey = getMetaKey(opts);

    try {
      const meta: DraftMeta = {
        savedAt: Date.now(),
        userId: String(opts.userId || 'guest'),
        builderId: opts.builderId,
        routeContext: opts.routeContext || 'default',
      };

      localStorage.setItem(draftKey, JSON.stringify(data));
      localStorage.setItem(metaKey, JSON.stringify(meta));
      setDraft(data);
      setHasDraft(true);
      setDraftAge(0);
    } catch (error) {
      console.error('[MPM Draft] Failed to save draft:', error);
    }
  }, []);

  const saveDraft = useCallback((data: T) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      saveDraftImmediate(data);
    }, DEBOUNCE_MS);
  }, [saveDraftImmediate]);

  const clearDraft = useCallback(() => {
    const opts = optionsRef.current;
    const draftKey = getDraftKey(opts);
    const metaKey = getMetaKey(opts);

    try {
      localStorage.removeItem(draftKey);
      localStorage.removeItem(metaKey);
      setDraft(null);
      setHasDraft(false);
      setDraftAge(null);
      console.log('🗑️ [MPM Draft] Draft cleared');
    } catch (error) {
      console.error('[MPM Draft] Failed to clear draft:', error);
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && draft) {
        saveDraftImmediate(draft);
        console.log('💾 [MPM Draft] Saved draft on visibility change (app backgrounded)');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [draft, saveDraftImmediate]);

  return {
    draft,
    saveDraft,
    clearDraft,
    hasDraft,
    draftAge,
  };
}
