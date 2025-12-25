import { Router } from "express";
import crypto from "crypto";
// import { presignUpload } from "../lib/s3"; // AWS S3 not configured

export const uploadsRouter = Router();

function getUserId(req: any) { 
  return req.user?.id || req.auth?.userId || req.headers["x-user-id"] || "demo-user"; 
}

// POST /api/uploads/sign
// body: { type: "familyRecipe", contentType: "image/jpeg" }
uploadsRouter.post("/uploads/sign", async (req, res) => {
  try {
    const userId = getUserId(req);

    const { type = "misc", contentType = "image/jpeg" } = req.body || {};

    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const id = crypto.randomBytes(16).toString("hex");
    const key = `${type}/${userId}/${new Date().toISOString().slice(0,10)}/${id}.${ext}`;

    // TODO: Configure either AWS S3 or Replit Object Storage
    // For now, return an error message
    throw new Error("Upload service not configured. Please set up AWS credentials (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) or implement Replit Object Storage.");

    res.json({ url, key, publicUrl, contentType });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message || "failed to presign" });
  }
});