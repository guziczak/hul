import { chromium } from "playwright-core";
import path from "node:path";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport });
  await page.goto("http://127.0.0.1:5173/hul/", { waitUntil: "networkidle" });
  await page.evaluate(() => scrollTo(0, 2000));
  await page.waitForTimeout(520);
  await page.screenshot({ path: path.join(process.env.TEMP, `hul-cookie-${viewport.width}.png`) });
  await page.close();
}

await browser.close();
