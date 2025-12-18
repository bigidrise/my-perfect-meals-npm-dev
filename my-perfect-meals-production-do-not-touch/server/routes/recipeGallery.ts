import { Router } from "express";
import { recipeGallery, insertRecipeGallerySchema } from "@shared/schema";
import { desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

// Get all recipe gallery items (up to 15, most recent first)
router.get("/", async (req, res) => {
  try {
    const { db } = await import("../db");
    
    const items = await db
      .select()
      .from(recipeGallery)
      .orderBy(desc(recipeGallery.createdAt))
      .limit(15);
    
    res.json({ items });
  } catch (error) {
    console.error("Get recipe gallery error:", error);
    res.status(500).json({ error: "Failed to get recipe gallery" });
  }
});

// Add to recipe gallery (manual endpoint)
router.post("/add", async (req, res) => {
  try {
    const { db } = await import("../db");
    
    await addToRecipeGallery(db, req.body);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Add to recipe gallery error:", error);
    res.status(500).json({ error: "Failed to add to recipe gallery" });
  }
});

// Add to recipe gallery with automatic 15-item cap
export async function addToRecipeGallery(db: any, params: {
  postId: string;
  title: string;
  imageUrl?: string;
  cookingInstructionsUrl?: string;
  tags?: string[];
}) {
  await db.transaction(async (tx: any) => {
    // Insert new recipe
    await tx.insert(recipeGallery).values({
      id: randomUUID(),
      postId: params.postId,
      title: params.title,
      imageUrl: params.imageUrl,
      cookingInstructionsUrl: params.cookingInstructionsUrl,
      tags: params.tags || [],
    });

    // Enforce cap: keep only latest 15
    const rows = await tx.select().from(recipeGallery).orderBy(desc(recipeGallery.createdAt));
    if (rows.length > 15) {
      const toDelete = rows.slice(15).map((r: any) => r.id);
      await tx.delete(recipeGallery).where(sql`${recipeGallery.id} = ANY(${toDelete})`);
    }
  });
}

export default router;