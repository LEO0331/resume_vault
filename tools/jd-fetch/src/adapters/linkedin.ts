import type { JobAdapter } from "./types.js";
import { extractVisibleText } from "./common.js";
import { extractBySelectors } from "./html-parser.js";

export const extractLinkedInTextFromHtml = (html: string): string =>
  extractBySelectors(html, [
    { type: "class", value: "show-more-less-html__markup" },
    { type: "tag", value: "main" },
    { type: "tag", value: "article" },
  ]);

export const linkedinAdapter: JobAdapter = {
  name: "linkedin",
  supports: (url) => url.hostname.includes("linkedin.com"),
  extract: async (page, url) => {
    const title = (await page.title()).trim();
    const html = await page.content();
    const textFromHtml = extractLinkedInTextFromHtml(html);
    const text = textFromHtml || (await extractVisibleText(page, [".show-more-less-html__markup", "main", "article"]));

    const warnings: string[] = [];
    if (!text) {
      warnings.push("Could not extract LinkedIn description. You may need to login or use paste fallback.");
    }

    return {
      domain: "linkedin.com",
      url: url.toString(),
      title,
      text,
      warnings,
    };
  },
};
