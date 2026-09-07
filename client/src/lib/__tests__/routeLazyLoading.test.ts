import fs from "node:fs";
import path from "node:path";

const routerSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/components/Router.tsx"),
  "utf8",
);

describe("route-level startup splitting", () => {
  it.each([
    ["SushiCreator", "@/pages/SushiCreator"],
    ["ProClientDashboard", "@/pages/pro/ProClientDashboard"],
    ["DiabeticMenuBuilder", "@/pages/physician/DiabeticMenuBuilder"],
    ["AdminDashboard", "@/pages/AdminDashboard"],
    ["AcademyHome", "@/pages/academy/AcademyHome"],
    ["CompanionNutritionHub", "@/pages/CompanionNutritionHub"],
  ])("loads %s only when its route is requested", (component, modulePath) => {
    expect(routerSource).toContain(
      `const ${component} = lazy(() => import("${modulePath}"));`,
    );
    expect(routerSource).not.toContain(
      `import ${component} from "${modulePath}";`,
    );
  });

  it("keeps route chunks behind a visible loading state", () => {
    expect(routerSource).toContain("<Suspense");
    expect(routerSource).toContain("Loading...");
  });
});