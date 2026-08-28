import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const baseUrl = process.argv[2] || "http://127.0.0.1:5173/";

const failures = [];
const checks = [];
const assert = (condition, message) => {
  checks.push(message);
  if (!condition) failures.push(message);
};

const context = await browser.newContext();
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("requestfailed", (request) => {
  if (request.failure()?.errorText === "net::ERR_ABORTED") return;
  failedRequests.push(`${request.url()} — ${request.failure()?.errorText}`);
});

await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(250);

const desktop = await page.evaluate(() => ({
  js: document.documentElement.classList.contains("js"),
  sections: document.querySelectorAll("main section").length,
  h1: document.querySelectorAll("h1").length,
  ctaLines: Number(document.querySelector(".contact-cta h2").dataset.revealLines),
  processLines: Number(document.querySelector(".process h2").dataset.revealLines),
  splitHeadings: [...document.querySelectorAll("[data-reveal-chars]")].map((heading) => ({
    characters: heading.querySelectorAll(".split-char").length,
    expected: Array.from(heading.dataset.revealText).filter((character) => !/\s/.test(character)).length,
    lineDelays: [...heading.querySelectorAll(".split-word:not(.split-word--anchor)")].map((word) => getComputedStyle(word).getPropertyValue("--line-delay").trim()),
  })),
  images: [...document.images].map((image) => ({ complete: image.complete, width: image.naturalWidth, loading: image.loading })),
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  externalRequests: performance.getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((url) => !url.startsWith(location.origin)),
  rootAbsoluteAssets: [...document.querySelectorAll('link[rel="stylesheet"], link[rel="icon"], script[src], img[src], source[src], source[srcset]')]
    .flatMap((element) => [element.getAttribute("href"), element.getAttribute("src"), element.getAttribute("srcset")])
    .filter((value) => value?.startsWith("/")),
  missingAnchors: [...document.querySelectorAll('a[href^="#"]')]
    .map((link) => link.getAttribute("href"))
    .filter((href) => href !== "#" && !document.querySelector(href)),
  meta: {
    description: Boolean(document.querySelector('meta[name="description"]')?.content),
    og: Boolean(document.querySelector('meta[property="og:title"]')?.content),
    twitter: Boolean(document.querySelector('meta[name="twitter:card"]')?.content),
    schema: Boolean(document.querySelector('script[type="application/ld+json"]')?.textContent),
  },
  landmarkOrder: Boolean(document.querySelector("body > nav.header + main > section.hero")),
}));

assert(desktop.js, "JS enhancement class is active");
assert(desktop.sections === 7, "Hero and all six content sections exist in the main landmark");
assert(desktop.h1 === 1, "Exactly one H1 exists");
assert(desktop.ctaLines === 2, "Desktop CTA keeps the target two-line split");
assert(desktop.processLines === 2, "Process heading keeps the target two-line split");
assert(desktop.splitHeadings.every((heading) => heading.characters === heading.expected), "Every visible heading glyph receives the target animation wrapper");
assert(desktop.splitHeadings.every((heading) => heading.lineDelays.every(Boolean)), "Heading animation delays follow the actual rendered lines");
assert(desktop.images.filter((image) => image.loading !== "lazy").every((image) => image.complete && image.width > 0), "All initially requested desktop images decode");
assert(desktop.overflow === 0, "Desktop has no horizontal overflow");
assert(desktop.externalRequests.length === 0, "Local page makes no external production requests");
assert(desktop.rootAbsoluteAssets.length === 0, "Static assets use GitHub Pages-safe relative paths");
assert(desktop.missingAnchors.length === 0, "All internal anchors resolve");
assert(Object.values(desktop.meta).every(Boolean), "SEO, social and schema metadata are present");
assert(desktop.landmarkOrder, "Primary navigation precedes hero actions in DOM and focus order");

