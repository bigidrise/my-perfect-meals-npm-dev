import fs from "fs";
import path from "path";

describe("My Perfect Menu definitive authentication UX", () => {
  const helper = fs.readFileSync(
    path.join(process.cwd(), "client/src/lib/authRequired.ts"),
    "utf8",
  );

  it.each([
    "AUTH_REQUIRED",
    "SESSION_IDLE_TIMEOUT",
    "AUTH_REAUTHENTICATION_REQUIRED",
  ])("recognizes %s as a definitive sign-in requirement", (code) => {
    expect(helper).toContain(`code === "${code}"`);
  });

  it("does not treat permission failures as session expiration", () => {
    expect(helper).not.toContain('status !== 403');
    expect(helper).not.toContain('code === "FORBIDDEN"');
  });
});