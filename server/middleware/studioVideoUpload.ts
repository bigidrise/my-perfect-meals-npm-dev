import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { STUDIO_VIDEO_MAX_UPLOAD_BYTES } from "@shared/studioVideoMessages";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: STUDIO_VIDEO_MAX_UPLOAD_BYTES },
});

export function studioVideoUpload(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  upload.single("video")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: "Video is too large. Maximum size is 64 MiB.",
      });
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
}