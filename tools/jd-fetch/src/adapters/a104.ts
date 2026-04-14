import type { JobAdapter } from "./types.js";
import { extractVisibleText } from "./common.js";
import { extractBySelectors } from "./html-parser.js";

export const extract104TextFromHtml = (html: string): string =>
  extractBySelectors(html, [
    { type: "class", value: "job-description" },
    { type: "class", value: "content" },
    { type: "tag", value: "article" },
  ]);

export const adapter104: JobAdapter = {
  name: "104",
  supports: (url) => url.hostname.includes("104.com.tw"),
  extract: async (page, url) => {
    const title = (await page.title()).trim();
    const html = await page.content();
    const textFromHtml = extract104TextFromHtml(html);
    const text = textFromHtml || (await extractVisibleText(page, [".job-description", ".content", "article"]));

    return {
      domain: "104.com.tw",
      url: url.toString(),
      title,
      text,
      warnings: text ? [] : ["No text extracted from known selectors"],
    };
  },
};
