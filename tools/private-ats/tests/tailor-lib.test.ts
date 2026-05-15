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

const sampleResume = `# Sheng Zhao
Adelaide SA | bestaisecurity@gmail.com | 0472687078

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
      candidateName: "Sheng Zhao",
      contactLine: "Adelaide SA | bestaisecurity@gmail.com | 0472687078",
    });
  });

  it("parses resume markdown entries from ATS headings", () => {
    const entries = parseResumeMarkdownToEntries(sampleResume, "en-AU");
    expect(entries.some((entry) => entry.category === "summary")).toBe(true);
    expect(entries.some((entry) => entry.category === "skill")).toBe(true);
    expect(entries.some((entry) => entry.category === "experience")).toBe(true);
    expect(entries.some((entry) => entry.category === "project")).toBe(true);
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

    expect(template.sections.map((section) => section.name)).toEqual(["summary", "skill", "experience", "project"]);
  });

  it("parses model output split into resume and analysis", () => {
    const parsed = parseTailorModelOutput(`---RESUME_MD---
# Sheng Zhao

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

    expect(parsed.resumeMarkdown.startsWith("# Sheng Zhao")).toBe(true);
    expect(parsed.analysis.target_role).toBe("Software Developer");
  });

  it("builds a markdown-resume-friendly fallback and validates required headings", () => {
    const output = buildFallbackResumeMarkdown({
      candidateName: "Sheng Zhao",
      contactLine: buildContactLine({
        location: "Adelaide SA",
        email: "bestaisecurity@gmail.com",
        phone: "0472687078",
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
      candidateName: "Sheng Zhao",
      contactLine: "Adelaide SA | bestaisecurity@gmail.com | 0472687078",
    });

    expect(output).toContain("## Core Skills");
    expect(output).toContain("## Professional Experience");
    expect(validation.errors).toEqual([]);
  });

  it("accepts reordered contact formatting as long as all contact fragments are present", () => {
    const validation = validateTailoredResume({
      resumeMarkdown: `# Sheng Zhao

bestaisecurity@gmail.com | 0472687078 | Adelaide SA

## Summary

- Summary

## Core Skills

- React

## Professional Experience

- Experience

## Education

- Degree
`,
      candidateName: "Sheng Zhao",
      contactLine: ["Adelaide SA", "bestaisecurity@gmail.com", "0472687078"],
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
