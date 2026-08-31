import { chromium, devices } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const baseUrl = process.argv[2] || "http://127.0.0.1:5173/";
const mailTemplates = {
  pl: {
    subject: "Zapytanie o kuchni\u0119 na wymiar \u2014 HUL",
    body: "Dzie\u0144 dobry,\r\n\r\nchc\u0119 porozmawia\u0107 o kuchni na wymiar.\r\n\r\nLokalizacja inwestycji:\r\nPlanowany termin:\r\nKilka s\u0142\u00f3w o wn\u0119trzu:\r\n\r\nPozdrawiam,",
  },
  en: {
    subject: "Bespoke kitchen enquiry \u2014 HUL",
    body: "Hello,\r\n\r\nI'd like to discuss a bespoke solid-wood kitchen.\r\n\r\nProject location:\r\nPreferred timeframe:\r\nA few words about the interior:\r\n\r\nBest regards,",
  },
  de: {
    subject: "Anfrage zu einer ma\u00dfgefertigten K\u00fcche \u2014 HUL",
    body: "Guten Tag,\r\n\r\nich m\u00f6chte mit Ihnen \u00fcber eine ma\u00dfgefertigte Massivholzk\u00fcche sprechen.\r\n\r\nOrt des Projekts:\r\nGew\u00fcnschter Zeitraum:\r\nKurze Beschreibung des Raums:\r\n\r\nMit freundlichen Gr\u00fc\u00dfen",
  },
};

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
await page.waitForFunction(() => document.querySelector(".hero__actions")?.classList.contains("is-visible"));
await page.waitForTimeout(1150);

