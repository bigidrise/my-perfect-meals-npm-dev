import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("mobile page scroll ownership", () => {
  test("RootViewport is the sole vertically pannable page scroller", () => {
    const source = read("client/src/layouts/RootViewport.tsx");

    expect(source).toContain('position: "absolute"');
    expect(source).toContain('overflowY: "auto"');
    expect(source).toContain('touchAction: "pan-y"');
    expect(source).toContain('overscrollBehaviorY: "contain"');
    expect(source).not.toContain('height: "100dvh"');
  });

  test("fixed bottom navigation does not block vertical gestures", () => {
    const css = read("client/src/index.css");
    const navRuleStart = css.indexOf('nav[class*="fixed"][class*="bottom-0"]');
    const navRuleEnd = css.indexOf("}", navRuleStart);
    const navRule = css.slice(navRuleStart, navRuleEnd);

    expect(navRuleStart).toBeGreaterThan(-1);
    expect(navRule).toContain("touch-action: pan-y");
    expect(navRule).not.toContain("touch-action: none");
  });

  test("Lifestyle fills and scrolls through RootViewport instead of the window", () => {
    const source = read("client/src/pages/LifestyleLandingPage.tsx");

    expect(source).toContain('scrollToTop("instant")');
    expect(source).toContain('className="min-h-full');
    expect(source).not.toContain('window.scrollTo({ top: 0');
  });
});