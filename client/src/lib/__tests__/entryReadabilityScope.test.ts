/** @jest-environment node */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { transformSync } from "esbuild";
import postcss from "postcss";

const styles = path.join(process.cwd(), "client/src/styles");

test.each([true, false])("the readability gate is opt-in only in Development (%s)", (development) => {
  const source = readFileSync(path.join(styles, "entryReadabilityGate.ts"), "utf8");
  const { code } = transformSync(source, {
    loader: "ts", format: "cjs", define: { "import.meta.env.DEV": String(development) },
  });
  const module = { exports: {} as { entryReadabilityClassName?: string } };
  vm.runInNewContext(code, { module, exports: module.exports });
  expect(module.exports.entryReadabilityClassName).toBe(development ? "mpm-entry-readable" : "");
});

test("every readability rule stays inside the opted-in entry-page scope", () => {
  const css = postcss.parse(readFileSync(path.join(styles, "entry-readability.css"), "utf8"));
  let count = 0;
  css.walkRules((rule) => {
    // postcss splits selectors safely, including comma-separated :is/:where arguments.
    for (const selector of rule.selectors) expect(selector.startsWith(".mpm-entry-readable")).toBe(true);
    count++;
  });
  expect(count).toBeGreaterThan(5);
});

function contrast(foreground: number[], background: number[], alpha = 1) {
  const luminance = (rgb: number[]) => rgb.map((channel) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
  const painted = foreground.map((channel, i) => channel * alpha + background[i] * (1 - alpha));
  const a = luminance(painted), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("updated supporting-copy and placeholder colors meet AA on the dark entry panels", () => {
  const css = postcss.parse(readFileSync(path.join(styles, "entry-readability.css"), "utf8"));
  const colors: Record<string, string> = {};
  css.walkRules((rule) => {
    rule.walkDecls("color", (decl) => { colors[rule.selector] = decl.value; });
  });
  const copyColor = colors['.mpm-entry-readable [class*="text-white/"]:not(button):not(button *)'];
  const placeholderColor = colors[".mpm-entry-readable :is(input, textarea)::placeholder"];
  const parse = (value: string) => value.match(/[\d.]+/g)!.map(Number);
  for (const color of [copyColor, placeholderColor]) {
    const [r, g, b, alpha] = parse(color);
    // #545454 conservatively bounds the entry dark panels and a white/10
    // input over neutral-700; browser fixtures separately check actual paints.
    for (const gray of [0, 48, 64, 84]) {
      expect(contrast([r, g, b], [gray, gray, gray], alpha)).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("the welcome orange gradient's brightest midpoint remains AA-safe for white text", () => {
  const css = readFileSync(path.join(styles, "entry-readability.css"), "utf8");
  expect(css).toContain("linear-gradient(to right, #000, #c2410c, #000)");
  expect(contrast([255, 255, 255], [0xc2, 0x41, 0x0c])).toBeGreaterThanOrEqual(4.5);
});