const desktop = await page.evaluate(() => ({
  js: document.documentElement.classList.contains("js"),
  consentPending: document.documentElement.classList.contains("consent-pending"),
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
  mailLinks: [...document.querySelectorAll('a[href^="mailto:"]')].map((link) => {
    const url = new URL(link.href);
    return {
      recipient: url.pathname,
      subject: url.searchParams.get("subject"),
      body: url.searchParams.get("body"),
    };
  }),
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
  schemaAddress: (() => {
    const structuredData = JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent || "{}");
    const business = structuredData["@graph"]?.find((entry) => entry["@type"] === "HomeAndConstructionBusiness") || structuredData;
    return business.address?.streetAddress;
  })(),
  schemaModel: (() => {
    const structuredData = JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent || "{}");
    const graph = structuredData["@graph"] || [structuredData];
    const website = graph.find((entry) => entry["@type"] === "WebSite");
    const webpage = graph.find((entry) => entry["@type"] === "WebPage");
    return {
      pageUrl: webpage?.url,
      pageLanguage: webpage?.inLanguage,
      siteLanguages: website?.inLanguage,
    };
  })(),
  glassButtons: [...document.querySelectorAll(".motion-button--glass")].map((button) => ({
    background: getComputedStyle(button).backgroundColor,
    blur: getComputedStyle(button).backdropFilter,
  })),
  actionHeights: {
    content: [
      ...document.querySelectorAll(".hero__actions .motion-button"),
      document.querySelector(".visit__details .motion-button"),
      document.querySelector(".contact-cta .motion-button"),
    ].map((button) => button.getBoundingClientRect().height),
    header: document.querySelector(".header .motion-button--compact").getBoundingClientRect().height,
  },
  actionWidths: {
    hero: [...document.querySelectorAll(".hero__actions .motion-button")].map((button) => button.getBoundingClientRect().width),
    route: document.querySelector(".visit__details .motion-button").getBoundingClientRect().width,
    map: [...document.querySelectorAll(".map-preview__actions > *")].map((button) => button.getBoundingClientRect().width),
  },
  heroEntrance: (() => {
    const heroElement = document.querySelector(".hero");
    const title = document.querySelector(".hero__title");
    const lineDelays = [...document.querySelectorAll(".hero__title .split-word:not(.split-word--anchor)")]
      .map((word) => parseFloat(word.style.getPropertyValue("--line-delay")))
      .filter((delay, index, delays) => delays.indexOf(delay) === index)
      .sort((first, second) => first - second);
    const actions = [...document.querySelectorAll(".hero__actions .motion-button")];
    return {
      eyebrowIsReveal: document.querySelector(".hero__eyebrow")?.classList.contains("reveal"),
      titleWrapperDuration: parseFloat(getComputedStyle(title).transitionDuration),
      headingDelay: parseFloat(getComputedStyle(heroElement).getPropertyValue("--hero-heading-delay")),
      primaryDelay: parseFloat(getComputedStyle(heroElement).getPropertyValue("--hero-primary-action-delay")),
      secondaryDelay: parseFloat(getComputedStyle(heroElement).getPropertyValue("--hero-secondary-action-delay")),
      lineDelays,
      actionTransitions: actions.map((action) => getComputedStyle(action).transitionProperty
        .split(",").map((property) => property.trim())),
    };
  })(),
  heroHeader: {
    background: getComputedStyle(document.querySelector(".header")).backgroundColor,
    blur: getComputedStyle(document.querySelector(".header")).backdropFilter,
  },
  headerUtilities: (() => {
    const utilities = document.querySelector(".header__utilities");
    const switcher = utilities.querySelector(".language-switcher--desktop");
    const cta = utilities.querySelector(".motion-button");
    const desktopLinks = document.querySelector(".header__desktop-links");
    const track = cta.querySelector(".motion-button__track");
    const utilitiesRect = utilities.getBoundingClientRect();
    const switcherRect = switcher.getBoundingClientRect();
    const ctaRect = cta.getBoundingClientRect();
    const linksRect = desktopLinks.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    return {
      grouped: switcher.parentElement === utilities && cta.parentElement === utilities,
      controlGap: ctaRect.left - switcherRect.right,
      navigationGap: utilitiesRect.left - linksRect.right,
      activeBackground: getComputedStyle(switcher.querySelector('[aria-current="page"]')).backgroundColor,
      visibleTrackLabels: [...track.children].filter((label) => {
        const rect = label.getBoundingClientRect();
        return rect.bottom > trackRect.top + 0.5 && rect.top < trackRect.bottom - 0.5;
      }).length,
    };
  })(),
  heroMedia: {
    decoded: document.querySelector(".hero__media").classList.contains("is-decoded"),
    currentSrc: document.querySelector("[data-hero-image]").currentSrc,
    opacity: getComputedStyle(document.querySelector("[data-hero-image]")).opacity,
    filter: getComputedStyle(document.querySelector("[data-hero-image]")).filter,
    transform: getComputedStyle(document.querySelector("[data-hero-image]")).transform,
    pictureDisplay: getComputedStyle(document.querySelector(".hero__media")).display,
    shade: getComputedStyle(document.querySelector(".hero__shade")).backgroundColor,
  },
  heroLayer: {
    occluded: document.querySelector(".hero").classList.contains("hero--occluded"),
    position: getComputedStyle(document.querySelector(".hero")).position,
    mediaVisibility: getComputedStyle(document.querySelector(".hero__media")).visibility,
    canvasBackground: getComputedStyle(document.documentElement).backgroundColor,
    overscroll: getComputedStyle(document.documentElement).overscrollBehaviorY,
  },
  heroActionsBottom: document.querySelector(".hero__actions").getBoundingClientRect().bottom,
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
assert(desktop.consentPending, "An undecided visit reserves the consent-safe hero position before the prompt appears");
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
assert(desktop.mailLinks.length === 2 && desktop.mailLinks.every((link) => link.recipient === "domar@kuchniezdrewna.pl" && link.subject === mailTemplates.pl.subject && link.body === mailTemplates.pl.body), "Polish email links open a useful localized kitchen enquiry without JavaScript");
assert(Object.values(desktop.meta).every(Boolean), "SEO, social and schema metadata are present");
assert(desktop.landmarkOrder, "Primary navigation precedes hero actions in DOM and focus order");
assert(desktop.skipLink.firstFocusable && desktop.skipLink.target === "#main-content" && desktop.skipLink.mainId === "main-content", "Skip link is the first focus target and resolves to main content");
assert(desktop.privacy.storedConsent === null && desktop.privacy.cookies === "", "No consent value or cookie exists before the visitor decides");
assert(!desktop.privacy.analyticsScript && !desktop.privacy.interactiveMap, "Optional services start inactive");
assert(desktop.privacy.localMap?.includes("map-domar.jpg"), "The contact section starts with a local map preview");
assert(desktop.schemaAddress?.includes("Braniborska 14"), "Structured data contains the verified showroom address");
assert(desktop.schemaModel.pageUrl === "https://guziczak.github.io/hul/" && desktop.schemaModel.pageLanguage === "pl" && ["pl", "en", "de"].every((language) => desktop.schemaModel.siteLanguages?.includes(language)), "Polish WebPage and multilingual WebSite structured data are linked correctly");
assert(desktop.glassButtons.every((button) => button.background === "rgba(255, 255, 255, 0.24)" && button.blur === "blur(16px)"), "Glass buttons compensate for the darker local layers with a milkier fill and the original 16px blur");
assert(desktop.actionHeights.content.every((height) => height === 48) && desktop.actionHeights.header === 32, "Primary content actions share the 48px control height while the navigation CTA remains intentionally compact");
assert([
  ...desktop.actionWidths.hero,
  desktop.actionWidths.route,
  ...desktop.actionWidths.map,
].every((width) => Math.abs(width - 210) <= 0.5), "Desktop hero, directions and map actions share the literal 210px button width");
assert(desktop.heroEntrance.eyebrowIsReveal && desktop.heroEntrance.titleWrapperDuration === 0 && desktop.heroEntrance.headingDelay === 160, "Hero entrance starts with the eyebrow while the heading wrapper itself remains stationary");
assert(desktop.heroEntrance.lineDelays.every((delay, index) => delay === index * 100) && desktop.heroEntrance.primaryDelay === desktop.heroEntrance.headingDelay + desktop.heroEntrance.lineDelays.length * 100 && desktop.heroEntrance.secondaryDelay === desktop.heroEntrance.primaryDelay, "Hero lines rise in sequence before both CTAs enter together");
assert(desktop.heroEntrance.actionTransitions.every((properties) => properties.includes("opacity") && properties.includes("transform")), "Each hero CTA owns its independent fade-and-rise transition");
assert(desktop.heroHeader.background === "rgba(22, 35, 27, 0.36)" && desktop.heroHeader.blur === "blur(12px)", "The transparent hero header keeps navigation legible over bright image areas");
assert(desktop.headerUtilities.grouped && desktop.headerUtilities.controlGap >= 7 && desktop.headerUtilities.navigationGap >= 32, "Desktop languages and CTA form one spaced utility group clear of the centered navigation");
assert(desktop.headerUtilities.activeBackground !== "rgba(0, 0, 0, 0)" && desktop.headerUtilities.visibleTrackLabels === 1, "The segmented language control marks the current locale and the animated CTA shows one resting label");
assert(desktop.heroMedia.decoded && desktop.heroMedia.currentSrc.includes(".webp") && desktop.heroMedia.opacity === "1", "The hero reveals a fully decoded modern image rather than streaming partial pixels");
assert(desktop.heroMedia.filter === "none" && desktop.heroMedia.transform === "none" && desktop.heroMedia.pictureDisplay === "block" && desktop.heroMedia.shade === "rgba(0, 0, 0, 0.35)", "The hero avoids the filtered transformed image layer that clips in mobile WebKit");
assert(!desktop.heroLayer.occluded && desktop.heroLayer.position === "fixed" && desktop.heroLayer.mediaVisibility === "visible", "The opening hero remains fully visible and fixed in its active scene");
assert(desktop.heroLayer.canvasBackground === "rgb(22, 35, 27)" && desktop.heroLayer.overscroll === "auto", "The dark viewport backing protects bottom overscroll without disabling native pull-to-refresh at the top");
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
  const phone = document.querySelector(".quick-action--phone").getBoundingClientRect();
  const topAction = document.querySelector("[data-scroll-top]").getBoundingClientRect();
  const phoneLabel = document.querySelector(".quick-action--phone .quick-action__tooltip");
  const cookieTitle = document.querySelector(".cookie-banner__copy strong").getBoundingClientRect();
  const settings = document.querySelector("[data-consent-settings]").getBoundingClientRect();
  return {
    headerGap: content.top - header.bottom,
    bannerGap: banner.top - actions.bottom,
    actionsBottom: actions.bottom,
    phoneHeroTopGap: Math.abs(phone.top - actions.top),
    phoneHeroBottomGap: Math.abs(phone.bottom - actions.bottom),
    phoneWidth: phone.width,
    phoneHeight: phone.height,
    phoneRight: phone.right,
    phoneBannerGap: banner.top - phone.bottom,
    phoneRightGap: Math.abs(banner.right - phone.right),
    topRightGap: Math.abs(topAction.right - phone.right),
    phoneLabelVisible: getComputedStyle(phoneLabel).opacity === "1"
      && getComputedStyle(phoneLabel).position === "static",
    consentWidths: [...document.querySelectorAll("[data-consent-accept], [data-consent-reject]")]
      .map((button) => button.getBoundingClientRect().width),
    consentActionCount: document.querySelector(".cookie-banner__actions").children.length,
    settingsInCopy: document.querySelector("[data-consent-settings]").parentElement.classList.contains("cookie-banner__copy"),
    settingsTitleOffset: Math.abs(settings.top - cookieTitle.top),
  };
});
assert(desktopHeroConsentLayout.headerGap >= 19 && desktopHeroConsentLayout.bannerGap >= 19, "The desktop hero content stays between the header and an undecided consent prompt");
assert(Math.abs(desktopHeroConsentLayout.actionsBottom - desktop.heroActionsBottom) <= 0.5, "Showing the consent prompt does not move hero content");
assert(desktopHeroConsentLayout.phoneWidth >= 120 && desktopHeroConsentLayout.phoneHeight === 48 && desktopHeroConsentLayout.phoneLabelVisible, "Desktop presents the permanent phone as a readable oak call capsule");
assert(desktopHeroConsentLayout.phoneHeroTopGap <= 0.5 && desktopHeroConsentLayout.phoneHeroBottomGap <= 0.5, "Desktop phone aligns vertically with the opening hero actions while consent is pending");
assert(desktopHeroConsentLayout.phoneRightGap <= 0.5 && desktopHeroConsentLayout.phoneBannerGap >= 11, "Desktop phone aligns with the consent rail and remains directly above it");
assert(desktopHeroConsentLayout.consentWidths.every((width) => Math.abs(width - 210) <= 0.5), "Desktop consent actions use the same literal 210px width as every content action");
assert(desktopHeroConsentLayout.consentActionCount === 2 && desktopHeroConsentLayout.settingsInCopy && desktopHeroConsentLayout.settingsTitleOffset <= 0.5, "Consent settings sit beside the title while the primary action row contains only accept and reject");
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
    heroOccluded: document.querySelector(".hero").classList.contains("hero--occluded"),
    heroPosition: getComputedStyle(document.querySelector(".hero")).position,
    heroMediaVisibility: getComputedStyle(document.querySelector(".hero__media")).visibility,
    heroContentVisibility: getComputedStyle(document.querySelector(".hero__content")).visibility,
    heroBackground: getComputedStyle(document.querySelector(".hero")).backgroundColor,
  };
});
assert(footerConsentLayout.footerGap >= 19 && footerConsentLayout.actionsGap >= 11 && footerConsentLayout.bannerTop >= 20, "The desktop consent prompt clears the footer while floating actions remain above it");
assert(Math.abs(footerConsentLayout.heroActionsBottom - desktopHeroConsentLayout.actionsBottom) <= 0.5, "Footer movement does not change the hero content height");
assert(footerConsentLayout.heroOccluded && footerConsentLayout.heroPosition === "fixed" && footerConsentLayout.heroMediaVisibility === "hidden" && footerConsentLayout.heroContentVisibility === "hidden" && footerConsentLayout.heroBackground === "rgb(22, 35, 27)", "Bottom overscroll can reveal only the dark hero base, never the opening image or copy");
await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  scrollTo(0, 0);
  document.documentElement.style.removeProperty("scroll-behavior");
});
await cookieBanner.locator("[data-consent-reject]").click();
await cookieBanner.waitFor({ state: "hidden" });
await page.waitForTimeout(450);
const rejectedPrivacy = await page.evaluate(() => {
  const heroActions = document.querySelector(".hero__actions").getBoundingClientRect();
  const phone = document.querySelector(".quick-action--phone").getBoundingClientRect();
  return {
    consent: JSON.parse(localStorage.getItem("hul:privacy-consent:v1")),
    iframe: Boolean(document.querySelector("iframe[data-interactive-map]")),
    analytics: Boolean(document.querySelector("script[data-hul-analytics]")),
    consentPending: document.documentElement.classList.contains("consent-pending"),
    heroContentBottom: parseFloat(getComputedStyle(document.querySelector(".hero__content")).bottom),
    heroActionsBottom: heroActions.bottom,
    heroOccluded: document.querySelector(".hero").classList.contains("hero--occluded"),
    heroMediaVisibility: getComputedStyle(document.querySelector(".hero__media")).visibility,
    phoneRight: phone.right,
    phoneHeroTopGap: Math.abs(phone.top - heroActions.top),
    phoneHeroBottomGap: Math.abs(phone.bottom - heroActions.bottom),
  };
});
assert(rejectedPrivacy.consent?.version === 1 && !rejectedPrivacy.consent.analytics && !rejectedPrivacy.consent.maps, "Rejecting optional services stores an explicit category-level decision");
assert(!rejectedPrivacy.heroOccluded && rejectedPrivacy.heroMediaVisibility === "visible", "Returning to the top restores the opening hero after its bottom-overscroll guard");
assert(!rejectedPrivacy.iframe && !rejectedPrivacy.analytics, "Rejecting optional services leaves Google resources unloaded");
assert(!rejectedPrivacy.consentPending && rejectedPrivacy.heroContentBottom === 112 && rejectedPrivacy.heroActionsBottom > desktop.heroActionsBottom + 21, "Hiding consent moves hero once to its fixed normal position");
assert(rejectedPrivacy.phoneHeroTopGap <= 0.5 && rejectedPrivacy.phoneHeroBottomGap <= 0.5, "Desktop phone stays vertically aligned with hero actions after the consent prompt closes");
assert(Math.abs(rejectedPrivacy.phoneRight - desktopHeroConsentLayout.phoneRight) <= 0.5, "The desktop phone keeps its content-rail alignment after the consent prompt closes");
await page.reload({ waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(250);
const storedConsentStart = await page.evaluate(() => ({
  consentPending: document.documentElement.classList.contains("consent-pending"),
  bannerHidden: document.querySelector("[data-cookie-banner]").hidden,
  heroContentBottom: parseFloat(getComputedStyle(document.querySelector(".hero__content")).bottom),
}));
assert(!storedConsentStart.consentPending && storedConsentStart.bannerHidden && storedConsentStart.heroContentBottom === 112, "A saved choice starts directly in the normal hero state without a first-paint jump");

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

const topReloadContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await topReloadContext.addInitScript(() => {
  localStorage.setItem("hul:privacy-consent:v1", JSON.stringify({ version: 1, analytics: false, maps: false }));
});
let delayTopScript = false;
await topReloadContext.route("**/script.js", async (route) => {
  if (delayTopScript) await new Promise((resolve) => setTimeout(resolve, 1200));
  await route.continue();
});
const topReloadPage = await topReloadContext.newPage();
const topUrl = new URL(baseUrl);
topUrl.hash = "top";
await topReloadPage.goto(topUrl.href, { waitUntil: "networkidle" });
await topReloadPage.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  document.querySelector(".about").scrollIntoView();
  document.documentElement.style.removeProperty("scroll-behavior");
});
const topReloadStart = await topReloadPage.evaluate(() => scrollY);
const previousTopDocumentOrigin = await topReloadPage.evaluate(() => performance.timeOrigin);
delayTopScript = true;
await topReloadPage.reload({ waitUntil: "commit" });
await topReloadPage.waitForFunction((previousOrigin) => performance.timeOrigin !== previousOrigin, previousTopDocumentOrigin);
await topReloadPage.waitForFunction(() => document.readyState !== "loading");
await topReloadPage.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
const topReloadPositions = [await topReloadPage.evaluate(() => scrollY)];
for (const delay of [50, 150, 400]) {
  await topReloadPage.waitForTimeout(delay);
  topReloadPositions.push(await topReloadPage.evaluate(() => scrollY));
}
await topReloadPage.waitForLoadState("load");
await topReloadPage.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const topReloadState = await topReloadPage.evaluate(() => ({
  lock: document.documentElement.classList.contains("initial-top"),
  restoration: history.scrollRestoration,
}));
assert(
  topReloadStart > 900 && topReloadPositions.every((position) => position <= 1),
  `Reloading a #top URL appears at the hero immediately even while the main script is delayed (start ${topReloadStart}; samples ${topReloadPositions.join(", ")})`,
);
assert(!topReloadState.lock && topReloadState.restoration === "auto", "Initial #top locking releases after pageshow and restores normal browser history behavior");

