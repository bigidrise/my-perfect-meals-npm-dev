/** @jest-environment jsdom */
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePersonalAntiInflammatorySupport } from "@/hooks/usePersonalAntiInflammatorySupport";
import { AntiInflammatorySupportControl } from "@/components/profile/AntiInflammatorySupportControl";
const mockAPI = jest.fn();
jest.mock("@/lib/apiRequest", () => ({ apiRequest: (...args: unknown[]) => mockAPI(...args) }));

function Indicator({ actor = "synthetic-a", subject = actor, household }: {
  actor?: string; subject?: string; household?: string;
}) {
  const support = usePersonalAntiInflammatorySupport({
    actorUserId: actor, subjectUserId: subject, householdProfileId: household,
  });
  return <output data-testid="indicator">{support.enabled ? "Optional support On" : support.available ? "Optional support Off" : "Unverified"}</output>;
}
function wrap(children: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}
beforeEach(() => mockAPI.mockReset());
afterEach(cleanup);
test.each(["General Nutrition", "Diabetic", "GLP-1"])("%s reads the profile opt-in immediately on activation and deactivation", async () => {
  let active = false;
  mockAPI.mockImplementation(async (_path, options) => {
    if (options?.method === "PUT") active = JSON.parse(options.body).enabled;
    return { enabled: active, legacyPreferenceSaved: active };
  });
  wrap(<><AntiInflammatorySupportControl userId="synthetic-a" /><Indicator /></>);
  await waitFor(() => expect(screen.getByTestId("indicator").textContent).toBe("Optional support Off"));
  fireEvent.click(await screen.findByRole("button", { name: "Enable Anti-Inflammatory support" }));
  await waitFor(() => expect(screen.getByTestId("indicator").textContent).toBe("Optional support On"));
  const off = await screen.findByRole("button", { name: "Turn off Anti-Inflammatory support" });
  await waitFor(() => expect(off.hasAttribute("disabled")).toBe(false));
  fireEvent.click(off);
  await waitFor(() => expect(screen.getByTestId("indicator").textContent).toBe("Optional support Off"));
  expect(mockAPI.mock.calls.filter(([, o]) => o?.method === "PUT").map(([, o]) => JSON.parse(o.body)))
    .toEqual([{ enabled: true }, { enabled: false }]);
});
test.each([
  { subject: "different-client" }, { household: "household-child" },
])("never attributes the actor's support to a different subject: %p", async props => {
  wrap(<Indicator {...props} />);
  expect(screen.getByTestId("indicator").textContent).toBe("Unverified");
  expect(mockAPI).not.toHaveBeenCalled();
});
test("late account A responses do not illuminate account B", async () => {
  let complete!: (value: unknown) => void;
  mockAPI.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }))
    .mockResolvedValue({ enabled: false, legacyPreferenceSaved: false });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = render(<QueryClientProvider client={client}><Indicator /></QueryClientProvider>);
  view.rerender(<QueryClientProvider client={client}><Indicator actor="synthetic-b" /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByTestId("indicator").textContent).toBe("Optional support Off"));
  await act(async () => complete({ enabled: true }));
  expect(screen.getByTestId("indicator").textContent).toBe("Optional support Off");
});
test("a failed resolver is unverified, not a successful activation", async () => {
  mockAPI.mockRejectedValue(new Error("unavailable"));
  wrap(<Indicator />);
  await waitFor(() => expect(mockAPI).toHaveBeenCalled());
  expect(screen.getByTestId("indicator").textContent).toBe("Unverified");
});
test.each([
  "pro/GeneralNutritionBuilder.tsx", "physician/DiabeticMenuBuilder.tsx", "physician/GLP1MealBuilder.tsx",
])("%s keeps optional support distinct and consumes the resolved state", file => {
  const source = fs.readFileSync(path.resolve("client/src/pages", file), "utf8");
  expect(source).toContain("usePersonalAntiInflammatorySupport({");
  expect(source).toContain("actorUserId: user?.id, subjectUserId: effectiveUserId, householdProfileId");
  expect(source).toMatch(/isActive: personalAntiSupport.enabled \|\|/);
  expect(source).toContain("not a clinical diagnosis");
  expect(source).toContain("(optional)");
});
test.each(["pro/GeneralNutritionBuilder.tsx", "physician/GLP1MealBuilder.tsx"])(
  "%s supplies only Development personal image-recovery context to all three card paths", file => {
    const source = fs.readFileSync(path.resolve("client/src/pages", file), "utf8");
    expect(source.match(/imageRecoveryWeekStartISO=\{import\.meta\.env\.DEV && !proClientId && !householdProfileId \? weekStartISO : undefined\}/g)).toHaveLength(3);
    const card = fs.readFileSync(path.resolve("client/src/components/MealCard.tsx"), "utf8");
    expect(card).toContain("const imageRecoveryWeek = imageRecoveryWeekStartISO ?? weekStartISO");
    expect(card).toContain("weekStartISO: imageRecoveryWeek");
    expect(card).toContain('{weekStartISO && ISO_DATE_RE.test(date) && meal.id &&');
  },
);
