const OUTPUT_SECTION_KEYS = {
  summary: "summary",
  coreSkills: "core-skills",
  professionalExperience: "professional-experience",
  selectedProjects: "selected-projects",
  education: "education",
  additional: "certifications-additional",
};

const normalizeHeading = (heading) =>
  String(heading || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim();

const dedupe = (items) => {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const normalized = String(item || "").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
};

const GENERIC_GAP_TOKENS = new Set([
  "-",
  "and",
  "applications",
  "application",
  "at",
  "build",
  "company",
  "co",
  "developer",
  "engineer",
  "job",
  "platform",
  "role",
  "software",
  "web",
]);

const toBulletLines = (block) =>
  String(block || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);

const headingToEntryCategory = (heading) => {
  const normalized = normalizeHeading(heading);
  if (normalized.includes("summary") || normalized.includes("profile") || normalized.includes("摘要") || normalized.includes("自我")) {
    return "summary";
  }
  if (normalized.includes("experience") || normalized.includes("employment") || normalized.includes("work") || normalized.includes("經歷") || normalized.includes("工作")) {
    return "experience";
  }
  if (normalized.includes("project") || normalized.includes("portfolio") || normalized.includes("專案") || normalized.includes("作品")) {
    return "project";
  }
  if (normalized.includes("skill") || normalized.includes("tools") || normalized.includes("technology") || normalized.includes("技能") || normalized.includes("專長")) {
    return "skill";
  }
  if (normalized.includes("achievement") || normalized.includes("award") || normalized.includes("additional") || normalized.includes("certification") || normalized.includes("成就") || normalized.includes("獎")) {
    return "achievement";
  }
  return null;
};

const headingToOutputSection = (heading) => {
  const normalized = normalizeHeading(heading);
  if (normalized.includes("summary") || normalized.includes("profile") || normalized.includes("摘要") || normalized.includes("自我")) {
    return OUTPUT_SECTION_KEYS.summary;
  }
  if (normalized.includes("core skills") || normalized === "skills" || normalized.includes("technical skills") || normalized.includes("skills") || normalized.includes("專長") || normalized.includes("技能")) {
    return OUTPUT_SECTION_KEYS.coreSkills;
  }
  if (normalized.includes("professional experience") || normalized.includes("experience") || normalized.includes("employment") || normalized.includes("work") || normalized.includes("經歷") || normalized.includes("工作")) {
    return OUTPUT_SECTION_KEYS.professionalExperience;
  }
  if (normalized.includes("selected projects") || normalized.includes("projects") || normalized.includes("project") || normalized.includes("專案") || normalized.includes("作品")) {
    return OUTPUT_SECTION_KEYS.selectedProjects;
  }
  if (normalized.includes("education") || normalized.includes("學歷")) {
    return OUTPUT_SECTION_KEYS.education;
  }
  if (normalized.includes("certification") || normalized.includes("additional") || normalized.includes("achievement") || normalized.includes("awards") || normalized.includes("證照") || normalized.includes("其他")) {
    return OUTPUT_SECTION_KEYS.additional;
  }
  return null;
};

const formatSelectedEntryLine = (entry, targetSectionKey) => {
  const entrySectionKey = headingToOutputSection(entry.title);
  if (entry.category === "skill" || entrySectionKey === targetSectionKey) {
    return entry.content;
  }
  return `${entry.title}: ${entry.content}`;
};

export const slugifySegment = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "resume";

export const buildContactLine = (contact) =>
  [contact?.location, contact?.email, contact?.phone, contact?.linkedin]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" | ");

export const extractResumeHeader = (resumeMarkdown, contact = null) => {
  const lines = String(resumeMarkdown || "").split(/\r?\n/);
  const h1Line = lines.find((line) => line.trim().startsWith("# "));
  const fallbackName = String(contact?.name || "").trim();
  const name = h1Line ? h1Line.replace(/^#\s+/, "").trim() : fallbackName;
  let contactLine = "";

  if (h1Line) {
    const startIndex = lines.indexOf(h1Line) + 1;
    for (let index = startIndex; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) {
        continue;
      }
      if (line.startsWith("#")) {
        break;
      }
      contactLine = line;
      break;
    }
  }

  if (!contactLine) {
    contactLine = buildContactLine(contact);
  }

  return {
    candidateName: name,
    contactLine,
  };
};

