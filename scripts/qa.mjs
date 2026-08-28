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
  mediaDimensions: [...document.querySelectorAll("img, video")].map((media) => ({ width: media.getAttribute("width"), height: media.getAttribute("height") })),
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
  skipLink: {
    firstFocusable: document.querySelector("body > a:first-child")?.classList.contains("skip-link"),
    target: document.querySelector(".skip-link")?.getAttribute("href"),
    mainId: document.querySelector("main")?.id,
  },
  privacy: {
    storedConsent: localStorage.getItem("hul:privacy-consent:v1"),
    cookies: document.cookie,
    bannerHidden: document.querySelector("[data-cookie-banner]")?.hidden,
    analyticsScript: Boolean(document.querySelector("script[data-hul-analytics]")),
    interactiveMap: Boolean(document.querySelector("iframe[data-interactive-map]")),
    localMap: document.querySelector("[data-map-preview] img")?.getAttribute("src"),
  },
  schemaAddress: JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent || "{}").address?.streetAddress,
  glassButtons: [...document.querySelectorAll(".motion-button--glass")].map((button) => ({
    background: getComputedStyle(button).backgroundColor,
    blur: getComputedStyle(button).backdropFilter,
  })),
  heroHeader: {
    background: getComputedStyle(document.querySelector(".header")).backgroundColor,
    blur: getComputedStyle(document.querySelector(".header")).backdropFilter,
  },
  heroMedia: {
    decoded: document.querySelector(".hero__media").classList.contains("is-decoded"),
    currentSrc: document.querySelector("[data-hero-image]").currentSrc,
    opacity: getComputedStyle(document.querySelector("[data-hero-image]")).opacity,
    filter: getComputedStyle(document.querySelector("[data-hero-image]")).filter,
    transform: getComputedStyle(document.querySelector("[data-hero-image]")).transform,
    pictureDisplay: getComputedStyle(document.querySelector(".hero__media")).display,
    shade: getComputedStyle(document.querySelector(".hero__shade")).backgroundColor,
  },
  quickActions: {
    phoneHref: document.querySelector(".quick-action--phone")?.getAttribute("href"),
    topHref: document.querySelector("[data-scroll-top]")?.getAttribute("href"),
    phoneVisible: document.querySelector(".quick-action--phone")?.classList.contains("is-visible"),
    topVisible: document.querySelector("[data-scroll-top]")?.classList.contains("is-visible"),
    phoneBackground: getComputedStyle(document.querySelector(".quick-action--phone")).backgroundColor,
    topBackground: getComputedStyle(document.querySelector("[data-scroll-top]")).backgroundColor,
  },
}));