await topReloadPage.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  document.querySelector(".about").scrollIntoView();
  document.documentElement.style.removeProperty("scroll-behavior");
});
const smoothTopStart = await topReloadPage.evaluate(() => scrollY);
await topReloadPage.locator(".header__top > .logo").click();
await topReloadPage.waitForTimeout(120);
const smoothTopMiddle = await topReloadPage.evaluate(() => scrollY);
await topReloadPage.waitForFunction(() => scrollY <= 1);
assert(smoothTopMiddle > 1 && smoothTopMiddle < smoothTopStart, "Later logo clicks retain the intended smooth return-to-top motion");
await topReloadContext.close();

await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  scrollTo(0, document.documentElement.scrollHeight);
  document.documentElement.style.removeProperty("scroll-behavior");
});
await page.waitForTimeout(620);
const footerQuickActions = await page.evaluate(() => {
  const phone = document.querySelector(".quick-action--phone").getBoundingClientRect();
  const topAction = document.querySelector("[data-scroll-top]").getBoundingClientRect();
  const footer = document.querySelector(".footer").getBoundingClientRect();
  return {
    gap: footer.top - phone.bottom,
    rightEdgeGap: Math.abs(phone.right - topAction.right),
    darkSurface: document.querySelector("[data-quick-actions]").classList.contains("quick-actions--on-dark"),
    phoneBackground: getComputedStyle(document.querySelector(".quick-action--phone")).backgroundColor,
    phoneColor: getComputedStyle(document.querySelector(".quick-action--phone")).color,
  };
});
assert(footerQuickActions.gap >= 12 && footerQuickActions.darkSurface, "Floating actions clear the footer logo and detect the dark ending");
assert(footerQuickActions.rightEdgeGap <= 0.5, "Visible back-to-top control shares the phone capsule's right edge");
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
  phoneWidth: document.querySelector(".quick-action--phone").getBoundingClientRect().width,
  phoneLabelDisplay: getComputedStyle(document.querySelector(".quick-action--phone .quick-action__tooltip")).display,
  phoneClearsHeroActions: (() => {
    const phone = document.querySelector(".quick-action--phone").getBoundingClientRect();
    return [...document.querySelectorAll(".hero__actions .motion-button")].every((action) => {
      const rect = action.getBoundingClientRect();
      return rect.right <= phone.left - 11
        || rect.left >= phone.right + 11
        || rect.bottom <= phone.top - 11
        || rect.top >= phone.bottom + 11;
    });
  })(),
  heroActionWidths: [...document.querySelectorAll(".hero__actions .motion-button")].map((button) => button.getBoundingClientRect().width),
  mapActionWidths: [...document.querySelectorAll(".map-preview__actions > *")].map((button) => button.getBoundingClientRect().width),
  routeActionWidth: document.querySelector(".visit__details .motion-button").getBoundingClientRect().width,
}));
assert(mobileState.ctaLines === 3, "Mobile CTA keeps the target three-line split after resize");
assert(mobileState.overflow === 0, "Mobile has no horizontal overflow");
assert(mobileState.menuInert && mobileState.menuHidden === "true", "Closed mobile navigation is removed from focus order");
assert(mobileState.heroImage.includes("hero-mobile"), "Mobile loads the dedicated hero crop");
assert(mobileState.phoneWidth === 48 && mobileState.phoneLabelDisplay === "none", "Mobile keeps the compact thumb-friendly phone icon");
assert(mobileState.phoneClearsHeroActions, "Mobile phone keeps a safe gap from the equal-width hero actions");
assert([
  ...mobileState.heroActionWidths,
  ...mobileState.mapActionWidths,
  mobileState.routeActionWidth,
].every((width) => Math.abs(width - 145) <= 0.5), "390px hero, map and directions actions share the literal responsive width");

const raisedPhoneBottom = await page.locator(".quick-action--phone").evaluate((phone) => innerHeight - phone.getBoundingClientRect().bottom);
await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  scrollTo(0, innerHeight * 1.75);
  document.documentElement.style.removeProperty("scroll-behavior");
});
await page.waitForTimeout(520);
const scrolledPhoneBottom = await page.locator(".quick-action--phone").evaluate((phone) => innerHeight - phone.getBoundingClientRect().bottom);
assert(Math.abs(scrolledPhoneBottom - raisedPhoneBottom) <= 0.5, "Mobile phone keeps its elevated hero-row position while the page scrolls");
await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  scrollTo(0, 0);
  document.documentElement.style.removeProperty("scroll-behavior");
});
await page.waitForTimeout(120);

const stableHeadingGlyph = await page.locator(".hero .split-char").first().elementHandle();
await page.evaluate(() => window.dispatchEvent(new Event("resize")));
await page.waitForTimeout(180);
assert(await stableHeadingGlyph.evaluate((glyph) => glyph.isConnected), "Height-only mobile resize events do not rebuild the hero heading");

const stableMobileHeroCrop = await page.evaluate(() => {
  const hero = document.querySelector(".hero");
  const media = document.querySelector(".hero__media");
  const image = document.querySelector(".hero__media img");
  const initialMediaHeight = media.getBoundingClientRect().height;
  const initialHeroHeight = hero.getBoundingClientRect().height;
  hero.style.height = `${initialHeroHeight - 96}px`;
  const shortenedHeroHeight = hero.getBoundingClientRect().height;
  const shortenedMediaHeight = media.getBoundingClientRect().height;
  hero.style.removeProperty("height");
  return {
    initialMediaHeight,
    shortenedHeroHeight,
    shortenedMediaHeight,
    imageTransform: getComputedStyle(image).transform,
  };
});
assert(
  Math.abs(stableMobileHeroCrop.initialMediaHeight - stableMobileHeroCrop.shortenedMediaHeight) <= 0.5
    && stableMobileHeroCrop.shortenedMediaHeight > stableMobileHeroCrop.shortenedHeroHeight + 90
    && stableMobileHeroCrop.imageTransform === "none",
  "Mobile browser-chrome height changes reveal a stable hero crop instead of rescaling the image",
);

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
assert(mobileState.height === 240 && mobileState.open, "Mobile menu opens to the target 240px height with language selection");
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
await page.mouse.click(195, 400);
await page.waitForTimeout(100);
mobileState = await page.evaluate(() => ({
  open: document.querySelector(".header").classList.contains("header--open"),
  expanded: document.querySelector(".menu-toggle").getAttribute("aria-expanded"),
  inert: document.querySelector(".header__mobile-links").inert,
  bodyMenuOpen: document.body.classList.contains("menu-open"),
  quickActionsInert: document.querySelector("[data-quick-actions]").inert,
}));
assert(!mobileState.open && mobileState.expanded === "false" && mobileState.inert && !mobileState.bodyMenuOpen && !mobileState.quickActionsInert, "A pointer press outside the mobile navigation closes it and restores the page controls");

await page.locator(".menu-toggle").click();
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(220);
assert(!(await page.locator(".header").evaluate((header) => header.classList.contains("header--open"))), "Desktop resize clears the mobile menu state");

for (const width of [320, 431, 768, 810, 1199, 1200, 1664, 1920]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(width <= 431 ? 520 : 220);
  const responsiveLayout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    phoneWidth: document.querySelector(".quick-action--phone").getBoundingClientRect().width,
    phoneLabelOpacity: getComputedStyle(document.querySelector(".quick-action--phone .quick-action__tooltip")).opacity,
    phoneRightInset: innerWidth - document.querySelector(".quick-action--phone").getBoundingClientRect().right,
    phoneBottomInset: innerHeight - document.querySelector(".quick-action--phone").getBoundingClientRect().bottom,
  }));
  assert(responsiveLayout.overflow === 0, `No horizontal overflow at ${width}px`);
  if (width === 431) assert(Math.abs(responsiveLayout.phoneRightInset - 8) <= 0.5 && Math.abs(responsiveLayout.phoneBottomInset - 40) <= 0.5, "Large mobile aligns the phone with the consent rail while retaining its elevated hero-row position");
  if (width === 1199) assert(responsiveLayout.phoneWidth === 48, "Phone remains a compact icon immediately below the desktop breakpoint");
  if (width === 1200) assert(responsiveLayout.phoneWidth >= 120 && responsiveLayout.phoneLabelOpacity === "1", "Phone becomes a labelled capsule exactly at the desktop breakpoint");
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
        buttonWidths: [...document.querySelectorAll(".hero__actions .motion-button")].map((action) => action.getBoundingClientRect().width),
        mapButtonWidths: [...document.querySelectorAll(".map-preview__actions > *")].map((action) => action.getBoundingClientRect().width),
        mapButtonPadding: getComputedStyle(document.querySelector(".map-preview__button")).paddingLeft,
        routeButtonWidth: document.querySelector(".visit__details .motion-button").getBoundingClientRect().width,
        phoneClearance,
      };
    });
    assert(hero.lines === 4 && hero.fontSize === "36px" && hero.lineHeight === "36px", "320px hero keeps the target four-line 36px heading");
    assert(hero.buttonFontSize === "16px" && hero.buttonPadding === "6px", "320px hero buttons keep their typography and use compact padding so equal columns do not clip labels");
    assert([
      ...hero.buttonWidths,
      ...hero.mapButtonWidths,
      hero.routeButtonWidth,
    ].every((buttonWidth) => Math.abs(buttonWidth - 134) <= 0.5) && hero.mapButtonPadding === "5px", "320px gives hero, map and directions actions the same literal 134px width without clipping labels");
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

