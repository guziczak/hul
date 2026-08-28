import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const baseUrl = "http://127.0.0.1:5173/hul/";
const output = process.env.TEMP || ".";

async function dismissBanner(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator("[data-cookie-banner]").waitFor({ state: "visible" });
  await page.locator("[data-consent-reject]").click();
  await page.locator("[data-cookie-banner]").waitFor({ state: "hidden" });
}

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await dismissBanner(desktop);
await desktop.evaluate(() => scrollTo(0, 3200));
await desktop.waitForTimeout(800);
await desktop.locator(".quick-action--phone").hover();
await desktop.screenshot({ path: `${output}\\hul-quick-desktop.png` });
await desktop.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
await desktop.waitForTimeout(800);
await desktop.screenshot({ path: `${output}\\hul-quick-footer.png` });
await desktop.close();

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await dismissBanner(mobile);
await mobile.evaluate(() => scrollTo(0, 3200));
await mobile.waitForTimeout(800);
await mobile.screenshot({ path: `${output}\\hul-quick-mobile.png` });
await mobile.close();

const cookie = await browser.newPage({ viewport: { width: 320, height: 568 } });
await cookie.goto(baseUrl, { waitUntil: "networkidle" });
await cookie.locator("[data-cookie-banner]").waitFor({ state: "visible" });
await cookie.evaluate(() => scrollTo(0, 2200));
await cookie.waitForTimeout(800);
await cookie.screenshot({ path: `${output}\\hul-quick-cookie.png` });
await cookie.close();

await browser.close();