assert(desktop.js, "JS enhancement class is active");
assert(desktop.sections === 8, "Hero and all seven content sections exist in the main landmark");
assert(desktop.h1 === 1, "Exactly one H1 exists");
assert(desktop.ctaLines === 2, "Desktop CTA keeps the target two-line split");
assert(desktop.processLines === 2, "Process heading keeps the target two-line split");
assert(desktop.mediaDimensions.every((media) => media.width && media.height), "Images and video declare intrinsic dimensions");
assert(desktop.splitHeadings.every((heading) => heading.characters === heading.expected), "Every visible heading glyph receives the target animation wrapper");
assert(desktop.splitHeadings.every((heading) => heading.lineDelays.every(Boolean)), "Heading animation delays follow the actual rendered lines");
assert(desktop.images.filter((image) => image.loading !== "lazy").every((image) => image.complete && image.width > 0), "All initially requested desktop images decode");
assert(desktop.overflow === 0, "Desktop has no horizontal overflow");
assert(desktop.externalRequests.length === 0, "Local page makes no external production requests");
assert(desktop.rootAbsoluteAssets.length === 0, "Static assets use GitHub Pages-safe relative paths");
assert(desktop.missingAnchors.length === 0, "All internal anchors resolve");
assert(Object.values(desktop.meta).every(Boolean), "SEO, social and schema metadata are present");
assert(desktop.landmarkOrder, "Primary navigation precedes hero actions in DOM and focus order");
assert(desktop.skipLink.firstFocusable && desktop.skipLink.target === "#main-content" && desktop.skipLink.mainId === "main-content", "Skip link is the first focus target and resolves to main content");
assert(desktop.privacy.storedConsent === null && desktop.privacy.cookies === "", "No consent value or cookie exists before the visitor decides");
assert(!desktop.privacy.analyticsScript && !desktop.privacy.interactiveMap, "Optional services start inactive");
assert(desktop.privacy.localMap?.includes("map-domar.jpg"), "The contact section starts with a local map preview");
assert(desktop.schemaAddress?.includes("Braniborska 14"), "Structured data contains the verified showroom address");
assert(desktop.glassButtons.every((button) => button.background === "rgba(255, 255, 255, 0.16)" && button.blur === "blur(16px)"), "Glass buttons keep the original milky 16px backdrop blur");
assert(desktop.heroHeader.background === "rgba(22, 35, 27, 0.36)" && desktop.heroHeader.blur === "blur(12px)", "The transparent hero header keeps navigation legible over bright image areas");
assert(desktop.heroMedia.decoded && desktop.heroMedia.currentSrc.includes(".webp") && desktop.heroMedia.opacity === "1", "The hero reveals a fully decoded modern image rather than streaming partial pixels");
assert(desktop.heroMedia.filter === "none" && desktop.heroMedia.transform === "none" && desktop.heroMedia.pictureDisplay === "block" && desktop.heroMedia.shade === "rgba(0, 0, 0, 0.35)", "The hero avoids the filtered transformed image layer that clips in mobile WebKit");
assert(desktop.quickActions.phoneHref === "tel:+48717810307" && desktop.quickActions.topHref === "#top" && desktop.quickActions.phoneVisible && !desktop.quickActions.topVisible, "The phone is immediately available while the back-to-top action stays hidden at the page top");
assert(desktop.quickActions.phoneBackground === "rgba(50, 38, 31, 0.97)" && desktop.quickActions.topBackground === "rgba(249, 245, 235, 0.84)", "The permanent phone action is oak while the secondary back-to-top action stays milky");

const cookieBanner = page.locator("[data-cookie-banner]");
await cookieBanner.waitFor({ state: "visible" });
const undecidedPrivacy = await page.evaluate(() => ({
  ariaHidden: document.querySelector("[data-cookie-banner]").getAttribute("aria-hidden"),
  inert: document.querySelector("[data-cookie-banner]").inert,
  background: getComputedStyle(document.querySelector("[data-cookie-banner]")).backgroundColor,
  externalRequests: performance.getEntriesByType("resource").filter((entry) => !entry.name.startsWith(location.origin)).length,
  cookies: document.cookie,
}));
assert(undecidedPrivacy.ariaHidden === "false" && !undecidedPrivacy.inert, "The first-visit consent prompt becomes accessible and interactive");
assert(undecidedPrivacy.background === "rgba(50, 38, 31, 0.97)", "The consent prompt uses the warm dark-oak brand surface");
assert(undecidedPrivacy.externalRequests === 0 && undecidedPrivacy.cookies === "", "Showing the consent prompt does not contact third parties or set cookies");
await page.waitForTimeout(520);
const desktopHeroConsentLayout = await page.evaluate(() => {
  const header = document.querySelector(".header__top").getBoundingClientRect();
  const content = document.querySelector(".hero__content").getBoundingClientRect();
  const actions = document.querySelector(".hero__actions").getBoundingClientRect();
  const banner = document.querySelector("[data-cookie-banner]").getBoundingClientRect();
  return {
    headerGap: content.top - header.bottom,
    bannerGap: banner.top - actions.bottom,
    actionsBottom: actions.bottom,
  };
});
assert(desktopHeroConsentLayout.headerGap >= 19 && desktopHeroConsentLayout.bannerGap >= 19, "The desktop hero content stays between the header and an undecided consent prompt");
await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  scrollTo(0, document.documentElement.scrollHeight);
  document.documentElement.style.removeProperty("scroll-behavior");
});
await page.waitForTimeout(520);
const footerConsentLayout = await page.evaluate(() => {
  const banner = document.querySelector("[data-cookie-banner]").getBoundingClientRect();
  const footer = document.querySelector(".footer").getBoundingClientRect();
  const quickActions = document.querySelector("[data-quick-actions]").getBoundingClientRect();
  return {
    footerGap: footer.top - banner.bottom,
    actionsGap: banner.top - quickActions.bottom,
    bannerTop: banner.top,
    heroActionsBottom: document.querySelector(".hero__actions").getBoundingClientRect().bottom,
  };
});
assert(footerConsentLayout.footerGap >= 19 && footerConsentLayout.actionsGap >= 11 && footerConsentLayout.bannerTop >= 20, "The desktop consent prompt clears the footer while floating actions remain above it");
assert(Math.abs(footerConsentLayout.heroActionsBottom - desktopHeroConsentLayout.actionsBottom) <= 0.5, "Footer movement does not change the hero content height");
await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  scrollTo(0, 0);
  document.documentElement.style.removeProperty("scroll-behavior");
});
await cookieBanner.locator("[data-consent-reject]").click();
await cookieBanner.waitFor({ state: "hidden" });
const rejectedPrivacy = await page.evaluate(() => ({
  consent: JSON.parse(localStorage.getItem("hul:privacy-consent:v1")),
  iframe: Boolean(document.querySelector("iframe[data-interactive-map]")),
  analytics: Boolean(document.querySelector("script[data-hul-analytics]")),
}));
assert(rejectedPrivacy.consent?.version === 1 && !rejectedPrivacy.consent.analytics && !rejectedPrivacy.consent.maps, "Rejecting optional services stores an explicit category-level decision");
assert(!rejectedPrivacy.iframe && !rejectedPrivacy.analytics, "Rejecting optional services leaves Google resources unloaded");

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