export const parseMarkdownSections = (markdownText) => {
  const lines = String(markdownText || "").split(/\r?\n/);
  const sections = [];
  let current = { heading: "", lines: [] };

  const flush = () => {
    if (!current.heading && current.lines.length === 0) {
      return;
    }
    sections.push({
      heading: current.heading,
      lines: [...current.lines],
    });
    current = { heading: "", lines: [] };
  };

  for (const rawLine of lines) {
    const headingMatch = rawLine.match(/^##\s+(.+)$/);
    if (headingMatch) {
      flush();
      current.heading = headingMatch[1].trim();
      continue;
    }
    current.lines.push(rawLine);
  }

  flush();
  return sections;
};

export const parseResumeMarkdownToEntries = (resumeMarkdown, locale = "en-AU") => {
  const importedAt = new Date().toISOString();
  const sections = parseMarkdownSections(resumeMarkdown);
  const entries = [];

  for (const section of sections) {
    const category = headingToEntryCategory(section.heading);
    if (!category) {
      continue;
    }

    const lines = toBulletLines(section.lines.join("\n"));
    for (const line of lines) {
      entries.push({
        id: `resume-entry-${entries.length + 1}`,
        category,
        title: section.heading,
        content: line,
        locale,
        tags:
          category === "summary"
            ? ["summary", "profile"]
            : category === "experience"
              ? ["experience", "work"]
              : category === "project"
                ? ["project", "delivery"]
                : category === "skill"
                  ? ["skill", "tools", "tech"]
                  : ["achievement", "award"],
        weight: category === "experience" ? 4 : 3,
        updatedAt: importedAt,
      });
    }
  }

  return entries;
};

export const parseTemplateInput = (templateText, locale = "en-AU") => {
  const raw = String(templateText || "").trim();
  if (!raw) {
    return {
      id: "tailor-template",
      name: "Tailor Resume Template",
      locale,
      sections: [
        { name: "summary", maxItems: 2, preferredTags: ["summary", "profile"] },
        { name: "skill", maxItems: 8, preferredTags: ["skill", "tools", "tech"] },
        { name: "experience", maxItems: 5, preferredTags: ["experience", "work"] },
        { name: "project", maxItems: 3, preferredTags: ["project", "delivery"] },
        { name: "achievement", maxItems: 3, preferredTags: ["achievement", "award"] },
      ],
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.sections)) {
      return parsed;
    }
  } catch {
    // Fall through to markdown parsing.
  }

  const sections = [];
  for (const section of parseMarkdownSections(raw)) {
    const category = headingToEntryCategory(section.heading);
    if (!category || sections.some((item) => item.name === category)) {
      continue;
    }
    sections.push({
      name: category,
      maxItems: category === "skill" ? 8 : category === "experience" ? 5 : 3,
      preferredTags:
        category === "summary"
          ? ["summary", "profile"]
          : category === "experience"
            ? ["experience", "work"]
            : category === "project"
              ? ["project", "delivery"]
              : category === "skill"
                ? ["skill", "tools", "tech"]
                : ["achievement", "award"],
    });
  }

  return {
    id: "tailor-template",
    name: "Tailor Resume Template",
    locale,
    sections:
      sections.length > 0
        ? sections
        : [
            { name: "summary", maxItems: 2, preferredTags: ["summary", "profile"] },
            { name: "skill", maxItems: 8, preferredTags: ["skill", "tools", "tech"] },
            { name: "experience", maxItems: 5, preferredTags: ["experience", "work"] },
            { name: "project", maxItems: 3, preferredTags: ["project", "delivery"] },
            { name: "achievement", maxItems: 3, preferredTags: ["achievement", "award"] },
          ],
  };
};

export const buildSelectedEntriesText = (entries) =>
  entries
    .map((entry) => `- [${entry.id}] (${entry.category}) ${entry.title}: ${entry.content}`)
    .join("\n");

const getOutputSectionLines = (resumeSections, sectionKey) => {
  const matched = resumeSections.find((section) => headingToOutputSection(section.heading) === sectionKey);
  return matched ? toBulletLines(matched.lines.join("\n")) : [];
};

