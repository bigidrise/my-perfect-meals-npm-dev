import { Readable } from "stream";
import sharp from "sharp";

jest.mock("../objectStorage", () => ({
  ObjectStorageService: jest.fn(),
}));
import { ObjectStorageService } from "../objectStorage";
import { checkSavedImageDelivery, probeSavedImage, verifyRecoveryPhotograph } from "../services/savedImageVerification";
import fs from "fs";
import path from "path";

const original = "/public-objects/replit-objstore-test/meal-images/original.jpg";
const alternate = "/public-objects/replit-objstore-test/meal-images/display.jpg";
const resolve = jest.fn();
const stream = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  resolve.mockImplementation(() => { throw new Error("Unexpected storage access"); });
  stream.mockImplementation(() => { throw new Error("Unexpected byte access"); });
  jest.mocked(ObjectStorageService).mockImplementation(() => ({
    resolvePublicObjectPath: resolve, streamResolvedObject: stream,
  }) as any);
});
afterEach(() => jest.useRealTimers());

describe("authoritative, read-only saved image checks", () => {
  it("confirms missing only when the storage resolver confirms absence", async () => {
    resolve.mockResolvedValue(null);
    expect(await probeSavedImage(original)).toBe("missing");
    expect(await checkSavedImageDelivery(original, { thumbnailUrl: original, displayUrl: original }))
      .toEqual({ status: "unavailable", reason: "missing" });
  });

  it.each(["Permission denied", "Storage unavailable", "Network timeout"])(
    "%s is never classified as a missing object", async message => {
      resolve.mockRejectedValue(new Error(message));
      expect(await probeSavedImage(original)).toBe("unavailable");
      expect(await checkSavedImageDelivery(original, { thumbnailUrl: original, displayUrl: original }))
        .toEqual({ status: "retry", imageUrl: original });
    },
  );

  it("bounds a hung resolver and treats timeout as unavailable", async () => {
    jest.useFakeTimers();
    resolve.mockReturnValue(new Promise(() => undefined));
    const result = probeSavedImage(original);
    await jest.advanceTimersByTimeAsync(5_000);
    expect(await result).toBe("unavailable");
  });

  it("offers an accessible variant only as a display suggestion", async () => {
    resolve.mockResolvedValueOnce(null).mockResolvedValueOnce({ bucketId: "test", objectName: "display.jpg" });
    expect(await checkSavedImageDelivery(original, { thumbnailUrl: original, displayUrl: alternate }))
      .toEqual({ status: "recovered", imageUrl: alternate });
    expect(stream).not.toHaveBeenCalled();
  });

  it("does not mistake uncertain alternate access for confirmed absence", async () => {
    resolve.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("Permission denied"));
    expect(await checkSavedImageDelivery(original, { thumbnailUrl: original, displayUrl: alternate }))
      .toEqual({ status: "retry", imageUrl: alternate });
  });

  it("unsupported URLs cannot prove absence or qualify as replacement bytes", async () => {
    expect(await probeSavedImage("https://untrusted.example/image.jpg")).toBe("unavailable");
    expect(await verifyRecoveryPhotograph("/images/fallback/salad.svg")).toBe(false);
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe("independent replacement-byte verification", () => {
  async function serve(bytes: Buffer) {
    resolve.mockResolvedValue({ bucketId: "test", objectName: "image.jpg" });
    stream.mockImplementation(() => Readable.from([bytes]));
    return verifyRecoveryPhotograph(original);
  }

  it("accepts a decodable raster photograph independently of its URL extension", async () => {
    const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } }).jpeg().toBuffer();
    expect(await serve(bytes)).toBe(true);
  });
  it.each([
    Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'/>"),
    Buffer.from("not image bytes"),
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  ])("rejects illustrations, invalid data and truncated images", async bytes => {
    expect(await serve(bytes)).toBe(false);
  });
  it("fails closed when storage is inaccessible", async () => {
    resolve.mockRejectedValue(new Error("Permission denied"));
    expect(await verifyRecoveryPhotograph(original)).toBe(false);
    expect(stream).not.toHaveBeenCalled();
  });
  it("rejects oversized image streams", async () => {
    expect(await serve(Buffer.alloc(20 * 1024 * 1024 + 1))).toBe(false);
  });
  it("bounds a stalled image stream", async () => {
    jest.useFakeTimers();
    resolve.mockResolvedValue({ bucketId: "test", objectName: "image.jpg" });
    stream.mockImplementation(() => new Readable({ read() {} }));
    const verification = verifyRecoveryPhotograph(original);
    await jest.advanceTimersByTimeAsync(5_000);
    expect(await verification).toBe(false);
  });
});

it("the automatic Board image check contains no image finalization or database writes", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../routes/weekBoard.ts"), "utf8");
  const handler = source.split('app.post("/api/weekly-board/image-recovery"')[1].split('app.get("/api/week-board"')[0];
  expect(handler).toContain("validateMealImageAuthority");
  expect(handler).not.toMatch(/finalizeMealImage|generateMeal|invalidateMeal|db\.(update|insert|delete)\(/);
});
