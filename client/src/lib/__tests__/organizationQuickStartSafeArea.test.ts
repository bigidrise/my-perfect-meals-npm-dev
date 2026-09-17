import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("Organization Quick Start mobile Safari geometry", () => {
  const quickStartPath = path.join(
    root,
    "client/src/components/business/OrganizationQuickStartModal.tsx",
  );
  const universalDialogPath = path.join(
    root,
    "client/src/components/ui/universal-modal.tsx",
  );
  const dialogPrimitivePath = path.join(
    root,
    "client/src/components/ui/dialog.tsx",
  );

  const quickStart = fs.readFileSync(quickStartPath, "utf8");
  const universalDialog = fs.readFileSync(universalDialogPath, "utf8");
  const dialogPrimitive = fs.readFileSync(dialogPrimitivePath, "utf8");

  it("uses mobile-browser dynamic viewport geometry with both safe-area insets", () => {
    expect(quickStart).toContain("100dvh");
    expect(quickStart).toContain("env(safe-area-inset-top,0px)");
    expect(quickStart).toContain("env(safe-area-inset-bottom,0px)");
    expect(quickStart).toContain("lg:top-[50%]");
    expect(quickStart).toContain("lg:max-h-[90vh]");
  });

  it("leaves the native Capacitor geometry unchanged", () => {
    expect(quickStart).toContain("Capacitor.isNativePlatform()");
    expect(quickStart).toContain(
      'isNative ? "" : MOBILE_SAFARI_DIALOG_GEOMETRY',
    );
  });

  it("keeps the fixed header and footer outside the scrollable body", () => {
    expect(quickStart).toContain('title="Organization Quick Start"');
    expect(quickStart).toContain("footer={");
    expect(quickStart).toContain("Don't open automatically again");
    expect(quickStart).toContain("Close Guide");
    expect(universalDialog).toContain('<DialogHeader className="shrink-0">');
    expect(universalDialog).toContain(
      '"flex-1 overflow-y-auto overscroll-contain min-h-0"',
    );
    expect(universalDialog).toContain("{footer && <ModalFooter>{footer}</ModalFooter>}");
  });

  it("does not move the safe-area repair into the shared dialog system", () => {
    expect(universalDialog).not.toContain("MOBILE_SAFARI_DIALOG_GEOMETRY");
    expect(dialogPrimitive).not.toContain("MOBILE_SAFARI_DIALOG_GEOMETRY");
    expect(dialogPrimitive).toContain(
      "fixed left-[50%] top-[50%]",
    );
  });
});