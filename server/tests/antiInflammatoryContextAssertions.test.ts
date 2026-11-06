// The existing context contract is an assertion-based module rather than a Jest
// suite. Execute it under Jest's database mocks, never an application DB import.
jest.mock("../db", () => ({
  pool: { query: jest.fn(() => { throw new Error("Live database unavailable to context assertions"); }) },
  db: {},
}));
test("existing Human Food context, immutable snapshot and request-scope assertions", () => {
  require("./humanFoodContext.contract.test.ts");
});
