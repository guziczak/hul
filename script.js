const root = document.documentElement;
const header = document.querySelector(".header");
const hero = document.querySelector(".hero");
const menuToggle = document.querySelector(".menu-toggle");
const mobileLinks = document.querySelector(".header__mobile-links");

function setMenu(open) {
  header.classList.toggle("header--open", open);
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

let headerFrame = 0;

function updateHeader() {
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
  header.style.setProperty("--header-translate", `${translate}%`);
}

function requestHeaderUpdate() {
  if (headerFrame) return;
  headerFrame = requestAnimationFrame(() => {
    updateHeader();
    headerFrame = 0;
  });
}

window.addEventListener("scroll", requestHeaderUpdate, { passive: true });
window.addEventListener("resize", () => {
  if (window.innerWidth >= 1200 && header.classList.contains("header--open")) setMenu(false);
  requestHeaderUpdate();
}, { passive: true });
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
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
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
