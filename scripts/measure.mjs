import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});

const width = Number(process.argv[2] || 768);
const height = Number(process.argv[3] || 900);

async function measure(label, url) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    const rect = (node) => {
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return {
        x: box.x,
        y: box.y + scrollY,
        width: box.width,
        height: box.height,
      };
    };
    const text = (node) => node?.textContent.trim().replace(/\s+/g, " ").slice(0, 80);
    const headings = [...document.querySelectorAll("h2")];
    const storyHeading = headings.find((node) => text(node)?.includes("Naturalność"));
    const faqHeading = headings.find((node) => text(node)?.includes("zadawane"));
    const expertHeading = headings.find((node) => text(node)?.includes("Eksperci"));
    const sectionFor = (node) => node?.closest("section") || node?.parentElement?.parentElement;
    const storySection = sectionFor(storyHeading);
    const faqSection = sectionFor(faqHeading);
    const expertSection = sectionFor(expertHeading);
    const localCards = [...document.querySelectorAll(".experts__grid > .reveal")];
    const faqQuestions = [...(faqSection?.querySelectorAll("button") || [])];
    const faqParagraphs = [...(faqSection?.querySelectorAll("p") || [])];
    const traceText = (needle) => {
      const matches = [...document.querySelectorAll("body *")]
        .filter((node) => text(node)?.startsWith(needle))
        .sort((a, b) => a.childElementCount - b.childElementCount);
      const start = matches[0];
      const chain = [];
      let node = start;
      while (node && chain.length < 7) {
        const style = getComputedStyle(node);
        chain.push({
          tag: node.tagName,
          class: typeof node.className === "string" ? node.className : "",
          text: text(node),
          display: style.display,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          padding: style.padding,
          margin: style.margin,
          gap: style.gap,
          overflow: style.overflow,
          ...rect(node),
        });
        node = node.parentElement;
      }
      return chain;
    };
    return {
      documentHeight: document.documentElement.scrollHeight,
      sections: [...document.querySelectorAll("main > section, body > section, footer")].map((node) => ({
        name: node.className || node.getAttribute("data-framer-name"),
        ...rect(node),
      })),
      expert: {
        section: rect(expertSection),
        heading: rect(expertHeading),
        cards: localCards.length
          ? localCards.map((node) => ({ text: text(node), ...rect(node) }))
          : [...(expertSection?.querySelectorAll("img") || [])].map((node) => ({ alt: node.alt, ...rect(node) })),
      },
      stories: {
        section: rect(storySection),
        heading: rect(storyHeading),
        paragraphs: [...(storySection?.querySelectorAll("p") || [])].map((node) => ({ text: text(node), ...rect(node) })),
        images: [...(storySection?.querySelectorAll("img") || [])].map((node) => ({ alt: node.alt, ...rect(node) })),
        imageChains: [...(storySection?.querySelectorAll("img") || [])].map((image) => {
          const chain = [];
          let node = image;
          while (node && node !== storySection && chain.length < 5) {
            const style = getComputedStyle(node);
            chain.push({
              tag: node.tagName,
              class: typeof node.className === "string" ? node.className : "",
              aspectRatio: style.aspectRatio,
              overflow: style.overflow,
              ...rect(node),
            });
            node = node.parentElement;
          }
          return chain;
        }),
      },
      faq: {
        section: rect(faqSection),
        heading: { text: text(faqHeading), ...rect(faqHeading) },
        questions: faqQuestions.map((node) => ({ text: text(node), ...rect(node) })),
        paragraphs: faqParagraphs.map((node) => ({ text: text(node), ...rect(node) })),
        traceSecondQuestion: traceText("Czy tworzymy meble"),
        traceFirstAnswer: traceText("Działamy wszędzie"),
      },
    };
  });
  if (process.argv[4] === "summary") {
    const footer = result.sections.find((section) => String(section.name).includes("footer"))
      || result.sections.at(-1);
    const faqBottom = result.faq.section.y + result.faq.section.height;
    console.log(JSON.stringify({
      label,
      width,
      documentHeight: result.documentHeight,
      expertHeight: result.expert.section?.height
        || result.sections.find((section) => section.name === "experts")?.height,
      faqHeight: result.faq.section.height,
      ctaHeight: footer.y - faqBottom,
      footerY: footer.y,
      stories: {
        height: result.stories.section?.height,
        paragraph: result.stories.paragraphs[0]
          ? { x: result.stories.paragraphs[0].x, width: result.stories.paragraphs[0].width, height: result.stories.paragraphs[0].height }
          : null,
        images: result.stories.images.map((item) => ({ x: item.x, width: item.width, height: item.height })),
      },
      sectionHeights: result.sections.map((section) => [section.name, section.height]),
    }));
  } else {
    console.log(JSON.stringify({ label, width, ...result }, null, 2));
  }
  await page.close();
}

await measure("target", "https://cuddly-result-708677.framer.app/");
await measure("local", "http://127.0.0.1:5173/");
await browser.close();
