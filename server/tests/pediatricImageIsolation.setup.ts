/** Opt-in setup for pediatric image contract tests. Never start the app or use Neon. */
import net from "node:net";
import { jest } from "@jest/globals";

jest.mock("../db", () => ({
  db: new Proxy({}, {
    get: (_target, method) => {
      throw new Error(`Unmocked database access in pediatric image tests: ${String(method)}`);
    },
  }),
}));
jest.mock("../objectStorage", () => ({
  ObjectStorageService: class {
    constructor() { throw new Error("Unmocked object storage in pediatric image tests"); }
  },
  StorageUnavailableError: class StorageUnavailableError extends Error {},
}));
jest.mock("openai", () => ({
  __esModule: true,
  default: class {
    constructor() { throw new Error("Unmocked OpenAI in pediatric image tests"); }
  },
}));

// Supertest needs loopback sockets. Everything else, including database hosts,
// image providers and cloud storage, is forbidden even if a mock is missed.
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (this: net.Socket, ...args: any[]) {
  // Node's HTTP agent may pass the already-normalized [options, callback] tuple.
  const connectArgs = Array.isArray(args[0]) ? args[0] : args;
  const options = connectArgs[0];
  const host = typeof options === "object" && options !== null
    ? options.host ?? options.hostname
    : typeof connectArgs[1] === "string" ? connectArgs[1] : undefined;
  if (!["127.0.0.1", "::1", "localhost"].includes(host)) {
    throw new Error("External network access forbidden in pediatric image tests");
  }
  return originalConnect.apply(this, args as any);
} as typeof originalConnect;
