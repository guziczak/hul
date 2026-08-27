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
  updateHeader();
}

menuToggle?.addEventListener("click", () => {
  setMenu(!header.classList.contains("header--open"));
});

mobileLinks?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setMenu(false));
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
window.addEventListener("resize", requestHeaderUpdate, { passive: true });
updateHeader();

function splitHeading(heading) {
  const text = heading.textContent.trim();
  const words = text.split(/\s+/);
  let characterIndex = 0;

  heading.setAttribute("aria-label", text);
  heading.textContent = "";

  words.forEach((word, wordIndex) => {
    const wordElement = document.createElement("span");
    wordElement.className = "split-word";
    wordElement.setAttribute("aria-hidden", "true");

    Array.from(word).forEach((character) => {
      const characterElement = document.createElement("span");
      characterElement.className = "split-char";
      characterElement.style.setProperty("--char-delay", `${100 + characterIndex * 12}ms`);
      characterElement.textContent = character;
      wordElement.append(characterElement);
      characterIndex += 1;
    });

    heading.append(wordElement);
    if (wordIndex < words.length - 1) heading.append(document.createTextNode(" "));
  });

  heading.closest(".reveal")?.classList.add("reveal--chars");
}

document.querySelectorAll("[data-reveal-chars]").forEach(splitHeading);

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0, rootMargin: "0px 0px -4% 0px" },
);

document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

document.querySelectorAll(".faq-item__question").forEach((button) => {
  button.addEventListener("click", () => {
    const item = button.closest(".faq-item");
    const open = item.classList.toggle("faq-item--open");
    button.setAttribute("aria-expanded", String(open));
  });
});

const ctaVideo = document.querySelector(".contact-cta__video");
if (ctaVideo) {
  const videoObserver = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) ctaVideo.play().catch(() => {});
      else ctaVideo.pause();
    },
    { threshold: 0.12 },
  );
  videoObserver.observe(ctaVideo);
}

if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  root.classList.add("reduced-motion");
}
