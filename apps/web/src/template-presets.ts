import type { ResumeTemplate } from "@resume-vault/core";

export type AppLocale = ResumeTemplate["locale"];

export const STARTER_TEMPLATE_ID_BY_LOCALE: Record<AppLocale, string> = {
  "zh-TW": "starter-ats-au-standard-zh",
  "en-AU": "starter-ats-au-standard-en",
};

const LEGACY_STARTER_ID_MIGRATION: Record<string, string> = {
  "starter-reverse-chronological": STARTER_TEMPLATE_ID_BY_LOCALE["en-AU"],
  "starter-hybrid-combination": STARTER_TEMPLATE_ID_BY_LOCALE["zh-TW"],
};

export const starterTemplates: ResumeTemplate[] = [
  {
    id: STARTER_TEMPLATE_ID_BY_LOCALE["en-AU"],
    name: "AU ATS Standard (Chronological)",
    locale: "en-AU",
    sections: [
      { name: "summary", maxItems: 2, preferredTags: ["summary", "profile"] },
      { name: "experience", maxItems: 5, preferredTags: ["experience", "work"] },
      { name: "skill", maxItems: 8, preferredTags: ["skill", "tools", "tech", "strength", "domain"] },
      { name: "project", maxItems: 2, preferredTags: ["project", "delivery", "portfolio"] },
      { name: "achievement", maxItems: 3, preferredTags: ["achievement", "impact", "award"] },
    ],
  },
  {
    id: STARTER_TEMPLATE_ID_BY_LOCALE["zh-TW"],
    name: "澳洲 ATS 標準（時間倒序）",
    locale: "zh-TW",
    sections: [
      { name: "summary", maxItems: 2, preferredTags: ["summary", "profile"] },
      { name: "experience", maxItems: 5, preferredTags: ["experience", "work"] },
      { name: "skill", maxItems: 8, preferredTags: ["skill", "tools", "tech", "strength", "domain"] },
      { name: "project", maxItems: 2, preferredTags: ["project", "delivery", "portfolio"] },
      { name: "achievement", maxItems: 3, preferredTags: ["achievement", "impact", "award"] },
    ],
  },
];

const starterById = new Map(starterTemplates.map((template) => [template.id, template]));

const resolveStarterId = (templateId: string): string | undefined => {
  if (starterById.has(templateId)) {
    return templateId;
  }
  return LEGACY_STARTER_ID_MIGRATION[templateId];
};

export const ensureStarterTemplates = (templates: ResumeTemplate[]): ResumeTemplate[] => {
  const byId = new Map<string, ResumeTemplate>();

  for (const template of templates) {
    const starterId = resolveStarterId(template.id);
    if (starterId) {
      byId.set(starterId, starterById.get(starterId) as ResumeTemplate);
      continue;
    }

    byId.set(template.id, template);
  }

  for (const starter of starterTemplates) {
    byId.set(starter.id, starter);
  }

  return Array.from(byId.values());
};

export const getDefaultTemplateId = (locale: AppLocale, templates: ResumeTemplate[]): string => {
  const starterId = STARTER_TEMPLATE_ID_BY_LOCALE[locale];
  const starter = templates.find((template) => template.id === starterId && template.locale === locale);
  if (starter) {
    return starter.id;
  }

  const sameLocaleFallback = templates.find((template) => template.locale === locale);
  return sameLocaleFallback?.id ?? "";
};
