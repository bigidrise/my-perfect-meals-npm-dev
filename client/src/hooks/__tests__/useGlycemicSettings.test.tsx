/** @jest-environment jsdom */
import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGlycemicSettings } from "../useGlycemicSettings";

it("keeps the unloaded settings reference stable between renders", () => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender } = renderHook(() => useGlycemicSettings(false), { wrapper });
  const unloaded = result.current.data;
  rerender();
  expect(result.current.data).toBe(unloaded);
});