await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  scrollTo(0, 300);
  document.documentElement.style.removeProperty("scroll-behavior");
});
await page.waitForTimeout(80);
let headerState = await page.locator(".header").evaluate((header) => ({
  translate: parseFloat(header.style.getPropertyValue("--header-translate")),
  unit: header.style.getPropertyValue("--header-translate").trim().slice(-2),
  scrolled: header.classList.contains("header--scrolled"),
}));
assert(headerState.translate < -5 && headerState.translate > -50 && headerState.unit === "px", `Header follows the scroll target with the measured Framer spring lag (${headerState.translate}${headerState.unit})`);
await page.waitForTimeout(520);
headerState = await page.locator(".header").evaluate((header) => ({
  translate: parseFloat(header.style.getPropertyValue("--header-translate")),
  scrolled: header.classList.contains("header--scrolled"),
}));
assert(headerState.translate < -58 && headerState.translate > -70, "Header spring settles at the original pixel-based scroll target");
await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  scrollTo(0, 700);
  document.documentElement.style.removeProperty("scroll-behavior");
});
await page.waitForTimeout(80);
const returningHeaderTranslate = await page.locator(".header").evaluate((header) => parseFloat(header.style.getPropertyValue("--header-translate")));
assert(returningHeaderTranslate > headerState.translate && returningHeaderTranslate < -5, `Header retains visible inertia while returning after the scroll phase (${returningHeaderTranslate}px)`);
await page.waitForTimeout(520);
headerState = await page.locator(".header").evaluate((header) => ({
  translate: parseFloat(header.style.getPropertyValue("--header-translate")),
  scrolled: header.classList.contains("header--scrolled"),
  buttonBlur: getComputedStyle(header.querySelector(".motion-button--glass")).backdropFilter,
}));
assert(Math.abs(headerState.translate) < 0.25 && headerState.scrolled && headerState.buttonBlur === "none", `Header returns in its solid, non-blurred state after the hero threshold (${headerState.buttonBlur})`);

await page.locator('.header__desktop-links a[href="#kontakt"]').click();
await page.waitForFunction(() => Math.abs(document.querySelector(".visit").getBoundingClientRect().top - 64) <= 2);
const contactAnchorTop = await page.locator(".visit").evaluate((section) => section.getBoundingClientRect().top);
assert(Math.abs(contactAnchorTop - 64) <= 2, `The Contact anchor clears the fixed 64px header (${contactAnchorTop}px)`);

