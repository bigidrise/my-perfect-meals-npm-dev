import fs from "fs";
import path from "path";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/components/shopping/SavedGroceriesSheet.tsx"),
  "utf8",
);

describe("SavedGroceriesSheet item layout", () => {
  it("keeps product information separate from wrapping item actions", () => {
    expect(source).toContain('gridTemplateColumns: "auto minmax(0, 1fr)"');
    expect(source).toContain('gridColumn: "1 / -1"');
    expect(source).toContain('flexWrap: "wrap"');
  });

  it("allows long grocery names to wrap without covering controls", () => {
    expect(source).toContain('overflowWrap: "anywhere"');
  });

  it("labels the icon-only remove action", () => {
    expect(source).toContain('aria-label={`Remove ${itemDisplayName(item)} from saved groceries`}');
  });
});