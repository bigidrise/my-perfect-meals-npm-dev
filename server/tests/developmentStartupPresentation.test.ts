/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { addDevelopmentStartupPresentation } from "../developmentStartupPresentation";
import { renderMarketingPage } from "../marketingPages";

const template = fs.readFileSync(path.resolve(__dirname, "../../client/index.html"), "utf8");
const originalMode = process.env.NODE_ENV;

beforeEach(() => {
  process.env.NODE_ENV = "development";
  document.documentElement.className = "";
});
afterEach(() => {
  window.dispatchEvent(new Event("mpm:startup-failed"));
  document.getElementById("mpm-startup-public")?.click();
  jest.useRealTimers();
  process.env.NODE_ENV = originalMode;
});

function boot(marketing = true, documentReady = true) {
  const html = addDevelopmentStartupPresentation(marketing ? renderMarketingPage(template, "/lifestyle") : template);
  // Installing HTML doesn't execute scripts: this models the no-JS document first.
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)![1];
  document.body.innerHTML = body;
  const source = html.match(/<script data-mpm-startup-bootstrap>([\s\S]*?)<\/script>/)![1];
  const run = new Function(source);
  run();
  if (documentReady) document.dispatchEvent(new Event("DOMContentLoaded"));
  return html;
}

it("preserves crawler-readable marketing HTML, module scripts, and the existing logo", () => {
  const html = addDevelopmentStartupPresentation(renderMarketingPage(template, "/lifestyle"));
  expect(html).toContain("Lifestyle tools for real food decisions");
  expect(html).toContain("data-seo-page");
  expect(html).toContain('src="/src/main.tsx"');
  expect(html).toContain('src="/icons/chef.png?v=2026b"');
  expect(html).toContain('application/ld+json');
  expect(html).toContain("#mpm-development-startup { display: none; }");
  // Loading visibility is opt-in via executable JS, never a permanent no-JS class.
  expect(html).not.toMatch(/<html[^>]*mpm-starting/);
});

it.each(["production", "test"])("does not change %s HTML", mode => {
  process.env.NODE_ENV = mode;
  expect(addDevelopmentStartupPresentation(template)).toBe(template);
});

it("is idempotent and accounts for all four device safe-area insets", () => {
  const html = addDevelopmentStartupPresentation(template);
  expect(addDevelopmentStartupPresentation(html)).toBe(html);
  for (const side of ["top", "bottom", "left", "right"]) {
    expect(html).toContain(`env(safe-area-inset-${side}, 0px)`);
  }
});

it.each([true, false])("shows loading before React, then clears on its first committed render (marketing=%s)", marketing => {
  boot(marketing);
  expect(document.documentElement.classList.contains("mpm-starting")).toBe(true);
  document.getElementById("root")!.innerHTML = "<div>Application rendered</div>";
  window.dispatchEvent(new Event("mpm:app-mounted"));
  expect(document.getElementById("mpm-development-startup")).toBeNull();
  expect(document.documentElement.classList.contains("mpm-starting")).toBe(false);
});

it("turns explicit bootstrap failure into actionable feedback and can reveal public content", () => {
  boot();
  window.dispatchEvent(new Event("mpm:startup-failed"));
  expect(document.documentElement.classList.contains("mpm-startup-error")).toBe(true);
  expect(document.getElementById("mpm-startup-message")!.textContent).toContain("could not finish starting");
  document.getElementById("mpm-startup-public")!.click();
  expect(document.getElementById("mpm-development-startup")).toBeNull();
  expect(document.querySelector("[data-seo-page]")!.textContent).toContain("Lifestyle tools for real food decisions");
});

it("exposes module load errors instead of leaving a loading splash", () => {
  boot();
  const module = document.createElement("script");
  module.type = "module";
  document.body.appendChild(module);
  module.dispatchEvent(new Event("error"));
  expect(document.documentElement.classList.contains("mpm-startup-error")).toBe(true);
});

it("keeps recovery buttons usable even while an entry module holds DOMContentLoaded", () => {
  jest.useFakeTimers();
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  boot(true, false);
  jest.advanceTimersByTime(30000);
  expect(document.documentElement.classList.contains("mpm-startup-error")).toBe(true);
  document.getElementById("mpm-startup-public")!.click();
  expect(document.getElementById("mpm-development-startup")).toBeNull();
  expect(document.documentElement.classList.contains("mpm-startup-error")).toBe(false);
  document.dispatchEvent(new Event("DOMContentLoaded")); // A late lifecycle event cannot restore the overlay.
  expect(document.getElementById("mpm-development-startup")).toBeNull();
  error.mockRestore();
});

it("ends stalled loading after the bounded watchdog without adding a minimum display time", () => {
  jest.useFakeTimers();
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  boot();
  jest.advanceTimersByTime(30000);
  expect(document.documentElement.classList.contains("mpm-starting")).toBe(false);
  expect(document.documentElement.classList.contains("mpm-startup-error")).toBe(true);
  expect(error).toHaveBeenCalledWith(expect.stringContaining("timed out"));
  error.mockRestore();
});
