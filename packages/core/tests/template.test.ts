import { describe, expect, it } from "vitest";
import { generateCoverLetter, generateResume } from "../src/template";
import type { JobDescription, ResumeEntry, ResumeTemplate } from "../src/types";

const entries: ResumeEntry[] = [
  {
    id: "s1",
    category: "summary",
    title: "Frontend Profile",
    content: "Frontend engineer focused on React and TypeScript",
    locale: "en-AU",
    tags: ["summary", "react", "typescript"],
    weight: 3,
    updatedAt: "2026-04-14T00:00:00.000Z",
  },
  {
    id: "x1",
    category: "experience",
    title: "Product Team Delivery",
    content: "Delivered API-backed features with measurable quality gains",
    locale: "en-AU",
    tags: ["experience", "api", "quality"],
    weight: 4,
    updatedAt: "2026-04-14T00:00:00.000Z",
  },
];

const jd: JobDescription = {
  id: "jd-1",
  sourceType: "paste",
  rawText: "Looking for React TypeScript engineer with API delivery experience",
  createdAt: "2026-04-14T00:00:00.000Z",
};

const template: ResumeTemplate = {
  id: "tpl-1",
  name: "base",
  locale: "en-AU",
  sections: [
    { name: "summary", maxItems: 1, preferredTags: ["summary"] },
    { name: "experience", maxItems: 1, preferredTags: ["experience"] },
  ],
};

describe("generateResume", () => {
  it("returns markdown with section headings and selected trace", () => {
    const result = generateResume(jd, entries, template);

    expect(result.outputMd).toContain("# Tailored Resume");
    expect(result.outputMd).toContain("## Summary");
    expect(result.outputMd).toContain("## Experience");
    expect(result.trace.length).toBeGreaterThan(0);
    expect(result.trace.every((item) => item.entryId === "s1" || item.entryId === "x1")).toBe(true);
    expect(result.matchReport).toBeDefined();
    expect(result.matchReport?.coverageScore).toBeGreaterThanOrEqual(0);
    expect(result.matchReport?.coverageScore).toBeLessThanOrEqual(100);
    expect(result.matchReport?.strengths.length).toBeGreaterThanOrEqual(0);
    expect(result.matchReport?.gaps.every((gap) => gap.priority === "high" || gap.priority === "medium")).toBe(true);
  });

  it("renders sections in template order instead of fixed category order", () => {
    const reorderedTemplate: ResumeTemplate = {
      ...template,
      sections: [
        { name: "experience", maxItems: 1, preferredTags: ["experience"] },
        { name: "summary", maxItems: 1, preferredTags: ["summary"] },
      ],
    };

    const result = generateResume(jd, entries, reorderedTemplate);
    const experienceIndex = result.outputMd.indexOf("## Experience");
    const summaryIndex = result.outputMd.indexOf("## Summary");

    expect(experienceIndex).toBeGreaterThan(-1);
    expect(summaryIndex).toBeGreaterThan(-1);
    expect(experienceIndex).toBeLessThan(summaryIndex);
  });
});

describe("generateCoverLetter", () => {
  it("returns deterministic english cover letter content from selected entries", () => {
    const result = generateCoverLetter({
      job: jd,
      entries,
      template,
      locale: "en-AU",
      candidateName: "Candidate Name",
      companyName: "Example Co",
      roleTitle: "Frontend Engineer",
      today: new Date("2026-05-18T00:00:00.000Z"),
    });

    expect(result.outputMd).toContain("18 May 2026");
    expect(result.outputMd).toContain("Dear Hiring Manager,");
    expect(result.outputMd).toContain("I am writing to apply for the Frontend Engineer role at Example Co.");
    expect(result.outputMd).toContain("React");
    expect(result.outputMd).toContain("Delivered API-backed features with measurable quality gains.");
    expect(result.outputMd).not.toContain("kubernetes");
    expect(result.outputMd).toContain("Kind regards,");
    expect(result.outputMd).toContain("Candidate Name");
    expect(result.trace.length).toBeGreaterThan(0);
    expect(result.matchReport?.coverageScore).toBeGreaterThanOrEqual(0);
  });

  it("falls back to generic wording and zh-TW template when role or company is missing", () => {
    const result = generateCoverLetter({
      job: {
        ...jd,
        rawText: "需要 React 與 TypeScript 能力",
      },
      entries: [
        {
          ...entries[0],
          locale: "zh-TW",
          content: "熟悉 React 與 TypeScript 開發",
        },
      ],
      template: {
        ...template,
        locale: "zh-TW",
      },
      locale: "zh-TW",
      today: new Date("2026-05-18T00:00:00.000Z"),
    });

    expect(result.outputMd).toContain("2026年5月18日");
    expect(result.outputMd).toContain("您好，招募主管：");
    expect(result.outputMd).toContain("我想應徵這份職位。");
    expect(result.outputMd).toContain("熟悉 React 與 TypeScript 開發");
    expect(result.outputMd).toContain("此致");
    expect(result.outputMd).not.toContain("Kind regards");
  });
});
