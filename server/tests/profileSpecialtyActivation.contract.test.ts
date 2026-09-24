import fs from "fs";
import path from "path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");

describe("Phase 2B profile specialty activation persistence", () => {
  const routes = read("routes.ts");
  const pregnancyRoutes = read("routes/pregnancyCoach.ts");
  const editProfile = fs.readFileSync(
    path.resolve(__dirname, "../../client/src/pages/profile/EditProfilePage.tsx"),
    "utf8"
  );
  const pregnancyModal = fs.readFileSync(
    path.resolve(__dirname, "../../client/src/components/PregnancySupportSetupModal.tsx"),
    "utf8"
  );

  it("accepts pregnancy support through the self-selected specialty route", () => {
    expect(routes).toMatch(/ALLOWED\s*=\s*\[[^\]]*"pregnancy-support"/);
    expect(routes).toMatch(/getPhysicianLockStatus\(userId\)/);
    expect(routes).toMatch(/getLabDrivenConditions\(userId\)/);
  });

  it("keeps pregnancy setup active and preserves unrelated conditions", () => {
    const setupPost = pregnancyRoutes.slice(
      pregnancyRoutes.indexOf('router.post("/setup"'),
      pregnancyRoutes.indexOf('router.delete("/setup"')
    );
    expect(setupPost).toMatch(/new Set\(\[\.\.\.currentConditions,\s*"pregnancy-support"\]\)/);
    expect(setupPost).not.toMatch(/filter\([\s\S]*pregnancy-support/);
    expect(setupPost).toMatch(/getPhysicianLockStatus\(userId\)/);
  });

  it("turns pregnancy support off without removing other specialties", () => {
    const setupDelete = pregnancyRoutes.slice(pregnancyRoutes.indexOf('router.delete("/setup"'));
    expect(setupDelete).toMatch(/filter\(\s*c\s*=>\s*c\s*!==\s*"pregnancy-support"/);
    expect(setupDelete).toMatch(/getPhysicianLockStatus\(userId\)/);
  });

  it("does not claim pregnancy setup succeeded when its route rejects", () => {
    expect(pregnancyModal).toMatch(/setSaved\(true\)/);
    expect(pregnancyModal).toMatch(/catch \(err\)[\s\S]*setError/);
    expect(pregnancyModal).toMatch(/role="alert"/);
  });

  it("surfaces rejected Alpha-gal writes and requires a complete profile for activation", () => {
    expect(editProfile).toMatch(/if \(!alphaRes\.ok\)/);
    expect(editProfile).toMatch(/Failed to save Alpha-gal profile details/);
    expect(editProfile).toMatch(/Complete your Alpha-gal profile details before activating/);
    expect(routes).toMatch(/getPhysicianLockStatus\(userId\)[\s\S]*Your clinical profile is controlled by your physician/);
  });

  it("does not assume a pregnancy stage until the user selects one", () => {
    expect(pregnancyModal).toMatch(/useState<Stage \| null>\(null\)/);
    expect(pregnancyModal).toMatch(/if \(!stage\) return/);
  });
});