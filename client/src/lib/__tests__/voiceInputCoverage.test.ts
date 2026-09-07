import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("voice input coverage", () => {
  it.each([
    "client/src/components/my-perfect-beginning/ParentsCorner.tsx",
    "client/src/pages/MyPerfectPregnancyPage.tsx",
    "client/src/pages/CoachsCorner.tsx",
    "client/src/components/CreateWithChefModal.tsx",
    "client/src/components/SnackCreatorModal.tsx",
    "client/src/components/JustDescribeItModal.tsx",
  ])("uses the shared voice input in %s", (file) => {
    expect(read(file)).toContain("<VoiceInputButton");
  });

  it("does not render the inactive Studio video messaging card", () => {
    const source = read("client/src/pages/More.tsx");
    expect(source).not.toContain('data-testid="card-studio-video-messaging"');
    expect(source).not.toContain('t("studioVideoTitle")');
  });
});