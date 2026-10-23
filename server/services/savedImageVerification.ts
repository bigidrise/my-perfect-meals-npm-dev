import sharp from "sharp";
import { ObjectStorageService } from "../objectStorage";
import {
  decideImageDeliveryRecovery,
  publicObjectPathFromUrl,
  publicObjectUrlForKey,
  type DeliveryProbe,
} from "./imageDeliveryRecovery";

type SavedImageVariants = {
  thumbnailUrl: string | null;
  displayUrl: string | null;
  originalObjectKey?: string | null;
};

/** Bounded, read-only existence probe. Errors are never evidence of absence. */
export async function probeSavedImage(url: string): Promise<DeliveryProbe> {
  const path = publicObjectPathFromUrl(url);
  if (!path) return "unavailable";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      new ObjectStorageService().resolvePublicObjectPath(path)
        .then(object => object ? "available" as const : "missing" as const),
      new Promise<"unavailable">(resolve => {
        timer = setTimeout(() => resolve("unavailable"), 5_000);
        timer.unref?.();
      }),
    ]);
  } catch {
    return "unavailable";
  } finally {
    clearTimeout(timer);
  }
}

/** Suggest a display-only variant; never update lifecycle or meal records. */
export async function checkSavedImageDelivery(failedUrl: string, asset: SavedImageVariants) {
  const failedProbe = await probeSavedImage(failedUrl);
  let alternate: { url: string; probe: DeliveryProbe } | null = null;
  if (failedProbe === "missing") {
    const candidates = [...new Set([
      asset.thumbnailUrl, asset.displayUrl,
      publicObjectUrlForKey(failedUrl, asset.originalObjectKey),
    ])].filter((url): url is string => Boolean(url && url !== failedUrl));
    for (const url of candidates) {
      alternate = { url, probe: await probeSavedImage(url) };
      if (alternate.probe !== "missing") break;
    }
  }
  return decideImageDeliveryRecovery({ failedUrl, failedProbe, alternate });
}

/** Independent byte validation, not a generator claim or URL-prefix check. */
export async function verifyRecoveryPhotograph(url: string): Promise<boolean> {
  const path = publicObjectPathFromUrl(url);
  if (!path) return false; // Controlled repair supports verifiable stored bytes only.
  const storage = new ObjectStorageService();
  // probeSavedImage bounds the initial lookup and fails closed on access errors.
  if (await probeSavedImage(url) !== "available") return false;
  let stream: ReturnType<ObjectStorageService["streamResolvedObject"]> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const resolved = await Promise.race([
      storage.resolvePublicObjectPath(path),
      new Promise<null>(resolve => {
        timer = setTimeout(() => resolve(null), 5_000);
        timer.unref?.();
      }),
    ]);
    clearTimeout(timer);
    if (!resolved) return false;
    stream = storage.streamResolvedObject(resolved.bucketId, resolved.objectName);
    timer = setTimeout(() => stream?.destroy(new Error("Image verification timed out")), 5_000);
    timer.unref?.();
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of stream) {
      const buffer = Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > 20 * 1024 * 1024) return false;
      chunks.push(buffer);
    }
    // Decode pixels as well as the header: truncated files and SVG illustrations
    // must not qualify as a verified photograph.
    const image = sharp(Buffer.concat(chunks), { limitInputPixels: 25_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (!metadata.format || !["jpeg", "png", "webp", "avif", "heif"].includes(metadata.format)) return false;
    await image.raw().toBuffer();
    return Boolean(metadata.width && metadata.height);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    stream?.destroy();
  }
}
