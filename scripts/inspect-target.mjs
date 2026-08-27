import { chromium } from "playwright-core";
import os from "node:os";
import path from "node:path";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});

const targetUrl = process.argv[2] || "https://cuddly-result-708677.framer.app/";
const outputName = process.argv[3] || "hul-target-revealed-desktop.png";

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(targetUrl, { waitUntil: "networkidle" });

const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < pageHeight; y += 500) {
  await page.evaluate((scrollY) => window.scrollTo({ top: scrollY }), y);
  await page.waitForTimeout(160);
}
await page.evaluate(() => window.scrollTo({ top: 0 }));
await page.waitForTimeout(500);

const sections = await page.locator("header, main > section, footer, section").evaluateAll((nodes) =>
  nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      tag: node.tagName.toLowerCase(),
      name: node.getAttribute("data-framer-name"),
      className: node.className,
      x: Math.round(rect.x),
      y: Math.round(rect.y + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      background: style.backgroundColor,
      text: node.innerText.replace(/\s+/g, " ").slice(0, 180),
    };
  }),
);

const textSamples = await page.locator("h1,h2,h3,h4,h5,p,a,button").evaluateAll((nodes) =>
  nodes
    .filter((node) => node.textContent.trim())
    .slice(0, 160)
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        tag: node.tagName.toLowerCase(),
        text: node.textContent.trim().replace(/\s+/g, " ").slice(0, 90),
        x: Math.round(rect.x),
        y: Math.round(rect.y + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        font: style.fontFamily,
        size: style.fontSize,
        weight: style.fontWeight,
        lineHeight: style.lineHeight,
        color: style.color,
      };
    }),
);

const images = await page.locator("img").evaluateAll((nodes) =>
  nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      alt: node.alt,
      src: node.currentSrc,
      x: Math.round(rect.x),
      y: Math.round(rect.y + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      fit: style.objectFit,
      position: style.objectPosition,
      opacity: style.opacity,
    };
  }),
);

await page.screenshot({
  path: path.join(os.tmpdir(), outputName),
  fullPage: true,
});

console.log(JSON.stringify({ pageHeight, sections, textSamples, images }, null, 2));
await browser.close();
