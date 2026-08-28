const root = document.documentElement;
const header = document.querySelector(".header");
const hero = document.querySelector(".hero");
const menuToggle = document.querySelector(".menu-toggle");
const mobileLinks = document.querySelector(".header__mobile-links");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const heroMedia = document.querySelector(".hero__media");
const heroImage = heroMedia?.querySelector("[data-hero-image]");

let heroDecodeVersion = 0;
async function revealDecodedHero() {
  if (!heroMedia || !heroImage || !heroImage.complete || !heroImage.naturalWidth) return;
  const version = ++heroDecodeVersion;
  try {
    if (typeof heroImage.decode === "function") await heroImage.decode();
    if (version === heroDecodeVersion) heroMedia.classList.add("is-decoded");
  } catch {
    // Keep the complete low-resolution placeholder instead of exposing partial pixels.
  }
}

heroImage?.addEventListener("load", revealDecodedHero);
heroImage?.addEventListener("error", () => heroMedia?.classList.remove("is-decoded"));
revealDecodedHero();

function setMenu(open) {
  header.classList.toggle("header--open", open);
  document.body.classList.toggle("menu-open", open);
  const quickActionsElement = document.querySelector("[data-quick-actions]");
  if (quickActionsElement) quickActionsElement.inert = open || document.body.classList.contains("privacy-open");
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Zamknij menu" : "Otwórz menu");
  mobileLinks.setAttribute("aria-hidden", String(!open));
  mobileLinks.inert = !open;
  updateHeader();
}

menuToggle?.addEventListener("click", () => {
  setMenu(!header.classList.contains("header--open"));
});

mobileLinks?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setMenu(false));
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !header.classList.contains("header--open")) return;
  setMenu(false);
  menuToggle.focus();
});

let headerUpdateFrame = 0;
let headerMotionFrame = 0;
let headerMotionTime = 0;
let headerMotionInitialized = false;
let headerTargetTranslate = 0;
let headerRenderedTranslate = 0;
let headerVelocity = 0;

function renderHeader(position) {
  const rendered = Math.abs(position) < 0.0005 ? 0 : position;
  header.style.setProperty("--header-translate", `${rendered}px`);
}

function stepHeaderMotion(now) {
  const elapsed = headerMotionTime ? Math.min((now - headerMotionTime) / 1000, 0.064) : 1 / 60;
  headerMotionTime = now;

  // Exact overdamped spring response: stiffness 500, damping 60, mass 1.
  // Its two decay rates are -10 and -50, matching the Framer source motion.
  const error = headerRenderedTranslate - headerTargetTranslate;
  const slowComponent = (headerVelocity + 50 * error) / 40;
  const fastComponent = error - slowComponent;
  const slowDecay = Math.exp(-10 * elapsed);
  const fastDecay = Math.exp(-50 * elapsed);

  headerRenderedTranslate = headerTargetTranslate
    + slowComponent * slowDecay
    + fastComponent * fastDecay;
  headerVelocity = -10 * slowComponent * slowDecay - 50 * fastComponent * fastDecay;
  renderHeader(headerRenderedTranslate);

  const settled = Math.abs(headerRenderedTranslate - headerTargetTranslate) < 0.01
    && Math.abs(headerVelocity) < 0.1;
  if (settled) {
    headerRenderedTranslate = headerTargetTranslate;
    headerVelocity = 0;
    headerMotionTime = 0;
    headerMotionFrame = 0;
    renderHeader(headerRenderedTranslate);
    return;
  }

  headerMotionFrame = requestAnimationFrame(stepHeaderMotion);
}

function requestHeaderMotion() {
  if (headerMotionFrame) return;
  headerMotionTime = 0;
  headerMotionFrame = requestAnimationFrame(stepHeaderMotion);
}

function setHeaderTarget(translate, instant = false) {
  headerTargetTranslate = translate;
  if (!headerMotionInitialized || instant || reducedMotion.matches) {
    if (headerMotionFrame) cancelAnimationFrame(headerMotionFrame);
    headerMotionInitialized = true;
    headerMotionFrame = 0;
    headerMotionTime = 0;
    headerVelocity = 0;
    headerRenderedTranslate = headerTargetTranslate;
    renderHeader(headerRenderedTranslate);
    return;
  }
  requestHeaderMotion();
}

