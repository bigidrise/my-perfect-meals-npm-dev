import {
  SENTRY_REDACTED,
  scrubSentryBreadcrumb,
  scrubSentryData,
  scrubSentryEvent,
} from "../../shared/sentryScrubber";

describe("sentry scrubber", () => {
  it("redacts nested credentials, PHI, and matching string values without mutation", () => {
    const input = {
      request: { headers: { authorization: "Bearer top-secret" } },
      details: {
        email: "person@example.com",
        note: "patient reported a medication reaction",
        safe: "GET",
      },
    };
    const output = scrubSentryData(input) as typeof input;

    expect(output).not.toBe(input);
    expect(output.request.headers.authorization).toBe(SENTRY_REDACTED);
    expect(output.details.email).toBe(SENTRY_REDACTED);
    expect(output.details.note).toBe(SENTRY_REDACTED);
    expect(output.details.safe).toBe("GET");
    expect(input.request.headers.authorization).toBe("Bearer top-secret");
    expect(input.details.email).toBe("person@example.com");
  });

  it("is bounded and handles cycles", () => {
    const cyclic: Record<string, unknown> = { items: Array.from({ length: 55 }, (_, i) => i) };
    cyclic.self = cyclic;
    let deep: Record<string, unknown> = {};
    const root = deep;
    for (let i = 0; i < 10; i++) {
      deep.next = {};
      deep = deep.next as Record<string, unknown>;
    }

    const output = scrubSentryData({ cyclic, root }) as any;
    expect(output.cyclic.self).toBe("[CIRCULAR]");
    expect(output.cyclic.items).toHaveLength(51);
    expect(output.cyclic.items[50]).toBe("[TRUNCATED]");
    expect(JSON.stringify(output.root)).toContain("[MAX_DEPTH]");

    const broad = Array.from({ length: 50 }, () =>
      Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`key${i}`, i])),
    );
    expect(JSON.stringify(scrubSentryData(broad))).toContain("[MAX_SIZE]");
  });

  it("enforces request and user policy while preserving safe diagnostics", () => {
    const event = {
      request: {
        method: "POST",
        url: "https://example.test/checkout?token=secret",
        headers: { accept: "application/json" },
        query_string: "email=person@example.com",
        data: { glucose: 120 },
      },
      requestId: "req_123",
      exception: { values: [{ type: "ValidationError", value: "invalid input" }] },
      user: { id: "stable-user-id", email: "person@example.com", username: "person" },
    };
    const output = scrubSentryEvent(event);

    expect(output.request.method).toBe("POST");
    expect(output.request.url).toBe("/checkout");
    expect("headers" in output.request).toBe(false);
    expect("query_string" in output.request).toBe(false);
    expect("data" in output.request).toBe(false);
    expect(output.requestId).toBe("req_123");
    expect(output.exception.values[0].type).toBe("ValidationError");
    expect(output.exception.values[0].value).toBe(SENTRY_REDACTED);
    expect(output.user).toEqual({});
    expect(event.request.url).toContain("?token=");
  });

  it("scrubs breadcrumb messages and data values", () => {
    const breadcrumb = {
      category: "storage",
      message: "opaque private content with no medical keywords",
      data: {
        key: "opaque-private-key",
        error: "opaque private content",
        operation: "safeLocalStorageSet",
        outcome: "failed",
      },
    };
    const output = scrubSentryBreadcrumb(breadcrumb);
    expect(output.message).toBe(SENTRY_REDACTED);
    expect(output.data).toEqual({
      operation: "safeLocalStorageSet",
      outcome: "failed",
    });
  });

  it("drops arbitrary contexts, tags, stack traces, and opaque content", () => {
    const event = {
      message: "Jane takes Lisinopril 10mg",
      tags: { account: "opaque-private-value" },
      contexts: { profile: { address: "123 Private Street" } },
      exception: {
        values: [{
          type: "Error",
          value: "opaque private content",
          stacktrace: { frames: [{ filename: "/private/path", function: "secretFunction" }] },
        }],
      },
      extra: {
        requestId: "req_123",
        arbitrary: "opaque-private-value",
      },
    };
    const output = scrubSentryEvent(event) as Record<string, unknown>;
    expect(output).not.toHaveProperty("message");
    expect(output).not.toHaveProperty("tags");
    expect(output).not.toHaveProperty("contexts");
    expect(JSON.stringify(output)).not.toContain("opaque-private");
    expect(JSON.stringify(output)).not.toContain("Private Street");
    expect(JSON.stringify(output)).not.toContain("secretFunction");
    expect(output.extra).toEqual({ requestId: "req_123" });
  });
});