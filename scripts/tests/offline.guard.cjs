// Test-process isolation only; never changes application environment or policy.
const deny = () => { throw new Error("RELEASE_OFFLINE: external I/O is forbidden"); };
for (const name of ["http", "https"]) {
  const transport = require(`node:${name}`);
  transport.request = deny;
  transport.get = deny;
}
const net = require("node:net");
net.connect = deny;
net.createConnection = deny;
net.Socket.prototype.connect = deny;
require("node:tls").connect = deny;
const dns = require("node:dns");
for (const api of [dns, dns.promises]) {
  for (const key of Object.keys(api)) {
    if (/^(lookup|resolve|reverse)/.test(key) && typeof api[key] === "function") api[key] = deny;
  }
}
const childProcess = require("node:child_process");
for (const key of ["exec", "execFile", "execSync", "execFileSync", "spawn", "spawnSync", "fork"]) childProcess[key] = deny;
globalThis.fetch = deny;
globalThis.WebSocket = class { constructor() { deny(); } };
