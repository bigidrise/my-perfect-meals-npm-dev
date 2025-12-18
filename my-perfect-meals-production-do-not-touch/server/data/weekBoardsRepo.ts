import { db } from '../db';
import { weekBoards, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Ensure fallback user exists in database (for alpha testing without auth)
async function ensureFallbackUser(): Promise<void> {
  try {
    const fallbackUserId = 'local-user';
    
    // Check if fallback user exists
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.id, fallbackUserId))
      .limit(1);
    
    if (!existing) {
      // Create fallback user if it doesn't exist
      await db
        .insert(users)
        .values({
          id: fallbackUserId,
          username: 'local-user',
          email: 'local@test.com',
          password: 'hashed', // Not used for alpha testing
        })
        .onConflictDoNothing();
      
      console.log('✅ Created fallback user for alpha testing');
    }
  } catch (error) {
    console.error('Error ensuring fallback user:', error);
  }
}

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
    // Ensure fallback user exists before attempting upsert (for alpha testing)
    if (userId === 'local-user') {
      await ensureFallbackUser();
    }
    
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
  // For now, use a fallback user ID for alpha testing
  // Later this can use real auth: req.user?.id
  return req.user?.id ?? 'local-user';
}