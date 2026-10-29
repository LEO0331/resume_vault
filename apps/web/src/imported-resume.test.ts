import { describe, expect, it } from "vitest";
import { generateResume } from "@resume-vault/core";
import { createTemplateFromImportedEntries, mergeImportedEntries, mergeImportedTemplate, parseImportedProfile, parseImportedResume } from "./imported-resume";

const resumeText = `# Candidate

## Summary
- Frontend engineer focused on React.
- Frontend engineer focused on React.

## Professional Experience
- Delivered API-backed workflow tooling.
`;

describe("imported resume helpers", () => {
  it("keeps a role's separate date line when JD selection is limited to one bullet", () => {
    const source = "## Experience\n### Engineer | Example Co\n*Jan 2023 - Present*\n- Built TypeScript tooling.\n- Wrote documentation.";
    const entries = parseImportedResume(source, "en-AU");
    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.startDate === "Jan 2023" && entry.endDate === "Present")).toBe(true);
    const result = generateResume({ id: "jd", sourceType: "paste", rawText: "TypeScript tooling", createdAt: "2026-01-01" }, entries, {
      id: "limited", name: "Limited", locale: "en-AU", sections: [{ name: "experience", maxItems: 1, preferredTags: ["experience"] }],
    });
    expect(result.outputMd).toContain("Engineer | Example Co");
    expect(result.outputMd).toContain("Jan 2023");
    expect(result.outputMd).toContain("Present");
    expect(result.outputMd).toContain("Built TypeScript tooling.");
  });

  it("does not merge otherwise identical roles held in different periods", () => {
    const first = parseImportedResume("## Experience\n### Engineer | Example Co | 2020 - 2021\n- Built tools.", "en-AU");
    const second = parseImportedResume("## Experience\n### Engineer | Example Co | 2023 - Present\n- Built tools.", "en-AU");
    expect(mergeImportedEntries(first, second)).toHaveLength(2);
    expect(first[0]?.id).not.toBe(second[0]?.id);
  });

  it("continues to accept legacy top-level section headings without treating them as names", () => {
    const source = "# Summary\nEngineering background.\n# Experience\n- Built tools.\n# Education\n- Example University";
    expect(parseImportedProfile(source)).toEqual({});
    expect(parseImportedResume(source, "en-AU").map((entry) => entry.category)).toEqual(["summary", "experience", "education"]);
  });

  it("keeps Chinese identity and contact outside selectable entries and recognises education", () => {
    const source = "# 陳範例\n台北 | alex@example.test\n\n## 學歷\n### 範例大學\n- 資訊工程學士\n\n## 技能\n- TypeScript";
    expect(parseImportedProfile(source)).toEqual({ name: "陳範例", contactLine: "台北 | alex@example.test" });
    const entries = parseImportedResume(source, "zh-TW");
    expect(entries.map((entry) => entry.category)).toEqual(["education", "skill"]);
    expect(entries[0]?.title).toBe("範例大學");
    expect(createTemplateFromImportedEntries(entries, "zh-TW").sections[0]?.name).toBe("education");
  });

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
