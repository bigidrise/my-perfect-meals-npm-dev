import { Worker } from "node:worker_threads";
import { PgDialect } from "drizzle-orm/pg-core";
import { developmentProUnreadQuery } from "../services/developmentProUnreadQuery";
import { developmentClientConversationEnabled } from "../middleware/developmentClientConversation";

// This database lives only in memory. Never imports the application's DB client.
jest.mock("../middleware/requireWorkspaceAccess", () => ({ requireClientWorkspaceAccess: jest.fn() }));

const STUDIO = "00000000-0000-0000-0000-000000000001";
const OTHER_STUDIO = "00000000-0000-0000-0000-000000000002";
const CLIENT = "synthetic-client";
const OTHER_CLIENT = "synthetic-other-client";
const OWNER = "synthetic-business-owner";
const OLD = "2000-01-01T00:00:00Z";
const READ = "2000-01-02T00:00:00Z";
const NEW = "2000-01-03T00:00:00Z";
interface FixtureDatabase {
  exec: (statement: string) => Promise<unknown>;
  query: <T = Record<string, unknown>>(statement: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  close: () => Promise<void>;
}
let database: FixtureDatabase;
let sequence = 0;
const nextId = () => `10000000-0000-0000-0000-${String(++sequence).padStart(12, "0")}`;

function isolatedDatabase(): FixtureDatabase {
  // PGlite uses Node dynamic imports. A worker avoids Jest VM loader limitations
  // without changing the project's Jest mode or importing the real DB client.
  const worker = new Worker(`
    const { parentPort } = require("node:worker_threads");
    const { PGlite } = require("@electric-sql/pglite");
    const db = new PGlite();
    parentPort.on("message", async ({ id, method, statement, params }) => {
      try {
        const result = await db[method](statement, params);
        parentPort.postMessage({ id, result });
      } catch (error) { parentPort.postMessage({ id, error: error.message }); }
    });
  `, { eval: true });
  let nextRequest = 0;
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  worker.on("message", ({ id, result, error }) => {
    const request = pending.get(id);
    pending.delete(id);
    if (error) request?.reject(new Error(error));
    else request?.resolve(result);
  });
  worker.on("error", error => {
    pending.forEach(request => request.reject(error));
    pending.clear();
  });
  const call = (method: string, statement?: string, params?: unknown[]): Promise<any> =>
    new Promise((resolve, reject) => {
      const id = ++nextRequest;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, method, statement, params });
    });
  return {
    exec: statement => call("exec", statement),
    query: (statement, params) => call("query", statement, params),
    close: async () => { await call("close"); await worker.terminate(); },
  };
}

beforeAll(async () => {
  database = isolatedDatabase();
  await database.exec(`
    CREATE TABLE client_notes (
      id uuid PRIMARY KEY, studio_id uuid, client_user_id text, created_at timestamptz,
      body text, entry_type text, sender text, content_type text
    );
    CREATE TABLE studio_video_messages (
      id uuid PRIMARY KEY, studio_id uuid, client_user_id text, created_at timestamptz,
      body text, sender text, visibility text
    );
    CREATE TABLE studio_video_media (message_id uuid PRIMARY KEY);
    CREATE TABLE studio_message_viewer_deletions (
      viewer_user_id text, client_note_id uuid, studio_video_message_id uuid
    );
    CREATE TABLE pro_message_reads (
      studio_id uuid, client_user_id text, last_read_at timestamptz,
      PRIMARY KEY (studio_id, client_user_id)
    );
  `);
}, 30000);
afterAll(async () => { await database?.close(); });
beforeEach(async () => {
  await database.exec(`TRUNCATE client_notes, studio_video_messages, studio_video_media,
    studio_message_viewer_deletions, pro_message_reads`);
  sequence = 0;
});

