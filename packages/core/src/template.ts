import { scoreEntries, selectEntriesForTemplate } from "./match";
import type { GeneratedResume, JobDescription, ResumeEntry, ResumeTemplate } from "./types";

const byCategory = (entries: ResumeEntry[]): Map<string, ResumeEntry[]> => {
  const group = new Map<string, ResumeEntry[]>();

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

export const generateResume = (
  jd: JobDescription,
  entries: ResumeEntry[],
  template: ResumeTemplate,
): GeneratedResume => {
  const trace = scoreEntries(jd.rawText, entries);
  const selected = selectEntriesForTemplate(trace, entries, template);
  const grouped = byCategory(selected);

  const sections = [
    renderSection("Summary", (grouped.get("summary") ?? []).map((entry) => `${entry.title}: ${entry.content}`)),
    renderSection("Experience", (grouped.get("experience") ?? []).map((entry) => `${entry.title}: ${entry.content}`)),
    renderSection("Projects", (grouped.get("project") ?? []).map((entry) => `${entry.title}: ${entry.content}`)),
    renderSection("Skills", (grouped.get("skill") ?? []).map((entry) => entry.content)),
    renderSection("Achievements", (grouped.get("achievement") ?? []).map((entry) => `${entry.title}: ${entry.content}`)),
  ].filter(Boolean);

  const outputMd = [`# Tailored Resume`, `> JD source: ${jd.sourceType}`, "", ...sections].join("\n\n");

  return {
    outputMd,
    trace: trace.filter((item) => selected.some((entry) => entry.id === item.entryId)),
  };
};
