import { chromium } from "playwright-core";
import path from "node:path";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:5173/hul/", { waitUntil: "networkidle" });

const position = () => page.locator(".header").evaluate((header) => ({
  value: header.style.getPropertyValue("--header-translate"),
  y: Number(header.getBoundingClientRect().y.toFixed(4)),
}));

async function sequence(label, top) {
  await page.evaluate((value) => {
    document.documentElement.style.scrollBehavior = "auto";
    scrollTo(0, value);
    document.documentElement.style.removeProperty("scroll-behavior");
  }, top);
  let elapsed = 0;
  const result = [];
  for (const delay of [0, 16, 40, 80, 120, 300, 600]) {
    await page.waitForTimeout(delay - elapsed);
    elapsed = delay;
    result.push({ delay, ...await position() });
  }
  console.log(label, result);
}

await sequence("DOWN", 300);
await sequence("RETURN", 700);

const cookiePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await cookiePage.goto("http://127.0.0.1:5173/hul/", { waitUntil: "networkidle" });
await cookiePage.locator("[data-cookie-banner]").waitFor({ state: "visible" });
await cookiePage.waitForTimeout(450);
await cookiePage.screenshot({ path: path.join(process.env.TEMP, "hul-oak-cookie.png") });
await cookiePage.close();

const iphonePage = await browser.newPage({ viewport: { width: 430, height: 932 } });
await iphonePage.goto("http://127.0.0.1:5173/hul/", { waitUntil: "networkidle" });
await iphonePage.locator("[data-consent-reject]").click();
await iphonePage.waitForTimeout(450);
console.log("IPHONE", await iphonePage.evaluate(() => ({
  viewport: innerHeight,
  hero: document.querySelector(".hero").getBoundingClientRect().height,
  spacer: document.querySelector(".hero-spacer").getBoundingClientRect().height,
})));
await iphonePage.screenshot({ path: path.join(process.env.TEMP, "hul-iphone-hero.png") });
await iphonePage.close();
await browser.close();