const visibleQuickActions = await page.evaluate(() => ({
  phone: document.querySelector(".quick-action--phone").classList.contains("is-visible"),
  top: document.querySelector("[data-scroll-top]").classList.contains("is-visible"),
}));
assert(visibleQuickActions.phone && visibleQuickActions.top, "The phone remains available and the back-to-top action appears after meaningful scrolling");
await page.locator("[data-scroll-top]").click();
await page.waitForFunction(() => window.scrollY <= 1);
assert(await page.evaluate(() => location.hash === "#top"), "The floating arrow returns to the document top");

await page.locator('.header__desktop-links a[href="#kontakt"]').click();
await page.waitForFunction(() => Math.abs(document.querySelector(".visit").getBoundingClientRect().top - 64) <= 2);
await page.locator(".header__top > .logo").click();
await page.waitForFunction(() => window.scrollY <= 1);
assert(await page.evaluate(() => window.scrollY <= 1 && location.hash === "#top"), "Clicking the upper-left HUL logo returns to the document top");

await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  scrollTo(0, document.documentElement.scrollHeight);
  document.documentElement.style.removeProperty("scroll-behavior");
});
await page.waitForTimeout(620);
const footerQuickActions = await page.evaluate(() => {
  const phone = document.querySelector(".quick-action--phone").getBoundingClientRect();
  const footer = document.querySelector(".footer").getBoundingClientRect();
  return {
    gap: footer.top - phone.bottom,
    darkSurface: document.querySelector("[data-quick-actions]").classList.contains("quick-actions--on-dark"),
    phoneBackground: getComputedStyle(document.querySelector(".quick-action--phone")).backgroundColor,
    phoneColor: getComputedStyle(document.querySelector(".quick-action--phone")).color,
  };
});
assert(footerQuickActions.gap >= 12 && footerQuickActions.darkSurface, "Floating actions clear the footer logo and detect the dark ending");
assert(footerQuickActions.phoneBackground === "rgba(50, 38, 31, 0.97)" && footerQuickActions.phoneColor === "rgb(249, 245, 235)", "The phone action remains oak and legible over the dark ending");
await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  scrollTo(0, 0);
  document.documentElement.style.removeProperty("scroll-behavior");
});

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
  bodyMenuOpen: document.body.classList.contains("menu-open"),
  quickActionsInert: document.querySelector("[data-quick-actions]").inert,
}));
assert(mobileState.height === 208 && mobileState.open, "Mobile menu opens to the target 208px height");
assert(mobileState.expanded === "true" && !mobileState.inert && mobileState.hidden === "false", "Open mobile navigation is exposed accessibly");
assert(mobileState.bodyMenuOpen && mobileState.quickActionsInert, "Open mobile navigation suppresses floating actions");
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
      const phone = document.querySelector(".quick-action--phone").getBoundingClientRect();
      const phoneClearance = [...document.querySelectorAll(".hero__actions .motion-button")].every((action) => {
        const rect = action.getBoundingClientRect();
        return rect.right <= phone.left - 11 || rect.left >= phone.right + 11 || rect.bottom <= phone.top - 11 || rect.top >= phone.bottom + 11;
      });
      return {
        lines: Number(heading.dataset.revealLines),
        fontSize: getComputedStyle(heading).fontSize,
        lineHeight: getComputedStyle(heading).lineHeight,
        buttonFontSize: style.fontSize,
        buttonPadding: style.paddingLeft,
        phoneClearance,
      };
    });
    assert(hero.lines === 4 && hero.fontSize === "36px" && hero.lineHeight === "36px", "320px hero keeps the target four-line 36px heading");
    assert(hero.buttonFontSize === "16px" && hero.buttonPadding === "16px", "320px hero buttons keep target typography and padding");
    assert(hero.phoneClearance, "The permanent phone action clears hero CTAs at 320px without a consent prompt");
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