const dynamicIphoneContext = await browser.newContext(devices["iPhone 15 Pro Max"]);
await dynamicIphoneContext.addInitScript(() => {
  localStorage.setItem("hul:privacy-consent:v1", JSON.stringify({ version: 1, analytics: false, maps: false }));
});
const dynamicIphonePage = await dynamicIphoneContext.newPage();
await dynamicIphonePage.goto(baseUrl, { waitUntil: "networkidle" });
const dynamicHeroStates = [];
for (const viewportHeight of [739, 789, 839, 739]) {
  if (viewportHeight !== 739 || dynamicHeroStates.length) {
    await dynamicIphonePage.evaluate(() => scrollTo(0, 12));
    await dynamicIphonePage.setViewportSize({ width: 430, height: viewportHeight });
  }
  await dynamicIphonePage.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  dynamicHeroStates.push(await dynamicIphonePage.evaluate(() => {
    const hero = document.querySelector(".hero").getBoundingClientRect();
    const media = document.querySelector(".hero__media");
    const mediaRect = media.getBoundingClientRect();
    const image = media.querySelector("img");
    return {
      viewportHeight: innerHeight,
      heroHeight: hero.height,
      mediaHeight: mediaRect.height,
      lockedHeight: media.style.getPropertyValue("--hero-media-height"),
      currentSrc: image.currentSrc,
      imageTransform: getComputedStyle(image).transform,
    };
  }));
}
const dynamicMediaHeights = dynamicHeroStates.map((state) => state.mediaHeight);
assert(
  Math.max(...dynamicMediaHeights) - Math.min(...dynamicMediaHeights) <= 0.5
    && Math.max(...dynamicHeroStates.map((state) => state.heroHeight)) - Math.min(...dynamicHeroStates.map((state) => state.heroHeight)) >= 90
    && dynamicHeroStates.every((state) => state.mediaHeight + 0.5 >= state.heroHeight && state.lockedHeight.endsWith("px") && state.currentSrc === dynamicHeroStates[0].currentSrc && state.imageTransform === "none"),
  "iPhone browser-chrome height changes keep one pixel-locked hero crop without source or transform jumps",
);
await dynamicIphonePage.setViewportSize({ width: 390, height: 844 });
await dynamicIphonePage.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const widthChangedHero = await dynamicIphonePage.evaluate(() => ({
  mediaHeight: document.querySelector(".hero__media").getBoundingClientRect().height,
  viewportHeight: innerHeight,
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
assert(
  Math.abs(widthChangedHero.mediaHeight - widthChangedHero.viewportHeight) <= 1 && widthChangedHero.overflow === 0,
  "The mobile hero crop recalculates normally after a genuine width change",
);
await dynamicIphonePage.setViewportSize({ width: 667, height: 320 });
await dynamicIphonePage.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
await dynamicIphonePage.setViewportSize({ width: 667, height: 375 });
await dynamicIphonePage.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const landscapeHero = await dynamicIphonePage.evaluate(() => ({
  heroHeight: document.querySelector(".hero").getBoundingClientRect().height,
  mediaHeight: document.querySelector(".hero__media").getBoundingClientRect().height,
  lockedHeight: document.querySelector(".hero__media").style.getPropertyValue("--hero-media-height"),
}));
assert(
  landscapeHero.mediaHeight + 0.5 >= landscapeHero.heroHeight && landscapeHero.lockedHeight === "",
  "Short landscape phones keep the dynamic hero fully covered without a stale portrait lock",
);
await dynamicIphoneContext.close();

const underreportedLargeViewportContext = await browser.newContext({
  ...devices["iPhone 15 Pro Max"],
  viewport: { width: 430, height: 735 },
  screen: { width: 430, height: 932 },
});
await underreportedLargeViewportContext.addInitScript(() => {
  localStorage.setItem("hul:privacy-consent:v1", JSON.stringify({ version: 1, analytics: false, maps: false }));
});
let underreportedLargeViewportCssApplied = false;
await underreportedLargeViewportContext.route("**/src/styles.css", async (route) => {
  const response = await route.fetch();
  const sourceCss = await response.text();
  const largeViewportDeclaration = "height: var(--hero-media-height, 100lvh);";
  underreportedLargeViewportCssApplied = sourceCss.includes(largeViewportDeclaration);
  const css = sourceCss.replace(
    largeViewportDeclaration,
    "height: var(--hero-media-height, 625px);",
  );
  await route.fulfill({ response, body: css, contentType: "text/css" });
});
const underreportedLargeViewportPage = await underreportedLargeViewportContext.newPage();
await underreportedLargeViewportPage.goto(baseUrl, { waitUntil: "networkidle" });
const underreportedLargeViewportStates = [];
for (const viewportHeight of [735, 789, 839, 735]) {
  if (underreportedLargeViewportStates.length) {
    await underreportedLargeViewportPage.evaluate(() => scrollTo(0, 12));
    await underreportedLargeViewportPage.setViewportSize({ width: 430, height: viewportHeight });
  }
  await underreportedLargeViewportPage.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  underreportedLargeViewportStates.push(await underreportedLargeViewportPage.evaluate(() => {
    const hero = document.querySelector(".hero").getBoundingClientRect();
    const mediaElement = document.querySelector(".hero__media");
    const media = mediaElement.getBoundingClientRect();
    const image = mediaElement.querySelector("img");
    return {
      heroHeight: hero.height,
      mediaHeight: media.height,
      uncoveredBottom: Math.max(0, hero.bottom - media.bottom),
      lockedHeight: parseFloat(mediaElement.style.getPropertyValue("--hero-media-height")),
      currentSrc: image.currentSrc,
      imageTransform: getComputedStyle(image).transform,
    };
  }));
}
const underreportedMediaHeights = underreportedLargeViewportStates.map((state) => state.mediaHeight);
assert(
  underreportedLargeViewportCssApplied
    && Math.max(...underreportedMediaHeights) - Math.min(...underreportedMediaHeights) <= 0.5
    && underreportedLargeViewportStates.every((state) => state.mediaHeight + 0.5 >= state.heroHeight
      && state.uncoveredBottom <= 0.5
      && Math.abs(state.lockedHeight - 839) <= 1
      && state.currentSrc === underreportedLargeViewportStates[0].currentSrc
      && state.imageTransform === "none"),
  "Brave-style underreported 100lvh keeps one stable hero crop with no exposed bottom strip",
);
await underreportedLargeViewportContext.close();

const noJsPage = await browser.newPage({
  javaScriptEnabled: false,
  viewport: { width: 390, height: 844 },
});
await noJsPage.goto(baseUrl, { waitUntil: "networkidle" });
const noJs = await noJsPage.evaluate(() => ({
  js: document.documentElement.classList.contains("js"),
  heroPosition: getComputedStyle(document.querySelector(".hero")).position,
  overscroll: getComputedStyle(document.documentElement).overscrollBehaviorY,
  canvasBackground: getComputedStyle(document.documentElement).backgroundColor,
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
assert(noJs.heroPosition === "absolute" && noJs.overscroll === "auto" && noJs.canvasBackground === "rgb(22, 35, 27)", "No-JS mode scrolls the hero away, keeps a dark overscroll backing surface and preserves pull-to-refresh");
assert(noJs.headerHeight === 240 && noJs.menuVisibility === "hidden", "No-JS mobile navigation and language selection stay permanently visible without a fake toggle");
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
await mapPage.locator("[data-consent-maps]").evaluate((input) => {
  input.checked = false;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
});
const revokeNavigation = mapPage.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => null);
await mapPage.locator("[data-consent-save]").click();
await revokeNavigation;
await mapPage.waitForFunction(() => {
  const consent = JSON.parse(localStorage.getItem("hul:privacy-consent:v1"));
  return consent && !consent.maps && !document.querySelector("iframe[data-interactive-map]");
});
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
const mobileBannerLayout = await acceptPage.evaluate(() => {
  const primaryActions = [...document.querySelectorAll("[data-consent-accept], [data-consent-reject]")]
    .map((button) => button.getBoundingClientRect());
  const settings = document.querySelector("[data-consent-settings]").getBoundingClientRect();
  const title = document.querySelector(".cookie-banner__copy strong").getBoundingClientRect();
  return {
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bannerTop: document.querySelector("[data-cookie-banner]").getBoundingClientRect().top,
    bannerHeight: document.querySelector("[data-cookie-banner]").getBoundingClientRect().height,
    copyLines: Math.round(
      document.querySelector(".cookie-banner__copy p").getBoundingClientRect().height
        / parseFloat(getComputedStyle(document.querySelector(".cookie-banner__copy p")).lineHeight),
    ),
    primaryActions: primaryActions.map((rect) => ({
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
    })),
    settings: { left: settings.left, right: settings.right, top: settings.top, bottom: settings.bottom },
    settingsTitleOffset: Math.abs(settings.top - title.top),
    sharedWidths: [
      ...document.querySelectorAll(".hero__actions .motion-button, .map-preview__actions > *"),
      document.querySelector(".visit__details .motion-button"),
      ...document.querySelectorAll("[data-consent-accept], [data-consent-reject]"),
    ].map((button) => button.getBoundingClientRect().width),
    quickActions: [...document.querySelectorAll(".quick-action.is-visible")].map((action) => {
      const rect = action.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }),
  };
});
assert(mobileBannerLayout.overflow === 0 && [...mobileBannerLayout.primaryActions, mobileBannerLayout.settings].every((rect) => rect.left >= 0 && rect.right <= 320 && rect.top >= 0 && rect.bottom <= 568), "The complete consent prompt stays reachable at 320px");
assert(new Set(mobileBannerLayout.primaryActions.map((rect) => Math.round(rect.top))).size === 1 && mobileBannerLayout.primaryActions.every((rect) => Math.abs(rect.width - 134) <= 0.5) && mobileBannerLayout.sharedWidths.every((width) => Math.abs(width - 134) <= 0.5), "Every 320px content and consent action uses the same literal 134px width");
assert(mobileBannerLayout.settingsTitleOffset <= 0.5 && mobileBannerLayout.copyLines <= 2 && mobileBannerLayout.bannerHeight <= 150, "Mobile consent settings sit beside the title while the copy remains compact at 320px");
assert(mobileBannerLayout.quickActions.length === 2 && mobileBannerLayout.quickActions.every((rect) => rect.left >= 0 && rect.right <= 320 && rect.top >= 0 && rect.bottom <= mobileBannerLayout.bannerTop - 8), "Floating actions move above the mobile consent prompt without overlap");
await acceptPage.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  scrollTo(0, document.documentElement.scrollHeight);
  document.documentElement.style.removeProperty("scroll-behavior");
});
await acceptPage.waitForTimeout(520);
const mobileFooterConsentLayout = await acceptPage.evaluate(() => {
  const header = document.querySelector(".header__top").getBoundingClientRect();
  const banner = document.querySelector("[data-cookie-banner]").getBoundingClientRect();
  const footer = document.querySelector(".footer").getBoundingClientRect();
  const quickActions = document.querySelector("[data-quick-actions]");
  const contactCta = document.querySelector(".contact-cta").getBoundingClientRect();
  const contactContentElement = document.querySelector(".contact-cta__content");
  const contactContent = contactContentElement.getBoundingClientRect();
  const contactButton = document.querySelector(".contact-cta .motion-button").getBoundingClientRect();
  const phone = document.querySelector(".quick-action--phone").getBoundingClientRect();
  const intersects = (first, second) => first.right > second.left + 1
    && first.left < second.right - 1
    && first.bottom > second.top + 1
    && first.top < second.bottom - 1;
  return {
    footerGap: footer.top - banner.bottom,
    bannerTop: banner.top,
    heroActionsBottom: document.querySelector(".hero__actions").getBoundingClientRect().bottom,
    contactGap: banner.top - contactContent.bottom,
    contactInset: contactContent.top - contactCta.top,
    contactReserve: contactCta.height - contactContent.height - banner.height,
    contentAnimatesTop: getComputedStyle(contactContentElement).transitionProperty
      .split(",").map((property) => property.trim()).includes("top"),
    topActionDisplay: getComputedStyle(document.querySelector("[data-scroll-top]")).display,
    phoneVisible: phone.width === 48 && phone.height === 48,
    phoneClearsButton: !intersects(contactButton, phone),
    phoneClearsContent: !intersects(contactContent, phone),
    phoneClearsFooter: !intersects(footer, phone),
    phoneBannerGap: banner.top - phone.bottom,
    phoneHeaderGap: phone.top - header.bottom,
    phoneRightGap: Math.abs(phone.right - banner.right),
    phoneDocked: quickActions.classList.contains("quick-actions--footer-docked"),
  };
});
assert(mobileFooterConsentLayout.footerGap >= 7 && mobileFooterConsentLayout.bannerTop >= 8, "The mobile consent prompt clears the footer without being pushed off-screen");
assert(mobileFooterConsentLayout.contactGap >= 11 && mobileFooterConsentLayout.contactInset >= 15 && mobileFooterConsentLayout.contactReserve >= 39 && mobileFooterConsentLayout.contentAnimatesTop, "The final mobile contact CTA reserves enough real space and moves smoothly above consent");
assert(mobileFooterConsentLayout.topActionDisplay === "none" && mobileFooterConsentLayout.phoneVisible, "The compact footer state keeps the phone visible and suppresses only the competing top arrow");
assert(mobileFooterConsentLayout.phoneClearsButton, "The compact footer phone clears the final CTA button");
assert(mobileFooterConsentLayout.phoneClearsContent, "The compact footer phone clears the complete final CTA content block");
assert(mobileFooterConsentLayout.phoneClearsFooter, "The compact footer phone remains outside the footer");
assert(!mobileFooterConsentLayout.phoneDocked && mobileFooterConsentLayout.phoneBannerGap >= 11 && mobileFooterConsentLayout.phoneHeaderGap >= 7 && mobileFooterConsentLayout.phoneRightGap <= 0.5, "The phone stays on the consent rail above page content instead of jumping into the footer");
assert(Math.abs(mobileFooterConsentLayout.heroActionsBottom - mobileHeroConsentLayout.actionsBottom) <= 0.5, "Mobile footer movement leaves hero content at its fixed consent height");
await acceptPage.locator("[data-consent-accept]").click();
await acceptPage.locator("[data-cookie-banner]").waitFor({ state: "hidden" });
await acceptPage.locator("iframe[data-interactive-map]").waitFor({ state: "attached" });
await acceptPage.waitForTimeout(450);
const acceptedPrivacy = await acceptPage.evaluate(() => ({
  consent: JSON.parse(localStorage.getItem("hul:privacy-consent:v1")),
  analyticsScript: Boolean(document.querySelector("script[data-hul-analytics]")),
  contactTop: parseFloat(getComputedStyle(document.querySelector(".contact-cta__content")).top),
  contactMinHeight: parseFloat(getComputedStyle(document.querySelector(".contact-cta")).minHeight),
  topActionDisplay: getComputedStyle(document.querySelector("[data-scroll-top]")).display,
  ctaGuard: document.querySelector("[data-quick-actions]").classList.contains("quick-actions--cta-guard"),
  phoneDocked: document.querySelector("[data-quick-actions]").classList.contains("quick-actions--footer-docked"),
  inlineOffset: document.querySelector(".contact-cta").style.getPropertyValue("--contact-cta-content-offset"),
  inlineMinHeight: document.querySelector(".contact-cta").style.getPropertyValue("--contact-cta-consent-min-height"),
}));
assert(acceptedPrivacy.consent.analytics && acceptedPrivacy.consent.maps, "Accept all stores both optional categories");
assert(!acceptedPrivacy.analyticsScript, "Analytics stays physically inactive until a real GA4 measurement ID is configured");
assert(Math.abs(acceptedPrivacy.contactTop) <= 0.5 && Math.abs(acceptedPrivacy.contactMinHeight) <= 0.5 && acceptedPrivacy.topActionDisplay === "grid" && !acceptedPrivacy.ctaGuard && !acceptedPrivacy.phoneDocked && !acceptedPrivacy.inlineOffset && !acceptedPrivacy.inlineMinHeight, "Accepting consent returns the final CTA, phone and top arrow to their normal state");
await acceptContext.close();

const wideMobileConsentContext = await browser.newContext({ viewport: { width: 700, height: 932 } });
const wideMobileConsentPage = await wideMobileConsentContext.newPage();
await wideMobileConsentPage.goto(baseUrl, { waitUntil: "networkidle" });
await wideMobileConsentPage.evaluate(() => document.fonts.ready);
await wideMobileConsentPage.locator("[data-cookie-banner]").waitFor({ state: "visible" });
const wideMobileActionWidths = await wideMobileConsentPage.evaluate(() => ({
  hero: [...document.querySelectorAll(".hero__actions .motion-button")].map((button) => button.getBoundingClientRect().width),
  route: document.querySelector(".visit__details .motion-button").getBoundingClientRect().width,
  map: [...document.querySelectorAll(".map-preview__actions > *")].map((button) => button.getBoundingClientRect().width),
  consent: [...document.querySelectorAll("[data-consent-accept], [data-consent-reject]")].map((button) => button.getBoundingClientRect().width),
}));
assert([
  ...wideMobileActionWidths.hero,
  wideMobileActionWidths.route,
  ...wideMobileActionWidths.map,
  ...wideMobileActionWidths.consent,
].every((width) => Math.abs(width - 210) <= 0.5), "Wide mobile gives hero, directions, map and consent actions the same literal 210px width");
await wideMobileConsentPage.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  scrollTo(0, document.documentElement.scrollHeight);
  document.documentElement.style.removeProperty("scroll-behavior");
});
await wideMobileConsentPage.waitForTimeout(620);
const wideMobileFooterConsent = await wideMobileConsentPage.evaluate(() => {
  const banner = document.querySelector("[data-cookie-banner]").getBoundingClientRect();
  const phone = document.querySelector(".quick-action--phone").getBoundingClientRect();
  const quickActions = document.querySelector("[data-quick-actions]");
  return {
    topActionDisplay: getComputedStyle(document.querySelector("[data-scroll-top]")).display,
    guarded: quickActions.classList.contains("quick-actions--cta-guard"),
    phoneWidth: phone.width,
    phoneHeight: phone.height,
    phoneBannerGap: banner.top - phone.bottom,
  };
});
assert(wideMobileFooterConsent.topActionDisplay === "none" && wideMobileFooterConsent.guarded && wideMobileFooterConsent.phoneWidth === 48 && wideMobileFooterConsent.phoneHeight === 48 && wideMobileFooterConsent.phoneBannerGap >= 11, "The Edge-width mobile footer hides the competing arrow while keeping the phone above undecided consent");
await wideMobileConsentContext.close();

const consentBoundaryContext = await browser.newContext({ viewport: { width: 809, height: 700 } });
const consentBoundaryPage = await consentBoundaryContext.newPage();
await consentBoundaryPage.goto(baseUrl, { waitUntil: "networkidle" });
await consentBoundaryPage.evaluate(() => document.fonts.ready);
await consentBoundaryPage.locator("[data-cookie-banner]").waitFor({ state: "visible" });
for (const height of [700, 900]) {
  for (const width of [809, 810, 899, 900, 1199, 1200]) {
    await consentBoundaryPage.setViewportSize({ width, height });
    await consentBoundaryPage.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      scrollTo(0, document.documentElement.scrollHeight);
      document.documentElement.style.removeProperty("scroll-behavior");
    });
    await consentBoundaryPage.waitForTimeout(620);
    const boundaryLayout = await consentBoundaryPage.evaluate(() => {
      const bannerElement = document.querySelector("[data-cookie-banner]");
      const banner = bannerElement.getBoundingClientRect();
      const contactCta = document.querySelector(".contact-cta").getBoundingClientRect();
      const contactContentElement = document.querySelector(".contact-cta__content");
      const contactContent = contactContentElement.getBoundingClientRect();
      const footer = document.querySelector(".footer").getBoundingClientRect();
      const header = document.querySelector(".header__top").getBoundingClientRect();
      const phone = document.querySelector(".quick-action--phone").getBoundingClientRect();
      const copy = document.querySelector(".cookie-banner__copy p");
      const mobile = innerWidth <= 809;
      return {
        bannerHeight: banner.height,
        bannerColumns: getComputedStyle(bannerElement).gridTemplateColumns.trim().split(/\s+/).length,
        copyLines: Math.round(copy.getBoundingClientRect().height / parseFloat(getComputedStyle(copy).lineHeight)),
        contentGap: banner.top - contactContent.bottom,
        footerGap: footer.top - banner.bottom,
        phoneGap: banner.top - phone.bottom,
        contentSafeTop: contactContent.top - Math.max(contactCta.top + 16, header.bottom + 8, mobile ? 8 : 20),
        guard: document.querySelector("[data-quick-actions]").classList.contains("quick-actions--cta-guard"),
        arrowDisplay: getComputedStyle(document.querySelector("[data-scroll-top]")).display,
        inlineReserve: parseFloat(document.querySelector(".contact-cta").style.getPropertyValue("--contact-cta-consent-min-height")),
        requiredReserve: contactContentElement.offsetHeight + banner.height + (mobile ? 40 : 48),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert(boundaryLayout.overflow === 0 && boundaryLayout.contentGap >= 11 && boundaryLayout.contentSafeTop >= -1, `Pending consent keeps the final CTA readable at ${width}x${height}`);
    assert(boundaryLayout.phoneGap >= 11 && boundaryLayout.footerGap >= (width <= 809 ? 7 : 19), `Pending consent keeps floating UI and footer clear at ${width}x${height}`);
    assert(boundaryLayout.inlineReserve + 1 >= boundaryLayout.requiredReserve, `Final CTA reserves enough real layout space at ${width}x${height}`);
    if (width <= 899) {
      assert(boundaryLayout.bannerColumns === 1 && boundaryLayout.bannerHeight <= 150, `Consent stacks compactly through ${width}px`);
    } else {
      assert(boundaryLayout.bannerColumns === 2 && boundaryLayout.bannerHeight <= 113.5 && boundaryLayout.copyLines <= 2, `Consent uses its compact horizontal layout from ${width}px`);
    }
    if (width <= 1199) {
      assert(boundaryLayout.guard && boundaryLayout.arrowDisplay === "none", `A real CTA collision suppresses only the secondary arrow at ${width}x${height}`);
    } else {
      assert(!boundaryLayout.guard && boundaryLayout.arrowDisplay === "grid", `Desktop keeps its natural CTA and arrow layout at ${width}x${height}`);
    }
  }
}
await consentBoundaryPage.setViewportSize({ width: 810, height: 700 });
await consentBoundaryPage.locator("[data-consent-reject]").click();
await consentBoundaryPage.locator("[data-cookie-banner]").waitFor({ state: "hidden" });
await consentBoundaryPage.waitForTimeout(450);
const tabletConsentReset = await consentBoundaryPage.evaluate(() => ({
  contentTop: parseFloat(getComputedStyle(document.querySelector(".contact-cta__content")).top),
  minHeight: parseFloat(getComputedStyle(document.querySelector(".contact-cta")).minHeight),
  arrowDisplay: getComputedStyle(document.querySelector("[data-scroll-top]")).display,
  guard: document.querySelector("[data-quick-actions]").classList.contains("quick-actions--cta-guard"),
  inlineOffset: document.querySelector(".contact-cta").style.getPropertyValue("--contact-cta-content-offset"),
  inlineReserve: document.querySelector(".contact-cta").style.getPropertyValue("--contact-cta-consent-min-height"),
}));
assert(Math.abs(tabletConsentReset.contentTop) <= 0.5 && Math.abs(tabletConsentReset.minHeight) <= 0.5 && tabletConsentReset.arrowDisplay === "grid" && !tabletConsentReset.guard && !tabletConsentReset.inlineOffset && !tabletConsentReset.inlineReserve, "Closing consent fully restores the tablet CTA and floating controls");
await consentBoundaryContext.close();

const stableFooterPhoneContext = await browser.newContext({ viewport: { width: 430, height: 932 } });
const stableFooterPhonePage = await stableFooterPhoneContext.newPage();
await stableFooterPhonePage.goto(baseUrl, { waitUntil: "networkidle" });
await stableFooterPhonePage.locator("[data-cookie-banner]").waitFor({ state: "visible" });
await stableFooterPhonePage.locator("[data-contact-map]").scrollIntoViewIfNeeded();
await stableFooterPhonePage.waitForTimeout(80);
await stableFooterPhonePage.evaluate(() => {
  const mapActions = document.querySelector(".map-preview__actions").getBoundingClientRect();
  const banner = document.querySelector("[data-cookie-banner]").getBoundingClientRect();
  scrollBy(0, mapActions.bottom - (banner.top - 12));
});
await stableFooterPhonePage.waitForTimeout(720);
const mobileMapPhoneLayout = await stableFooterPhonePage.evaluate(() => {
  const phone = document.querySelector(".quick-action--phone").getBoundingClientRect();
  const mapActions = document.querySelector(".map-preview__actions").getBoundingClientRect();
  const consentActions = document.querySelector(".cookie-banner__actions").getBoundingClientRect();
  const mapButtons = [...document.querySelectorAll(".map-preview__actions > *")]
    .map((button) => button.getBoundingClientRect());
  const consentButtons = [...document.querySelectorAll("[data-consent-accept], [data-consent-reject]")]
    .map((button) => button.getBoundingClientRect());
  const routeButton = document.querySelector(".visit__details .motion-button").getBoundingClientRect();
  const intersects = phone.right > mapActions.left + 1
    && phone.left < mapActions.right - 1
    && phone.bottom > mapActions.top + 1
    && phone.top < mapActions.bottom - 1;
  return {
    intersects,
    phoneMapGap: mapActions.top - phone.bottom,
    groupWidthDelta: Math.abs(mapActions.width - consentActions.width),
    mapGap: mapButtons[1].left - mapButtons[0].right,
    consentGap: consentButtons[1].left - consentButtons[0].right,
    routeConsentLeftDelta: Math.abs(routeButton.left - consentButtons[0].left),
    widths: [...mapButtons, ...consentButtons].map((rect) => rect.width),
    heights: [...mapButtons, ...consentButtons].map((rect) => rect.height),
  };
});
assert(!mobileMapPhoneLayout.intersects && mobileMapPhoneLayout.phoneMapGap >= 11, "The mobile phone rises above the complete map CTA row instead of covering Google Maps");
assert(mobileMapPhoneLayout.groupWidthDelta <= 0.5 && Math.abs(mobileMapPhoneLayout.mapGap - 12) <= 0.5 && Math.abs(mobileMapPhoneLayout.consentGap - 12) <= 0.5 && mobileMapPhoneLayout.widths.every((width) => Math.abs(width - 165) <= 0.5) && mobileMapPhoneLayout.heights.every((height) => Math.abs(height - 40) <= 0.5), "430px map and consent pairs share the same complete 342px by 40px control geometry");
assert(mobileMapPhoneLayout.routeConsentLeftDelta <= 0.5, "430px directions and accept actions share the exact same left edge");
await stableFooterPhonePage.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  scrollTo(0, document.documentElement.scrollHeight);
  document.documentElement.style.removeProperty("scroll-behavior");
});
await stableFooterPhonePage.waitForTimeout(520);
const bottomScrollY = await stableFooterPhonePage.evaluate(() => scrollY);
await stableFooterPhonePage.evaluate((targetY) => {
  document.documentElement.style.scrollBehavior = "auto";
  scrollTo(0, targetY);
  document.documentElement.style.removeProperty("scroll-behavior");
}, Math.max(0, bottomScrollY - 160));
await stableFooterPhonePage.waitForTimeout(520);
const stableFooterPhone = await stableFooterPhonePage.evaluate(() => {
  const banner = document.querySelector("[data-cookie-banner]").getBoundingClientRect();
  const phone = document.querySelector(".quick-action--phone").getBoundingClientRect();
  return {
    bannerGap: banner.top - phone.bottom,
    rightGap: Math.abs(banner.right - phone.right),
    docked: document.querySelector("[data-quick-actions]").classList.contains("quick-actions--footer-docked"),
  };
});
assert(stableFooterPhone.bannerGap >= 11 && stableFooterPhone.bannerGap <= 17 && stableFooterPhone.rightGap <= 0.5 && !stableFooterPhone.docked, "A slight upward scroll from the footer keeps the phone on the consent rail instead of throwing it above the CTA");

