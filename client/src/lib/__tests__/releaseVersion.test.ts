import {
  acknowledgeRelease,
  isManifestVersionNewer,
  isReleaseAcknowledged,
  releaseDismissKey,
} from "@/lib/releaseVersion";

describe("release version ordering", () => {
  it("rejects the same version", () => {
    expect(isManifestVersionNewer("100", "100")).toBe(false);
  });

  it("accepts only a newer manifest", () => {
    expect(isManifestVersionNewer("100", "101")).toBe(true);
    expect(isManifestVersionNewer("101", "100")).toBe(false);
  });

  it.each([null, undefined, "", "unknown", "99x"])(
    "fails closed for malformed or missing manifest version %p",
    version => {
      expect(isManifestVersionNewer("100", version)).toBe(false);
    },
  );

  it("fails closed for development or malformed running versions", () => {
    expect(isManifestVersionNewer("dev", "101")).toBe(false);
    expect(isManifestVersionNewer("bad", "101")).toBe(false);
  });
});

describe("release acknowledgement", () => {
  beforeAll(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, String(value)),
      },
    });
  });

  beforeEach(() => localStorage.clear());

  it("requires an actual release ID", () => {
    expect(releaseDismissKey("")).toBeNull();
    expect(acknowledgeRelease("")).toBe(false);
  });

  it("persists acknowledgement for the intended release only", () => {
    expect(acknowledgeRelease("release-1")).toBe(true);
    expect(isReleaseAcknowledged("release-1")).toBe(true);
    expect(isReleaseAcknowledged("release-2")).toBe(false);
  });
});