import { TurnExecution } from "../../services/pairingAdvisor/readiness/execution";
import { harness, owner } from "./fixtures";

const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
beforeEach(() => jest.useFakeTimers());
afterEach(() => { expect(jest.getTimerCount()).toBe(0); jest.useRealTimers(); });

describe("C: physical attempts, deadlines, cancellation and stale completion", () => {
  test("three distinct model stages consume exactly three slots; a fourth or repeat cannot start", async () => {
    const execution = new TurnExecution({ totalMilliseconds: 100, perAttemptMilliseconds: 50 });
    const work = jest.fn(async () => true);
    try {
      for (const stage of ["interpretation", "generation", "review"] as const) await execution.model(stage, work);
      expect(execution.physicalAttempts).toBe(3);
      await expect(execution.model("review", work)).rejects.toMatchObject({ code: "ATTEMPT_LIMIT" });
      expect(work).toHaveBeenCalledTimes(3);
    } finally { execution.close(); }
  });
  test("a failed stage still consumes its single physical slot; no implicit retry", async () => {
    const execution = new TurnExecution({ totalMilliseconds: 100, perAttemptMilliseconds: 50 });
    try {
      await expect(execution.model("interpretation", async () => { throw new Error("failed"); })).rejects.toThrow("failed");
      const work = jest.fn();
      await expect(execution.model("interpretation", work)).rejects.toMatchObject({ code: "ATTEMPT_LIMIT" });
      expect(work).not.toHaveBeenCalled();
    } finally { execution.close(); }
  });
  test("per-attempt timeout aborts the signal and settles even if the provider ignores it", async () => {
    const execution = new TurnExecution({ totalMilliseconds: 100, perAttemptMilliseconds: 25 });
    let signal: AbortSignal | undefined;
    const promise = execution.model("interpretation", async input => {
      signal = input; return new Promise(() => undefined);
    });
    const assertion = expect(promise).rejects.toMatchObject({ code: "DEADLINE_EXCEEDED" });
    await flush(); await jest.advanceTimersByTimeAsync(25); await assertion;
    expect(signal?.aborted).toBe(true);
    expect(execution.physicalAttempts).toBe(1);
    execution.close();
  });
  test("total deadline includes non-model authority work and starts no model attempt", async () => {
    const h = harness({ limits: { totalMilliseconds: 50, perAttemptMilliseconds: 25 } });
    h.resolveOwner.mockImplementation(() => new Promise(() => undefined));
    const pending = h.send();
    await flush(); await jest.advanceTimersByTimeAsync(50);
    expect(await pending).toMatchObject({ code: "DEADLINE_EXCEEDED" });
    expect(h.execute).not.toHaveBeenCalled();
  });
  test("total budget spans stages rather than restarting for each stage", async () => {
    const execution = new TurnExecution({ totalMilliseconds: 50, perAttemptMilliseconds: 40 });
    try {
      await execution.model("interpretation", async () => true);
      await jest.advanceTimersByTimeAsync(30);
      const pending = execution.model("generation", async () => new Promise(() => undefined));
      const assertion = expect(pending).rejects.toMatchObject({ code: "DEADLINE_EXCEEDED" });
      await flush(); await jest.advanceTimersByTimeAsync(20); await assertion;
      expect(execution.physicalAttempts).toBe(2);
    } finally { execution.close(); }
  });
  test("already cancelled transport starts no authority or provider work", async () => {
    const h = harness(); const abort = new AbortController(); abort.abort();
    expect(await h.send({}, abort.signal)).toMatchObject({ code: "CANCELLED" });
    expect(h.resolveOwner).not.toHaveBeenCalled(); expect(h.execute).not.toHaveBeenCalled();
  });
  test("owner cancellation retains unresolved input and releases account lease", async () => {
    const h = harness();
    let finish: ((value: { source: string; physicalAttempts: number; output: unknown }) => void) | undefined;
    h.execute.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const submission = h.turn({ message: "I disclosed a risk" });
    const pending = h.controller.submit(owner, submission);
    await flush();
    expect(h.controller.cancel(owner, {
      sessionId: submission.sessionId, conversationId: submission.conversationId, requestId: submission.requestId,
    })).toEqual({ status: "cancelled" });
    const result = await pending;
    expect(result).toMatchObject({ code: "CANCELLED", acknowledgement: { unresolvedInput: true } });
    if (result.acknowledgement) h.setAck(result.acknowledgement);
    // Cancellation settles the transport, not necessarily the physical provider operation.
    expect(await h.send()).toMatchObject({ code: "IN_FLIGHT" });
    finish?.({ source: "mock_provider", physicalAttempts: 1, output: {} });
    await flush();
    expect(h.execute).toHaveBeenCalledTimes(1);
    expect((await h.send()).status).toBe("accepted");
  });
  test("cancel cannot target another request and a finished request is idempotently not in flight", async () => {
    const h = harness(); const turn = h.turn();
    expect(h.controller.cancel(owner, {
      sessionId: turn.sessionId, conversationId: turn.conversationId, requestId: "not-this-request",
    })).toEqual({ status: "not_in_flight" });
    await h.controller.submit(owner, turn);
    expect(h.controller.cancel(owner, {
      sessionId: turn.sessionId, conversationId: turn.conversationId, requestId: turn.requestId,
    })).toEqual({ status: "not_in_flight" });
  });
  test("reset aborts in-flight work; a late result cannot attach to the new conversation", async () => {
    const h = harness();
    h.execute.mockImplementationOnce(() => new Promise(() => undefined));
    const turn = h.turn();
    const pending = h.controller.submit(owner, turn);
    await flush();
    const ack = h.controller.resetHistory(owner, { sessionId: turn.sessionId, conversationId: turn.conversationId });
    expect(ack.conversationId).not.toBe(turn.conversationId);
    expect(await pending).toMatchObject({ code: "CANCELLED", acknowledgement: { conversationId: ack.conversationId } });
  });
  test("one account cannot execute simultaneous turns across different login sessions", async () => {
    const h = harness();
    h.execute.mockImplementationOnce(() => new Promise(() => undefined));
    const abort = new AbortController();
    const pending = h.send({}, abort.signal);
    await flush();
    const otherLogin = { ...owner, authSessionId: "second-login" };
    const ack = h.controller.open(otherLogin);
    expect(await h.controller.submit(otherLogin, {
      ...h.turn(), sessionId: ack.sessionId, conversationId: ack.conversationId, expectedRevision: 0,
    })).toMatchObject({ code: "IN_FLIGHT" });
    abort.abort(); await pending;
  });
  test("session expiry during review prevents serialization of the accepted candidate", async () => {
    let time = 0;
    const h = harness({ now: () => time });
    const original = h.execute.getMockImplementation()!;
    h.execute.mockImplementation(async call => {
      const receipt = await original(call);
      if (call.stage === "review") time = h.ack().expiresAt + 1;
      return receipt;
    });
    // Total deadline takes precedence over expiry when time moves beyond both.
    expect(await h.send()).toMatchObject({ status: "error", code: "DEADLINE_EXCEEDED", acknowledgement: null });
  });
});