export const buildFallbackResumeMarkdown = ({
  candidateName,
  contactLine,
  selectedEntries,
  currentResumeMarkdown,
}) => {
  const currentSections = parseMarkdownSections(currentResumeMarkdown);
  const summaryLines = dedupe([
    ...selectedEntries.filter((entry) => entry.category === "summary").map((entry) => entry.content),
    ...getOutputSectionLines(currentSections, OUTPUT_SECTION_KEYS.summary),
  ]).slice(0, 3);

  const skillLines = dedupe([
    ...selectedEntries.filter((entry) => entry.category === "skill").flatMap((entry) => entry.content.split(/,\s*/)),
    ...getOutputSectionLines(currentSections, OUTPUT_SECTION_KEYS.coreSkills),
  ]).slice(0, 12);

  const experienceLines = dedupe([
    ...selectedEntries
      .filter((entry) => entry.category === "experience")
      .map((entry) => formatSelectedEntryLine(entry, OUTPUT_SECTION_KEYS.professionalExperience)),
    ...getOutputSectionLines(currentSections, OUTPUT_SECTION_KEYS.professionalExperience),
  ]).slice(0, 8);

  const projectLines = dedupe([
    ...selectedEntries
      .filter((entry) => entry.category === "project")
      .map((entry) => formatSelectedEntryLine(entry, OUTPUT_SECTION_KEYS.selectedProjects)),
    ...getOutputSectionLines(currentSections, OUTPUT_SECTION_KEYS.selectedProjects),
  ]).slice(0, 6);

  const educationLines = dedupe(getOutputSectionLines(currentSections, OUTPUT_SECTION_KEYS.education));
  const additionalLines = dedupe([
    ...selectedEntries
      .filter((entry) => entry.category === "achievement")
      .map((entry) => formatSelectedEntryLine(entry, OUTPUT_SECTION_KEYS.additional)),
    ...getOutputSectionLines(currentSections, OUTPUT_SECTION_KEYS.additional),
  ]).slice(0, 6);

  const sections = [
    ["Summary", summaryLines],
    ["Core Skills", skillLines],
    ["Professional Experience", experienceLines],
    ["Selected Projects", projectLines],
    ["Education", educationLines],
    ["Certifications / Additional Information", additionalLines],
  ];

  const lines = [`# ${candidateName || "Candidate"}`];
  if (contactLine) {
    lines.push("");
    lines.push(contactLine);
  }

  for (const [heading, sectionLines] of sections) {
    lines.push("");
    lines.push(`## ${heading}`);
    lines.push("");
    if (sectionLines.length > 0) {
      for (const sectionLine of sectionLines) {
        lines.push(`- ${sectionLine}`);
      }
    } else {
      lines.push("- Not provided in current resume data.");
    }
  }

  return `${lines.join("\n").trim()}\n`;
};

export const fillPromptTemplate = (template, values) =>
  String(template || "").replace(/\{\{([A-Z_]+)\}\}/g, (_match, key) => values[key] ?? "");

export const parseTailorModelOutput = (outputText) => {
  const resumeMarker = "---RESUME_MD---";
  const analysisMarker = "---ANALYSIS_JSON---";
  const resumeIndex = String(outputText || "").indexOf(resumeMarker);
  const analysisIndex = String(outputText || "").indexOf(analysisMarker);
  if (resumeIndex === -1 || analysisIndex === -1 || analysisIndex <= resumeIndex) {
    throw new Error("Model output must contain ---RESUME_MD--- followed by ---ANALYSIS_JSON---.");
  }

  const resumeMarkdown = outputText
    .slice(resumeIndex + resumeMarker.length, analysisIndex)
    .trim();
  const analysisText = outputText.slice(analysisIndex + analysisMarker.length).trim();
  const analysis = JSON.parse(analysisText);

  return {
    resumeMarkdown,
    analysis,
  };
};

export const sanitizeStringArray = (value) =>
  Array.isArray(value) ? dedupe(value.map((item) => String(item || "").trim()).filter(Boolean)) : [];

