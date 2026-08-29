import { chromium } from "playwright-core";
import os from "node:os";
import path from "node:path";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const baseUrl = process.argv[2] || "http://127.0.0.1:5173/";

for (const language of ["en", "de"]) {
  for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto(new URL(`${language}/`, baseUrl).href, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.locator("[data-cookie-banner]").waitFor({ state: "visible" });
    await page.waitForTimeout(700);
    const prefix = `hul-${language}-${viewport.name}`;
    const topPath = path.join(os.tmpdir(), `${prefix}-top.png`);
    await page.screenshot({ path: topPath });
    console.log(topPath);
    if (language === "de" && viewport.name === "mobile") {
      console.log(await page.evaluate(() => [...document.querySelectorAll(".header .motion-button, .hero__actions .motion-button")].map((button) => {
        const track = button.querySelector(".motion-button__track");
        const text = track?.querySelector("span");
        return {
          label: button.textContent.trim(),
          buttonWidth: button.getBoundingClientRect().width,
          buttonScrollWidth: button.scrollWidth,
          trackWidth: track?.getBoundingClientRect().width,
          trackScrollWidth: track?.scrollWidth,
          textWidth: text?.getBoundingClientRect().width,
        };
      })));
    }

    await page.locator("[data-consent-reject]").click();
    await page.locator(".experts__grid").scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    const expertsPath = path.join(os.tmpdir(), `${prefix}-experts.png`);
    await page.screenshot({ path: expertsPath });
    console.log(expertsPath);

    await page.locator(".contact-cta").scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    const ctaPath = path.join(os.tmpdir(), `${prefix}-cta.png`);
    await page.screenshot({ path: ctaPath });
    console.log(ctaPath);
    await context.close();
  }
}

await browser.close();