for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += 700) {
  await page.evaluate((top) => scrollTo(0, top), y);
  await page.waitForTimeout(60);
}
const allImagesDecode = await page.evaluate(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
assert(allImagesDecode, "Lazy-loaded images decode after entering the viewport");
await page.evaluate(() => scrollTo(0, 0));

const faqButtons = page.locator(".faq-item__question");
await faqButtons.nth(1).click();
await page.waitForTimeout(520);
let faqState = await page.locator(".faq-item").evaluateAll((items) => items.map((item) => ({
  open: item.classList.contains("faq-item--open"),
  expanded: item.querySelector("button")?.getAttribute("aria-expanded"),
  hidden: item.querySelector(".faq-item__answer-grid")?.getAttribute("aria-hidden"),
})));
assert(await faqButtons.evaluateAll((buttons) => buttons.every((button) => button.tabIndex === 0 && !button.disabled)), "Enhanced FAQ controls return to the keyboard focus order");
assert(faqState[0].open && faqState[1].open, "FAQ items can remain independently open");
assert(faqState[1].expanded === "true" && faqState[1].hidden === "false", "FAQ ARIA state follows the open state");
await faqButtons.nth(0).click();
await page.waitForTimeout(520);
faqState = await page.locator(".faq-item").evaluateAll((items) => items.map((item) => item.classList.contains("faq-item--open")));
assert(!faqState[0] && faqState[1], "Closing one FAQ does not close another");

await page.evaluate(() => scrollTo(0, 300));
await page.waitForTimeout(100);
let headerState = await page.locator(".header").evaluate((header) => ({
  translate: parseFloat(header.style.getPropertyValue("--header-translate")),
  scrolled: header.classList.contains("header--scrolled"),
}));
assert(headerState.translate < -40 && headerState.translate > -90, "Header progressively hides during the first scroll phase");
await page.evaluate(() => scrollTo(0, 700));
await page.waitForTimeout(100);
headerState = await page.locator(".header").evaluate((header) => ({
  translate: parseFloat(header.style.getPropertyValue("--header-translate")),
  scrolled: header.classList.contains("header--scrolled"),
}));
assert(Math.abs(headerState.translate) < 0.1 && headerState.scrolled, "Header returns in its solid state after the hero threshold");

await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => scrollTo(0, 0));
await page.waitForTimeout(350);
await page.waitForFunction(() => document.querySelector(".hero__media img").currentSrc.includes("hero-mobile"));
let mobileState = await page.evaluate(() => ({
  ctaLines: Number(document.querySelector(".contact-cta h2").dataset.revealLines),
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  menuInert: document.querySelector(".header__mobile-links").inert,
  menuHidden: document.querySelector(".header__mobile-links").getAttribute("aria-hidden"),
  heroImage: document.querySelector(".hero__media img").currentSrc,
}));
assert(mobileState.ctaLines === 3, "Mobile CTA keeps the target three-line split after resize");
assert(mobileState.overflow === 0, "Mobile has no horizontal overflow");
assert(mobileState.menuInert && mobileState.menuHidden === "true", "Closed mobile navigation is removed from focus order");
assert(mobileState.heroImage.includes("hero-mobile"), "Mobile loads the dedicated hero crop");

await page.locator(".menu-toggle").click();
await page.waitForTimeout(620);
mobileState = await page.evaluate(() => ({
  height: document.querySelector(".header").getBoundingClientRect().height,
  open: document.querySelector(".header").classList.contains("header--open"),
  expanded: document.querySelector(".menu-toggle").getAttribute("aria-expanded"),
  inert: document.querySelector(".header__mobile-links").inert,
  hidden: document.querySelector(".header__mobile-links").getAttribute("aria-hidden"),
}));
assert(mobileState.height === 208 && mobileState.open, "Mobile menu opens to the target 208px height");
assert(mobileState.expanded === "true" && !mobileState.inert && mobileState.hidden === "false", "Open mobile navigation is exposed accessibly");
await page.keyboard.press("Escape");
await page.waitForTimeout(100);
mobileState = await page.evaluate(() => ({
  open: document.querySelector(".header").classList.contains("header--open"),
  focused: document.activeElement === document.querySelector(".menu-toggle"),
}));
assert(!mobileState.open && mobileState.focused, "Escape closes the menu and restores focus");

await page.locator(".menu-toggle").click();
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(220);
assert(!(await page.locator(".header").evaluate((header) => header.classList.contains("header--open"))), "Desktop resize clears the mobile menu state");