await stableFooterPhonePage.locator("[data-consent-reject]").click();
await stableFooterPhonePage.waitForTimeout(600);
await stableFooterPhonePage.reload({ waitUntil: "networkidle" });
await stableFooterPhonePage.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  scrollTo(0, document.documentElement.scrollHeight);
  document.documentElement.style.removeProperty("scroll-behavior");
});
await stableFooterPhonePage.waitForTimeout(900);
const noPromptFooterActions = await stableFooterPhonePage.evaluate(() => {
  const contactButton = document.querySelector(".contact-cta__content .motion-button").getBoundingClientRect();
  const topAction = document.querySelector("[data-scroll-top]").getBoundingClientRect();
  const phone = document.querySelector(".quick-action--phone").getBoundingClientRect();
  return {
    topAlignment: Math.abs(topAction.top - contactButton.top),
    horizontalGap: topAction.left - contactButton.right,
    phoneGap: phone.top - topAction.bottom,
    rightInset: innerWidth - phone.right,
  };
});
assert(noPromptFooterActions.topAlignment <= 0.5 && noPromptFooterActions.horizontalGap >= 12, "Without the consent prompt, the footer arrow aligns exactly with the final CTA without covering it");
assert(Math.abs(noPromptFooterActions.phoneGap - 8) <= 0.5 && Math.abs(noPromptFooterActions.rightInset - 8) <= 0.5, "The footer phone remains one regular gap below the arrow and aligned to the mobile right inset");
await stableFooterPhoneContext.close();

