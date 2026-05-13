import { buildMatchReport, scoreEntries, selectEntriesForTemplate } from "./match";
import type { GeneratedResume, JobDescription, ResumeEntry, ResumeTemplate } from "./types";

type RenderableSection = {
  title: string;
  lines: string[];
};

const categoryToHeading = (category: string): string => {
  switch (category) {
    case "summary":
      return "Summary";
    case "experience":
      return "Experience";
    case "project":
      return "Projects";
    case "skill":
      return "Skills";
    case "achievement":
      return "Achievements";
    default:
      return category;
  }
};

const byCategory = (entries: ResumeEntry[]): Map<ResumeEntry["category"], ResumeEntry[]> => {
  const group = new Map<ResumeEntry["category"], ResumeEntry[]>();

  for (const entry of entries) {
    const existing = group.get(entry.category) ?? [];
    existing.push(entry);
    group.set(entry.category, existing);
  }

  return group;
};

const renderSection = (title: string, lines: string[]): string => {
  if (lines.length === 0) {
    return "";
  }

  return `## ${title}\n${lines.map((line) => `- ${line}`).join("\n")}`;
};

const buildSectionsFromTemplate = (
  template: ResumeTemplate,
  grouped: Map<ResumeEntry["category"], ResumeEntry[]>,
): RenderableSection[] => {
  const usedCategories = new Set<ResumeEntry["category"]>();
  const sections: RenderableSection[] = [];

  for (const section of template.sections) {
    const category = section.name as ResumeEntry["category"];
    if (usedCategories.has(category)) {
      continue;
    }

    const categoryEntries = grouped.get(category) ?? [];
    const lines =
      category === "skill"
        ? categoryEntries.map((entry) => entry.content)
        : categoryEntries.map((entry) => `${entry.title}: ${entry.content}`);

    if (lines.length > 0) {
      sections.push({
        title: categoryToHeading(category),
        lines,
      });
    }
    usedCategories.add(category);
  }

  for (const [category, categoryEntries] of grouped.entries()) {
    if (usedCategories.has(category)) {
      continue;
    }

    const lines =
      category === "skill"
        ? categoryEntries.map((entry) => entry.content)
        : categoryEntries.map((entry) => `${entry.title}: ${entry.content}`);

    sections.push({
      title: categoryToHeading(category),
      lines,
    });
  }

  return sections;
};

export const generateResume = (
  jd: JobDescription,
  entries: ResumeEntry[],
  template: ResumeTemplate,
): GeneratedResume => {
  const trace = scoreEntries(jd.rawText, entries);
  const selected = selectEntriesForTemplate(trace, entries, template);
  const grouped = byCategory(selected);
  const selectedIds = new Set(selected.map((entry) => entry.id));
  const sections = buildSectionsFromTemplate(template, grouped)
    .map((section) => renderSection(section.title, section.lines))
    .filter(Boolean);

  const outputMd = [`# Tailored Resume`, `> JD source: ${jd.sourceType}`, "", ...sections].join("\n\n");

  return {
    outputMd,
    trace: trace.filter((item) => selectedIds.has(item.entryId)),
    matchReport: buildMatchReport(jd.rawText, selected),
  };
};