function updateHeader(instant = false) {
  if (!header || !hero) return;

  const heroHeight = hero.getBoundingClientRect().height;
  const mobile = window.innerWidth <= 809;
  const hideEnd = heroHeight * (mobile ? 0.473 : 0.521);
  const showEnd = heroHeight * (mobile ? 0.652 : 0.683);
  const scroll = window.scrollY;
  const menuOpen = header.classList.contains("header--open");
  let translate = 0;

  if (!menuOpen && scroll > 0 && scroll < hideEnd) {
    translate = -100 * (scroll / hideEnd);
  } else if (!menuOpen && scroll >= hideEnd && scroll < showEnd) {
    translate = -100 + 100 * ((scroll - hideEnd) / (showEnd - hideEnd));
  }

  const scrolled = scroll >= hideEnd || menuOpen;
  header.classList.toggle("header--scrolled", scrolled);
  setHeaderTarget(translate, instant);
}

function requestHeaderUpdate() {
  if (headerUpdateFrame) return;
  headerUpdateFrame = requestAnimationFrame(() => {
    updateHeader();
    headerUpdateFrame = 0;
  });
}

window.addEventListener("scroll", requestHeaderUpdate, { passive: true });
window.addEventListener("resize", () => {
  if (window.innerWidth >= 1200 && header.classList.contains("header--open")) setMenu(false);
  requestHeaderUpdate();
}, { passive: true });
reducedMotion.addEventListener?.("change", () => updateHeader(true));
setMenu(false);

function splitHeading(heading) {
  const text = heading.dataset.revealText || heading.textContent.trim();
  const linesBreakpoint = Number(heading.dataset.linesBreakpoint || 809);
  const preferredLines = window.innerWidth <= linesBreakpoint
    ? heading.dataset.linesMobile
    : heading.dataset.linesDesktop;
  const lines = preferredLines
    ? preferredLines.split("|").map((line) => line.trim().split(/\s+/))
    : [text.split(/\s+/)];

  heading.dataset.revealText = text;
  heading.setAttribute("aria-label", text);
  heading.textContent = "";

  lines.forEach((lineWords, lineIndex) => {
    lineWords.forEach((word, wordIndex) => {
      const wordElement = document.createElement("span");
      wordElement.className = "split-word";
      wordElement.setAttribute("aria-hidden", "true");
      Array.from(word).forEach((character) => {
        const characterElement = document.createElement("span");
        characterElement.className = "split-char";
        characterElement.textContent = character;
        wordElement.append(characterElement);
      });
      heading.append(wordElement);
      if (wordIndex < lineWords.length - 1) heading.append(document.createTextNode(" "));
    });

    if (lineIndex < lines.length - 1) {
      heading.append(document.createTextNode(" "));
      const lineAnchor = document.createElement("span");
      lineAnchor.className = "split-word split-word--anchor";
      lineAnchor.setAttribute("aria-hidden", "true");
      heading.append(lineAnchor, document.createElement("br"));
    }
  });

  const lineTops = [];
  heading.querySelectorAll(".split-word:not(.split-word--anchor)").forEach((wordElement) => {
    const top = Math.round(wordElement.getBoundingClientRect().top);
    let lineIndex = lineTops.findIndex((lineTop) => Math.abs(lineTop - top) <= 2);
    if (lineIndex === -1) {
      lineIndex = lineTops.length;
      lineTops.push(top);
    }
    wordElement.style.setProperty("--line-delay", `${lineIndex * 100}ms`);
  });
  heading.dataset.revealLines = String(lineTops.length);
  heading.closest(".reveal")?.classList.add("reveal--chars");
}

