import { db } from '../db';
import { weekBoards } from '@shared/schema';
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
export async function getWeekBoard(userId: string, weekStartISO: string) {
  try {
    const [row] = await db
      .select()
      .from(weekBoards)
      .where(and(
        eq(weekBoards.userId, userId),
        eq(weekBoards.weekStartISO, weekStartISO)
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

export async function upsertWeekBoard(userId: string, weekStartISO: string, board: any) {
  try {
    await db
      .insert(weekBoards)
      .values({
        userId,
        weekStartISO,
        boardJSON: board,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [weekBoards.userId, weekBoards.weekStartISO],
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

export function resolveUserId(req: any): string {
  // CRITICAL SECURITY: Require authenticated user - no fallback to shared identity
  // This prevents cross-account data leakage where multiple users would share 'local-user' data
  const userId = req.user?.id;
  if (!userId) {
    throw new Error('Authentication required: No user ID found in request');
  }
  return userId;
}