async function add(kind: "text" | "voice" | "video", options: {
  studio?: string; client?: string; created?: string; sender?: string;
  visibility?: string; entryType?: string; withMedia?: boolean;
} = {}) {
  const id = nextId();
  const studio = options.studio ?? STUDIO;
  const client = options.client ?? CLIENT;
  const created = options.created ?? NEW;
  const sender = options.sender ?? "client";
  if (kind === "video") {
    await database.query(`INSERT INTO studio_video_messages VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, studio, client, created, "PRIVATE TRANSCRIPT", sender, options.visibility ?? "shared_with_client"]);
    if (options.withMedia !== false) await database.query(`INSERT INTO studio_video_media VALUES ($1)`, [id]);
  } else {
    await database.query(`INSERT INTO client_notes VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, studio, client, created, `${kind} message`, options.entryType ?? "message", sender, kind]);
  }
  return id;
}
async function readAt(client = CLIENT, at = READ, studio = STUDIO) {
  await database.query(`INSERT INTO pro_message_reads VALUES ($1,$2,$3)
    ON CONFLICT (studio_id,client_user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
  [studio, client, at]);
}
async function summary(studio = STUDIO, viewer = OWNER) {
  const query = new PgDialect().sqlToQuery(developmentProUnreadQuery(studio, viewer));
  return (await database.query<{
    clientUserId: string; unreadCount: number; lastMessageAt: Date; lastMessageBody: string;
  }>(query.sql, query.params)).rows;
}

test.each([
  ["text-only", ["text"]],
  ["voice-only", ["voice"]],
  ["video-only", ["video"]],
  ["mixed", ["text", "voice", "video"]],
] as const)("%s counts each new client message once and preserves the existing watermark", async (_label, kinds) => {
  await readAt();
  for (const kind of kinds) {
    await add(kind, { created: OLD });
    await add(kind);
  }
  const before = (await database.query("SELECT * FROM pro_message_reads")).rows;
  expect((await summary())[0].unreadCount).toBe(kinds.length);
  expect((await summary())[0].unreadCount).toBe(kinds.length);
  expect((await database.query("SELECT * FROM pro_message_reads")).rows).toEqual(before);
});

test("a video-only conversation with no read marker is included and does not create a marker", async () => {
  await add("video");
  expect(await summary()).toEqual([expect.objectContaining({ clientUserId: CLIENT, unreadCount: 1, lastMessageBody: "Video message" })]);
  expect((await database.query("SELECT * FROM pro_message_reads")).rows).toEqual([]);
});

test("videos on or before the watermark stay read; later videos stay unread", async () => {
  await readAt();
  for (const created of [OLD, READ, NEW]) await add("video", { created });
  expect((await summary())[0].unreadCount).toBe(1);
});

test("the existing folder read watermark clears only the appropriate conversation", async () => {
  for (const kind of ["text", "voice", "video"] as const) await add(kind);
  await add("video", { client: OTHER_CLIENT });
  expect((await summary()).reduce((sum, row) => sum + row.unreadCount, 0)).toBe(4);
  // Identical watermark operation used by the existing conversation route.
  await database.query(`INSERT INTO pro_message_reads (studio_id,client_user_id,last_read_at)
    VALUES ($1,$2,NOW()) ON CONFLICT (studio_id,client_user_id) DO UPDATE SET last_read_at = NOW()`,
  [STUDIO, CLIENT]);
  expect(await summary()).toEqual(expect.arrayContaining([
    expect.objectContaining({ clientUserId: CLIENT, unreadCount: 0 }),
    expect.objectContaining({ clientUserId: OTHER_CLIENT, unreadCount: 1 }),
  ]));
});

test("another Studio's videos and read markers cannot affect this Studio", async () => {
  await add("video", { studio: OTHER_STUDIO });
  expect(await summary()).toEqual([]);
  await add("video");
  await readAt(CLIENT, "2099-01-01T00:00:00Z", OTHER_STUDIO);
  expect((await summary())[0].unreadCount).toBe(1);
});

test("professional videos, private videos, non-message notes and incomplete records do not inflate counts", async () => {
  await add("video", { sender: "pro" });
  await add("video", { visibility: "private" });
  await add("video", { withMedia: false });
  await add("text", { entryType: "note" });
  await add("voice", { sender: "pro" });
  expect(await summary()).toEqual([]);
});

test("viewer-hidden text, voice and video are excluded only for that viewer", async () => {
  for (const kind of ["text", "voice", "video"] as const) {
    const id = await add(kind);
    await database.query(`INSERT INTO studio_message_viewer_deletions VALUES ($1,$2,$3)`,
      [OWNER, kind === "video" ? null : id, kind === "video" ? id : null]);
  }
  expect(await summary()).toEqual([]);
  expect((await summary(STUDIO, "synthetic-other-viewer"))[0].unreadCount).toBe(3);
});

test("multiple identical-looking videos count separately without multiplying through other viewers' deletions", async () => {
  const first = await add("video");
  await add("video");
  for (const viewer of ["synthetic-viewer-a", "synthetic-viewer-b"]) {
    await database.query(`INSERT INTO studio_message_viewer_deletions VALUES ($1,NULL,$2)`, [viewer, first]);
  }
  const rows = await summary();
  expect(rows[0].unreadCount).toBe(2);
  expect(rows[0].lastMessageBody).toBe("Video message");
  expect(JSON.stringify(rows)).not.toContain("PRIVATE TRANSCRIPT");
});

test.each([
  [{ NODE_ENV: "development" }, true],
  [{ NODE_ENV: "production" }, false],
  [{ NODE_ENV: "development", REPLIT_DEPLOYMENT: "1" }, false],
  [{ NODE_ENV: "test" }, false],
])("release boundary %j is %s", (env, enabled) => {
  expect(developmentClientConversationEnabled(env)).toBe(enabled);
});
