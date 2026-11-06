/**
 * Opt-in Jest setup for offline Ask Chef release verification.
 * Permit HTTP fixtures bound by this test process, never the running app,
 * shared database or external providers. Existing per-suite mocks remain intact.
 *
 * Invoke with both setup files:
 * --setupFiles ./server/tests/testEnv.setup.ts ./server/tests/helpers/askChefReleaseIoGuard.cjs
 */
const net = require("node:net");
const marker = Symbol.for("ask-chef-release-io-guard");
if (!net.Socket.prototype.connect[marker]) {
  const servers = new Set();
  const listen = net.Server.prototype.listen;
  net.Server.prototype.listen = function (...args) {
    servers.add(this);
    this.once("close", () => servers.delete(this));
    return listen.apply(this, args);
  };
  const ownedPort = port => [...servers].some(server => {
    const address = server.address();
    return address && typeof address === "object" && address.port === Number(port);
  });
  const connect = net.Socket.prototype.connect;
  function guardedConnect(...args) {
    const normalized = Array.isArray(args[0]) ? args[0] : args;
    const options = typeof normalized[0] === "object"
      ? normalized[0] : { port: normalized[0], host: normalized[1] };
    const host = typeof options?.host === "string" ? options.host : "localhost";
    if (!["localhost", "127.0.0.1", "::1"].includes(host) ||
        !ownedPort(options?.port)) {
      throw new Error("ASK_CHEF_RELEASE_EXTERNAL_IO_BLOCKED: socket outside an owned test fixture");
    }
    return connect.apply(this, args);
  }
  guardedConnect[marker] = ownedPort;
  net.Socket.prototype.connect = guardedConnect;
}
const fixtureFetch = globalThis.fetch;
globalThis.fetch = async (input, ...args) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url);
  if (typeof fixtureFetch === "function" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      net.Socket.prototype.connect[marker](url.port)) {
    return fixtureFetch(input, ...args);
  }
  throw new Error("ASK_CHEF_RELEASE_EXTERNAL_IO_BLOCKED: provide an explicit fetch fixture");
};
