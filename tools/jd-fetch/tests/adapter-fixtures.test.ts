import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { adapter104, extract104TextFromHtml } from "../src/adapters/a104";
import { extractLinkedInTextFromHtml, linkedinAdapter } from "../src/adapters/linkedin";
import { extractSeekTextFromHtml, seekAdapter } from "../src/adapters/seek";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string => readFileSync(resolve(currentDir, "fixtures", name), "utf-8");

describe("adapter support routing", () => {
  it("matches known domains", () => {
    expect(adapter104.supports(new URL("https://www.104.com.tw/job/123"))).toBe(true);
    expect(linkedinAdapter.supports(new URL("https://www.linkedin.com/jobs/view/123"))).toBe(true);
    expect(seekAdapter.supports(new URL("https://www.seek.com.au/job/123"))).toBe(true);
  });
});

describe("adapter fixture extraction", () => {
  it("extracts text from 104 fixture", () => {
    const text = extract104TextFromHtml(fixture("104-sample.html"));
    expect(text).toContain("React TypeScript engineer wanted");
    expect(text).toContain("API integration");
  });

  it("extracts text from linkedin fixture", () => {
    const text = extractLinkedInTextFromHtml(fixture("linkedin-sample.html"));
    expect(text).toContain("Senior frontend role focused on React");
    expect(text).toContain("design system quality");
  });

  it("extracts text from seek fixture", () => {
    const text = extractSeekTextFromHtml(fixture("seek-sample.html"));
    expect(text).toContain("customer-facing web features");
    expect(text).toContain("product managers and backend engineers");
  });
});
