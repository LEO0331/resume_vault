import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { markdownToHtml } from "../src/lib.mjs";
import { renderPdf } from "../src/pdf.mjs";

describe("resume Markdown rendering", () => {
  it("renders headings, emphasis, links, nested lists and wrapped paragraphs without Markdown markers", async () => {
    const html = markdownToHtml(`# Alex Example
alex@example.test | [Portfolio](https://example.test)

## Professional Experience
### Engineer | Example Co
**2023 - Present**

- Delivered **secure APIs** with *TypeScript* and \`SQL\`.
  - Maintained regression checks.
  Continued delivery support.

## Education
Bachelor of Computing
Example University

1. First award
2. Second award`);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(html);
      expect(await page.locator("h3").textContent()).toBe("Engineer | Example Co");
      expect(await page.locator("strong").allTextContents()).toEqual(["2023 - Present", "secure APIs"]);
      expect(await page.locator("em").textContent()).toBe("TypeScript");
      expect(await page.locator("code").textContent()).toBe("SQL");
      expect(await page.locator("ul ul li").textContent()).toContain("Maintained regression checks");
      expect(await page.locator("ol > li").count()).toBe(2);
      expect(await page.locator("p").last().textContent()).toBe("Bachelor of Computing Example University");
      expect(await page.locator("a").getAttribute("href")).toBe("https://example.test");
    } finally { await browser.close(); }
  });

  it("escapes HTML and unsafe links and never embeds remote images", () => {
    const html = markdownToHtml("# 測試姓名\n<script>alert(1)</script>\n[click](javascript:alert)\n![portrait](https://example.test/photo.png)", { locale: "zh-TW" });
    expect(html).toContain('<html lang="zh-TW">');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("default-src 'none'");
    expect(markdownToHtml("alex_first_last@example.test and _TypeScript_")).toContain("alex_first_last@example.test and <em>TypeScript</em>");
  });
});

describe("local Playwright PDF", () => {
  it("creates selectable A4 output and paginates long bilingual content without blank pages", async () => {
    const dir = await mkdtemp(join(tmpdir(), "resume-vault-pdf-"));
    try {
      const shortPath = join(dir, "short-resume.pdf");
      await renderPdf("# Alex Example\nalex@example.test\n\n## Summary\nEngineer delivering **secure APIs**.\n\n## Education\nBachelor of Computing", shortPath);
      const shortPdf = (await readFile(shortPath)).toString("latin1");
      expect((shortPdf.match(/\/Type \/Page\b/g) ?? []).length).toBe(1);
      const path = join(dir, "resume.pdf");
      const sections = Array.from({ length: 12 }, (_, index) => `## Project ${index + 1}\n### Engineer | Example Co\n- Built and maintained API delivery checks for project ${index + 1}.\n- 建置服務與維護自動化測試，確保系統穩定運作。\n- Delivered accessible interfaces using TypeScript and SQL.`);
      await renderPdf(`# Alex Example\nalex@example.test\n\n${sections.join("\n\n")}\n\n## Education\nBachelor of Computing | Example University`, path, { locale: "zh-TW" });
      const bytes = await readFile(path);
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      const pdf = bytes.toString("latin1");
      expect((pdf.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
      expect(pdf).toContain("/ToUnicode");
      expect(pdf).toContain("/StructTreeRoot");
      const mediaBox = pdf.match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/);
      expect(mediaBox !== null).toBe(true);
      expect(Math.abs(Number(mediaBox?.[1]) - 595.28)).toBeLessThan(1);
      expect(Math.abs(Number(mediaBox?.[2]) - 841.89)).toBeLessThan(1);

      // Enable extraction checks with a local Python containing pypdf. This is
      // intentionally optional so npm test does not gain a Python dependency.
      if (process.env.RESUME_PDF_TEST_PYTHON) {
        const script = `import json,sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint(json.dumps([p.extract_text() for p in r.pages]))`;
        const pages: string[] = JSON.parse(execFileSync(process.env.RESUME_PDF_TEST_PYTHON, ["-c", script, path], { encoding: "utf8" }));
        expect(pages.every((text) => text.trim().length > 0)).toBe(true);
        const text = pages.join("\n").normalize("NFKC");
        expect(text).toContain("Alex Example");
        expect(text).toContain("alex@example.test");
        expect(text).toContain("Bachelor of Computing");
        expect(text).toContain("建置服務與維護自動化測試");
        for (let index = 1; index <= 12; index++) expect(text).toContain(`project ${index}.`);
        for (let index = 0; index < pages.length - 1; index++) {
          expect(pages[index].trim()).not.toMatch(/(?:Project \d+|Education|Engineer \| Example Co)$/);
        }
      }
    } finally { await rm(dir, { recursive: true, force: true }); }
  }, 30_000);
});