document.fonts.ready.then(() => {
  document.querySelectorAll("[data-reveal-chars]").forEach(splitHeading);

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0 },
  );

  document.querySelectorAll(".reveal").forEach((element) => {
    if (element.closest(".hero")) {
      requestAnimationFrame(() => element.classList.add("is-visible"));
      return;
    }
    revealObserver.observe(element);
  });
  window.clearTimeout(window.__hulRevealFallback);

  let headingResizeTimer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(headingResizeTimer);
    headingResizeTimer = window.setTimeout(() => {
      document.querySelectorAll("[data-reveal-chars]").forEach(splitHeading);
    }, 120);
  }, { passive: true });
}).catch(() => {
  root.classList.remove("js");
});

document.querySelectorAll(".faq-item__question").forEach((button) => {
  const item = button.closest(".faq-item");
  const answer = document.getElementById(button.getAttribute("aria-controls"));
  const initiallyOpen = item.classList.contains("faq-item--open");
  button.disabled = false;
  button.removeAttribute("tabindex");
  button.setAttribute("aria-expanded", String(initiallyOpen));
  answer?.setAttribute("aria-hidden", String(!initiallyOpen));

  button.addEventListener("click", () => {
    const open = item.classList.toggle("faq-item--open");
    button.setAttribute("aria-expanded", String(open));
    answer?.setAttribute("aria-hidden", String(!open));
  });
});

const ctaVideo = document.querySelector(".contact-cta__video");
if (ctaVideo && !reducedMotion.matches) {
  const videoObserver = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) ctaVideo.play().catch(() => {});
      else ctaVideo.pause();
    },
    { threshold: 0.12 },
  );
  videoObserver.observe(ctaVideo);
}

if (reducedMotion.matches) {
  ctaVideo?.pause();
  root.classList.add("reduced-motion");
}

/* Floating phone and back-to-top controls */
const quickActions = document.querySelector("[data-quick-actions]");
const quickTop = quickActions?.querySelector("[data-scroll-top]");
let floatingUiFrame = 0;

function updateQuickActions() {
  if (!quickActions || !hero) return;
  const heroHeight = hero.getBoundingClientRect().height;
  quickTop?.classList.toggle("is-visible", window.scrollY >= Math.max(heroHeight * 1.25, window.innerHeight * 1.5));
}

function requestFloatingUiUpdate() {
  if (floatingUiFrame) return;
  floatingUiFrame = requestAnimationFrame(() => {
    updateQuickActions();
    syncFloatingUiOffsets();
    floatingUiFrame = 0;
  });
}

function syncFloatingUiOffsets() {
  const mobile = window.innerWidth <= 809;
  const viewportGap = mobile ? 8 : 20;
  const quickActionsBaseBottom = mobile ? 16 : 20;
  const cookieBannerBaseBottom = mobile ? 8 : 20;
  const banner = document.querySelector("[data-cookie-banner]");
  const footer = document.querySelector(".footer");
  const footerRect = footer?.getBoundingClientRect();
  const visibleFooterHeight = footerRect
    ? Math.max(0, Math.min(footerRect.height, window.innerHeight - footerRect.top))
    : 0;

  let cookieBannerBottom = cookieBannerBaseBottom;
  if (banner && !banner.hidden) {
    const requestedBottom = cookieBannerBaseBottom + visibleFooterHeight;
    const maximumBottom = Math.max(cookieBannerBaseBottom, window.innerHeight - banner.offsetHeight - viewportGap);
    cookieBannerBottom = Math.min(requestedBottom, maximumBottom);
  }
  banner?.style.setProperty("--cookie-banner-bottom", `${cookieBannerBottom}px`);

  const heroContent = hero?.querySelector(".hero__content");
  if (heroContent && hero) {
    if (banner && !banner.hidden) {
      const heroRect = hero.getBoundingClientRect();
      const bannerTargetTop = window.innerHeight - cookieBannerBottom - banner.offsetHeight;
      const restingBottom = parseFloat(getComputedStyle(hero).getPropertyValue("--hero-content-resting-bottom")) || 0;
      const requiredBottom = heroRect.bottom - bannerTargetTop + (mobile ? 16 : 20);
      const headerHeight = header?.querySelector(".header__top")?.offsetHeight || 64;
      const maximumBottom = Math.max(
        restingBottom,
        heroRect.bottom - heroContent.offsetHeight - headerHeight - (mobile ? 12 : 20),
      );
      const heroContentBottom = Math.min(Math.max(restingBottom, requiredBottom), maximumBottom);
      heroContent.style.setProperty("--hero-content-bottom", `${heroContentBottom}px`);
    } else {
      heroContent.style.removeProperty("--hero-content-bottom");
    }
  }

  if (!quickActions) return;
  const bannerOffset = banner && !banner.hidden
    ? cookieBannerBottom + banner.offsetHeight + 12
    : quickActionsBaseBottom;
  const footerOffset = quickActionsBaseBottom + visibleFooterHeight;
  const requestedQuickActionsBottom = Math.max(quickActionsBaseBottom, bannerOffset, footerOffset);
  const maximumQuickActionsBottom = Math.max(
    quickActionsBaseBottom,
    window.innerHeight - quickActions.offsetHeight - viewportGap,
  );
  quickActions.style.setProperty(
    "--quick-actions-bottom",
    `${Math.min(requestedQuickActionsBottom, maximumQuickActionsBottom)}px`,
  );
}

