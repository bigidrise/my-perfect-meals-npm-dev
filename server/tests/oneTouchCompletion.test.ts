import type { OneTouchDirection } from "@shared/oneTouch";
import { completeOneTouchMeals } from "../services/oneTouch/completion";

const direction = (title: string) => ({ title } as OneTouchDirection);

describe("One-Touch completed-meal queue", () => {
  it("retains one completed meal and asks for exactly two replacements", async () => {
    const requests: number[] = [];
    const completed = await completeOneTouchMeals({
      directions: [direction("A"), direction("B"), direction("C")],
      generateDirections: async ({ requestedCount }) => {
        requests.push(requestedCount);
        return [direction("D"), direction("E")];
      },
      canonicalAccept: async ({ title }) => ({ accepted: ["A", "D", "E"].includes(title), value: title }),
    });
    expect(requests).toEqual([2]);
    expect(completed.accepted.map(({ value }) => value)).toEqual(["A", "D", "E"]);
    expect(completed.attemptsCompleted).toBe(5);
  });

  it("retains two completed meals and asks for exactly one replacement", async () => {
    const requests: number[] = [];
    const completed = await completeOneTouchMeals({
      directions: [direction("A"), direction("B"), direction("C")],
      generateDirections: async ({ requestedCount }) => {
        requests.push(requestedCount);
        return [direction("D")];
      },
      canonicalAccept: async ({ title }) => ({ accepted: title !== "C", value: title }),
    });
    expect(requests).toEqual([1]);
    expect(completed.accepted.map(({ value }) => value)).toEqual(["A", "B", "D"]);
  });

  it("never returns a partial result and stops at five canonical attempts", async () => {
    let calls = 0;
    await expect(completeOneTouchMeals({
      directions: [direction("A"), direction("B"), direction("C")],
      generateDirections: async () => [direction("D"), direction("E")],
      canonicalAccept: async () => { calls++; return { accepted: false, failureClass: "authority" as const }; },
    })).rejects.toMatchObject({
      code: "ONE_TOUCH_AUTHORITY_COMPLETION_FAILED",
      attemptsCompleted: 5,
      missingCount: 3,
    });
    expect(calls).toBe(5);
  });

  it("stops immediately when canonical authority is unresolved", async () => {
    let calls = 0;
    await expect(completeOneTouchMeals({
      directions: [direction("A"), direction("B"), direction("C")],
      generateDirections: async () => [direction("D")],
      canonicalAccept: async () => {
        calls++;
        throw Object.assign(new Error("Context unresolved"), { oneTouchStop: true, status: 409 });
      },
    })).rejects.toMatchObject({ status: 409 });
    expect(calls).toBe(1);
  });
});