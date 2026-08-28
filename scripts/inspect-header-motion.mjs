import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("https://cuddly-result-708677.framer.app/", { waitUntil: "networkidle" });

const fixed = await page.evaluate(() => [...document.querySelectorAll("body *")]
  .map((element, index) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      index,
      tag: element.tagName,
      name: element.getAttribute("data-framer-name"),
      id: element.id,
      className: String(element.className).slice(0, 140),
      position: style.position,
      top: style.top,
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      transform: style.transform,
      transition: style.transition,
    };
  })
  .filter((item) => (item.position === "fixed" || item.position === "sticky") && item.width > 700 && item.height > 20 && item.height < 300));

console.log(JSON.stringify(fixed, null, 2));

const selector = ".framer-8zfk6f-container";
const snapshot = () => page.locator(selector).evaluate((element) => {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return {
    time: Math.round(performance.now()),
    scroll: Math.round(scrollY),
    y: Number(rect.y.toFixed(3)),
    transform: style.transform,
    inline: element.getAttribute("style"),
    transitionProperty: style.transitionProperty,
    transitionDuration: style.transitionDuration,
    transitionTiming: style.transitionTimingFunction,
  };
});

async function sample(label, delays) {
  let elapsed = 0;
  const samples = [];
  for (const delay of delays) {
    await page.waitForTimeout(delay - elapsed);
    elapsed = delay;
    samples.push({ delay, ...await snapshot() });
  }
  console.log(label, JSON.stringify(samples, null, 2));
}

await page.evaluate(() => scrollTo(0, 0));
await page.waitForTimeout(800);
await page.mouse.wheel(0, 140);
await sample("DOWN 140", [0, 16, 32, 50, 80, 120, 180, 260, 400, 600, 900]);

await page.mouse.wheel(0, 420);
await sample("DOWN 420", [0, 16, 32, 50, 80, 120, 180, 260, 400, 600, 900]);

await page.mouse.wheel(0, -90);
await sample("UP 90", [0, 16, 32, 50, 80, 120, 180, 260, 400, 600, 900]);

await page.evaluate(() => scrollTo(0, 720));
await sample("JUMP 720", [0, 16, 32, 50, 80, 120, 180, 260, 400, 600, 900]);

await page.evaluate(() => scrollTo(0, 0));
await sample("JUMP TOP", [0, 16, 32, 50, 80, 120, 180, 260, 400, 600, 900]);

await page.waitForTimeout(800);
const frameSamples = await page.evaluate(() => new Promise((resolve) => {
  const header = document.querySelector(".framer-8zfk6f-container");
  const started = performance.now();
  const frames = [];
  scrollTo(0, 140);
  const capture = (now) => {
    const rect = header.getBoundingClientRect();
    frames.push({ time: Number((now - started).toFixed(2)), y: Number(rect.y.toFixed(4)) });
    if (now - started < 800) requestAnimationFrame(capture);
    else resolve(frames);
  };
  requestAnimationFrame(capture);
}));
console.log("RAF DOWN 140", JSON.stringify(frameSamples, null, 2));

const mainScript = await page.locator('script[src*="script_main"]').getAttribute("src");
const source = await (await page.request.get(mainScript)).text();
for (const pattern of ["stiffness", "damping", "framer-8zfk6f-container"]) {
  const matches = [];
  let cursor = 0;
  while (matches.length < 12) {
    const index = source.indexOf(pattern, cursor);
    if (index < 0) break;
    matches.push(source.slice(Math.max(0, index - 180), index + 260));
    cursor = index + pattern.length;
  }
  console.log(`SOURCE ${pattern}`, JSON.stringify(matches, null, 2));
}
await browser.close();
