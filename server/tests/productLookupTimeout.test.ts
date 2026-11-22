import { chatJson } from "../utils/openaiSafe";

const mockCreate = jest.fn();
jest.mock("openai", () => ({
  __esModule: true,
  default: class { chat = { completions: { create: (...args: unknown[]) => mockCreate(...args) } }; },
}));

test("a product lookup actually aborts its provider request without automatic retry multiplication", async () => {
  jest.useFakeTimers();
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "offline-synthetic-key-not-a-credential";
  mockCreate.mockImplementation((_body, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new Error("synthetic abort")), { once: true });
  }));
  try {
    const request = chatJson({ system: "synthetic", user: "synthetic", timeoutMs: 15, maxRetries: 0 })
      .then(() => "unexpected success", error => error.message);
    await jest.advanceTimersByTimeAsync(20);
    expect(await request).toBe("synthetic abort");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][1].signal.aborted).toBe(true);
    expect(mockCreate.mock.calls[0][1].maxRetries).toBe(0);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    jest.useRealTimers();
  }
});
