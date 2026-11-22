import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "client/src/components/InspirationCaptureModal.tsx"),
  "utf8",
);

describe("Recipe Maker capture layout contract", () => {
  it("puts the existing tutorial before the title and trash row in Development only", () => {
    const topHelp = source.indexOf('data-testid="recipe-maker-top-help"');
    const header = source.indexOf('<DialogHeader className="mb-5 shrink-0">');
    expect(topHelp).toBeGreaterThan(0);
    expect(topHelp).toBeLessThan(header);
    expect(source.slice(topHelp, header)).toContain('featureKey="recipeMaker"');
    expect(source.slice(topHelp - 150, topHelp)).toContain(
      'isDevelopmentRuntime && !isSmartScan && profileType === "human"',
    );
    expect(source).toContain('!isDevelopmentRuntime && !isSmartScan && profileType === "human"');
  });

  it("uses three mobile columns with wrapping labels and matching button heights", () => {
    expect(source).toContain("grid grid-cols-3 gap-2");
    expect(source).toContain("[&_button]:h-8");
    expect(source).toContain("[&_button]:px-1");
    expect(source).toContain("[&_button]:whitespace-normal");
    expect(source).toContain("[&_button]:leading-tight");
    expect(source).toContain("env(safe-area-inset-top, 0px)");
    expect(source).toContain("max-h-[90vh] overflow-y-auto");
  });

  it("adds a disabled pill without a click handler or a new input mode", () => {
    const placeholder = source.match(/<PillButton\s+type="button"\s+disabled[\s\S]*?<\/PillButton>/)?.[0];
    expect(placeholder).toContain('data-testid="recipe-maker-from-scratch"');
    expect(placeholder).toContain('foodCopy("From Scratch")');
    expect(placeholder).not.toContain("onClick");
    expect(source).toContain('type InputMode = "camera" | "upload" | "voice" | "text"');
  });

  it("retains photo and camera inputs and their existing change handlers", () => {
    expect(source).toContain('onClick={() => switchMode("upload")}');
    expect(source).toContain('onClick={() => switchMode("camera")}');
    expect(source).toContain('onChange={(e) => { switchMode("upload"); handleUploadCapture(e); }}');
    expect(source).toContain('onChange={(e) => { switchMode("camera"); handleCameraCapture(e); }}');
    expect(source).toContain('capture="environment"');
    expect(source.indexOf('data-testid="recipe-maker-from-scratch"')).toBeLessThan(
      source.indexOf('{mode === "upload" && ('),
    );
  });
});
