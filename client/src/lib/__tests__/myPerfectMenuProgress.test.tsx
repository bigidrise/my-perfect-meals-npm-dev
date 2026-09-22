/** @jest-environment jsdom */

import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import { BouncingDots } from "@/components/ui/bouncing-dots";

describe("My Perfect Menu progress UX", () => {
  it("renders exactly three bouncing dots", () => {
    render(<BouncingDots />);
    expect(screen.getAllByTestId("bouncing-dot")).toHaveLength(3);
  });

  it("uses bouncing dots instead of spinners for restoration and generation", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "client/src/pages/MyPerfectMenu.tsx"),
      "utf8",
    );
    expect(source).toContain("Restoring your");
    expect(source).toContain("Creating 3 new");
    expect(source).toContain("<BouncingDots");
    expect(source).not.toContain("Loader2");
  });

  it("opens a returned category immediately while authoritative restoration runs", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "client/src/pages/MyPerfectMenu.tsx"),
      "utf8",
    );
    expect(source).toContain("useState<IdeaType | null>(() => returnedIdeaType)");
    expect(source).toContain('restorationStatus === "loading"');
  });
});