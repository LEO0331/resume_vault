import { describe, expect, it } from "vitest";
import { generateResume } from "../src/template";
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
  });
});
