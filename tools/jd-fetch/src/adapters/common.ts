import type { Page } from "playwright";

export const extractVisibleText = async (page: Page, selectors: string[]): Promise<string> => {
  for (const selector of selectors) {
    const text = await page.locator(selector).first().innerText().catch(() => "");
    if (text.trim()) {
      return text.trim();
    }
  }

  return page.locator("body").innerText().catch(() => "");
};