const localizedPages = [
  {
    code: "en",
    path: "en/",
    canonical: "https://guziczak.github.io/hul/en/",
    ogLocale: "en_US",
    cookieTitle: "Your privacy",
    menuClose: "Close menu",
    mapTitle: "Interactive Google Map",
    mapStatus: "has been enabled",
    forbiddenCopy: ["Twoja prywatność", "Porozmawiajmy", "Często zadawane pytania", "Włącz interaktywną mapę", "Ustawienia prywatności"],
  },
  {
    code: "de",
    path: "de/",
    canonical: "https://guziczak.github.io/hul/de/",
    ogLocale: "de_DE",
    cookieTitle: "Ihre Privatsphäre",
    menuClose: "Menü schließen",
    mapTitle: "Interaktive Google-Karte",
    mapStatus: "wurde aktiviert",
    forbiddenCopy: ["Twoja prywatność", "Porozmawiajmy", "Często zadawane pytania", "Włącz interaktywną mapę", "Ustawienia prywatności"],
  },
];
const productionAlternates = {
  pl: "https://guziczak.github.io/hul/",
  en: "https://guziczak.github.io/hul/en/",
  de: "https://guziczak.github.io/hul/de/",
  "x-default": "https://guziczak.github.io/hul/",
};
const productionPageUrls = [...new Set(Object.values(productionAlternates))];
const localLanguageTargets = {
  pl: new URL("./", baseUrl).href,
  en: new URL("en/", baseUrl).href,
  de: new URL("de/", baseUrl).href,
};

