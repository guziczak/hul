import { chromium } from "playwright-core";
import os from "node:os";
import path from "node:path";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const baseUrl = "http://127.0.0.1:5173/";

for (const language of ["pl", "en", "de"]) {
  for (const width of [1200, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem("hul:privacy-consent:v1", JSON.stringify({ version: 1, analytics: false, maps: false }));
    });
    const page = await context.newPage();
    const languagePath = language === "pl" ? "" : `${language}/`;
    await page.goto(new URL(languagePath, baseUrl).href, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(700);

    const fullPath = path.join(os.tmpdir(), `hul-header-${language}-${width}.png`);
    const detailPath = path.join(os.tmpdir(), `hul-header-${language}-${width}-detail.png`);
    await page.screenshot({ path: fullPath });
    await page.screenshot({
      path: detailPath,
      clip: { x: Math.max(0, width - 520), y: 0, width: Math.min(520, width), height: 96 },
    });
    console.log(fullPath);
    console.log(detailPath);
    await context.close();
  }
}

await browser.close();
