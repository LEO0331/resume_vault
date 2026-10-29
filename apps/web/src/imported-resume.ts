import type { ResumeEntry, ResumeProfile, ResumeTemplate, TemplateSection } from "@resume-vault/core";
import type { AppLocale } from "./template-presets";

const normalizeHeading = (heading: string): string => heading.toLowerCase().replace(/[^a-z\u4e00-\u9fff]+/g, "").trim();

const isSectionHeading = (heading: string): boolean => /^(summary|professionalsummary|profile|experience|professionalexperience|workexperience|employment|projects|selectedprojects|portfolio|skills|technicalskills|coreskills|education|achievements|awards|certifications|additional|摘要|自我介紹|經歷|工作經歷|專案|精選專案|技能|專長|技術技能|學歷|教育|成就|獎項)$/.test(normalizeHeading(heading));

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

  if (normalized.includes("education") || normalized.includes("學歷") || normalized.includes("教育")) {
    return "education";
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
    case "education":
      return "education";
    default:
      return "experience";
  }
};

export const importedEntryKey = (entry: Pick<ResumeEntry, "category" | "content" | "locale" | "title"> & Partial<ResumeEntry>): string =>
  [
    entry.locale,
    entry.category,
    normalizeEntryText(entry.title).toLowerCase(),
    normalizeEntryText(entry.content).toLowerCase(),
    ...(["organization", "position", "startDate", "endDate", "location", "parentId"] as const)
      .filter((field) => entry[field])
      .map((field) => `${field}:${normalizeEntryText(entry[field]!).toLowerCase()}`),
  ].join("|");

export const parseImportedResume = (
  text: string,
  locale: ResumeEntry["locale"],
  importedAt = new Date().toISOString(),
): ResumeEntry[] => {
  const lines = text.split(/\r?\n/);
  let currentHeading = "Imported";
  let currentCategory: ResumeEntry["category"] = "experience";
  let inHeader = false;
  let currentDates: Pick<ResumeEntry, "startDate" | "endDate"> = {};
  let groupStart = 0;
  const items: ResumeEntry[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const level = line.match(/^#+/)![0].length;
      if (level === 1 && !isSectionHeading(headingMatch[1])) {
        inHeader = true;
        continue;
      }
      inHeader = false;
      currentDates = {};
      groupStart = items.length;
      currentHeading = headingMatch[1].trim();
      if (level <= 2) currentCategory = headingToCategory(currentHeading);
      continue;
    }

    if (inHeader) continue;

    const plainLine = line.replace(/[*_]/g, "").trim();
    const dateRange = plainLine.match(DATE_RANGE);
    if (dateRange && plainLine === dateRange[0]) {
      currentDates = { startDate: dateRange[1], endDate: dateRange[2] };
      for (const entry of items.slice(groupStart)) Object.assign(entry, currentDates);
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/) ?? line.match(/^\d+\.\s+(.+)$/);
    const content = normalizeEntryText(bulletMatch ? bulletMatch[1] : line);
    if (!content) {
      continue;
    }

    items.push({
      id: "",
      category: currentCategory,
      content,
      locale,
      tags: ["imported", "custom-resume", currentCategory],
      weight: 1,
      updatedAt: importedAt,
      ...currentDates,
      ...detailsFromHeading(currentHeading),
    });
  }

  const unique = new Map<string, ResumeEntry>();
  for (const entry of items) {
    const key = importedEntryKey(entry);
    if (!unique.has(key)) unique.set(key, { ...entry, id: `imported-${stableHash(key)}` });
  }
  return [...unique.values()];
};

const DATE_RANGE = /\b((?:[A-Za-z]{3,9}\s+)?(?:19|20)\d{2}(?:[-/]\d{1,2})?)\s*(?:-|–|—|to|至)\s*((?:[A-Za-z]{3,9}\s+)?(?:19|20)\d{2}(?:[-/]\d{1,2})?|present|current|至今|迄今)/i;

// Only promote explicit dates; preserve the remaining role/employer context.
const detailsFromHeading = (heading: string): Pick<ResumeEntry, "title" | "startDate" | "endDate"> => {
  const range = heading.match(DATE_RANGE);
  const title = range ? heading.replace(range[0], "").replace(/^[\s|,;()]+|[\s|,;()]+$/g, "").trim() : heading;
  return range ? { title: title || heading, startDate: range[1], endDate: range[2] } : { title };
};

/** Identity is preserved separately from JD-selectable experience entries. */
export const parseImportedProfile = (text: string): ResumeProfile => {
  const lines = text.split(/\r?\n/);
  const nameIndex = lines.findIndex((line) => /^#\s+/.test(line.trim()) && !isSectionHeading(line.trim().replace(/^#\s+/, "")));
  if (nameIndex < 0) return {};
  const name = lines[nameIndex].trim().replace(/^#\s+/, "").trim();
  const contact: string[] = [];
  for (const rawLine of lines.slice(nameIndex + 1)) {
    const line = rawLine.trim();
    if (/^#{1,6}\s/.test(line)) break;
    if (line) contact.push(line);
  }
  return { name, ...(contact.length ? { contactLine: contact.join(" | ") } : {}) };
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
