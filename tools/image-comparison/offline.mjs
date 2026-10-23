// No flags can enable networking. stdout contains metadata only, never image bytes.
import { readFileSync } from "node:fs";
import { createOfflineHarness } from "./runner.mjs";
if (process.argv.length !== 2) throw new Error("Offline tool takes no arguments; live execution does not exist");
const manifest = JSON.parse(readFileSync(new URL("./frozen-prompts.json", import.meta.url), "utf8"));
console.log(JSON.stringify(await createOfflineHarness(manifest).run(), null, 2));
