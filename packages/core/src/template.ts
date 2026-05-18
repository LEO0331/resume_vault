import { buildMatchReport, scoreEntries, selectEntriesForTemplate } from "./match";
import type { GeneratedCoverLetter, GeneratedResume, JobDescription, ResumeEntry, ResumeTemplate } from "./types";

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

type CoverLetterInput = {
  job: JobDescription;
  entries: ResumeEntry[];
  template: ResumeTemplate;
  locale: "zh-TW" | "en-AU";
  candidateName?: string;
  companyName?: string;
  roleTitle?: string;
  today?: Date;
};

const buildSelection = (jd: JobDescription, entries: ResumeEntry[], template: ResumeTemplate) => {
  const trace = scoreEntries(jd.rawText, entries);
  const selected = selectEntriesForTemplate(trace, entries, template);
  const selectedIds = new Set(selected.map((entry) => entry.id));

  return {
    trace,
    selected,
    filteredTrace: trace.filter((item) => selectedIds.has(item.entryId)),
    matchReport: buildMatchReport(jd.rawText, selected),
  };
};

const dedupe = (values: string[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }

  return output;
};

const sentenceCase = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

const toSentence = (value: string): string => {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const formatDate = (locale: "zh-TW" | "en-AU", date: Date): string => {
  if (locale === "zh-TW") {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
};

const parseJobTargets = (job: JobDescription, companyName?: string, roleTitle?: string) => {
  const explicitRole = roleTitle?.trim() ?? "";
  const explicitCompany = companyName?.trim() ?? "";
  if (explicitRole || explicitCompany) {
    return {
      role: explicitRole,
      company: explicitCompany,
    };
  }

  const firstLine = job.rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? "";
  const looksLikeDescription = /^(looking for|seeking|need|needs|required|responsibilities|requirements|需要|具備|職責)/i.test(firstLine);
  if (!firstLine || looksLikeDescription) {
    return {
      role: "",
      company: "",
    };
  }
  const companyMatch = firstLine.match(/\bat\s+(.+)$/i);
  const company = companyMatch?.[1]?.trim() ?? "";
  const role = company ? firstLine.replace(/\s+at\s+.+$/i, "").trim() : firstLine;

  return {
    role,
    company,
  };
};

const splitSkillContent = (value: string): string[] =>
  value
    .split(/[,\u3001/|]/)
    .map((part) => part.trim())
    .filter(Boolean);

const GENERIC_SIGNAL_TAGS = new Set([
  "summary",
  "profile",
  "experience",
  "work",
  "project",
  "delivery",
  "skill",
  "tools",
  "tech",
  "achievement",
  "award",
]);

const buildStrengthsText = (selected: ResumeEntry[], strengths: string[]): string => {
  const values = dedupe([
    ...selected
      .flatMap((entry) => entry.tags)
      .filter((tag) => !GENERIC_SIGNAL_TAGS.has(tag.toLowerCase()))
      .map(sentenceCase),
    ...selected.filter((entry) => entry.category === "skill").flatMap((entry) => splitSkillContent(entry.content)),
    ...selected
      .filter((entry) => entry.category === "summary")
      .flatMap((entry) => splitSkillContent(entry.content))
      .filter((part) => /^[A-Za-z][A-Za-z0-9+#.\- ]{1,30}$/.test(part)),
    ...strengths.map(sentenceCase),
  ]).slice(0, 3);
  if (values.length === 0) {
    return "";
  }
  if (values.length === 1) {
    return values[0];
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
};

const buildRelevantExampleLines = (selected: ResumeEntry[]): string[] => {
  const primary = dedupe(
    selected
      .filter((entry) => entry.category === "experience" || entry.category === "project" || entry.category === "skill")
      .map((entry) => entry.content),
  ).slice(0, 3);

  if (primary.length > 0) {
    return primary;
  }

  return dedupe(
    selected
      .filter((entry) => entry.category === "summary")
      .map((entry) => entry.content),
  ).slice(0, 2);
};

const compactLines = (lines: string[]): string[] => {
  const output: string[] = [];
  for (const line of lines) {
    const normalized = line.trim() ? line : "";
    if (normalized === "" && (output.length === 0 || output[output.length - 1] === "")) {
      continue;
    }
    output.push(normalized);
  }
  while (output.length > 0 && output[output.length - 1] === "") {
    output.pop();
  }
  return output;
};

export const generateResume = (
  jd: JobDescription,
  entries: ResumeEntry[],
  template: ResumeTemplate,
): GeneratedResume => {
  const { filteredTrace, selected, matchReport } = buildSelection(jd, entries, template);
  const grouped = byCategory(selected);
  const sections = buildSectionsFromTemplate(template, grouped)
    .map((section) => renderSection(section.title, section.lines))
    .filter(Boolean);

  const outputMd = [`# Tailored Resume`, `> JD source: ${jd.sourceType}`, "", ...sections].join("\n\n");

  return {
    outputMd,
    trace: filteredTrace,
    matchReport,
  };
};

export const generateCoverLetter = ({
  job,
  entries,
  template,
  locale,
  candidateName,
  companyName,
  roleTitle,
  today = new Date(),
}: CoverLetterInput): GeneratedCoverLetter => {
  const { filteredTrace, selected, matchReport } = buildSelection(job, entries, template);
  const { role, company } = parseJobTargets(job, companyName, roleTitle);
  const strengthsText = buildStrengthsText(selected, matchReport.strengths);
  const examples = buildRelevantExampleLines(selected).map(toSentence);
  const dateLine = formatDate(locale, today);

  if (locale === "zh-TW") {
    const intro = role && company
      ? `我想應徵${company}的${role}職位。`
      : role
        ? `我想應徵這份${role}職位。`
        : company
          ? `我想應徵${company}的這份職位。`
          : "我想應徵這份職位。";
    const alignmentLead = strengthsText
      ? `我的相關背景涵蓋${strengthsText}。`
      : "我的背景與這份職缺需求方向相符。";
    const alignmentBody = examples.length > 0
      ? `我曾經${examples.join(" ")}`.replace(/\s+/g, " ").trim()
      : "我能以既有的相關經驗，快速銜接這份工作需要的實務內容。";
    const closing = role && company
      ? `若有機會，我希望能進一步說明自己如何把這些經驗帶到${company}的${role}工作中。感謝您撥空審閱。`
      : "若有機會，我希望能進一步說明自己如何把這些經驗帶到這份工作中。感謝您撥空審閱。";

    const lines = compactLines([
      dateLine,
      "",
      "您好，招募主管：",
      "",
      `${intro}${alignmentLead}`,
      "",
      alignmentBody,
      "",
      closing,
      "",
      "此致",
      candidateName?.trim() ? candidateName.trim() : "",
    ]);

    return {
      outputMd: `${lines.join("\n").trim()}\n`,
      trace: filteredTrace,
      matchReport,
    };
  }

  const intro = role && company
    ? `I am writing to apply for the ${role} role at ${company}.`
    : role
      ? `I am writing to apply for this ${role} opportunity.`
      : company
        ? `I am writing to apply for the opportunity at ${company}.`
        : "I am writing to apply for this opportunity.";
  const alignmentLead = strengthsText
    ? `My background aligns with this role through ${strengthsText}.`
    : "My background aligns well with the direction of this role.";
  const alignmentBody = examples.length > 0
    ? toSentence(`Relevant experience includes ${examples.join(" ")}`)
    : "I would bring relevant hands-on experience and a practical delivery mindset to the role.";
  const closing = role && company
    ? `I would welcome the opportunity to discuss how this background can support ${company}'s ${role} work. Thank you for your time and consideration.`
    : "I would welcome the opportunity to discuss how this background can support the role. Thank you for your time and consideration.";

  const lines = compactLines([
    dateLine,
    "",
    "Dear Hiring Manager,",
    "",
    `${intro} ${alignmentLead}`.trim(),
    "",
    alignmentBody,
    "",
    closing,
    "",
    "Kind regards,",
    candidateName?.trim() ? candidateName.trim() : "",
  ]);

  return {
    outputMd: `${lines.join("\n").trim()}\n`,
    trace: filteredTrace,
    matchReport,
  };
};
