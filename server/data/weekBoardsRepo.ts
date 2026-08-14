import { db } from '../db';
import { weekBoards, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// We'll add a local simple normalizer to avoid circular imports
function simpleNormalizeBoard(board: any): any {
  // Simple normalization - just ensure we have the basic structure
  if (!board || typeof board !== 'object') {
    return {
      id: 'empty-board',
      version: 1,
      lists: { breakfast: [], lunch: [], dinner: [], snacks: [] },
      meta: { 
        createdAt: new Date().toISOString(), 
        lastUpdatedAt: new Date().toISOString() 
      }
    };
  }
  return board;
}

// Repository for week board database operations
export async function getWeekBoard(userId: string, weekStartISO: string, builderType: string = '') {
  try {
    const [row] = await db
      .select()
      .from(weekBoards)
      .where(and(
        eq(weekBoards.userId, userId),
        eq(weekBoards.weekStartISO, weekStartISO),
        eq(weekBoards.builderType, builderType)
      ))
      .limit(1);
    
    if (!row) return null;
    
    // Return the normalized board JSON
    return simpleNormalizeBoard(row.boardJSON);
  } catch (error) {
    console.error('Error getting week board:', error);
    return null;
  }
}

export async function upsertWeekBoard(userId: string, weekStartISO: string, board: any, builderType: string = '') {
  try {
    await db
      .insert(weekBoards)
      .values({
        userId,
        weekStartISO,
        builderType,
        boardJSON: board,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [weekBoards.userId, weekBoards.weekStartISO, weekBoards.builderType],
        set: {
          boardJSON: board,
          updatedAt: new Date(),
        },
      });
    
    return board;
  } catch (error) {
    console.error('Error upserting week board:', error);
    throw error;
  }
}

/**
 * Version-conditional board update (CAS pattern).
 *
 * Only updates the board if the stored board's `version` field in JSONB equals
 * `expectedVersion`.  Returns `{ updated: true }` on success, `{ updated: false }`
 * when the version was stale (concurrent edit — caller should return 409).
 *
 * This prevents the classic read-modify-write race: if two preview/confirm flows
 * race each other, only the first one wins; the second gets a 409 and must
 * re-preview against the new board state.
 */
export async function conditionalUpdateWeekBoard(
  userId:          string,
  weekStartISO:    string,
  board:           any,
  expectedVersion: number,
  builderType:     string = "",
): Promise<{ updated: boolean }> {
  try {
    const { sql: sqlTag, and: andCond, eq: eqCond } = await import("drizzle-orm");
    const result = await db
      .update(weekBoards)
      .set({ boardJSON: board, updatedAt: new Date() })
      .where(andCond(
        eqCond(weekBoards.userId,       userId),
        eqCond(weekBoards.weekStartISO, weekStartISO),
        eqCond(weekBoards.builderType,  builderType),
        // JSONB cast: compare the stored board version to the expected value
        sqlTag`(${weekBoards.boardJSON}->>'version')::int = ${expectedVersion}`,
      ))
      .returning({ userId: weekBoards.userId });
    return { updated: result.length > 0 };
  } catch (error) {
    console.error("Error in conditionalUpdateWeekBoard:", error);
    throw error;
  }
}

// Custom error class for auth failures - allows routes to catch and return 401
export class AuthenticationRequiredError extends Error {
  constructor(message: string = 'Authentication required: No user ID found in request') {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

// Apple Review mode user ID - hardcoded for App Store review testing
const APPLE_REVIEW_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function resolveUserId(req: any): Promise<string> {
  const userId = req.authUser?.id || req.user?.id || req.session?.userId;
  if (userId) {
    return userId;
  }

  const token = req.headers['x-auth-token'] as string | undefined;
  if (token) {
    try {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.authToken, token))
        .limit(1);
      if (user) {
        return user.id;
      }
    } catch (error) {
      console.error('[WeekBoard Auth] Token lookup error:', error);
    }
  }
  
  const appleReviewHeader = req.headers['x-apple-review-user'];
  if (appleReviewHeader === APPLE_REVIEW_USER_ID) {
    console.log('[Auth] Apple Review mode active for weekly board');
    return APPLE_REVIEW_USER_ID;
  }
  
  throw new AuthenticationRequiredError();
}