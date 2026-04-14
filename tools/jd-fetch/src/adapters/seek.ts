import type { JobAdapter } from "./types.js";
import { extractVisibleText } from "./common.js";
import { extractBySelectors } from "./html-parser.js";

export const extractSeekTextFromHtml = (html: string): string =>
  extractBySelectors(html, [
    { type: "data", attr: "data-automation", value: "jobAdDetails" },
    { type: "tag", value: "main" },
    { type: "tag", value: "article" },
  ]);

export const seekAdapter: JobAdapter = {
  name: "seek",
  supports: (url) => url.hostname.includes("seek.com.au") || url.hostname.includes("seek.co.nz"),
  extract: async (page, url) => {
    const title = (await page.title()).trim();
    const html = await page.content();
    const textFromHtml = extractSeekTextFromHtml(html);
    const text = textFromHtml || (await extractVisibleText(page, ["[data-automation='jobAdDetails']", "main", "article"]));

    return {
      domain: "seek",
      url: url.toString(),
      title,
      text,
      warnings: text ? [] : ["No text extracted from Seek selectors"],
    };
  },
};