window.addEventListener("scroll", requestFloatingUiUpdate, { passive: true });
window.addEventListener("resize", () => {
  requestFloatingUiUpdate();
  syncFloatingUiOffsets();
}, { passive: true });

const contactCta = document.querySelector(".contact-cta");
if (quickActions && contactCta) {
  const darkSurfaceObserver = new IntersectionObserver(
    ([entry]) => quickActions.classList.toggle("quick-actions--on-dark", entry.isIntersecting),
    { threshold: 0.08 },
  );
  darkSurfaceObserver.observe(contactCta);
}

updateQuickActions();
syncFloatingUiOffsets();

/* Privacy consent, Google Analytics and the interactive contact map */
const PRIVACY_STORAGE_KEY = "hul:privacy-consent:v1";
const PRIVACY_VERSION = 1;
// Uzupełnij pustą wartość prawdziwym identyfikatorem GA4, gdy usługa będzie gotowa.
const GA_MEASUREMENT_ID = "";
const ANALYTICS_HOSTS = new Set(["guziczak.github.io", "hul.com.pl", "www.hul.com.pl"]);

const cookieBanner = document.querySelector("[data-cookie-banner]");
const privacyDialog = document.querySelector("[data-privacy-dialog]");
const analyticsConsentInput = document.querySelector("[data-consent-analytics]");
const mapsConsentInput = document.querySelector("[data-consent-maps]");
const contactMap = document.querySelector("[data-contact-map]");
const mapPreview = contactMap?.querySelector("[data-map-preview]");
const mapStatus = contactMap?.querySelector("[data-map-status]");
const mapEnableButton = contactMap?.querySelector("[data-enable-map]");
const footerPrivacyButton = document.querySelector("[data-open-privacy]");

if (cookieBanner && typeof ResizeObserver === "function") {
  const floatingUiResizeObserver = new ResizeObserver(syncFloatingUiOffsets);
  floatingUiResizeObserver.observe(cookieBanner);
  const footer = document.querySelector(".footer");
  if (footer) floatingUiResizeObserver.observe(footer);
  const heroContent = hero?.querySelector(".hero__content");
  if (heroContent) floatingUiResizeObserver.observe(heroContent);
}

let bannerTimer = 0;
let dialogReturnFocus = null;
let pendingMapRequest = false;

window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function gtag() {
  window.dataLayer.push(arguments);
};
window.gtag("consent", "default", {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  functionality_storage: "denied",
  personalization_storage: "denied",
  security_storage: "granted",
  wait_for_update: 500,
});

function readConsent() {
  try {
    const value = JSON.parse(localStorage.getItem(PRIVACY_STORAGE_KEY));
    if (value?.version !== PRIVACY_VERSION) return null;
    if (typeof value.analytics !== "boolean" || typeof value.maps !== "boolean") return null;
    return value;
  } catch {
    return null;
  }
}

