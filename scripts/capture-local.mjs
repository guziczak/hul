import { chromium } from "playwright-core";
import os from "node:os";
import path from "node:path";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});

async function capture(width, height, positions, prefix) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  for (const y of positions) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(os.tmpdir(), `${prefix}-${y}.png`) });
  }
  return page;
}

const desktop = await capture(1440, 900, [0, 800, 1850, 2350, 3200, 4100, 4950, 5500], "hul-local-desktop-scroll");
await desktop.close();

const mobile = await capture(390, 844, [0, 750, 1800, 2300, 3000, 4100, 5200, 6000, 6600], "hul-local-mobile-scroll");
await mobile.evaluate(() => window.scrollTo(0, 0));
await mobile.locator(".menu-toggle").click();
await mobile.waitForTimeout(500);
await mobile.screenshot({ path: path.join(os.tmpdir(), "hul-local-mobile-menu.png") });
await mobile.close();

await browser.close();