for (const localized of localizedPages) {
  const localizedContext = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  await localizedContext.route("https://maps.google.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><title>Google Maps test</title>",
  }));
  const localizedPage = await localizedContext.newPage();
  const localizedConsoleErrors = [];
  const localizedFailedRequests = [];
  localizedPage.on("console", (message) => {
    if (message.type() === "error") localizedConsoleErrors.push(message.text());
  });
  localizedPage.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED") return;
    localizedFailedRequests.push(`${request.url()} — ${request.failure()?.errorText}`);
  });

  const localizedResponse = await localizedPage.goto(new URL(localized.path, baseUrl).href, { waitUntil: "networkidle" });
  await localizedPage.evaluate(() => document.fonts.ready);
  await localizedPage.waitForTimeout(250);
  const localizedState = await localizedPage.evaluate(() => {
    const schema = JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent || "{}");
    const schemaGraph = schema["@graph"] || [schema];
    const schemaPage = schemaGraph.find((entry) => entry["@type"] === "WebPage") || {};
    const schemaSite = schemaGraph.find((entry) => entry["@type"] === "WebSite") || {};
    const alternates = Object.fromEntries(
      [...document.querySelectorAll('link[rel="alternate"][hreflang]')]
        .map((link) => [link.getAttribute("hreflang"), link.getAttribute("href")]),
    );
    const assetValues = [...document.querySelectorAll('link[rel="stylesheet"], link[rel="icon"], script[src], img[src], source[src], source[srcset]')]
      .flatMap((element) => [element.getAttribute("href"), element.getAttribute("src"), element.getAttribute("srcset")])
      .filter(Boolean);
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    const utilities = document.querySelector(".header__utilities");
    const switcher = utilities.querySelector(".language-switcher--desktop");
    const cta = utilities.querySelector(".motion-button");
    const desktopLinks = document.querySelector(".header__desktop-links");
    const track = cta.querySelector(".motion-button__track");
    const utilitiesRect = utilities.getBoundingClientRect();
    const switcherRect = switcher.getBoundingClientRect();
    const ctaRect = cta.getBoundingClientRect();
    const linksRect = desktopLinks.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    const phone = document.querySelector(".quick-action--phone");
    const phoneRect = phone.getBoundingClientRect();
    const phoneLabel = phone.querySelector(".quick-action__tooltip");
    const phoneLabelStyle = getComputedStyle(phoneLabel);
    return {
      lang: document.documentElement.lang,
      h1: document.querySelectorAll("h1").length,
      sections: document.querySelectorAll("main section").length,
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
      ogLocale: document.querySelector('meta[property="og:locale"]')?.content,
      alternates,
      schemaUrl: schemaPage.url,
      schemaPageLanguage: schemaPage.inLanguage,
      schemaLanguages: schemaSite.inLanguage,
      currentSwitchers: document.querySelectorAll('.language-switcher a[aria-current="page"]').length,
      desktopSwitchTargets: Object.fromEntries(
        [...document.querySelectorAll(".language-switcher--desktop a")]
          .map((link) => [link.hreflang, link.href]),
      ),
      hasMobileSwitcher: Boolean(document.querySelector(".language-switcher--mobile")),
      assetsAreParentRelative: assetValues.every((value) => value.startsWith("../")),
      duplicateIds: ids.length - new Set(ids).size,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      mailLinks: [...document.querySelectorAll('a[href^="mailto:"]')].map((link) => {
        const url = new URL(link.href);
        return {
          recipient: url.pathname,
          subject: url.searchParams.get("subject"),
          body: url.searchParams.get("body"),
        };
      }),
      cookieTitle: document.querySelector(".cookie-banner__copy strong")?.textContent.trim(),
      bodyText: document.body.innerText,
      mapLanguage: new URL(document.querySelector("[data-contact-map]")?.dataset.mapUrl).searchParams.get("hl"),
      externalRequests: performance.getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((url) => !url.startsWith(location.origin)),
      utilityLayout: {
        grouped: switcher.parentElement === utilities && cta.parentElement === utilities,
        controlGap: ctaRect.left - switcherRect.right,
        navigationGap: utilitiesRect.left - linksRect.right,
        visibleTrackLabels: [...track.children].filter((label) => {
          const rect = label.getBoundingClientRect();
          return rect.bottom > trackRect.top + 0.5 && rect.top < trackRect.bottom - 0.5;
        }).length,
      },
      phoneLayout: {
        width: phoneRect.width,
        height: phoneRect.height,
        label: phoneLabel.textContent.trim(),
        labelOpacity: phoneLabelStyle.opacity,
        labelLines: Math.round(phoneLabel.getBoundingClientRect().height / parseFloat(phoneLabelStyle.lineHeight)),
      },
    };
  });

  assert(localizedResponse?.ok(), `${localized.code.toUpperCase()} static document returns HTTP 200`);
  assert(localizedState.lang === localized.code && localizedState.h1 === 1 && localizedState.sections === 8, `${localized.code.toUpperCase()} declares its language and preserves the complete semantic structure`);
  assert(localizedState.canonical === localized.canonical && localizedState.ogLocale === localized.ogLocale, `${localized.code.toUpperCase()} has its own canonical and Open Graph locale`);
  assert(Object.entries(productionAlternates).every(([language, href]) => localizedState.alternates[language] === href), `${localized.code.toUpperCase()} exposes reciprocal pl/en/de/x-default hreflang links`);
  assert(localizedState.schemaUrl === localized.canonical && localizedState.schemaPageLanguage === localized.code && ["pl", "en", "de"].every((language) => localizedState.schemaLanguages?.includes(language)), `${localized.code.toUpperCase()} WebPage and WebSite structured data match the localized URL and supported languages`);
  assert(localizedState.currentSwitchers === 2 && localizedState.hasMobileSwitcher, `${localized.code.toUpperCase()} marks the current language in both desktop and mobile switchers`);
  assert(Object.entries(localLanguageTargets).every(([language, href]) => localizedState.desktopSwitchTargets[language] === href), `${localized.code.toUpperCase()} language switcher resolves correctly under the GitHub Pages subpath`);
  assert(localizedState.assetsAreParentRelative && localizedState.duplicateIds === 0, `${localized.code.toUpperCase()} uses safe shared asset paths and unique IDs`);
  assert(localizedState.mailLinks.length === 2 && localizedState.mailLinks.every((link) => link.recipient === "domar@kuchniezdrewna.pl" && link.subject === mailTemplates[localized.code].subject && link.body === mailTemplates[localized.code].body), `${localized.code.toUpperCase()} email links open the matching localized kitchen enquiry`);
  assert(localizedState.overflow === 0 && localizedState.mapLanguage === localized.code, `${localized.code.toUpperCase()} has no desktop overflow and requests the matching map language`);
  assert(localizedState.utilityLayout.grouped && localizedState.utilityLayout.controlGap >= 7 && localizedState.utilityLayout.navigationGap >= 24 && localizedState.utilityLayout.visibleTrackLabels === 1, `${localized.code.toUpperCase()} utility controls stay composed without duplicate visible CTA copy at 1200px`);
  assert(localizedState.phoneLayout.width >= 120 && localizedState.phoneLayout.height === 48 && localizedState.phoneLayout.label && localizedState.phoneLayout.labelOpacity === "1" && localizedState.phoneLayout.labelLines === 1, `${localized.code.toUpperCase()} desktop phone capsule keeps its localized label on one line`);
  assert(localizedState.cookieTitle === localized.cookieTitle && localized.forbiddenCopy.every((copy) => !localizedState.bodyText.includes(copy)), `${localized.code.toUpperCase()} translates consent and contains no Polish interface-copy leaks`);
  assert(localizedState.externalRequests.length === 0, `${localized.code.toUpperCase()} makes no third-party request before consent`);

  await localizedPage.locator("[data-cookie-banner]").waitFor({ state: "visible" });
  await localizedPage.setViewportSize({ width: 320, height: 568 });
  await localizedPage.waitForTimeout(620);
  const localizedConsentLayout = await localizedPage.evaluate(() => {
    const header = document.querySelector(".header__top").getBoundingClientRect();
    const hero = document.querySelector(".hero__content").getBoundingClientRect();
    const heroActions = document.querySelector(".hero__actions").getBoundingClientRect();
    const banner = document.querySelector("[data-cookie-banner]").getBoundingClientRect();
    const consentActions = [...document.querySelectorAll("[data-consent-accept], [data-consent-reject]")]
      .map((button) => button.getBoundingClientRect());
    const settings = document.querySelector("[data-consent-settings]").getBoundingClientRect();
    const title = document.querySelector(".cookie-banner__copy strong").getBoundingClientRect();
    const copy = document.querySelector(".cookie-banner__copy p");
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      headerGap: hero.top - header.bottom,
      bannerGap: banner.top - heroActions.bottom,
      bannerHeight: banner.height,
      copyLines: Math.round(copy.getBoundingClientRect().height / parseFloat(getComputedStyle(copy).lineHeight)),
      actionRows: new Set(consentActions.map((rect) => Math.round(rect.top))).size,
      actionsInViewport: [...consentActions, settings]
        .every((rect) => rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight),
      settingsTitleOffset: Math.abs(settings.top - title.top),
      settingsInCopy: document.querySelector("[data-consent-settings]").parentElement.classList.contains("cookie-banner__copy"),
      sharedWidths: [
        ...document.querySelectorAll(".hero__actions .motion-button, .map-preview__actions > *"),
        document.querySelector(".visit__details .motion-button"),
        ...document.querySelectorAll("[data-consent-accept], [data-consent-reject]"),
      ].map((button) => button.getBoundingClientRect().width),
      heroButtonsFit: [...document.querySelectorAll(".hero__actions .motion-button__track")]
        .every((track) => track.scrollWidth <= track.clientWidth + 1),
    };
  });
  assert(localizedConsentLayout.overflow === 0 && localizedConsentLayout.bannerHeight <= 150 && localizedConsentLayout.copyLines <= 2 && localizedConsentLayout.actionRows === 1 && localizedConsentLayout.actionsInViewport && localizedConsentLayout.heroButtonsFit, `${localized.code.toUpperCase()} hero actions and consent prompt remain compact and reachable at 320px`);
  assert(localizedConsentLayout.sharedWidths.every((width) => Math.abs(width - 134) <= 0.5), `${localized.code.toUpperCase()} hero, directions, map and consent actions share the literal 134px mobile width`);
  assert(localizedConsentLayout.settingsInCopy && localizedConsentLayout.settingsTitleOffset <= 0.5, `${localized.code.toUpperCase()} consent settings align with the localized prompt title`);
  assert(localizedConsentLayout.headerGap >= 11 && localizedConsentLayout.bannerGap >= 15, `${localized.code.toUpperCase()} mobile hero stays clear of both header and consent prompt`);
  await localizedPage.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    scrollTo(0, document.documentElement.scrollHeight);
    document.documentElement.style.removeProperty("scroll-behavior");
  });
  await localizedPage.waitForTimeout(620);
  const localizedFooterConsent = await localizedPage.evaluate(() => {
    const header = document.querySelector(".header__top").getBoundingClientRect();
    const cta = document.querySelector(".contact-cta").getBoundingClientRect();
    const contentElement = document.querySelector(".contact-cta__content");
    const content = contentElement.getBoundingClientRect();
    const button = document.querySelector(".contact-cta .motion-button").getBoundingClientRect();
    const banner = document.querySelector("[data-cookie-banner]").getBoundingClientRect();
    const footer = document.querySelector(".footer").getBoundingClientRect();
    const phone = document.querySelector(".quick-action--phone").getBoundingClientRect();
    const quickActions = document.querySelector("[data-quick-actions]");
    const phoneIntersectsButton = button.right > phone.left + 1
      && button.left < phone.right - 1
      && button.bottom > phone.top + 1
      && button.top < phone.bottom - 1;
    const phoneIntersectsContent = content.right > phone.left + 1
      && content.left < phone.right - 1
      && content.bottom > phone.top + 1
      && content.top < phone.bottom - 1;
    const phoneIntersectsFooter = footer.right > phone.left + 1
      && footer.left < phone.right - 1
      && footer.bottom > phone.top + 1
      && footer.top < phone.bottom - 1;
    return {
      bannerGap: banner.top - content.bottom,
      footerGap: footer.top - banner.bottom,
      headerGap: content.top - header.bottom,
      ctaInset: content.top - cta.top,
      reserve: cta.height - content.height - banner.height,
      contentAnimatesTop: getComputedStyle(contentElement).transitionProperty
        .split(",").map((property) => property.trim()).includes("top"),
      topActionDisplay: getComputedStyle(document.querySelector("[data-scroll-top]")).display,
      phoneVisible: phone.width === 48 && phone.height === 48,
      phoneClearsButton: !phoneIntersectsButton,
      phoneClearsContent: !phoneIntersectsContent,
      phoneClearsFooter: !phoneIntersectsFooter,
      phoneBannerGap: banner.top - phone.bottom,
      phoneHeaderGap: phone.top - header.bottom,
      phoneRightGap: Math.abs(phone.right - banner.right),
      phoneDocked: quickActions.classList.contains("quick-actions--footer-docked"),
    };
  });
  assert(localizedFooterConsent.bannerGap >= 11 && localizedFooterConsent.footerGap >= 7 && localizedFooterConsent.headerGap >= 7 && localizedFooterConsent.ctaInset >= 15 && localizedFooterConsent.reserve >= 39 && localizedFooterConsent.contentAnimatesTop, `${localized.code.toUpperCase()} final CTA remains fully readable and moves smoothly above undecided consent at 320px`);
  assert(localizedFooterConsent.topActionDisplay === "none" && localizedFooterConsent.phoneVisible, `${localized.code.toUpperCase()} keeps the footer phone visible and suppresses only the competing top arrow`);
  assert(localizedFooterConsent.phoneClearsButton, `${localized.code.toUpperCase()} footer phone clears the localized final CTA button`);
  assert(localizedFooterConsent.phoneClearsContent, `${localized.code.toUpperCase()} footer phone clears the complete localized CTA content block`);
  assert(localizedFooterConsent.phoneClearsFooter, `${localized.code.toUpperCase()} footer phone remains outside the footer`);
  assert(!localizedFooterConsent.phoneDocked && localizedFooterConsent.phoneBannerGap >= 11 && localizedFooterConsent.phoneHeaderGap >= 7 && localizedFooterConsent.phoneRightGap <= 0.5, `${localized.code.toUpperCase()} keeps the phone on the consent rail above content and out of the footer`);
  if (localized.code === "de") {
    await localizedPage.setViewportSize({ width: 360, height: 568 });
    await localizedPage.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      scrollTo(0, document.documentElement.scrollHeight);
      document.documentElement.style.removeProperty("scroll-behavior");
    });
    await localizedPage.waitForTimeout(620);
    const germanNarrowEdge = await localizedPage.evaluate(() => {
      const header = document.querySelector(".header__top").getBoundingClientRect();
      const cta = document.querySelector(".contact-cta").getBoundingClientRect();
      const content = document.querySelector(".contact-cta__content").getBoundingClientRect();
      const banner = document.querySelector("[data-cookie-banner]").getBoundingClientRect();
      return {
        bannerGap: banner.top - content.bottom,
        safeTop: content.top - Math.max(cta.top + 16, header.bottom + 8, 8),
      };
    });
    assert(germanNarrowEdge.bannerGap >= 11 && germanNarrowEdge.safeTop >= -1, "DE final CTA also clears consent at the former 360px breakpoint edge");
  }
  await localizedPage.setViewportSize({ width: 900, height: 700 });
  await localizedPage.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    scrollTo(0, document.documentElement.scrollHeight);
    document.documentElement.style.removeProperty("scroll-behavior");
  });
  await localizedPage.waitForTimeout(620);
  const localizedTabletConsent = await localizedPage.evaluate(() => {
    const bannerElement = document.querySelector("[data-cookie-banner]");
    const banner = bannerElement.getBoundingClientRect();
    const content = document.querySelector(".contact-cta__content").getBoundingClientRect();
    const copy = document.querySelector(".cookie-banner__copy p");
    return {
      columns: getComputedStyle(bannerElement).gridTemplateColumns.trim().split(/\s+/).length,
      bannerHeight: banner.height,
      copyLines: Math.round(copy.getBoundingClientRect().height / parseFloat(getComputedStyle(copy).lineHeight)),
      contentGap: banner.top - content.bottom,
      guard: document.querySelector("[data-quick-actions]").classList.contains("quick-actions--cta-guard"),
      arrowDisplay: getComputedStyle(document.querySelector("[data-scroll-top]")).display,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  assert(localizedTabletConsent.columns === 2 && localizedTabletConsent.bannerHeight <= 113.5 && localizedTabletConsent.copyLines <= 2 && localizedTabletConsent.contentGap >= 11 && localizedTabletConsent.guard && localizedTabletConsent.arrowDisplay === "none" && localizedTabletConsent.overflow === 0, `${localized.code.toUpperCase()} keeps compact consent clear of the final CTA at the 900px component boundary`);
  await localizedPage.locator("[data-consent-reject]").click();
  await localizedPage.locator("[data-cookie-banner]").waitFor({ state: "hidden" });
  await localizedPage.waitForTimeout(450);
  const localizedConsentReset = await localizedPage.evaluate(() => ({
    contentTop: parseFloat(getComputedStyle(document.querySelector(".contact-cta__content")).top),
    minHeight: parseFloat(getComputedStyle(document.querySelector(".contact-cta")).minHeight),
    topActionDisplay: getComputedStyle(document.querySelector("[data-scroll-top]")).display,
    ctaGuard: document.querySelector("[data-quick-actions]").classList.contains("quick-actions--cta-guard"),
    phoneDocked: document.querySelector("[data-quick-actions]").classList.contains("quick-actions--footer-docked"),
    inlineOffset: document.querySelector(".contact-cta").style.getPropertyValue("--contact-cta-content-offset"),
    inlineMinHeight: document.querySelector(".contact-cta").style.getPropertyValue("--contact-cta-consent-min-height"),
  }));
  assert(Math.abs(localizedConsentReset.contentTop) <= 0.5 && Math.abs(localizedConsentReset.minHeight) <= 0.5 && localizedConsentReset.topActionDisplay === "grid" && !localizedConsentReset.ctaGuard && !localizedConsentReset.phoneDocked && !localizedConsentReset.inlineOffset && !localizedConsentReset.inlineMinHeight, `${localized.code.toUpperCase()} final CTA and floating controls return to their unmodified layout after consent closes`);
  await localizedPage.setViewportSize({ width: 390, height: 844 });
  await localizedPage.locator(".menu-toggle").click();
  await localizedPage.waitForTimeout(620);
  const localizedMenu = await localizedPage.evaluate(() => ({
    height: document.querySelector(".header").getBoundingClientRect().height,
    label: document.querySelector(".menu-toggle").getAttribute("aria-label"),
    currentVisible: document.querySelector('.language-switcher--mobile a[aria-current="page"]')?.getBoundingClientRect().height > 0,
  }));
  assert(localizedMenu.height === 240 && localizedMenu.label === localized.menuClose && localizedMenu.currentVisible, `${localized.code.toUpperCase()} mobile menu localizes its controls and exposes language selection`);
  await localizedPage.locator(".menu-toggle").click();
  await localizedPage.setViewportSize({ width: 1280, height: 800 });
  await localizedPage.waitForTimeout(220);

  await localizedPage.locator("[data-contact-map]").scrollIntoViewIfNeeded();
  await localizedPage.locator("[data-enable-map]").click();
  await localizedPage.locator("[data-privacy-dialog]").waitFor({ state: "visible" });
  await localizedPage.waitForFunction(() => document.activeElement === document.querySelector("[data-consent-maps]"));
  await localizedPage.keyboard.press("Space");
  await localizedPage.locator("[data-consent-save]").click();
  await localizedPage.locator("iframe[data-interactive-map]").waitFor({ state: "attached" });
  const localizedMap = await localizedPage.evaluate(() => ({
    title: document.querySelector("iframe[data-interactive-map]")?.title,
    status: document.querySelector("[data-map-status]")?.textContent,
  }));
  assert(localizedMap.title?.includes(localized.mapTitle) && localizedMap.status?.includes(localized.mapStatus), `${localized.code.toUpperCase()} JavaScript localizes the interactive map title and live status`);
  assert(localizedConsoleErrors.length === 0 && localizedFailedRequests.length === 0, `${localized.code.toUpperCase()} runs without console or network errors`);
  await localizedContext.close();
}

const [sitemapResponse, robotsResponse, notFoundResponse] = await Promise.all([
  fetch(new URL("sitemap.xml", baseUrl)),
  fetch(new URL("robots.txt", baseUrl)),
  fetch(new URL("404.html", baseUrl)),
]);
const [sitemapText, robotsText, notFoundText] = await Promise.all([
  sitemapResponse.text(),
  robotsResponse.text(),
  notFoundResponse.text(),
]);
assert(sitemapResponse.ok && productionPageUrls.every((href) => sitemapText.includes(`<loc>${href}</loc>`)), "Sitemap is available and lists all three localized URLs");
assert(["pl", "en", "de", "x-default"].every((language) => sitemapText.includes(`hreflang="${language}"`)), "Sitemap carries all language relationships");
assert(robotsResponse.ok && robotsText.includes("Sitemap: https://guziczak.github.io/hul/sitemap.xml"), "Repository robots file points to the multilingual sitemap");
assert(notFoundResponse.ok && notFoundText.includes('name="robots" content="noindex, follow"') && notFoundText.includes('<base href="/hul/"') && ["./en/", "./de/"].every((href) => notFoundText.includes(`href="${href}"`)), "Custom 404 resolves assets from /hul/, stays noindex and offers English and German recovery links");

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