function writeConsent({ analytics, maps }) {
  const value = {
    version: PRIVACY_VERSION,
    analytics: Boolean(analytics),
    maps: Boolean(maps),
  };

  try {
    localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ustawienia obowiązują w bieżącej karcie, nawet gdy pamięć przeglądarki jest zablokowana.
  }
  return value;
}

function showCookieBanner() {
  if (!cookieBanner || readConsent()) return;
  cookieBanner.hidden = false;
  cookieBanner.inert = false;
  cookieBanner.setAttribute("aria-hidden", "false");
  syncFloatingUiOffsets();
  requestAnimationFrame(() => cookieBanner.classList.add("is-visible"));
}

function hideCookieBanner() {
  if (!cookieBanner || cookieBanner.hidden) return;
  window.clearTimeout(bannerTimer);
  if (cookieBanner.contains(document.activeElement)) document.activeElement.blur();
  cookieBanner.inert = true;
  cookieBanner.setAttribute("aria-hidden", "true");
  cookieBanner.classList.remove("is-visible");
  window.setTimeout(() => {
    cookieBanner.hidden = true;
    syncFloatingUiOffsets();
  }, reducedMotion.matches ? 0 : 430);
}

function openPrivacyDialog({ focusCategory, trigger } = {}) {
  if (!privacyDialog) return;
  const consent = readConsent() || { analytics: false, maps: false };
  analyticsConsentInput.checked = consent.analytics;
  mapsConsentInput.checked = consent.maps;
  dialogReturnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
  pendingMapRequest = focusCategory === "maps";

  if (typeof privacyDialog.showModal === "function") privacyDialog.showModal();
  else privacyDialog.setAttribute("open", "");
  document.body.classList.add("privacy-open");
  if (quickActions) quickActions.inert = true;

  requestAnimationFrame(() => {
    const target = focusCategory === "maps"
      ? mapsConsentInput
      : focusCategory === "analytics"
        ? analyticsConsentInput
        : privacyDialog.querySelector("[data-privacy-close]");
    target?.focus({ preventScroll: true });
  });
}

function closePrivacyDialog({ restoreFocus = true } = {}) {
  if (!privacyDialog?.hasAttribute("open")) return;
  const focusTarget = restoreFocus ? dialogReturnFocus : null;
  dialogReturnFocus = null;
  if (typeof privacyDialog.close === "function") privacyDialog.close();
  else privacyDialog.removeAttribute("open");
  document.body.classList.remove("privacy-open");
  if (quickActions) quickActions.inert = document.body.classList.contains("menu-open");
  if (focusTarget instanceof HTMLElement && focusTarget.isConnected && !focusTarget.closest("[inert]")) {
    focusTarget.focus({ preventScroll: true });
  }
}

function canLoadAnalytics() {
  return /^G-[A-Z0-9]{6,}$/.test(GA_MEASUREMENT_ID)
    && location.protocol === "https:"
    && ANALYTICS_HOSTS.has(location.hostname);
}

function loadGoogleAnalytics() {
  if (!canLoadAnalytics() || document.querySelector("script[data-hul-analytics]")) return;
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: true,
  });

  const script = document.createElement("script");
  script.async = true;
  script.dataset.hulAnalytics = "true";
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  document.head.append(script);
}

