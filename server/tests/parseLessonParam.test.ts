/**
 * Unit tests for parseLessonParam()
 *
 * Covers every edge-case that can arrive via a deep link:
 *   - missing ?lesson param
 *   - non-numeric string
 *   - negative number
 *   - out-of-range number (when totalLessons is known)
 *   - valid in-range number
 *
 * All invalid inputs must silently return null; a valid in-range input must
 * return the exact integer so the dashboard can scroll to the right lesson.
 */

import { parseLessonParam } from "@/lib/parseLessonParam";

describe("parseLessonParam", () => {
  describe("missing param", () => {
    it("returns null when the query string is empty", () => {
      expect(parseLessonParam("")).toBeNull();
    });

    it("returns null when there is no lesson key at all", () => {
      expect(parseLessonParam("?other=value")).toBeNull();
    });

    it("returns null when lesson has no value (?lesson=)", () => {
      expect(parseLessonParam("?lesson=")).toBeNull();
    });
  });

  describe("non-numeric string", () => {
    it("returns null for an alphabetic value (?lesson=abc)", () => {
      expect(parseLessonParam("?lesson=abc")).toBeNull();
    });

    it("returns null for a mixed alphanumeric value (?lesson=2abc)", () => {
      expect(parseLessonParam("?lesson=2abc")).toBeNull();
    });

    it("returns null for a float string (?lesson=2.5)", () => {
      expect(parseLessonParam("?lesson=2.5")).toBeNull();
    });

    it("returns null for a special character (?lesson=!)", () => {
      expect(parseLessonParam("?lesson=!")).toBeNull();
    });
  });

  describe("negative number", () => {
    it("returns null for ?lesson=-1", () => {
      expect(parseLessonParam("?lesson=-1")).toBeNull();
    });

    it("returns null for ?lesson=-100", () => {
      expect(parseLessonParam("?lesson=-100")).toBeNull();
    });

    it("returns null for ?lesson=0 (zero is not a valid 1-based index)", () => {
      expect(parseLessonParam("?lesson=0")).toBeNull();
    });
  });

  describe("out-of-range number", () => {
    it("returns null when lesson exceeds totalLessons (?lesson=99, total=5)", () => {
      expect(parseLessonParam("?lesson=99", 5)).toBeNull();
    });

    it("returns null when lesson equals totalLessons + 1 (off-by-one boundary)", () => {
      expect(parseLessonParam("?lesson=6", 5)).toBeNull();
    });

    it("returns null for a deep-link with no matching lesson in a realistic course (10 modules)", () => {
      expect(parseLessonParam("?lesson=99", 10)).toBeNull();
    });
  });

  describe("valid in-range number", () => {
    it("returns 1 for the first lesson", () => {
      expect(parseLessonParam("?lesson=1")).toBe(1);
    });

    it("returns the correct integer for a mid-range lesson", () => {
      expect(parseLessonParam("?lesson=3", 5)).toBe(3);
    });

    it("returns the correct integer at the last valid lesson (boundary)", () => {
      expect(parseLessonParam("?lesson=5", 5)).toBe(5);
    });

    it("ignores unrelated query params and still parses lesson correctly", () => {
      expect(parseLessonParam("?tab=overview&lesson=2&ref=email", 10)).toBe(2);
    });
  });
});
