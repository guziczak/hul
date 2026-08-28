import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});

const baseUrl = "http://127.0.0.1:5173/hul/";

const loadedContext = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
});
const loadedPage = await loadedContext.newPage();
await loadedPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
await loadedPage.waitForFunction(() => document.querySelector(".hero__media")?.classList.contains("is-decoded"));
await loadedPage.waitForTimeout(500);
await loadedPage.screenshot({ path: ".tmp-hero-loaded.png" });
await loadedContext.close();

const stalledContext = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
});
let releaseHero;
const heroGate = new Promise((resolve) => { releaseHero = resolve; });
await stalledContext.route("**/hero-mobile-1280.webp", async (route) => {
  await heroGate;
  await route.continue();
});
const stalledPage = await stalledContext.newPage();
await stalledPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
await stalledPage.waitForTimeout(500);
await stalledPage.screenshot({ path: ".tmp-hero-stalled.png" });
releaseHero();
await stalledContext.close();

await browser.close();
