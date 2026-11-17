import { describe, expect, it } from "vitest";
import { normalizeState, recoverStoredState, validateBackup } from "./stored-state";
import { parseImportedProfile, parseImportedResume } from "./imported-resume";

describe("stored resume migration", () => {
  it("adds an empty profile to v1 data without replacing bank entries or custom templates", () => {
    const entries = parseImportedResume("## Experience\n- Built local tools.", "en-AU");
    const custom = { id: "custom", name: "My template", locale: "en-AU" as const, sections: [{ name: "experience", maxItems: 2 }] };
    const result = normalizeState({ entries, templates: [custom], jobs: [] });
    expect(result.profile).toEqual({});
    expect(result.entries).toBe(entries);
    expect(result.templates).toContainEqual(custom);
    expect(result.templates.find((item) => item.id === "starter-ats-au-standard-en")?.sections.map((item) => item.name)).toEqual([
      "summary", "skill", "experience", "project", "education", "achievement",
    ]);
  });

  it("preserves education, explicit employment dates, identity and contact through JSON persistence", () => {
    const text = "# Alex Example\nalex@example.test | Taipei\n\n## Experience\n### Engineer | Example Co | 2023 - Present\n- Built local tools.\n\n## Education\n### Example University\n- Bachelor of Engineering, 2022";
    const entries = parseImportedResume(text, "en-AU");
    const profile = { ...parseImportedProfile(text), phone: "+61 400 000 000", website: "https://example.test" };
    const stored = normalizeState({ entries, profile });
    const restored = normalizeState(JSON.parse(JSON.stringify(stored)));
    expect(restored).toEqual(stored);
    expect(restored.profile).toEqual(profile);
    expect(restored.entries.find((entry) => entry.category === "experience")).toMatchObject({
      title: "Engineer | Example Co", startDate: "2023", endDate: "Present",
    });
    expect(restored.entries.find((entry) => entry.category === "education")).toMatchObject({ title: "Example University", content: "Bachelor of Engineering, 2022" });
    expect(restored.entries).toHaveLength(2);
  });
});

describe("saved state validation", () => {
  const entries = parseImportedResume("## Experience\n- Built local tools.", "en-AU");
  const template = { id: "toString", name: "Custom", locale: "en-AU", sections: [{ name: "experience", maxItems: 2 }] };
  const job = { id: "job", sourceType: "paste", rawText: "Example job", createdAt: "2026-04-14T10:00:00.000Z" };
  const backup = { entries, templates: [template], jobs: [job] };

  it("restores v1 backups with valid entries, templates and jobs", () => {
    const restored = validateBackup(backup);
    expect(restored.entries).toEqual(entries);
    expect(restored.templates).toContainEqual(template);
    expect(restored.jobs).toEqual([job]);
    expect(restored.profile).toEqual({});
  });

  it.each([
    { entries: [null] },
    { templates: [{ ...template, sections: [{ name: "experience", maxItems: "2" }] }] },
    { jobs: [{ ...job, rawText: [] }] },
    { profile: { phone: 123 } },
  ])("rejects a backup containing an invalid value", (invalid) => {
    expect(() => validateBackup({ ...backup, ...invalid })).toThrow("Invalid resume vault backup");
  });

  it("recovers valid records and profile fields on startup", () => {
    const restored = recoverStoredState({
      entries: [null, ...entries],
      templates: [template, { ...template, sections: null }],
      jobs: [job, false],
      profile: { name: "Alex Example", phone: 123 },
    });
    expect(restored.entries).toEqual(entries);
    expect(restored.templates).toContainEqual(template);
    expect(restored.jobs).toEqual([job]);
    expect(restored.profile).toEqual({ name: "Alex Example" });
  });
});
