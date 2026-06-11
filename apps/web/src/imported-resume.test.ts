import { describe, expect, it } from "vitest";
import { createTemplateFromImportedEntries, mergeImportedEntries, mergeImportedTemplate, parseImportedResume } from "./imported-resume";

const resumeText = `# Candidate

## Summary
- Frontend engineer focused on React.
- Frontend engineer focused on React.

## Professional Experience
- Delivered API-backed workflow tooling.
`;

describe("imported resume helpers", () => {
  it("parses imported resume entries with stable ids and dedupes repeated source lines", () => {
    const first = parseImportedResume(resumeText, "en-AU", "2026-06-11T00:00:00.000Z");
    const second = parseImportedResume(resumeText, "en-AU", "2026-06-12T00:00:00.000Z");

    expect(first).toHaveLength(2);
    expect(first.map((entry) => entry.id)).toEqual(second.map((entry) => entry.id));
    expect(first.map((entry) => entry.content)).toEqual([
      "Frontend engineer focused on React.",
      "Delivered API-backed workflow tooling.",
    ]);
  });

  it("merges repeated custom resume imports without duplicating entries or templates", () => {
    const imported = parseImportedResume(resumeText, "en-AU", "2026-06-11T00:00:00.000Z");
    const template = createTemplateFromImportedEntries(imported, "en-AU");

    const onceEntries = mergeImportedEntries([], imported);
    const twiceEntries = mergeImportedEntries(onceEntries, imported);
    const onceTemplates = mergeImportedTemplate([], template);
    const twiceTemplates = mergeImportedTemplate(onceTemplates, template);

    expect(twiceEntries).toEqual(onceEntries);
    expect(twiceTemplates).toEqual(onceTemplates);
    expect(template.id).toMatch(/^custom-en-au-/);
  });
});
