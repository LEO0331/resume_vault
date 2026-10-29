import { describe, expect, it } from "vitest";
import {
  buildContactLine,
  buildDeterministicAnalysis,
  buildFallbackResumeMarkdown,
  extractJdMetadata,
  extractResumeHeader,
  mergeModelAnalysis,
  parseResumeMarkdownToEntries,
  parseTailorModelOutput,
  parseTemplateInput,
  validateTailoredResume,
} from "../src/tailor-lib.mjs";

const sampleResume = `# Alex Chen
Adelaide SA | alex@example.com | 0400 000 000

## Summary
- Proactive IT student focused on AI security and authentication systems.

## Core Skills
- React
- TypeScript
- OAuth2

## Professional Experience
- MIT Big Data Living Lab: Built an AI-driven authentication system with OpenID Connect.

## Selected Projects
- Volunteer Website: Implemented secure user sign-up/login protections.

## Education
- Bachelor of Information Technology | The University of Adelaide

## Certifications / Additional Information
- Docker
`;

describe("tailor lib", () => {
  it("extracts resume header and contact line", () => {
    expect(
      extractResumeHeader(sampleResume, {
        name: "Fallback Name",
      }),
    ).toEqual({
      candidateName: "Alex Chen",
      contactLine: "Adelaide SA | alex@example.com | 0400 000 000",
    });
  });

  it("parses resume markdown entries from ATS headings", () => {
    const entries = parseResumeMarkdownToEntries(sampleResume, "en-AU");
    expect(entries.some((entry) => entry.category === "summary")).toBe(true);
    expect(entries.some((entry) => entry.category === "skill")).toBe(true);
    expect(entries.some((entry) => entry.category === "experience")).toBe(true);
    expect(entries.some((entry) => entry.category === "project")).toBe(true);
    expect(entries.some((entry) => entry.category === "education")).toBe(true);
  });

  it("keeps role headings, dates, and achievements together when selecting source entries", () => {
    const entries = parseResumeMarkdownToEntries(`# Alex Chen
## Professional Experience
### Software Engineer | Example Systems
2023-04 - Present
- Built secure APIs using TypeScript.
- Added integration tests.
### Intern | Fictional Labs
2021 - 2022
- Maintained documentation.
## Education
### BSc Computer Science | Example University
2017 - 2021
`);
    expect(entries).toHaveLength(3);
    expect(entries[0].title).toBe("Software Engineer | Example Systems");
    expect(entries[0]).toMatchObject({ startDate: "2023-04", endDate: "Present" });
    expect(entries[0].content).not.toContain("2023-04 - Present");
    expect(entries[0].content).toContain("- Added integration tests.");
    expect(entries[2].category).toBe("education");
    expect(entries[2]).toMatchObject({ startDate: "2017", endDate: "2021" });
    const output = buildFallbackResumeMarkdown({ candidateName: "Alex Chen", selectedEntries: entries, currentResumeMarkdown: "" });
    expect(output).toContain("\n\n2023-04 - Present\n\n");
    expect(output).not.toContain("- 2023-04 - Present");
  });

  it("promotes a Chinese date-only metadata line without treating other dates as a role range", () => {
    const entries = parseResumeMarkdownToEntries("## 工作經歷\n### 工程師 | 範例科技\n2024-01 – 至今\n- 於 2024 年完成系統測試。", "zh-TW");
    expect(entries[0]).toMatchObject({ startDate: "2024-01", endDate: "至今" });
    expect(entries[0].content).toBe("- 於 2024 年完成系統測試。");
  });

  it("preserves multiline contacts and supplemental contact fields", () => {
    expect(extractResumeHeader("# Alex Chen\nalex@example.com\n0400 000 000\n\n## Summary\nEngineer", {
      website: "https://example.com/alex",
    }).contactLine).toBe("alex@example.com | 0400 000 000 | https://example.com/alex");
  });

  it("migrates education into legacy JSON templates", () => {
    const template = parseTemplateInput(JSON.stringify({ id: "legacy", sections: [{ name: "experience", maxItems: 1 }] }));
    expect(template.id).toBe("legacy");
    expect(template.sections.map((section) => section.name)).toEqual(["experience", "education"]);
  });

  it("does not restore unselected content or create empty placeholders", () => {
    const output = buildFallbackResumeMarkdown({
      candidateName: "Alex Chen", contactLine: "alex@example.com",
      selectedEntries: [{ category: "experience", title: "Example Systems", content: "Built APIs." }],
      currentResumeMarkdown: sampleResume,
    });
    expect(output).toContain("Built APIs.");
    expect(output).toContain("Bachelor of Information Technology");
    expect(output).not.toContain("Volunteer Website");
    expect(output).not.toContain("OpenID Connect");
    expect(output).not.toContain("Not provided");
    expect(output).not.toContain("## Selected Projects");
    expect(validateTailoredResume({ resumeMarkdown: output, candidateName: "Alex Chen" }).errors).toEqual([]);
  });

  it("validates Chinese resumes and rejects missing contacts or analysis", () => {
    const output = "# 陳曉明\n\nengineer@example.com\n\n## 學歷\n\n- 範例大學 資訊工程學士\n";
    expect(validateTailoredResume({ resumeMarkdown: output, candidateName: "陳曉明", contactFragments: ["engineer@example.com"] }).errors).toEqual([]);
    expect(validateTailoredResume({ resumeMarkdown: output, contactFragments: ["missing@example.com"] }).errors).not.toEqual([]);
    expect(validateTailoredResume({ resumeMarkdown: `${output}\n> JD source: paste` }).errors).not.toEqual([]);
  });

  it("preserves and localizes Chinese source content without adding absent sections", () => {
    const source = "# 陳曉明\n\nengineer@example.com\n\n## 學歷\n\n- 範例大學 資訊工程學士\n";
    const entries = parseResumeMarkdownToEntries(source, "zh-TW");
    const output = buildFallbackResumeMarkdown({ candidateName: "陳曉明", contactLine: "engineer@example.com", selectedEntries: entries, currentResumeMarkdown: source });
    expect(output).toContain("## 學歷");
    expect(output).toContain("範例大學 資訊工程學士");
    expect(output).not.toContain("Education");
    expect(output).not.toContain("Not provided");
  });

  it("parses template markdown headings into core template sections", () => {
    const template = parseTemplateInput(
      `## Summary

## Core Skills

## Professional Experience

## Selected Projects

## Education
`,
      "en-AU",
    );

    expect(template.sections.map((section) => section.name)).toEqual(["summary", "skill", "experience", "project", "education"]);
  });

  it("parses model output split into resume and analysis", () => {
    const parsed = parseTailorModelOutput(`---RESUME_MD---
# Alex Chen

## Summary
- Tailored summary

## Core Skills
- React

## Professional Experience
- Experience

## Education
- Degree

---ANALYSIS_JSON---
{
  "target_role": "Software Developer",
  "target_company": "Example",
  "top_alignment_reasons": [],
  "keywords_used": [],
  "entries_used": [],
  "entries_removed_or_deemphasized": [],
  "unsupported_jd_requirements": [],
  "truthfulness_warnings": [],
  "pdf_rendering_notes": [],
  "recommended_filename": "resume.md"
}`);

    expect(parsed.resumeMarkdown.startsWith("# Alex Chen")).toBe(true);
    expect(parsed.analysis.target_role).toBe("Software Developer");
  });

  it("builds a markdown-resume-friendly fallback and validates required headings", () => {
    const output = buildFallbackResumeMarkdown({
      candidateName: "Alex Chen",
      contactLine: buildContactLine({
        location: "Adelaide SA",
        email: "alex@example.com",
        phone: "0400 000 000",
      }),
      selectedEntries: [
        {
          id: "e1",
          category: "summary",
          title: "Summary",
          content: "Proactive IT student focused on AI security.",
        },
        {
          id: "e2",
          category: "skill",
          title: "Skills",
          content: "React, TypeScript, OAuth2",
        },
        {
          id: "e3",
          category: "experience",
          title: "MIT Big Data Living Lab",
          content: "Built authentication workflows with OpenID Connect.",
        },
      ],
      currentResumeMarkdown: sampleResume,
    });

    const validation = validateTailoredResume({
      resumeMarkdown: output,
      candidateName: "Alex Chen",
      contactLine: "Adelaide SA | alex@example.com | 0400 000 000",
    });

    expect(output).toContain("## Technical Skills");
    expect(output).toContain("## Professional Experience");
    expect(validation.errors).toEqual([]);
  });

  it("accepts reordered contact formatting as long as all contact fragments are present", () => {
    const validation = validateTailoredResume({
      resumeMarkdown: `# Alex Chen

alex@example.com | 0400 000 000 | Adelaide SA

## Summary

- Summary

## Core Skills

- React

## Professional Experience

- Experience

## Education

- Degree
`,
      candidateName: "Alex Chen",
      contactLine: ["Adelaide SA", "alex@example.com", "0400 000 000"],
    });

    expect(validation.errors).toEqual([]);
  });

  it("merges model analysis without dropping deterministic unsupported requirements", () => {
    const merged = mergeModelAnalysis(
      {
        target_role: "Developer",
        target_company: "Example",
        top_alignment_reasons: ["priority_overlap:3"],
        keywords_used: ["react"],
        entries_used: ["e1: Summary"],
        entries_removed_or_deemphasized: ["e2: Old Entry"],
        unsupported_jd_requirements: ["kubernetes"],
        truthfulness_warnings: [],
        pdf_rendering_notes: ["Use markdown-resume for final PDF."],
        recommended_filename: "example.md",
      },
      {
        unsupported_jd_requirements: ["terraform"],
        keywords_used: ["typescript"],
        entries_used: ["unknown"],
      },
    );

    expect(merged.unsupported_jd_requirements).toEqual(["kubernetes", "terraform"]);
    expect(merged.entries_used).toEqual(["e1: Summary"]);
  });

  it("filters generic unsupported tokens out of deterministic analysis", () => {
    const analysis = buildDeterministicAnalysis({
      jdTitle: "Software Developer",
      jdCompany: "Example Co",
      matchReport: {
        coverageScore: 42,
        decision: "apply_with_gaps",
        strengths: ["react"],
        gaps: [
          { token: "kubernetes", priority: "high" },
          { token: "build", priority: "high" },
          { token: "co", priority: "high" },
          { token: "typescript", priority: "medium" },
        ],
      },
      trace: [],
      selectedEntries: [],
      allEntries: [],
      slug: "example-software-developer",
      pdfRenderingNotes: [],
    });

    expect(analysis.unsupported_jd_requirements).toEqual(["kubernetes"]);
  });

  it("splits role and company from jd metadata", () => {
    expect(
      extractJdMetadata({
        jdText: "Software Developer at Example Co",
        jdJson: null,
      }),
    ).toEqual({
      role: "Software Developer",
      company: "Example Co",
      sourceUrl: "",
    });
  });
});