const shortContext = await browser.newContext();
const shortMobileHeroBottoms = [];
for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 568 }, { width: 810, height: 600 }, { width: 1200, height: 600 }]) {
  const shortPage = await shortContext.newPage();
  await shortPage.setViewportSize(viewport);
  await shortPage.goto(baseUrl, { waitUntil: "networkidle" });
  await shortPage.evaluate(() => document.fonts.ready);
  // The hero reveal runs for 600ms after a 100ms delay. Wait for the
  // completed visual state so this layout assertion is not frame-timing dependent.
  await shortPage.waitForTimeout(760);
  const action = await shortPage.locator(".hero__actions").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const banner = document.querySelector("[data-cookie-banner]").getBoundingClientRect();
    const phone = document.querySelector(".quick-action--phone").getBoundingClientRect();
    const phoneClearance = [...element.querySelectorAll(".motion-button")].every((button) => {
      const buttonRect = button.getBoundingClientRect();
      return buttonRect.right <= phone.left - 11 || buttonRect.left >= phone.right + 11 || buttonRect.bottom <= phone.top - 11 || buttonRect.top >= phone.bottom + 11;
    });
    return {
      visible: getComputedStyle(element).opacity === "1",
      bottom: rect.bottom,
      bannerTop: banner.top,
      phoneClearance,
      viewportHeight: innerHeight,
    };
  });
  assert(action.visible && action.bottom <= action.viewportHeight, `Hero actions stay visible at ${viewport.width}×${viewport.height}`);
  const requiredConsentGap = viewport.width <= 809 ? 15 : 19;
  assert(action.bottom <= action.bannerTop - requiredConsentGap, `Hero actions clear consent at ${viewport.width}x${viewport.height}`);
  assert(action.phoneClearance, `Floating phone clears hero actions at ${viewport.width}x${viewport.height}`);
  if (viewport.height === 568) shortMobileHeroBottoms.push(action.bottom);
  await shortPage.close();
}
assert(Math.max(...shortMobileHeroBottoms) - Math.min(...shortMobileHeroBottoms) <= 0.5, "Short mobile hero content keeps one stable vertical position across widths");
await shortContext.close();

