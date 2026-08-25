const mockCreateTranscription = jest.fn();
const mockOpenAI = jest.fn().mockImplementation(() => ({
  audio: {
    transcriptions: {
      create: mockCreateTranscription,
    },
  },
}));

jest.mock("openai", () => ({
  __esModule: true,
  default: mockOpenAI,
}));

jest.mock("@replit/object-storage", () => ({
  Client: jest.fn(),
}));

import { getStudioVideoTranscriptionFailureMetadata } from "../services/studioVideoTranscriptionDiagnostics";
import { transcribeStudioVideoBuffer } from "../services/tabletVoiceService";

describe("Studio video transcription runtime", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    mockOpenAI.mockClear();
    mockCreateTranscription.mockReset();
    mockCreateTranscription.mockResolvedValue({
      text: "Private Studio video transcript",
      duration: 6,
    });
  });

  afterAll(() => {
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });

  it("constructs a Studio transcription upload without an ambient File global", async () => {
    const originalFileDescriptor = Object.getOwnPropertyDescriptor(globalThis, "File");
    Object.defineProperty(globalThis, "File", {
      configurable: true,
      value: undefined,
    });

    try {
      await expect(
        transcribeStudioVideoBuffer(Buffer.from("video-bytes"), "video/webm"),
      ).resolves.toEqual({
        transcript: "Private Studio video transcript",
        durationSec: 6,
      });
    } finally {
      if (originalFileDescriptor) {
        Object.defineProperty(globalThis, "File", originalFileDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "File");
      }
    }

    expect(mockCreateTranscription).toHaveBeenCalledTimes(1);
    const [{ file, model, response_format }] = mockCreateTranscription.mock.calls[0];
    expect(file.name).toBe("studio-video.webm");
    expect(file.type).toBe("video/webm");
    expect(model).toBe("whisper-1");
    expect(response_format).toBe("verbose_json");
  });

  it.each([
    ["video/webm", "studio-video.webm"],
    ["video/mp4", "studio-video.mp4"],
    ["video/quicktime", "studio-video.mov"],
  ])("preserves %s MIME metadata with filename %s", async (mimeType, filename) => {
    await transcribeStudioVideoBuffer(Buffer.from("video-bytes"), mimeType);

    const [{ file }] = mockCreateTranscription.mock.calls[0];
    expect(file.name).toBe(filename);
    expect(file.type).toBe(mimeType);
  });

  it("propagates provider errors so the existing route keeps its safe failed-media path", async () => {
    const providerError = Object.assign(new Error("provider unavailable"), {
      name: "APIConnectionError",
      code: "ECONNRESET",
    });
    mockCreateTranscription.mockRejectedValue(providerError);

    await expect(
      transcribeStudioVideoBuffer(Buffer.from("video-bytes"), "video/webm"),
    ).rejects.toBe(providerError);

    expect(getStudioVideoTranscriptionFailureMetadata(providerError)).toEqual({
      provider: "openai",
      failureCategory: "network",
      sdkErrorClass: "APIConnectionError",
    });
  });
});