// server/services/chefSignatureImports/workflow.ts
// Orchestrates the full YouTube → import record pipeline:
//   1. Fetch YouTube metadata (title, description, thumbnail)
//   2. Fetch transcript
//   3. AI-parse into a structured draft
//   4. Create an import record in chef_signature_imports (status: 'needs_review')
//   5. Optionally create a draft chef_signature_item linked to the import
//
// OWNERSHIP GATE:
//   - ownership_confirmed is ALWAYS false at creation time
//   - An admin must explicitly confirm ownership before the item can be published
//   - This is enforced both here and in the PATCH /publish endpoint

import { db } from "../../db";
import { chefSignatureImports } from "../../db/schema/chefSignatureImports";
import { chefSignatureItems } from "../../db/schema/chefSignatureLibrary";
import { creators } from "@shared/schema";
import { eq } from "drizzle-orm";
import { fetchYouTubeMeta } from "./youtubeClient";
import { fetchTranscript } from "./transcriptFetcher";
import { parseTranscriptIntoItemDraft } from "./parser";

export type ImportWorkflowResult = {
  importId: string;
  importStatus: string;
  parsedItemId: string | null;
  title: string;
  confidence: string;
  parserNotes: string;
  thumbnailUrl: string;
  ownershipConfirmed: false;
};

export async function importFromYouTube(
  creatorSlug: string,
  sourceUrl: string,
  requestedBy: string,
): Promise<ImportWorkflowResult> {
  // 1. Resolve creator
  const [creator] = await db
    .select({ id: creators.id })
    .from(creators)
    .where(eq(creators.slug, creatorSlug))
    .limit(1);

  if (!creator) throw new Error(`Creator not found: ${creatorSlug}`);

  // 2. Fetch YouTube metadata
  const meta = await fetchYouTubeMeta(sourceUrl);

  // 3. Fetch transcript (soft-fail — import continues even without one)
  let transcriptText: string | null = null;
  let transcriptError: string | null = null;
  try {
    const t = await fetchTranscript(meta.videoId);
    transcriptText = t.text;
  } catch (err: any) {
    transcriptError = err?.message ?? "Transcript unavailable";
    console.warn(`[importWorkflow] Transcript fetch failed for ${meta.videoId}: ${transcriptError}`);
  }

  // 4. AI-parse transcript into draft (uses title+description if transcript unavailable)
  const draft = await parseTranscriptIntoItemDraft(
    transcriptText ?? `[No transcript] ${meta.description}`,
    meta.title,
    meta.description,
  );

  // 5. Create the import record
  const [importRow] = await db
    .insert(chefSignatureImports)
    .values({
      creatorId: creator.id,
      sourceUrl,
      sourceType: "youtube",
      importStatus: "needs_review",
      ownershipConfirmed: false,
      rawTitle: meta.title,
      rawDescription: meta.description.slice(0, 2000),
      rawThumbnailUrl: meta.thumbnailUrl,
      rawTranscript: transcriptText,
      importRaw: {
        videoId: meta.videoId,
        channelId: meta.channelId,
        channelTitle: meta.channelTitle,
        publishedAt: meta.publishedAt,
        duration: meta.duration,
        tags: meta.tags,
        transcriptError,
        parserConfidence: draft.confidence,
        parserNotes: draft.parserNotes,
      },
      createdBy: requestedBy,
    })
    .returning({ id: chefSignatureImports.id });

  // 6. Create the draft chef_signature_item (linked to import, not published)
  // kind must match the DB enum: "dish" | "sauce" | "beverage" | "snack" | "recipe"
  const VALID_KINDS = ["dish", "sauce", "beverage", "snack", "recipe"] as const;
  type ValidKind = typeof VALID_KINDS[number];
  const safeKind: ValidKind = VALID_KINDS.includes(draft.kind as ValidKind)
    ? (draft.kind as ValidKind)
    : "dish";

  const [itemRow] = await db
    .insert(chefSignatureItems)
    .values({
      creatorId: creator.id,
      title: draft.name,
      description: draft.description,
      kind: safeKind,
      ingredients: draft.ingredients,
      techniques: draft.techniques,
      tags: draft.tags,
      mediaUrl: meta.thumbnailUrl || null,
      isPublished: false,
      isFeatured: false,
    })
    .returning({ id: chefSignatureItems.id });

  // 7. Link the parsed item back to the import record
  await db
    .update(chefSignatureImports)
    .set({ parsedItemId: itemRow.id, updatedAt: new Date() })
    .where(eq(chefSignatureImports.id, importRow.id));

  return {
    importId: importRow.id,
    importStatus: "needs_review",
    parsedItemId: itemRow.id,
    title: draft.name,
    confidence: draft.confidence,
    parserNotes: draft.parserNotes,
    thumbnailUrl: meta.thumbnailUrl,
    ownershipConfirmed: false,
  };
}
