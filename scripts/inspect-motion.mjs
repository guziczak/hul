import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});

async function ancestorState(locator) {
  return locator.evaluate((node) => {
    const result = [];
    let current = node;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
      const style = getComputedStyle(current);
      const rect = current.getBoundingClientRect();
      result.push({
        depth,
        tag: current.tagName,
        className: current.className,
        name: current.getAttribute("data-framer-name"),
        inline: current.getAttribute("style"),
        opacity: style.opacity,
        transform: style.transform,
        transition: style.transition,
        y: Math.round(rect.y + scrollY),
        height: Math.round(rect.height),
      });
    }
    return result;
  });
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("https://cuddly-result-708677.framer.app/", { waitUntil: "networkidle" });

const storiesTitle = page.getByText("Naturalność jest nowym luksusem", { exact: true });
console.log("STORIES BEFORE", JSON.stringify(await ancestorState(storiesTitle), null, 2));
await page.evaluate(() => window.scrollTo(0, 730));
for (const delay of [0, 50, 100, 150, 250, 400, 650, 900]) {
  if (delay) await page.waitForTimeout(delay - ([0, 50, 100, 150, 250, 400, 650, 900][[0, 50, 100, 150, 250, 400, 650, 900].indexOf(delay) - 1] || 0));
  const state = await storiesTitle.evaluate((node) => {
    let current = node;
    while (current && current !== document.body) {
      const computed = getComputedStyle(current);
      if (computed.opacity !== "1" || computed.transform !== "none") {
        return {
          delay: performance.now(),
          opacity: computed.opacity,
          transform: computed.transform,
          inline: current.getAttribute("style"),
          className: current.className,
        };
      }
      current = current.parentElement;
    }
    return null;
  });
  console.log("STORY SAMPLE", delay, state);
}

await page.evaluate(() => window.scrollTo(0, 0));
const button = page.locator("a").filter({ hasText: "Porozmawiajmy" }).first();
const buttonSnapshot = () =>
  button.evaluate((node) => ({
    outer: node.outerHTML.slice(0, 2400),
    descendants: [...node.querySelectorAll("*")].map((child) => {
      const style = getComputedStyle(child);
      const rect = child.getBoundingClientRect();
      return {
        tag: child.tagName,
        text: child.textContent.trim(),
        className: child.className,
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        opacity: style.opacity,
        transform: style.transform,
        transition: style.transition,
      };
    }),
  }));
console.log("BUTTON BEFORE", JSON.stringify(await buttonSnapshot(), null, 2));
await button.hover();
for (const delay of [0, 80, 180, 350]) {
  if (delay) await page.waitForTimeout(delay);
  console.log("BUTTON HOVER", delay, JSON.stringify(await buttonSnapshot(), null, 2));
}

await page.evaluate(() => window.scrollTo(0, 5000));
await page.waitForTimeout(400);
const secondFaq = page.getByText("Czy tworzymy meble z drewna do innych pomieszczeń?", { exact: true });
console.log("FAQ BEFORE", JSON.stringify(await ancestorState(secondFaq), null, 2));
await secondFaq.click();
for (const delay of [0, 80, 180, 350, 650]) {
  if (delay) await page.waitForTimeout(delay);
  console.log("FAQ OPEN", delay, JSON.stringify((await ancestorState(secondFaq)).slice(0, 6), null, 2));
}

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
await mobile.goto("https://cuddly-result-708677.framer.app/", { waitUntil: "networkidle" });
const topNamed = await mobile.locator("[data-framer-name]").evaluateAll((nodes) =>
  nodes
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return { name: node.getAttribute("data-framer-name"), x: rect.x, y: rect.y, w: rect.width, h: rect.height, tag: node.tagName };
    })
    .filter((item) => item.y < 220 && item.w > 0 && item.h > 0),
);
console.log("MOBILE TOP NAMES", JSON.stringify(topNamed, null, 2));

const possibleMenu = mobile.locator('[data-framer-name*="Menu" i]').filter({ visible: true });
console.log("MENU COUNT", await possibleMenu.count());
for (let index = 0; index < (await possibleMenu.count()); index += 1) {
  console.log("MENU ITEM", index, await possibleMenu.nth(index).getAttribute("data-framer-name"));
}

await browser.close();
