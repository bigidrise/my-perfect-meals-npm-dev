jest.mock("@/lib/resolveApiBase", () => ({
  apiUrl: (path: string) => `https://app.test${path}`,
}));

import {
  loadStudioVoicePlayback,
  StudioVoicePlaybackError,
} from "@/lib/studioVoicePlayback";

describe("Studio voice playback", () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => "blob:private-voice");
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  });

  test("fetches private streams with x-auth-token before creating an audio URL", async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          privatePlayback: true,
          url: "/api/client/tablet/audio/note-1?stream=1&access=fresh-token",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["voice"], { type: "audio/webm" }),
      });

    const source = await loadStudioVoicePlayback(
      "/api/client/tablet/audio/note-1",
      { "x-auth-token": "native-token" },
      fetchImpl as unknown as typeof fetch,
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(1, "https://app.test/api/client/tablet/audio/note-1", expect.objectContaining({
      headers: { "x-auth-token": "native-token" },
      cache: "no-store",
    }));
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://app.test/api/client/tablet/audio/note-1?stream=1&access=fresh-token",
      expect.objectContaining({ headers: { "x-auth-token": "native-token" } }),
    );
    expect(source.url).toBe("blob:private-voice");
    source.revoke();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:private-voice");
  });

  test("requests fresh metadata for each play instead of caching an expired private token", async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ privatePlayback: true, url: "/stream?access=expired" }) })
      .mockResolvedValueOnce({ ok: false, blob: async () => new Blob() })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ privatePlayback: true, url: "/stream?access=fresh" }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(["voice"]) });

    await expect(loadStudioVoicePlayback("/metadata", { "x-auth-token": "native-token" }, fetchImpl as unknown as typeof fetch))
      .rejects.toBeInstanceOf(StudioVoicePlaybackError);
    await expect(loadStudioVoicePlayback("/metadata", { "x-auth-token": "native-token" }, fetchImpl as unknown as typeof fetch))
      .resolves.toMatchObject({ url: "blob:private-voice" });

    expect(fetchImpl).toHaveBeenNthCalledWith(3, "https://app.test/metadata", expect.any(Object));
    expect(fetchImpl).toHaveBeenNthCalledWith(4, "https://app.test/stream?access=fresh", expect.any(Object));
  });

  test("surfaces the server's safe unavailable-audio message", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Audio is no longer available" }),
    });

    await expect(
      loadStudioVoicePlayback("/metadata", { "x-auth-token": "native-token" }, fetchImpl as unknown as typeof fetch),
    ).rejects.toMatchObject({
      name: "StudioVoicePlaybackError",
      message: "Audio is no longer available",
    });
  });

  test("keeps legacy signed URLs as direct playback without adding token headers to S3", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ privatePlayback: false, url: "https://legacy-s3.test/audio" }),
    });

    const source = await loadStudioVoicePlayback("/metadata", { "x-auth-token": "native-token" }, fetchImpl as unknown as typeof fetch);

    expect(source.url).toBe("https://legacy-s3.test/audio");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});