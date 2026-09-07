import { createSingleFlight } from "@/lib/singleFlight";

describe("single-flight requests", () => {
  it("shares one in-flight operation across concurrent callers", async () => {
    let resolveRequest!: (value: string) => void;
    const operation = jest.fn(
      () =>
        new Promise<string>(resolve => {
          resolveRequest = resolve;
        }),
    );
    const singleFlight = createSingleFlight<string>();

    const first = singleFlight.run(operation);
    const second = singleFlight.run(operation);

    expect(second).toBe(first);
    expect(operation).toHaveBeenCalledTimes(1);

    resolveRequest("profile");
    await expect(first).resolves.toBe("profile");
  });

  it("allows a later explicit refresh after the first request settles", async () => {
    const operation = jest
      .fn<Promise<string>, []>()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("refreshed");
    const singleFlight = createSingleFlight<string>();

    await expect(singleFlight.run(operation)).resolves.toBe("first");
    await expect(singleFlight.run(operation)).resolves.toBe("refreshed");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("clears a failed request so callers can retry", async () => {
    const operation = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("recovered");
    const singleFlight = createSingleFlight<string>();

    await expect(singleFlight.run(operation)).rejects.toThrow("offline");
    await expect(singleFlight.run(operation)).resolves.toBe("recovered");
  });
});