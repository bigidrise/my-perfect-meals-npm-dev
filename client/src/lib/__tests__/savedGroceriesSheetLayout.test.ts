import fs from "fs";
import path from "path";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/components/shopping/SavedGroceriesSheet.tsx"),
  "utf8",
);

describe("SavedGroceriesSheet item layout", () => {
  it("keeps actions alongside a flexible product label without a second action row", () => {
    expect(source).toContain('flex: "1 1 0", minWidth: 0');
    expect(source).not.toContain('gridColumn: "1 / -1"');
    expect(source).not.toContain("Saved analysis\n");
  });

  it("allows long grocery names to wrap without covering controls", () => {
    expect(source).toContain('overflowWrap: "anywhere"');
    expect(source).toContain('className="line-clamp-2"');
  });

  it("labels the icon-only remove action", () => {
    expect(source).toContain('aria-label={`Remove ${itemDisplayName(item)} from saved groceries`}');
  });
});