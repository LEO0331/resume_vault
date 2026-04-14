import { describe, expect, it } from "vitest";
import { scoreEntries, selectEntriesForTemplate } from "../src/match";
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
    expect(trace[0]?.reasons).toContain("tagBoost:1");
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
