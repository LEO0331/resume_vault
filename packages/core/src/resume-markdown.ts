import type { EntryCategory, ResumeEntry, ResumeProfile, ResumeTemplate } from "./types";

const headings: Record<ResumeTemplate["locale"], Record<EntryCategory, string>> = {
  "en-AU": { summary: "Professional Summary", skill: "Technical Skills", experience: "Professional Experience", project: "Selected Projects", education: "Education", achievement: "Achievements" },
  "zh-TW": { summary: "專業摘要", skill: "技術技能", experience: "工作經歷", project: "精選專案", education: "學歷", achievement: "成就" },
};

const unique = (values: (string | undefined)[]): string[] => [...new Set(values.map((value) => (value ?? "").trim()).filter(Boolean))];
const inline = (value?: string): string => (value ?? "").replace(/\s+/g, " ").trim();
const sortableDate = (value: string): string => {
  if (/^(present|current|至今|迄今)$/i.test(value)) return "9999-12";
  const numeric = value.match(/^((?:19|20)\d{2})(?:[-/](\d{1,2}))?/);
  if (numeric) return `${numeric[1]}-${(numeric[2] ?? "01").padStart(2, "0")}`;
  const month = value.match(/^([A-Za-z]+)\s+((?:19|20)\d{2})$/);
  const monthIndex = month ? ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(month[1].slice(0, 3).toLowerCase()) : -1;
  return month && monthIndex >= 0 ? `${month[2]}-${String(monthIndex + 1).padStart(2, "0")}` : "";
};
const dateKey = (entry: ResumeEntry): string => {
  const sourceRange = `${entry.title}\n${entry.content}`.match(/\b((?:19|20)\d{2}(?:-\d{2})?)\s*[-–—~至]\s*((?:19|20)\d{2}(?:-\d{2})?|present|current|至今|迄今)/i);
  const end = entry.endDate || sourceRange?.[2];
  return sortableDate(end || entry.startDate || sourceRange?.[1] || "");
};

/** Presentation only: content and relevance come from the existing selector. */
export const renderResumeMarkdown = (
  entries: ResumeEntry[], template: ResumeTemplate, profile: ResumeProfile, sourceEntries: ResumeEntry[] = entries,
): string => {
  const labels = headings[template.locale];
  const order = unique([...template.sections.map((section) => section.name), ...entries.map((entry) => entry.category)]);
  const contacts = unique([profile.contactLine ?? "", ...[profile.location, profile.email, profile.phone, profile.linkedin, profile.website]
    .map((value) => inline(value)).filter((value) => value && !(profile.contactLine ?? "").includes(value))]);
  const blocks: string[] = [];
  if (inline(profile.name)) blocks.push(`# ${inline(profile.name)}`);
  if (contacts.length) blocks.push(contacts.join(" | "));
  for (const category of order) {
    const seen = new Set<string>();
    const rows = entries.filter((entry) => entry.category === category && (entry.content.trim() || (entry.category === "education" && (entry.title.trim() || entry.organization))))
      .filter((entry) => {
        const key = (["summary", "skill", "achievement"].includes(category) ? [entry.content.trim()] : [entry.title, entry.content, entry.organization, entry.position, entry.startDate, entry.endDate, entry.location, entry.parentId]).join("|").toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (!rows.length) continue;
    if (["experience", "project", "education"].includes(category)) {
      // Stable sort leaves undated legacy entries in their original selection order.
      rows.sort((a, b) => dateKey(b).localeCompare(dateKey(a)) || sortableDate(b.startDate ?? "").localeCompare(sortableDate(a.startDate ?? "")));
    }
    const grouped: ResumeEntry[] = [];
    for (const entry of rows) {
      const sameRole = grouped.find((item) => ["experience", "project", "education"].includes(category)
        && [item.title, item.organization, item.position, item.startDate, item.endDate, item.location, item.parentId].join("|")
          === [entry.title, entry.organization, entry.position, entry.startDate, entry.endDate, entry.location, entry.parentId].join("|"));
      if (sameRole) sameRole.content += `\n${entry.content}`;
      else grouped.push({ ...entry });
    }
    const body = grouped.map((entry) => {
      const content = unique(entry.content.split(/\r?\n/).map((line) => line.trim()));
      if (category === "summary") return content.join("\n\n");
      if (category === "skill" || category === "achievement") {
        return content.map((line) => /^[-*]\s/.test(line) ? line : `- ${line}`).join("\n");
      }
      const parent = entry.parentId ? sourceEntries.find((item) => item.id === entry.parentId) : undefined;
      const title = unique([entry.position || entry.title, entry.organization]).join(" | ");
      const genericTitle = /^(professional experience|experience|work experience|employment|projects|selected projects|education|工作經歷|經歷|專案|精選專案|學歷)$/i.test(title.trim());
      const details = unique([
        [entry.startDate, entry.endDate].filter(Boolean).join(" - "), entry.location ?? "",
        parent ? unique([parent.position || parent.title, parent.organization]).join(" | ") : "",
      ]).join(" | ");
      return [!genericTitle && inline(title) ? `### ${inline(title)}` : "", details, ...content.map((line) => /^[-*]\s/.test(line) ? line : `- ${line}`)].filter(Boolean).join("\n\n");
    }).join("\n\n");
    blocks.push(`## ${labels[category as EntryCategory] ?? category}\n\n${body}`);
  }
  return blocks.join("\n\n").trim() + "\n";
};
