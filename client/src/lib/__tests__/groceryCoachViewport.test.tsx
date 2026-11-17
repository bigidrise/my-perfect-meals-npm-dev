/** @jest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { useGroceryCoachViewport } from "@/components/shopping/useGroceryCoachViewport";

test("tracks visual viewport resize and pan; removes listeners on close", () => {
  const visual = new EventTarget() as EventTarget & {height:number; offsetTop:number};
  visual.height = 568;
  visual.offsetTop = 0;
  Object.defineProperty(window, "visualViewport", {configurable:true, value:visual});
  const scroll = jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  const {result, rerender, unmount} = renderHook(({open}) => useGroceryCoachViewport(open), {initialProps:{open:true}});
  expect(result.current).toEqual({height:568,top:0});
  act(() => {visual.height = 300; visual.offsetTop = 24; visual.dispatchEvent(new Event("resize"));});
  expect(result.current).toEqual({height:300,top:24});
  act(() => {visual.offsetTop = 36; visual.dispatchEvent(new Event("scroll"));});
  expect(result.current?.top).toBe(36);
  rerender({open:false});
  act(() => {visual.height = 568; visual.dispatchEvent(new Event("resize"));});
  expect(result.current?.height).toBe(300);
  unmount();
  scroll.mockRestore();
  Object.defineProperty(window, "visualViewport", {configurable:true, value:undefined});
});

test("locks the background only while open and restores exact styles and scroll", () => {
  const scroll = jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(window, "scrollY", {configurable:true, value:240});
  document.body.style.position = "relative";
  document.body.style.width = "95%";
  document.body.style.top = "3px";
  document.body.style.overflow = "auto";
  const {rerender, unmount} = renderHook(({open}) => useGroceryCoachViewport(open), {initialProps:{open:false}});
  expect(document.body.style.position).toBe("relative");
  rerender({open:true});
  expect(document.body.style.position).toBe("fixed");
  expect(document.body.style.top).toBe("-240px");
  rerender({open:false});
  expect(document.body.style.position).toBe("relative");
  expect(document.body.style.width).toBe("95%");
  expect(document.body.style.top).toBe("3px");
  expect(document.body.style.overflow).toBe("auto");
  expect(scroll).toHaveBeenLastCalledWith(0,240);
  rerender({open:true});
  unmount();
  expect(document.body.style.position).toBe("relative");
  document.body.removeAttribute("style");
  Object.defineProperty(window, "scrollY", {configurable:true, value:0});
  scroll.mockRestore();
});
