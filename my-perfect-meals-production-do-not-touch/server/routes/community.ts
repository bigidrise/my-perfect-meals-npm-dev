import { Router } from "express";
import { db } from "../db";
import { comments, insertCommentSchema, type Comment } from "@shared/schema";
import { desc, eq, gt } from "drizzle-orm";

const r = Router();

// POST /api/community/posts — minimal stub, no DB yet
r.post("/posts", (req, res) => {
  const { text, imageUrl, tags = [], isAnonymous = false, isSuccessStory = false } = req.body || {};
  if (!text && !imageUrl) {
    return res.status(400).json({ ok: false, error: "text_or_image_required" });
  }
  const post = {
    id: `temp_${Date.now()}`,
    authorDisplay: isAnonymous ? "Anonymous" : "You",
    createdAt: new Date().toISOString(),
    text,
    imageUrl,
    tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
    isSuccessStory: !!isSuccessStory,
  };
  // (Later: insert into DB + mirror to testimonials when isSuccessStory)
  return res.json({ ok: true, post });
});

// GET /api/community/posts/:id/comments — fetch comments for a post
r.get("/posts/:id/comments", async (req, res) => {
  try {
    const { id: postId } = req.params;
    const { cursor, limit = "20" } = req.query;
    
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 20));
    
    let query = db
      .select()
      .from(comments)
      .where(eq(comments.postId, postId))
      .orderBy(desc(comments.createdAt))
      .limit(limitNum + 1); // +1 to check if there are more
    
    if (cursor) {
      query = query.where(gt(comments.createdAt, new Date(cursor as string)));
    }
    
    const results = await query;
    const hasMore = results.length > limitNum;
    const items = hasMore ? results.slice(0, -1) : results;
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : null;
    
    res.json({
      items,
      nextCursor,
      hasMore
    });
  } catch (error) {
    console.error("Failed to fetch comments:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// POST /api/community/posts/:id/comments — add a comment to a post
r.post("/posts/:id/comments", async (req, res) => {
  try {
    const { id: postId } = req.params;
    const { text, isAnonymous = false } = req.body;
    
    if (!text?.trim()) {
      return res.status(400).json({ error: "Comment text is required" });
    }
    
    const commentData = {
      postId,
      userId: isAnonymous ? undefined : "00000000-0000-0000-0000-000000000001", // Default user ID
      authorDisplay: isAnonymous ? "Anonymous" : "You",
      text: text.trim()
    };
    
    const validatedData = insertCommentSchema.parse(commentData);
    const [newComment] = await db.insert(comments).values(validatedData).returning();
    
    res.json(newComment);
  } catch (error) {
    console.error("Failed to create comment:", error);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

export default r;