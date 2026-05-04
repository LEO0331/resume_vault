import type { ResumeTemplate } from "@resume-vault/core";
import { describe, expect, it } from "vitest";
import { ensureStarterTemplates, getDefaultTemplateId, STARTER_TEMPLATE_ID_BY_LOCALE, starterTemplates } from "./template-presets";

describe("template presets", () => {
  it("ensures only the new AU ATS starter templates are present", () => {
    const normalized = ensureStarterTemplates([]);
    const ids = normalized.map((template) => template.id);

    expect(ids).toContain(STARTER_TEMPLATE_ID_BY_LOCALE["en-AU"]);
    expect(ids).toContain(STARTER_TEMPLATE_ID_BY_LOCALE["zh-TW"]);
    expect(ids).not.toContain("starter-reverse-chronological");
    expect(ids).not.toContain("starter-hybrid-combination");
  });

  it("migrates legacy starter ids and replaces with canonical starter structure", () => {
    const customizedLegacy: ResumeTemplate = {
      id: "starter-reverse-chronological",
      name: "Old Name",
      locale: "zh-TW",
      sections: [{ name: "summary", maxItems: 99 }],
    };

    const normalized = ensureStarterTemplates([customizedLegacy]);
    const migrated = normalized.find((template) => template.id === STARTER_TEMPLATE_ID_BY_LOCALE["en-AU"]);

    expect(migrated).toBeDefined();
    expect(migrated?.name).toBe("AU ATS Standard (Chronological)");
    expect(migrated?.locale).toBe("en-AU");
    expect(migrated?.sections).toEqual(starterTemplates[0]?.sections);
  });

  it("returns locale starter as default and falls back to same-locale first template", () => {
    const templates: ResumeTemplate[] = [
      {
        id: "custom-1",
        name: "Custom ZH",
        locale: "zh-TW",
        sections: [{ name: "summary", maxItems: 1 }],
      },
      ...starterTemplates,
    ];

    expect(getDefaultTemplateId("zh-TW", templates)).toBe(STARTER_TEMPLATE_ID_BY_LOCALE["zh-TW"]);
    expect(getDefaultTemplateId("en-AU", templates)).toBe(STARTER_TEMPLATE_ID_BY_LOCALE["en-AU"]);

    const noStarter: ResumeTemplate[] = [
      {
        id: "custom-en",
        name: "Custom EN",
        locale: "en-AU",
        sections: [{ name: "summary", maxItems: 1 }],
      },
    ];
    expect(getDefaultTemplateId("en-AU", noStarter)).toBe("custom-en");
    expect(getDefaultTemplateId("zh-TW", noStarter)).toBe("");
  });
});