const iphoneContext = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
});
let releaseHeroResponse;
let stalledHeroRequest = false;
const heroResponseGate = new Promise((resolve) => { releaseHeroResponse = resolve; });
await iphoneContext.route("**/hero-mobile-1280.webp", async (route) => {
  stalledHeroRequest = true;
  await heroResponseGate;
  await route.continue();
});
const iphonePage = await iphoneContext.newPage();
await iphonePage.goto(baseUrl, { waitUntil: "domcontentloaded" });
const guardedHero = await iphonePage.evaluate(() => ({
  opacity: getComputedStyle(document.querySelector("[data-hero-image]")).opacity,
  placeholder: getComputedStyle(document.querySelector(".hero__media")).backgroundImage,
  currentSrc: document.querySelector("[data-hero-image]").currentSrc,
}));
assert(
  stalledHeroRequest && guardedHero.opacity === "0" && guardedHero.placeholder.includes("hero-mobile-placeholder.webp"),
  `A stalled DPR3 hero request shows the complete placeholder instead of a half-painted image (${JSON.stringify({ ...guardedHero, stalledHeroRequest })})`,
);
releaseHeroResponse();
await iphonePage.waitForFunction(() => document.querySelector(".hero__media").classList.contains("is-decoded"));
await iphonePage.waitForTimeout(450);
const iphoneHero = await iphonePage.evaluate(() => {
  const heroRect = document.querySelector(".hero").getBoundingClientRect();
  const spacerRect = document.querySelector(".hero-spacer").getBoundingClientRect();
  const mediaRect = document.querySelector(".hero__media").getBoundingClientRect();
  const imageRect = document.querySelector(".hero__media img").getBoundingClientRect();
  return {
    viewportHeight: innerHeight,
    heroHeight: heroRect.height,
    heroBottom: heroRect.bottom,
    spacerHeight: spacerRect.height,
    mediaHeight: mediaRect.height,
    imageHeight: imageRect.height,
    imageBottom: imageRect.bottom,
    imageOpacity: getComputedStyle(document.querySelector("[data-hero-image]")).opacity,
    currentSrc: document.querySelector("[data-hero-image]").currentSrc,
  };
});
assert(
  Math.abs(iphoneHero.heroHeight - iphoneHero.viewportHeight) <= 1
    && Math.abs(iphoneHero.heroBottom - iphoneHero.viewportHeight) <= 1
    && Math.abs(iphoneHero.spacerHeight - iphoneHero.viewportHeight) <= 1
    && Math.abs(iphoneHero.mediaHeight - iphoneHero.viewportHeight) <= 1
    && Math.abs(iphoneHero.imageHeight - iphoneHero.viewportHeight) <= 1
    && Math.abs(iphoneHero.imageBottom - iphoneHero.viewportHeight) <= 1
    && iphoneHero.imageOpacity === "1"
    && iphoneHero.currentSrc.includes("hero-mobile-1280.webp"),
  "The mobile hero fills an iPhone 15 Pro Max viewport without a bottom strip",
);
await iphoneContext.close();

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
  privacyHidden: document.querySelector("[data-cookie-banner]")?.hidden,
  privacyButtonDisplay: getComputedStyle(document.querySelector("[data-open-privacy]")).display,
  quickActions: {
    phoneHref: document.querySelector(".quick-action--phone")?.getAttribute("href"),
    topHref: document.querySelector("[data-scroll-top]")?.getAttribute("href"),
    visible: [...document.querySelectorAll(".quick-action")].every((action) => getComputedStyle(action).visibility === "visible"),
  },
  map: {
    previewVisible: document.querySelector("[data-map-preview] img")?.getBoundingClientRect().height > 0,
    enableButtonDisplay: getComputedStyle(document.querySelector("[data-enable-map]")).display,
    externalLink: document.querySelector("[data-map-preview] a[href*='google.com/maps']")?.href,
    iframe: Boolean(document.querySelector("iframe[data-interactive-map]")),
  },
}));
assert(!noJs.js, "No-JS document does not claim enhancement state");
assert(noJs.headerHeight === 208 && noJs.menuVisibility === "hidden", "No-JS mobile navigation stays permanently visible without a fake toggle");
assert(noJs.links.every((link) => link.opacity === "1" && link.height > 0), "No-JS navigation links remain readable");
assert(noJs.answers.every((height) => height > 0) && noJs.content, "All FAQ content remains readable without JavaScript");
assert(noJs.faqButtons.every((button) => button.expanded === "true" && button.tabIndex === -1 && button.disabled), "No-JS FAQ exposes expanded content without dead controls");
assert(noJs.privacyHidden && noJs.privacyButtonDisplay === "none", "No-JS mode does not expose unusable consent controls");
assert(noJs.map.previewVisible && noJs.map.enableButtonDisplay === "none" && noJs.map.externalLink && !noJs.map.iframe, "No-JS mode keeps the local map and a working external directions link");
assert(noJs.quickActions.visible && noJs.quickActions.phoneHref === "tel:+48717810307" && noJs.quickActions.topHref === "#top", "No-JS mode keeps both native floating links usable");

await noJsPage.close();

const mapContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const mapPage = await mapContext.newPage();
const mapExternalRequests = [];
mapPage.on("request", (request) => {
  if (!request.url().startsWith(new URL(baseUrl).origin)) mapExternalRequests.push(request.url());
});
await mapContext.route("https://maps.google.com/**", (route) => route.fulfill({
  status: 200,
  contentType: "text/html",
  body: "<!doctype html><title>Testowa mapa Google</title>",
}));
await mapPage.goto(baseUrl, { waitUntil: "networkidle" });
await mapPage.locator("[data-cookie-banner]").waitFor({ state: "visible" });
await mapPage.locator("[data-consent-reject]").click();
await mapPage.locator("[data-cookie-banner]").waitFor({ state: "hidden" });
await mapPage.locator("[data-contact-map]").scrollIntoViewIfNeeded();
await mapPage.locator("[data-enable-map]").click();
await mapPage.locator("[data-privacy-dialog]").waitFor({ state: "visible" });
await mapPage.waitForTimeout(300);
let mapConsentState = await mapPage.evaluate(() => ({
  focused: document.activeElement === document.querySelector("[data-consent-maps]"),
  checked: document.querySelector("[data-consent-maps]").checked,
  iframe: Boolean(document.querySelector("iframe[data-interactive-map]")),
  quickActionsHidden: getComputedStyle(document.querySelector("[data-quick-actions]")).visibility === "hidden",
  quickActionsInert: document.querySelector("[data-quick-actions]").inert,
}));
assert(mapConsentState.focused && !mapConsentState.checked && !mapConsentState.iframe, "Requesting the interactive map opens settings on the unselected Maps category");
assert(mapConsentState.quickActionsHidden && mapConsentState.quickActionsInert, "The privacy dialog hides floating actions from view and focus");
await mapPage.keyboard.press("Space");
await mapPage.locator("[data-consent-save]").click();
await mapPage.locator("iframe[data-interactive-map]").waitFor({ state: "attached" });
await mapPage.waitForTimeout(150);
mapConsentState = await mapPage.evaluate(() => ({
  consent: JSON.parse(localStorage.getItem("hul:privacy-consent:v1")),
  previewHidden: document.querySelector("[data-map-preview]").hidden,
  iframeTitle: document.querySelector("iframe[data-interactive-map]")?.title,
  referrerPolicy: document.querySelector("iframe[data-interactive-map]")?.referrerPolicy,
  focused: document.activeElement === document.querySelector("iframe[data-interactive-map]"),
  status: document.querySelector("[data-map-status]")?.textContent,
}));
assert(mapConsentState.consent?.maps && !mapConsentState.consent.analytics, "Maps can be accepted independently from Analytics");
assert(mapConsentState.previewHidden && mapConsentState.iframeTitle && mapConsentState.referrerPolicy === "no-referrer", "Consent replaces the preview with a titled, privacy-restricted iframe");
assert(mapConsentState.focused && mapConsentState.status.includes("włączona"), "Loading the requested map preserves focus and announces the change");
assert(mapExternalRequests.some((url) => url.startsWith("https://maps.google.com/")), "Google Maps is requested only after Maps consent");
assert(!mapExternalRequests.some((url) => url.includes("googletagmanager.com")), "Map consent alone does not request Google Analytics");

await mapPage.locator("[data-open-privacy]").click();
await mapPage.locator("[data-consent-maps]").focus();
await mapPage.keyboard.press("Space");
await Promise.all([
  mapPage.waitForNavigation({ waitUntil: "domcontentloaded" }),
  mapPage.locator("[data-consent-save]").click(),
]);
await mapPage.waitForTimeout(120);
const revokedMap = await mapPage.evaluate(() => ({
  consent: JSON.parse(localStorage.getItem("hul:privacy-consent:v1")),
  iframe: Boolean(document.querySelector("iframe[data-interactive-map]")),
  previewHidden: document.querySelector("[data-map-preview]").hidden,
  bannerHidden: document.querySelector("[data-cookie-banner]").hidden,
}));
assert(!revokedMap.consent.maps && !revokedMap.iframe && !revokedMap.previewHidden, "Revoking Maps consent reloads the page without the external iframe");
assert(revokedMap.bannerHidden, "A saved rejection does not show the first-visit prompt again");
await mapContext.close();

