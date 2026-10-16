import {
  advanceClientInboxReadState,
  clientInboxReadKey,
  hasUnreadClientMessages,
  mergeClientInboxReadStates,
  readClientInboxState,
} from "../clientInboxReadState";

const empty = { latestAt: 0, ids: [] };
const message = (id: string, at = "2026-10-15T10:00:00Z", sender = "pro") =>
  ({ id, createdAt: at, sender });

describe("Personal client inbox read evidence", () => {
  test("read keys are account-specific and never use legacy shared timestamps", () => {
    expect(clientInboxReadKey("a")).not.toBe(clientInboxReadKey("b"));
    expect(readClientInboxState({ getItem: key => key === "mpm.tablet.client.lastSeen" ? "9999999999999" : null }, "a"))
      .toEqual(empty);
  });

  test("received video/text/voice messages use the same incoming identity", () => {
    for (const contentType of ["video", "text", "voice"]) {
      const messages = [{ ...message(contentType), contentType }];
      expect(hasUnreadClientMessages(messages, empty)).toBe(true);
      const seen = advanceClientInboxReadState(empty, messages);
      expect(hasUnreadClientMessages(messages, seen)).toBe(false);
      expect(hasUnreadClientMessages([...messages], seen)).toBe(false);
    }
  });

  test("a new message at the same timestamp is still unread", () => {
    const seen = advanceClientInboxReadState(empty, [message("one")]);
    expect(hasUnreadClientMessages([message("one"), message("two")], seen)).toBe(true);
    expect(advanceClientInboxReadState(seen, [message("two")]).ids.sort()).toEqual(["one", "two"]);
  });

  test("outgoing messages do not set unread or advance the incoming watermark", () => {
    const outgoing = message("reply", "2026-10-15T11:00:00Z", "client");
    expect(hasUnreadClientMessages([outgoing], empty)).toBe(false);
    expect(advanceClientInboxReadState(empty, [outgoing])).toEqual(empty);
  });

  test("failed/empty results and older poll snapshots cannot advance or regress read state", () => {
    const seen = advanceClientInboxReadState(empty, [message("latest", "2026-10-15T12:00:00Z")]);
    expect(advanceClientInboxReadState(seen, [])).toEqual(seen);
    expect(advanceClientInboxReadState(seen, [message("older")])).toEqual(seen);
    expect(hasUnreadClientMessages([message("older")], seen)).toBe(false);
    expect(hasUnreadClientMessages([message("new", "2026-10-15T13:00:00Z")], seen)).toBe(true);
  });

  test("corrupt or unavailable storage does not break the inbox", () => {
    for (const data of ["x", "null", '{"latestAt":-1,"ids":[]}', '{"latestAt":0,"ids":[1]}']) {
      expect(readClientInboxState({ getItem: () => data }, "a")).toEqual(empty);
    }
    expect(readClientInboxState({ getItem: () => { throw new Error("denied"); } }, "a")).toEqual(empty);
  });

  test("persisted read state survives reopen but cannot clear a different account", () => {
    const state = advanceClientInboxReadState(empty, [message("incoming")]);
    const data = new Map([[clientInboxReadKey("a"), JSON.stringify(state)]]);
    const storage = { getItem: (key: string) => data.get(key) ?? null };
    expect(hasUnreadClientMessages([message("incoming")], readClientInboxState(storage, "a"))).toBe(false);
    expect(hasUnreadClientMessages([message("incoming")], readClientInboxState(storage, "b"))).toBe(true);
  });

  test("invalid incoming dates never create a corrupt watermark", () => {
    expect(advanceClientInboxReadState(empty, [message("broken", "invalid")])).toEqual(empty);
    expect(hasUnreadClientMessages([message("broken", "invalid")], empty)).toBe(false);
  });

  test("merging session and cross-tab read evidence never moves backwards", () => {
    const earlier = advanceClientInboxReadState(empty, [message("early")]);
    const later = advanceClientInboxReadState(empty, [message("later", "2026-10-15T11:00:00Z")]);
    expect(mergeClientInboxReadStates(earlier, later)).toEqual(later);
    expect(mergeClientInboxReadStates(later, earlier)).toEqual(later);
    expect(mergeClientInboxReadStates(earlier, { ...earlier, ids: ["other"] }).ids.sort())
      .toEqual(["early", "other"]);
  });
});
