test.each(["list", "preference"])("a rejected over-limit %s edit does not strand a pending response", kind => {
  const { result } = renderHook(() => useSyntheticAdvisor());
  act(() => result.current.send("Show a sample pairing"));
  act(() => {
    if (kind === "list") result.current.replaceList(Array.from({ length: 101 }, (_, i) => `Synthetic ${i}`).join("\n"));
    else result.current.edit("meal", "x".repeat(501));
  });
  expect(result.current.state.status).toBe("waiting");
  expect(jest.getTimerCount()).toBe(1);
  act(() => jest.advanceTimersByTime(700));
  expect(result.current.state.status).toBe("ready");
  expect(result.current.state.messages.filter(message => message.role === "assistant")).toHaveLength(1);
});
import { act, renderHook } from "@testing-library/react";
import { useSyntheticAdvisor } from "../src/pairing-advisor/useSyntheticAdvisor";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("waiting buffers the complete response and rejects duplicate sends", () => {
  const { result } = renderHook(() => useSyntheticAdvisor());
  act(() => { result.current.setDraft("Show a sample pairing"); result.current.send(); result.current.send("duplicate"); });
  expect(result.current.state.status).toBe("waiting");
  expect(result.current.state.messages).toHaveLength(1);
  act(() => jest.advanceTimersByTime(699));
  expect(result.current.state.messages).toHaveLength(1);
  act(() => jest.advanceTimersByTime(1));
  expect(result.current.state.messages).toHaveLength(2);
});
test("stopping never displays a partial or late response", () => {
  const { result } = renderHook(() => useSyntheticAdvisor());
  act(() => result.current.send("Show a sample pairing"));
  act(() => result.current.stop());
  act(() => jest.advanceTimersByTime(1000));
  expect(result.current.state.status).toBe("stopped");
  expect(result.current.state.messages).toHaveLength(1);
});
test("interruption retains context and explicit retry does not duplicate the question", () => {
  const { result } = renderHook(() => useSyntheticAdvisor());
  act(() => { result.current.edit("meal", "Synthetic salmon"); result.current.setScenario("interrupted"); });
  act(() => result.current.send("Why?"));
  act(() => jest.advanceTimersByTime(700));
  expect(result.current.state.status).toBe("interrupted");
  act(() => result.current.setScenario("education"));
  act(() => result.current.retry());
  act(() => jest.advanceTimersByTime(700));
  expect(result.current.state.messages.filter(message => message.role === "user")).toHaveLength(1);
  expect(result.current.state.context.meal?.value).toBe("Synthetic salmon");
  expect(result.current.state.messages.filter(message => message.role === "assistant")).toHaveLength(1);
});
test.each(["reset", "changeIdentity"] as const)("%s clears pending work and prevents late replies", action => {
  const { result } = renderHook(() => useSyntheticAdvisor());
  act(() => result.current.send("Question"));
  act(() => result.current[action]());
  act(() => jest.advanceTimersByTime(1000));
  expect(result.current.state.messages).toHaveLength(0);
  expect(result.current.state.active).toBeNull();
});
test("editing context invalidates waiting work but preserves an unsent draft", () => {
  const { result } = renderHook(() => useSyntheticAdvisor());
  act(() => result.current.send("Question"));
  act(() => { result.current.setDraft("My next question"); result.current.edit("sauce", "User-described sauce"); });
  act(() => jest.advanceTimersByTime(1000));
  expect(result.current.state.draft).toBe("My next question");
  expect(result.current.state.messages.filter(message => message.role === "assistant")).toHaveLength(0);
});
test("invalid complete fixture fails closed without a recommendation", () => {
  const { result } = renderHook(() => useSyntheticAdvisor());
  act(() => result.current.setScenario("invalid"));
  act(() => result.current.send("Question"));
  act(() => jest.advanceTimersByTime(700));
  expect(result.current.state.status).toBe("unavailable");
  expect(result.current.state.messages.filter(message => message.role === "assistant")).toHaveLength(0);
});
test("unmount clears scheduled work", () => {
  const { result, unmount } = renderHook(() => useSyntheticAdvisor());
  act(() => result.current.send("Question"));
  expect(jest.getTimerCount()).toBe(1);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});
