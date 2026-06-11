import type { ResumeEntry, ResumeTemplate, TemplateSection } from "@resume-vault/core";
import type { AppLocale } from "./template-presets";

const normalizeHeading = (heading: string): string => heading.toLowerCase().replace(/[^a-z\u4e00-\u9fff]+/g, "").trim();

const stableHash = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
};

const normalizeEntryText = (value: string): string => value.trim().replace(/\s+/g, " ");

const headingToCategory = (heading: string): ResumeEntry["category"] => {
  const normalized = normalizeHeading(heading);

  if (normalized.includes("summary") || normalized.includes("profile") || normalized.includes("自我") || normalized.includes("摘要")) {
    return "summary";
  }

  if (normalized.includes("experience") || normalized.includes("work") || normalized.includes("經歷") || normalized.includes("工作")) {
    return "experience";
  }

  if (normalized.includes("project") || normalized.includes("作品") || normalized.includes("專案")) {
    return "project";
  }

  if (normalized.includes("skill") || normalized.includes("技能") || normalized.includes("專長")) {
    return "skill";
  }

  if (normalized.includes("achievement") || normalized.includes("award") || normalized.includes("成就") || normalized.includes("獎")) {
    return "achievement";
  }

  return "experience";
};

const categoryLabelForTemplate = (category: ResumeEntry["category"]): string => {
  switch (category) {
    case "summary":
      return "summary";
    case "experience":
      return "experience";
    case "project":
      return "project";
    case "skill":
      return "skill";
    case "achievement":
      return "achievement";
    default:
      return "experience";
  }
};

export const importedEntryKey = (entry: Pick<ResumeEntry, "category" | "content" | "locale" | "title">): string =>
  [
    entry.locale,
    entry.category,
    normalizeEntryText(entry.title).toLowerCase(),
    normalizeEntryText(entry.content).toLowerCase(),
  ].join("|");

export const parseImportedResume = (
  text: string,
  locale: ResumeEntry["locale"],
  importedAt = new Date().toISOString(),
): ResumeEntry[] => {
  const lines = text.split(/\r?\n/);
  let currentHeading = "Imported";
  let currentCategory: ResumeEntry["category"] = "experience";
  const items: ResumeEntry[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      currentHeading = headingMatch[1].trim();
      currentCategory = headingToCategory(currentHeading);
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/) ?? line.match(/^\d+\.\s+(.+)$/);
    const content = normalizeEntryText(bulletMatch ? bulletMatch[1] : line);
    if (!content) {
      continue;
    }

    const entrySeed = importedEntryKey({
      category: currentCategory,
      content,
      locale,
      title: currentHeading,
    });
    if (seen.has(entrySeed)) {
      continue;
    }
    seen.add(entrySeed);

    items.push({
      id: `imported-${stableHash(entrySeed)}`,
      category: currentCategory,
      title: currentHeading,
      content,
      locale,
      tags: ["imported", "custom-resume", currentCategory],
      weight: 1,
      updatedAt: importedAt,
    });
  }

  return items;
};

export const createTemplateFromImportedEntries = (
  importedEntries: ResumeEntry[],
  locale: AppLocale,
): ResumeTemplate => {
  const counts = new Map<ResumeEntry["category"], number>();
  const order: ResumeEntry["category"][] = [];

  for (const entry of importedEntries) {
    if (!counts.has(entry.category)) {
      counts.set(entry.category, 0);
      order.push(entry.category);
    }
    counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  }

  const sections: TemplateSection[] = order.map((category) => ({
    name: categoryLabelForTemplate(category),
    maxItems: Math.max(1, Math.min(8, counts.get(category) ?? 1)),
    preferredTags: [category],
  }));

  return {
    id: `custom-${locale.toLowerCase()}-${stableHash(importedEntries.map(importedEntryKey).join("\n"))}`,
    name: locale === "zh-TW" ? "custom-zh-imported-resume" : "custom-en-imported-resume",
    locale,
    sections,
  };
};

export const mergeImportedEntries = (existingEntries: ResumeEntry[], importedEntries: ResumeEntry[]): ResumeEntry[] => {
  const existingKeys = new Set(existingEntries.map(importedEntryKey));
  const nextImported = importedEntries.filter((entry) => !existingKeys.has(importedEntryKey(entry)));
  return [...nextImported, ...existingEntries];
};

export const mergeImportedTemplate = (existingTemplates: ResumeTemplate[], importedTemplate: ResumeTemplate): ResumeTemplate[] => {
  const withoutDuplicate = existingTemplates.filter((template) => template.id !== importedTemplate.id);
  return [importedTemplate, ...withoutDuplicate];
};
