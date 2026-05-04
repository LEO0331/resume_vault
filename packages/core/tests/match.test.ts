import { describe, expect, it } from "vitest";
import { buildMatchReport, scoreEntries, selectEntriesForTemplate } from "../src/match";
import type { ResumeEntry, ResumeTemplate } from "../src/types";

const entries: ResumeEntry[] = [
  {
    id: "e1",
    category: "experience",
    title: "React TypeScript Delivery",
    content: "Built React apps with TypeScript and API integration",
    locale: "en-AU",
    tags: ["react", "typescript", "api", "experience"],
    weight: 3,
    updatedAt: "2026-04-14T00:00:00.000Z",
  },
  {
    id: "e2",
    category: "experience",
    title: "Data Entry",
    content: "Handled spreadsheet updates",
    locale: "en-AU",
    tags: ["operations"],
    weight: 1,
    updatedAt: "2026-04-14T00:00:00.000Z",
  },
  {
    id: "e3",
    category: "skill",
    title: "Skills",
    content: "React, TypeScript, Playwright",
    locale: "en-AU",
    tags: ["skill", "react", "typescript"],
    weight: 2,
    updatedAt: "2026-04-14T00:00:00.000Z",
  },
];

const template: ResumeTemplate = {
  id: "tpl-1",
  name: "base",
  locale: "en-AU",
  sections: [
    { name: "experience", maxItems: 1, preferredTags: ["experience"] },
    { name: "skill", maxItems: 1, preferredTags: ["skill"] },
  ],
};

describe("scoreEntries", () => {
  it("ranks entries with stronger overlap and tags higher", () => {
    const trace = scoreEntries("react typescript api delivery", entries);

    expect(trace[0]?.entryId).toBe("e1");
    expect(trace[0]?.score).toBeGreaterThan(trace[1]?.score ?? 0);
    expect(trace[0]?.reasons.some((reason) => reason.startsWith("overlap:"))).toBe(true);
    expect(trace[0]?.reasons).toContain("tagBoost:1");
    expect(trace[0]?.reasons.some((reason) => reason.startsWith("priority_overlap:"))).toBe(true);
    expect(Array.isArray(trace[0]?.matchedTokens)).toBe(true);
    expect(Array.isArray(trace[0]?.priorityMatchedTokens)).toBe(true);
  });

  it("prioritizes requirement-heavy overlap over generic overlap", () => {
    const priorityEntries: ResumeEntry[] = [
      {
        id: "p1",
        category: "experience",
        title: "Must-have React TypeScript API ownership",
        content: "Required skills covered in production delivery",
        locale: "en-AU",
        tags: ["experience", "react", "typescript", "api"],
        weight: 2,
        updatedAt: "2026-04-14T00:00:00.000Z",
      },
      {
        id: "p2",
        category: "experience",
        title: "General software project",
        content: "Worked on collaboration and communication",
        locale: "en-AU",
        tags: ["experience"],
        weight: 2,
        updatedAt: "2026-04-14T00:00:00.000Z",
      },
    ];

    const trace = scoreEntries(
      "Responsibilities: build platform features\nRequirements: React TypeScript API\nNice to have: mentoring",
      priorityEntries,
    );
    expect(trace[0]?.entryId).toBe("p1");
  });

  it("keeps tie ordering deterministic by entry id", () => {
    const tieEntries: ResumeEntry[] = [
      {
        id: "b-entry",
        category: "skill",
        title: "React",
        content: "React",
        locale: "en-AU",
        tags: ["skill", "react"],
        weight: 1,
        updatedAt: "2026-04-14T00:00:00.000Z",
      },
      {
        id: "a-entry",
        category: "skill",
        title: "React",
        content: "React",
        locale: "en-AU",
        tags: ["skill", "react"],
        weight: 1,
        updatedAt: "2026-04-14T00:00:00.000Z",
      },
    ];

    const trace = scoreEntries("React", tieEntries);
    expect(trace[0]?.entryId).toBe("a-entry");
  });

  it("keeps recency boost bounded so relevance still wins", () => {
    const recencyEntries: ResumeEntry[] = [
      {
        id: "recent-low",
        category: "experience",
        title: "General operations support",
        content: "Handled documentation and meetings",
        locale: "en-AU",
        tags: ["operations"],
        weight: 1,
        updatedAt: "2026-04-20T00:00:00.000Z",
      },
      {
        id: "older-high",
        category: "experience",
        title: "React TypeScript API platform delivery",
        content: "Built frontend platform features with API ownership",
        locale: "en-AU",
        tags: ["react", "typescript", "api", "experience"],
        weight: 1,
        updatedAt: "2025-01-10T00:00:00.000Z",
      },
    ];

    const trace = scoreEntries("Requirements: React TypeScript API", recencyEntries);
    expect(trace[0]?.entryId).toBe("older-high");
  });
});

describe("selectEntriesForTemplate", () => {
  it("respects section limits and preferred tags", () => {
    const trace = scoreEntries("react typescript api delivery", entries);
    const selected = selectEntriesForTemplate(trace, entries, template);

    expect(selected).toHaveLength(2);
    expect(selected.some((entry) => entry.id === "e1")).toBe(true);
    expect(selected.some((entry) => entry.id === "e3")).toBe(true);
  });
});

describe("buildMatchReport", () => {
  it("returns bounded coverage score and expected decision bands", () => {
    const applyReport = buildMatchReport("Requirements: React TypeScript API", [entries[0], entries[2]]);
    expect(applyReport.coverageScore).toBeGreaterThanOrEqual(0);
    expect(applyReport.coverageScore).toBeLessThanOrEqual(100);
    expect(["apply", "apply_with_gaps", "stretch"]).toContain(applyReport.decision);
    expect(applyReport.gaps.every((gap) => gap.priority === "high" || gap.priority === "medium")).toBe(true);

    const stretchReport = buildMatchReport("Requirements: kubernetes terraform golang", [entries[1]]);
    expect(stretchReport.coverageScore).toBeLessThan(applyReport.coverageScore);
    expect(stretchReport.decision).toBe("stretch");
  });

  it("does not treat jd section labels as capability gaps", () => {
    const report = buildMatchReport("Requirements: React TypeScript\nResponsibilities: API integration", [entries[0], entries[2]]);
    const gapTokens = report.gaps.map((gap) => gap.token);
    expect(gapTokens).not.toContain("requirements");
    expect(gapTokens).not.toContain("responsibilities");
    expect(gapTokens).not.toContain("requirement");
    expect(gapTokens).not.toContain("responsibility");
  });
});
