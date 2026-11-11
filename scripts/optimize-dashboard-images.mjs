import sharp from "sharp";
import { stat } from "node:fs/promises";

// Keep original artwork as the reproducible source; no external image service.
for (const width of [512, 768, 1024]) {
  const output = `client/public/images/dashboard-chef-community-hero-${width}.webp`;
  await sharp("client/public/images/dashboard-chef-community-hero.png")
    .resize(width, width)
    .webp({ quality: 92, effort: 6 })
    .toFile(output);
  console.log(output, (await stat(output)).size);
}
for (const width of [160, 240]) {
  const output = `client/public/assets/ask-chef-desk-${width}.webp`;
  await sharp("client/public/assets/ask-chef-desk.webp")
    .resize(width, width)
    .webp({ quality: 95, effort: 6 })
    .toFile(output);
  console.log(output, (await stat(output)).size);
}
