import {
  getStudioMessageScrollDecision,
  isStudioMessageListNearBottom,
} from "../studioMessageScrollPolicy";

describe("Studio message scroll policy", () => {
  it("scrolls to the latest message only for the initial conversation load", () => {
    expect(getStudioMessageScrollDecision({
      initialLoad: true,
      wasNearBottom: false,
      previousMessageIds: null,
      messageIds: ["one", "two"],
    })).toEqual({ scrollToBottom: true, showNewMessageIndicator: false });
  });

  it("does not move the reader when polling returns the same messages", () => {
    expect(getStudioMessageScrollDecision({
      initialLoad: false,
      wasNearBottom: false,
      previousMessageIds: ["one", "two"],
      messageIds: ["one", "two"],
    })).toEqual({ scrollToBottom: false, showNewMessageIndicator: false });
  });

  it("follows a genuinely new message only while the reader is near the bottom", () => {
    expect(getStudioMessageScrollDecision({
      initialLoad: false,
      wasNearBottom: true,
      previousMessageIds: ["one"],
      messageIds: ["one", "two"],
    })).toEqual({ scrollToBottom: true, showNewMessageIndicator: false });
  });

  it("preserves position and shows an indicator when a reader has scrolled up", () => {
    expect(getStudioMessageScrollDecision({
      initialLoad: false,
      wasNearBottom: false,
      previousMessageIds: ["one"],
      messageIds: ["one", "two"],
    })).toEqual({ scrollToBottom: false, showNewMessageIndicator: true });
  });

  it("recognizes the near-bottom threshold without requiring exact alignment", () => {
    expect(isStudioMessageListNearBottom({
      scrollTop: 452,
      scrollHeight: 1000,
      clientHeight: 500,
    })).toBe(true);
    expect(isStudioMessageListNearBottom({
      scrollTop: 440,
      scrollHeight: 1000,
      clientHeight: 500,
    })).toBe(false);
  });
});