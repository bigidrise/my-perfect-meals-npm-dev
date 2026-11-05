// Dedicated release verification only; never loaded by an application workflow.
// Replaces Jest's ordinary setup, which unconditionally assigns NODE_ENV=test.
// React's act() needs the development renderer in JSDOM. Preload only that test
// renderer, then load all application modules with Production configuration.
if (typeof document !== "undefined") {
  process.env.NODE_ENV = "test";
  require("react");
  require("react-dom");
  require("react-dom/client");
  require("react-dom/test-utils");
}
process.env.NODE_ENV = "production";
