"use strict";
// Reusable offline Shopping test boundary. Run Jest in-band with sanitized env.
const deny = () => {
  throw new Error("Offline Shopping regression attempted an unexpected network connection");
};
require("node:net").Socket.prototype.connect = deny;
require("node:tls").connect = deny;
globalThis.fetch = async () => deny();
