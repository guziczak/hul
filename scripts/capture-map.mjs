import { chromium } from "playwright-core";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const coordinates = { latitude: 51.1104907, longitude: 17.0132594 };

const captures = [
  {
    path: "public/images/map-domar.jpg",
    width: 1920,
    height: 720,
    bbox: [16.987, 51.104, 17.0395, 51.117],
  },
  {
    path: "public/images/map-domar-mobile.jpg",
    width: 768,
    height: 520,
    bbox: [16.996, 51.1035, 17.0305, 51.1175],
  },
];

const browser = await chromium.launch({ executablePath: edgePath, headless: true });

try {
  for (const capture of captures) {
    const page = await browser.newPage({
      viewport: { width: capture.width, height: capture.height },
      deviceScaleFactor: 1,
    });
    const bbox = capture.bbox.join(",");
    const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${coordinates.latitude}%2C${coordinates.longitude}`;

    await page.goto(mapUrl, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: capture.path,
      type: "jpeg",
      quality: 90,
      fullPage: false,
    });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log("Saved local OpenStreetMap previews for the HUL showroom.");
