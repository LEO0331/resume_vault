import { chromium } from "playwright";
import { markdownToHtml } from "./lib.mjs";

// No remote resources are needed: resume content and fonts remain on this machine.
export const renderPdf = async (markdownText, outputPath, { locale = "en-AU" } = {}) => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route("**/*", (route) => route.abort());
    await page.setContent(markdownToHtml(markdownText, { locale }), { waitUntil: "domcontentloaded" });
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({
      path: outputPath,
      format: "A4",
      preferCSSPageSize: true,
      printBackground: true,
      tagged: true,
    });
  } finally {
    await browser.close();
  }
};