for (const width of [320, 431, 768, 810, 1200, 1664, 1920]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(220);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow === 0, `No horizontal overflow at ${width}px`);
  if (width === 320) {
    const hero = await page.evaluate(() => {
      const heading = document.querySelector(".hero h1");
      const button = document.querySelector(".hero__actions .motion-button");
      const style = getComputedStyle(button);
      return {
        lines: Number(heading.dataset.revealLines),
        fontSize: getComputedStyle(heading).fontSize,
        lineHeight: getComputedStyle(heading).lineHeight,
        buttonFontSize: style.fontSize,
        buttonPadding: style.paddingLeft,
      };
    });
    assert(hero.lines === 4 && hero.fontSize === "36px" && hero.lineHeight === "36px", "320px hero keeps the target four-line 36px heading");
    assert(hero.buttonFontSize === "16px" && hero.buttonPadding === "16px", "320px hero buttons keep target typography and padding");
    const cardOverlap = await page.evaluate(() => {
      const quote = document.querySelector(".expert-card__quote").getBoundingClientRect();
      const person = document.querySelector(".expert-card__person").getBoundingClientRect();
      return quote.bottom - person.top;
    });
    assert(cardOverlap <= 0.1, "320px expert quote reflows above the author details");
  }
  if (width === 431 || width === 768) {
    const cta = await page.evaluate(() => {
      const heading = document.querySelector(".contact-cta h2");
      return { lines: Number(heading.dataset.revealLines), width: heading.getBoundingClientRect().width };
    });
    const expectedWidth = width === 431 ? 399 : 480;
    assert(cta.lines === 2 && cta.width === expectedWidth, `${width}px CTA uses the target two-line, capped heading`);
  }
  if (width === 768) {
    const heroWidth = await page.locator(".hero h1").evaluate((heading) => heading.getBoundingClientRect().width);
    assert(heroWidth === 480, "768px hero heading is capped at the target 480px width");
  }
  if (width === 1200) {
    const cardOverlap = await page.evaluate(() => {
      const quote = document.querySelector(".expert-card__quote").getBoundingClientRect();
      const person = document.querySelector(".expert-card__person").getBoundingClientRect();
      return quote.bottom - person.top;
    });
    assert(cardOverlap <= 0.1, "1200px expert quote reflows above the author details");
  }
}

for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 568 }, { width: 810, height: 600 }, { width: 1200, height: 600 }]) {
  const shortPage = await context.newPage();
  await shortPage.setViewportSize(viewport);
  await shortPage.goto(baseUrl, { waitUntil: "networkidle" });
  await shortPage.evaluate(() => document.fonts.ready);
  await shortPage.waitForTimeout(180);
  const action = await shortPage.locator(".hero__actions").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { visible: getComputedStyle(element).opacity === "1", bottom: rect.bottom, viewportHeight: innerHeight };
  });
  assert(action.visible && action.bottom <= action.viewportHeight, `Hero actions stay visible at ${viewport.width}×${viewport.height}`);
  await shortPage.close();
}

const noJsPage = await browser.newPage({
  javaScriptEnabled: false,
  viewport: { width: 390, height: 844 },
});
await noJsPage.goto(baseUrl, { waitUntil: "networkidle" });
const noJs = await noJsPage.evaluate(() => ({
  js: document.documentElement.classList.contains("js"),
  headerHeight: document.querySelector(".header").getBoundingClientRect().height,
  menuVisibility: getComputedStyle(document.querySelector(".menu-toggle")).visibility,
  links: [...document.querySelectorAll(".header__mobile-links a")].map((link) => ({
    opacity: getComputedStyle(link).opacity,
    height: link.getBoundingClientRect().height,
  })),
  answers: [...document.querySelectorAll(".faq-item__answer-inner")].map((answer) => answer.getBoundingClientRect().height),
  faqButtons: [...document.querySelectorAll(".faq-item__question")].map((button) => ({ expanded: button.getAttribute("aria-expanded"), tabIndex: button.tabIndex, disabled: button.disabled })),
  content: document.body.innerText.includes("Działamy wszędzie tam"),
}));
assert(!noJs.js, "No-JS document does not claim enhancement state");
assert(noJs.headerHeight === 208 && noJs.menuVisibility === "hidden", "No-JS mobile navigation stays permanently visible without a fake toggle");
assert(noJs.links.every((link) => link.opacity === "1" && link.height > 0), "No-JS navigation links remain readable");
assert(noJs.answers.every((height) => height > 0) && noJs.content, "All FAQ content remains readable without JavaScript");
assert(noJs.faqButtons.every((button) => button.expanded === "true" && button.tabIndex === -1 && button.disabled), "No-JS FAQ exposes expanded content without dead controls");

await noJsPage.close();

const reducedContext = await browser.newContext({
  reducedMotion: "reduce",
  viewport: { width: 390, height: 844 },
});
const reducedPage = await reducedContext.newPage();
await reducedPage.goto(baseUrl, { waitUntil: "networkidle" });
await reducedPage.locator(".contact-cta").scrollIntoViewIfNeeded();
await reducedPage.waitForTimeout(500);
const reducedVideo = await reducedPage.locator(".contact-cta__video").evaluate((video) => ({ paused: video.paused, time: video.currentTime }));
assert(reducedVideo.paused && reducedVideo.time < 0.1, "Reduced-motion preference prevents CTA video autoplay");
await reducedContext.close();
await context.close();
await browser.close();

assert(consoleErrors.length === 0, "Browser console has no errors");
assert(failedRequests.length === 0, "No network requests fail");

if (failures.length) {
  console.error(`QA failed (${failures.length}/${checks.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  if (consoleErrors.length) console.error(consoleErrors);
  if (failedRequests.length) console.error(failedRequests);
  process.exit(1);
}

console.log(`QA passed: ${checks.length} checks.`);
