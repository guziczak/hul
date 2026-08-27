import { chromium } from "playwright-core";
import os from "node:os";
import path from "node:path";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});

const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 1,
});
await page.goto("https://cuddly-result-708677.framer.app/", { waitUntil: "networkidle" });

let pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < pageHeight; y += 360) {
  await page.evaluate((scrollY) => window.scrollTo({ top: scrollY }), y);
  await page.waitForTimeout(160);
  pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
}
await page.evaluate(() => window.scrollTo({ top: 0 }));
await page.waitForTimeout(500);

const sections = await page.locator("header, section, footer").evaluateAll((nodes) =>
  nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return {
      tag: node.tagName.toLowerCase(),
      name: node.getAttribute("data-framer-name"),
      x: Math.round(rect.x),
      y: Math.round(rect.y + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      text: node.innerText.replace(/\s+/g, " ").slice(0, 130),
    };
  }),
);

const samples = await page.locator("h1,h2,h3,h4,h5,p").evaluateAll((nodes) =>
  nodes
    .filter((node) => node.textContent.trim() && node.getBoundingClientRect().width > 0)
    .slice(0, 100)
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        tag: node.tagName.toLowerCase(),
        text: node.textContent.trim().replace(/\s+/g, " ").slice(0, 70),
        x: Math.round(rect.x),
        y: Math.round(rect.y + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        size: style.fontSize,
        lineHeight: style.lineHeight,
        font: style.fontFamily,
      };
    }),
);

const images = await page.locator("img").evaluateAll((nodes) =>
  nodes
    .filter((node) => node.getBoundingClientRect().width > 0)
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        alt: node.alt,
        src: node.currentSrc,
        x: Math.round(rect.x),
        y: Math.round(rect.y + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        position: getComputedStyle(node).objectPosition,
      };
    }),
);

await page.screenshot({
  path: path.join(os.tmpdir(), "hul-target-revealed-mobile.png"),
  fullPage: true,
});

console.log(JSON.stringify({ pageHeight, sections, samples, images }, null, 2));
await browser.close();