function clearGoogleAnalyticsCookies() {
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0].trim();
    if (name !== "_ga" && !name.startsWith("_ga_")) return;
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname}; SameSite=Lax`;
  });
}

function loadContactMap({ focus = false } = {}) {
  if (!contactMap || contactMap.querySelector("iframe")) return;
  const mapUrl = contactMap.dataset.mapUrl;
  if (!mapUrl) return;

  const iframe = document.createElement("iframe");
  iframe.src = mapUrl;
  iframe.title = "Interaktywna mapa Google — studio Hul w Galerii Wnętrz DOMAR";
  iframe.loading = "lazy";
  iframe.referrerPolicy = "no-referrer";
  iframe.allowFullscreen = true;
  iframe.dataset.interactiveMap = "true";
  mapPreview.hidden = true;
  mapPreview.inert = true;
  contactMap.append(iframe);
  if (mapStatus) mapStatus.textContent = "Interaktywna mapa Google została włączona.";
  if (focus) requestAnimationFrame(() => iframe.focus({ preventScroll: true }));
}

function applyConsent(consent, { focusMap = false } = {}) {
  window.gtag("consent", "update", {
    analytics_storage: consent.analytics ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  if (consent.analytics) loadGoogleAnalytics();
  if (consent.maps) loadContactMap({ focus: focusMap });
}

function saveConsent(next, { focusMap = false } = {}) {
  const previous = readConsent();
  const consent = writeConsent(next);
  const revokedAnalytics = previous?.analytics && !consent.analytics;
  const revokedMaps = previous?.maps && !consent.maps;
  hideCookieBanner();
  closePrivacyDialog({ restoreFocus: !focusMap });

  if (revokedAnalytics || revokedMaps) {
    if (revokedAnalytics) clearGoogleAnalyticsCookies();
    location.reload();
    return;
  }

  applyConsent(consent, { focusMap });
  pendingMapRequest = false;
}

cookieBanner?.querySelector("[data-consent-accept]")?.addEventListener("click", () => {
  saveConsent({ analytics: true, maps: true });
});

cookieBanner?.querySelector("[data-consent-reject]")?.addEventListener("click", () => {
  saveConsent({ analytics: false, maps: false });
});

cookieBanner?.querySelector("[data-consent-settings]")?.addEventListener("click", (event) => {
  openPrivacyDialog({ trigger: event.currentTarget });
});

footerPrivacyButton?.addEventListener("click", (event) => {
  openPrivacyDialog({ trigger: event.currentTarget });
});

mapEnableButton?.addEventListener("click", (event) => {
  const consent = readConsent();
  if (consent?.maps) {
    loadContactMap({ focus: true });
    return;
  }
  openPrivacyDialog({ focusCategory: "maps", trigger: event.currentTarget });
});

privacyDialog?.querySelector("[data-privacy-close]")?.addEventListener("click", () => {
  pendingMapRequest = false;
  closePrivacyDialog();
});

privacyDialog?.querySelector("[data-consent-save]")?.addEventListener("click", () => {
  const focusMap = pendingMapRequest && mapsConsentInput.checked;
  saveConsent({
    analytics: analyticsConsentInput.checked,
    maps: mapsConsentInput.checked,
  }, { focusMap });
});

privacyDialog?.querySelector("[data-dialog-reject]")?.addEventListener("click", () => {
  saveConsent({ analytics: false, maps: false });
});

privacyDialog?.addEventListener("click", (event) => {
  if (event.target !== privacyDialog) return;
  pendingMapRequest = false;
  closePrivacyDialog();
});

privacyDialog?.addEventListener("cancel", () => {
  pendingMapRequest = false;
  document.body.classList.remove("privacy-open");
  if (quickActions) quickActions.inert = document.body.classList.contains("menu-open");
});

privacyDialog?.addEventListener("close", () => {
  document.body.classList.remove("privacy-open");
  if (quickActions) quickActions.inert = document.body.classList.contains("menu-open");
  if (dialogReturnFocus instanceof HTMLElement && dialogReturnFocus.isConnected && !dialogReturnFocus.closest("[inert]")) {
    dialogReturnFocus.focus({ preventScroll: true });
  }
  dialogReturnFocus = null;
});

window.addEventListener("storage", (event) => {
  if (event.key !== PRIVACY_STORAGE_KEY) return;
  const consent = readConsent();
  if (!consent) {
    location.reload();
    return;
  }
  const mapsMustUnload = !consent.maps && Boolean(contactMap?.querySelector("iframe[data-interactive-map]"));
  const analyticsMustUnload = !consent.analytics && Boolean(document.querySelector("script[data-hul-analytics]"));
  if (mapsMustUnload || analyticsMustUnload) {
    if (analyticsMustUnload) clearGoogleAnalyticsCookies();
    location.reload();
    return;
  }
  applyConsent(consent);
});

const storedConsent = readConsent();
if (storedConsent) applyConsent(storedConsent);
else bannerTimer = window.setTimeout(showCookieBanner, reducedMotion.matches ? 0 : 650);