export const buildDeterministicAnalysis = ({
  jdTitle,
  jdCompany,
  matchReport,
  trace,
  selectedEntries,
  allEntries,
  slug,
  pdfRenderingNotes,
}) => {
  const selectedEntryIds = new Set(selectedEntries.map((entry) => entry.id));
  const unsupportedRequirements = dedupe(
    (matchReport?.gaps ?? [])
      .filter((gap) => gap.priority === "high")
      .map((gap) => String(gap.token || "").trim().toLowerCase())
      .filter((token) => token.length >= 3 && /^[a-z0-9+#.]+$/i.test(token) && !GENERIC_GAP_TOKENS.has(token)),
  ).slice(0, 12);

  return {
    target_role: jdTitle || "",
    target_company: jdCompany || "",
    top_alignment_reasons: dedupe(
      trace
        .filter((item) => selectedEntryIds.has(item.entryId))
        .slice(0, 5)
        .flatMap((item) => item.reasons.filter((reason) => !reason.startsWith("weight:")).slice(0, 2)),
    ).slice(0, 8),
    keywords_used: dedupe([
      ...(matchReport?.strengths ?? []),
      ...trace.filter((item) => selectedEntryIds.has(item.entryId)).flatMap((item) => item.priorityMatchedTokens ?? item.matchedTokens ?? []),
    ]).slice(0, 16),
    entries_used: selectedEntries.map((entry) => `${entry.id}: ${entry.title}`),
    entries_removed_or_deemphasized: allEntries
      .filter((entry) => !selectedEntryIds.has(entry.id))
      .slice(0, 10)
      .map((entry) => `${entry.id}: ${entry.title}`),
    unsupported_jd_requirements: unsupportedRequirements,
    truthfulness_warnings: [],
    pdf_rendering_notes: sanitizeStringArray(pdfRenderingNotes),
    recommended_filename: `${slug}.md`,
  };
};

export const mergeModelAnalysis = (baseAnalysis, modelAnalysis) => {
  const knownEntries = new Set(baseAnalysis.entries_used);
  const knownRemovedEntries = new Set(baseAnalysis.entries_removed_or_deemphasized);

  return {
    target_role: String(modelAnalysis?.target_role || baseAnalysis.target_role || "").trim(),
    target_company: String(modelAnalysis?.target_company || baseAnalysis.target_company || "").trim(),
    top_alignment_reasons: sanitizeStringArray(modelAnalysis?.top_alignment_reasons).slice(0, 8).length > 0
      ? sanitizeStringArray(modelAnalysis?.top_alignment_reasons).slice(0, 8)
      : baseAnalysis.top_alignment_reasons,
    keywords_used: dedupe([
      ...baseAnalysis.keywords_used,
      ...sanitizeStringArray(modelAnalysis?.keywords_used),
    ]).slice(0, 16),
    entries_used: sanitizeStringArray(modelAnalysis?.entries_used).filter((item) => knownEntries.has(item)).length > 0
      ? sanitizeStringArray(modelAnalysis?.entries_used).filter((item) => knownEntries.has(item))
      : baseAnalysis.entries_used,
    entries_removed_or_deemphasized: sanitizeStringArray(modelAnalysis?.entries_removed_or_deemphasized).filter((item) => knownRemovedEntries.has(item)),
    unsupported_jd_requirements: dedupe([
      ...baseAnalysis.unsupported_jd_requirements,
      ...sanitizeStringArray(modelAnalysis?.unsupported_jd_requirements),
    ]).slice(0, 12),
    truthfulness_warnings: dedupe([
      ...baseAnalysis.truthfulness_warnings,
      ...sanitizeStringArray(modelAnalysis?.truthfulness_warnings),
    ]),
    pdf_rendering_notes: dedupe([
      ...baseAnalysis.pdf_rendering_notes,
      ...sanitizeStringArray(modelAnalysis?.pdf_rendering_notes),
    ]),
    recommended_filename: String(modelAnalysis?.recommended_filename || baseAnalysis.recommended_filename || "").trim() || baseAnalysis.recommended_filename,
  };
};

export const validateTailoredResume = ({ resumeMarkdown, candidateName, contactLine }) => {
  const errors = [];
  const warnings = [];
  const text = String(resumeMarkdown || "");

  if (!text.trim()) {
    errors.push("resume.md is empty.");
  }
  if (text.includes("```")) {
    errors.push("resume.md must not contain triple-backtick wrappers.");
  }
  if (/"target_role"\s*:/.test(text) || text.includes("---ANALYSIS_JSON---")) {
    errors.push("resume.md must not contain analysis JSON.");
  }
  if (candidateName && !new RegExp(`^#\\s+${candidateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(text)) {
    errors.push("resume.md must start with the candidate name H1.");
  }
  if (contactLine && !text.includes(contactLine)) {
    errors.push("resume.md must include the contact line when contact data is available.");
  }

  const requiredHeadings = [
    /^##\s+Summary\s*$/m,
    /^##\s+Core Skills\s*$/m,
    /^##\s+(Professional\s+Experience|Experience)\s*$/m,
    /^##\s+Education\s*$/m,
  ];
  if (!requiredHeadings.every((pattern) => pattern.test(text))) {
    errors.push("resume.md must include Summary, Core Skills, Experience, and Education sections.");
  }

  if (/Not provided in current resume data\./.test(text)) {
    warnings.push("One or more required sections had no source content and were filled with placeholders.");
  }

  return {
    errors,
    warnings,
  };
};

export const extractJdMetadata = ({ jdText, jdJson }) => {
  const title = String(jdJson?.title || "").trim();
  const url = String(jdJson?.url || "").trim();
  const sourceText = String(jdText || "").trim();
  const firstLine = sourceText.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
  const rawRole = title || firstLine || "target-role";
  const companyMatch = rawRole.match(/\bat\s+(.+)$/i) || firstLine.match(/\bat\s+(.+)$/i);
  const company = companyMatch?.[1]?.trim() || "";
  const role = company ? rawRole.replace(new RegExp(`\\s+at\\s+${company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "").trim() : rawRole;
  return {
    role,
    company,
    sourceUrl: url,
  };
};
