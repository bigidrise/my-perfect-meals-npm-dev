import { clientMessageSendError } from "../clientMessageSendError";

function response(status: number, body: unknown = {}) {
  return { status, json: async () => body } as Response;
}

describe("safe client send errors", () => {
  it.each([400, 401, 403, 404, 413, 422, 429, 500, 503])("handles HTTP %s without exposing server details", async status => {
    const error = await clientMessageSendError(response(status, { error: "secret SQL patient content" }));
    expect(error).not.toContain("secret");
    expect(error).not.toContain("SQL");
    expect(error.length).toBeGreaterThan(20);
  });
  it("explains expired CSRF checks without signing out", async () => {
    expect(await clientMessageSendError(response(403, { code: "CSRF_TOKEN_INVALID" }))).toContain("security check expired");
  });
  it("handles non-JSON server failures", async () => {
    expect(await clientMessageSendError({ status: 502, json: async () => { throw Error("HTML"); } } as unknown as Response)).toContain("draft has been kept");
  });
});
