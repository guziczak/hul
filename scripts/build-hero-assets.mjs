import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const imagesDirectory = path.join(projectRoot, "public", "images");
const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const page = await browser.newPage();

async function encode(sourceName, outputName, width, height, type, quality) {
  const source = await readFile(path.join(imagesDirectory, sourceName));
  const sourceUrl = `data:image/jpeg;base64,${source.toString("base64")}`;
  const encoded = await page.evaluate(async ({ sourceUrl, width, height, type, quality }) => {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d", { alpha: false }).drawImage(image, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  }, { sourceUrl, width, height, type, quality });

  await writeFile(path.join(imagesDirectory, outputName), Buffer.from(encoded, "base64"));
}

for (const [width, height] of [[480, 720], [768, 1152], [1280, 1920]]) {
  await encode("hero-mobile.jpg", `hero-mobile-${width}.webp`, width, height, "image/webp", 0.86);
}
await encode("hero-mobile.jpg", "hero-mobile-1280.jpg", 1280, 1920, "image/jpeg", 0.88);
await encode("hero-mobile.jpg", "hero-mobile-placeholder.webp", 32, 48, "image/webp", 0.48);

for (const [width, height] of [[960, 640], [1440, 960], [1920, 1280]]) {
  await encode("hero-desktop.jpg", `hero-desktop-${width}.webp`, width, height, "image/webp", 0.86);
}
await encode("hero-desktop.jpg", "hero-desktop-1920.jpg", 1920, 1280, "image/jpeg", 0.88);
await encode("hero-desktop.jpg", "hero-desktop-placeholder.webp", 48, 32, "image/webp", 0.48);

await browser.close();