const acceptContext = await browser.newContext({ viewport: { width: 320, height: 568 } });
await acceptContext.route("https://maps.google.com/**", (route) => route.fulfill({
  status: 200,
  contentType: "text/html",
  body: "<!doctype html><title>Testowa mapa Google</title>",
}));
const acceptPage = await acceptContext.newPage();
await acceptPage.goto(baseUrl, { waitUntil: "networkidle" });
await acceptPage.locator("[data-cookie-banner]").waitFor({ state: "visible" });
await acceptPage.waitForTimeout(520);
const mobileHeroConsentLayout = await acceptPage.evaluate(() => {
  const header = document.querySelector(".header__top").getBoundingClientRect();
  const content = document.querySelector(".hero__content").getBoundingClientRect();
  const actions = document.querySelector(".hero__actions").getBoundingClientRect();
  const banner = document.querySelector("[data-cookie-banner]").getBoundingClientRect();
  return {
    headerGap: content.top - header.bottom,
    bannerGap: banner.top - actions.bottom,
    actionsBottom: actions.bottom,
  };
});
assert(mobileHeroConsentLayout.headerGap >= 11 && mobileHeroConsentLayout.bannerGap >= 15, "The 320px hero lifts above consent without entering the mobile header");
await acceptPage.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  scrollTo(0, 2000);
  document.documentElement.style.removeProperty("scroll-behavior");
});
await acceptPage.waitForFunction(() => document.querySelector("[data-scroll-top]").classList.contains("is-visible"));
await acceptPage.waitForTimeout(520);
const mobileBannerLayout = await acceptPage.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  bannerTop: document.querySelector("[data-cookie-banner]").getBoundingClientRect().top,
  bannerHeight: document.querySelector("[data-cookie-banner]").getBoundingClientRect().height,
  copyLines: Math.round(
    document.querySelector(".cookie-banner__copy p").getBoundingClientRect().height
      / parseFloat(getComputedStyle(document.querySelector(".cookie-banner__copy p")).lineHeight),
  ),
  actions: [...document.querySelectorAll("[data-cookie-banner] button")].map((button) => {
    const rect = button.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }),
  quickActions: [...document.querySelectorAll(".quick-action.is-visible")].map((action) => {
    const rect = action.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }),
}));
assert(mobileBannerLayout.overflow === 0 && mobileBannerLayout.actions.every((rect) => rect.left >= 0 && rect.right <= 320 && rect.top >= 0 && rect.bottom <= 568), "The complete consent prompt stays reachable at 320px");
assert(new Set(mobileBannerLayout.actions.map((rect) => Math.round(rect.top))).size === 1 && mobileBannerLayout.copyLines <= 2 && mobileBannerLayout.bannerHeight <= 150, "The mobile consent prompt keeps three actions on one row and compact copy at 320px");
assert(mobileBannerLayout.quickActions.length === 2 && mobileBannerLayout.quickActions.every((rect) => rect.left >= 0 && rect.right <= 320 && rect.top >= 0 && rect.bottom <= mobileBannerLayout.bannerTop - 8), "Floating actions move above the mobile consent prompt without overlap");
await acceptPage.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  scrollTo(0, document.documentElement.scrollHeight);
  document.documentElement.style.removeProperty("scroll-behavior");
});
await acceptPage.waitForTimeout(520);
const mobileFooterConsentLayout = await acceptPage.evaluate(() => {
  const banner = document.querySelector("[data-cookie-banner]").getBoundingClientRect();
  const footer = document.querySelector(".footer").getBoundingClientRect();
  const quickActions = document.querySelector("[data-quick-actions]").getBoundingClientRect();
  return {
    footerGap: footer.top - banner.bottom,
    actionsGap: banner.top - quickActions.bottom,
    bannerTop: banner.top,
    heroActionsBottom: document.querySelector(".hero__actions").getBoundingClientRect().bottom,
  };
});
assert(mobileFooterConsentLayout.footerGap >= 7 && mobileFooterConsentLayout.actionsGap >= 11 && mobileFooterConsentLayout.bannerTop >= 8, "The mobile consent prompt clears the footer without pushing floating controls off-screen");
assert(Math.abs(mobileFooterConsentLayout.heroActionsBottom - mobileHeroConsentLayout.actionsBottom) <= 0.5, "Mobile footer movement leaves hero content at its fixed consent height");
await acceptPage.locator("[data-consent-accept]").click();
await acceptPage.locator("iframe[data-interactive-map]").waitFor({ state: "attached" });
const acceptedPrivacy = await acceptPage.evaluate(() => ({
  consent: JSON.parse(localStorage.getItem("hul:privacy-consent:v1")),
  analyticsScript: Boolean(document.querySelector("script[data-hul-analytics]")),
}));
assert(acceptedPrivacy.consent.analytics && acceptedPrivacy.consent.maps, "Accept all stores both optional categories");
assert(!acceptedPrivacy.analyticsScript, "Analytics stays physically inactive until a real GA4 measurement ID is configured");
await acceptContext.close();

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
