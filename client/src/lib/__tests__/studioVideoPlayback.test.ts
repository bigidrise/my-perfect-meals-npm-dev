jest.mock("@/lib/resolveApiBase", () => ({
  apiUrl: (path: string) => `https://app.test${path}`,
}));

import {
  loadStudioVideoPlayback,
  StudioVideoPlaybackError,
} from "@/lib/studioVideoPlayback";

describe("Studio video playback", () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => "blob:private-video");
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  });

  test("fetches the short-lived protected stream with native auth before creating a video URL", async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "/api/client/tablet/video/message-1/stream?access=fresh-token",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["video"], { type: "video/mp4" }),
      });

    const source = await loadStudioVideoPlayback(
      "/api/client/tablet/video/message-1/playback",
      { "x-auth-token": "native-token" },
      fetchImpl as unknown as typeof fetch,
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://app.test/api/client/tablet/video/message-1/playback",
      expect.objectContaining({ headers: { "x-auth-token": "native-token" }, cache: "no-store" }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://app.test/api/client/tablet/video/message-1/stream?access=fresh-token",
      expect.objectContaining({ headers: { "x-auth-token": "native-token" }, cache: "no-store" }),
    );
    expect(source.url).toBe("blob:private-video");
    source.revoke();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:private-video");
  });

  test("fails without exposing a direct URL when protected metadata is unavailable", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false });

    await expect(
      loadStudioVideoPlayback(
        "/api/pro/tablet/client-1/video/message-1/playback",
        { "x-auth-token": "native-token" },
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toBeInstanceOf(StudioVideoPlaybackError);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});