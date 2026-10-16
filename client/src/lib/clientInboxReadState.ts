export interface ClientInboxMessage {
  id: string;
  sender: string;
  createdAt: string | Date;
}

export interface ClientInboxReadState {
  latestAt: number;
  ids: string[];
}

const empty = (): ClientInboxReadState => ({ latestAt: 0, ids: [] });
export const clientInboxReadKey = (accountId: string) =>
  `mpm.clientInbox.read.v1:${encodeURIComponent(accountId)}`;

export function mergeClientInboxReadStates(
  a: ClientInboxReadState, b: ClientInboxReadState,
): ClientInboxReadState {
  if (a.latestAt !== b.latestAt) return a.latestAt > b.latestAt ? a : b;
  return { latestAt: a.latestAt, ids: [...new Set([...a.ids, ...b.ids])] };
}

export function readClientInboxState(
  storage: Pick<Storage, "getItem">,
  accountId: string,
): ClientInboxReadState {
  try {
    const value = JSON.parse(storage.getItem(clientInboxReadKey(accountId)) || "null");
    if (!value || !Number.isFinite(value.latestAt) || value.latestAt < 0 ||
        !Array.isArray(value.ids) || !value.ids.every((id: unknown) => typeof id === "string")) return empty();
    return value;
  } catch {
    return empty();
  }
}

export function hasUnreadClientMessages(
  messages: readonly ClientInboxMessage[],
  seen: ClientInboxReadState,
): boolean {
  return messages.some(message => {
    const at = new Date(message.createdAt).getTime();
    return message.sender === "pro" && Number.isFinite(at) &&
      (at > seen.latestAt || (at === seen.latestAt && !seen.ids.includes(message.id)));
  });
}

/** Advance from received evidence, never the browser clock or a failed fetch. */
export function advanceClientInboxReadState(
  previous: ClientInboxReadState,
  messages: readonly ClientInboxMessage[],
): ClientInboxReadState {
  let latestAt = previous.latestAt;
  let ids = new Set(previous.ids);
  for (const message of messages) {
    if (message.sender !== "pro") continue;
    const at = new Date(message.createdAt).getTime();
    if (!Number.isFinite(at) || at < latestAt) continue;
    if (at > latestAt) {
      latestAt = at;
      ids = new Set();
    }
    ids.add(message.id);
  }
  return { latestAt, ids: [...ids] };
}
