import { describe, expect, it } from "vitest";
import { generateResume } from "../src/template";
import type { JobDescription, ResumeEntry, ResumeTemplate } from "../src/types";

const job: JobDescription = { id: "jd", sourceType: "paste", rawText: "Required TypeScript API", createdAt: "2026-01-01" };
const entry = (id: string, category: ResumeEntry["category"], content: string, extra: Partial<ResumeEntry> = {}): ResumeEntry => ({
  id, category, title: id, content, locale: "en-AU", tags: [category], weight: 1, updatedAt: "2026-01-01", ...extra,
});
const template: ResumeTemplate = { id: "ats", name: "ATS", locale: "en-AU", sections: [
  { name: "summary", maxItems: 1, preferredTags: ["summary"] },
  { name: "skill", maxItems: 2, preferredTags: ["skill"] },
  { name: "experience", maxItems: 3, preferredTags: ["experience"] },
  { name: "project", maxItems: 1, preferredTags: ["project"] },
] };

describe("submission resume", () => {
  it("retains profile, education and role relationships without analysis or invented claims", () => {
    const bank = [entry("Profile", "summary", "Engineer building internal tools."),
      entry("Skills", "skill", "TypeScript, SQL"),
      entry("old", "experience", "Maintained services.", { organization: "Example Labs", position: "Developer", startDate: "2019", endDate: "2021" }),
      entry("recent", "experience", "Built TypeScript APIs.", { organization: "Fictional Systems", position: "Engineer", startDate: "2022", endDate: "Present" }),
      entry("Tooling", "project", "Automated checks.", { parentId: "recent" }),
      entry("BSc Computing", "education", "Computer science.", { organization: "Example University", startDate: "2015", endDate: "2018" })];
    const result = generateResume(job, bank, template, { name: "Alex Example", email: "alex@example.invalid", phone: "0400 000 000", location: "Melbourne" });
    const md = result.outputMd;
    expect(md).toContain("# Alex Example\n");
    expect(md).toContain("Melbourne | alex@example.invalid | 0400 000 000");
    expect(md).toContain("Engineer | Fictional Systems");
    expect(md).toContain("2022 - Present");
    expect(md.indexOf("### Engineer")).toBeLessThan(md.indexOf("### Developer"));
    expect(md).toContain("### BSc Computing | Example University");
    const headings = [...md.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    expect(headings).toEqual(["Professional Summary", "Technical Skills", "Professional Experience", "Selected Projects", "Education"]);
    expect(md).not.toMatch(/Tailored Resume|JD source|coverageScore|matchedTokens|Required|50%|Candidate Name/);
    expect(result.trace.length).toBeGreaterThan(0);
    expect(result.matchReport).toBeDefined();
  });

  it("selects JD relevant bullets, deduplicates and does not export tags", () => {
    const bank = [entry("API work", "experience", "Built TypeScript API tools.", { tags: ["experience", "kubernetes"] }),
      entry("other", "experience", "Designed packaging."), entry("empty", "summary", "")];
    const limited = { ...template, sections: [{ name: "experience", maxItems: 1, preferredTags: ["experience"] }] };
    const md = generateResume(job, bank, limited).outputMd;
    expect(md).toContain("Built TypeScript API tools.");
    expect(md).not.toMatch(/packaging|kubernetes|Professional Summary|undefined/);
    const duplicated = generateResume(job, [bank[0], { ...bank[0], id: "duplicate" }], template).outputMd;
    expect(duplicated.match(/Built TypeScript API tools/g)).toHaveLength(1);
  });

  it("supports Chinese and legacy three-argument calls without placeholders", () => {
    const bank = [entry("學士", "education", "資訊工程", { locale: "zh-TW", organization: "範例大學" }),
      entry("簡介", "summary", "開發內部工具", { locale: "zh-TW" }),
      entry("English", "summary", "Wrong locale")];
    const md = generateResume(job, bank, { ...template, locale: "zh-TW" }).outputMd;
    expect(md).toContain("## 專業摘要");
    expect(md).toContain("## 學歷");
    expect(md).toContain("學士 | 範例大學");
    expect(md).not.toMatch(/Wrong locale|Candidate|Tailored|JD/);
  });

  it("sorts explicit month-name dates chronologically and omits duplicate skills", () => {
    const bank = [entry("Earlier", "experience", "Built tools.", { endDate: "Nov 2022" }),
      entry("Later", "experience", "Maintained APIs.", { endDate: "Apr 2024" }),
      entry("Skills A", "skill", "TypeScript, SQL"), entry("Skills B", "skill", "TypeScript, SQL")];
    const md = generateResume(job, bank, template).outputMd;
    expect(md.indexOf("### Later")).toBeLessThan(md.indexOf("### Earlier"));
    expect(md.match(/TypeScript, SQL/g)).toHaveLength(1);
  });
});
