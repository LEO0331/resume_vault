import { describe, expect, it } from "vitest";
import {
  buildOutputBaseName,
  classifyRoleLevelByTitle,
  extractGuideSections,
  extractJobIdFromUrl,
  isLikelyBotWall,
  extractSeekLocation,
  isSeekJobUrl,
  parsePrivateProfileToEntries,
  parseSeekUrlList,
  rankEntriesForJob,
} from "../src/lib.mjs";

describe("private ats lib", () => {
  it("extracts seek job id from url", () => {
    expect(extractJobIdFromUrl("https://www.seek.com.au/job/84123456")).toBe("84123456");
    expect(extractJobIdFromUrl("https://au.seek.com/jobs-in-information-communication-technology?jobId=91874838&type=standard")).toBe("91874838");
    expect(extractJobIdFromUrl("https://www.seek.com.au/jobs/software-developer")).toBe("");
  });

  it("detects seek domains only", () => {
    expect(isSeekJobUrl("https://www.seek.com.au/job/123")).toBe(true);
    expect(isSeekJobUrl("https://www.seek.co.nz/job/123")).toBe(true);
    expect(isSeekJobUrl("https://au.seek.com/jobs-in-information-communication-technology?jobId=91874838")).toBe(true);
    expect(isSeekJobUrl("https://linkedin.com/jobs/view/123")).toBe(false);
  });

  it("classifies junior-entry-mid titles using keyword rule", () => {
    expect(classifyRoleLevelByTitle("Junior Software Engineer")).toBe(true);
    expect(classifyRoleLevelByTitle("Graduate Developer")).toBe(true);
    expect(classifyRoleLevelByTitle("Intermediate Full Stack Engineer")).toBe(true);
    expect(classifyRoleLevelByTitle("Senior Staff Engineer")).toBe(false);
  });

  it("extracts guide sections from jd text", () => {
    const sections = extractGuideSections(`
Responsibilities:
- Build secure APIs
Experience required:
- 2+ years in JavaScript
Qualifications:
- Degree in Computer Science
`);

    expect(sections.responsibilities.some((line) => line.toLowerCase().includes("responsibilities"))).toBe(true);
    expect(sections.experienceRequired.some((line) => line.toLowerCase().includes("experience required"))).toBe(true);
    expect(sections.qualifications.some((line) => line.toLowerCase().includes("qualifications"))).toBe(true);
  });

  it("builds output basename by job id with index fallback", () => {
    expect(buildOutputBaseName("https://www.seek.com.au/job/84123456", 1)).toBe("seek-job-84123456");
    expect(buildOutputBaseName("https://au.seek.com/jobs-in-information-communication-technology?jobId=91874838&type=standard", 1)).toBe("seek-job-91874838");
    expect(buildOutputBaseName("https://www.seek.com.au/jobs", 2)).toBe("seek-job-index-02");
  });

  it("extracts location from title and text", () => {
    expect(extractSeekLocation({ title: "Software Engineer Job in Adelaide SA - SEEK", text: "" })).toBe("Adelaide SA");
    expect(extractSeekLocation({ title: "", text: "Location\nSydney NSW\nRole" })).toBe("Sydney NSW");
  });

  it("parses url list while skipping comments", () => {
    const parsed = parseSeekUrlList(`
# this is comment
https://www.seek.com.au/job/1

https://www.seek.com.au/job/2
`);
    expect(parsed).toEqual(["https://www.seek.com.au/job/1", "https://www.seek.com.au/job/2"]);
  });

  it("detects bot-wall responses", () => {
    expect(isLikelyBotWall({ title: "Just a moment...", text: "Help us keep SEEK secure, confirm you are human." })).toBe(true);
    expect(isLikelyBotWall({ title: "Junior Developer", text: "Responsibilities include building APIs." })).toBe(false);
  });

  it("parses profile lines without dropping normal sentence content", () => {
    const entries = parsePrivateProfileToEntries(
      `
Working Experience
Web Application, Volunteer, AUS
Engineered a dynamic platform enabling volunteer organizations to promote initiatives and maintain engagement.
Implemented secure user sign-up/login with protections against SQL Injection, XSS, and CSRF attacks.
      `,
      "en-AU",
    );

    const contents = entries.map((entry) => entry.content);
    expect(contents.some((line) => line.includes("Engineered a dynamic platform"))).toBe(true);
    expect(contents.some((line) => line.includes("Implemented secure user sign-up/login"))).toBe(true);
  });

  it("ranks entries by overlap then deterministic id tie-break", () => {
    const entries = [
      {
        id: "entry-b",
        title: "Backend work",
        content: "Built secure APIs with Node and OAuth2.",
        category: "experience",
        locale: "en-AU",
        tags: ["experience", "security"],
        weight: 4,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "entry-a",
        title: "Backend work",
        content: "Built secure APIs with Node and OAuth2.",
        category: "experience",
        locale: "en-AU",
        tags: ["experience", "security"],
        weight: 4,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const ranking = rankEntriesForJob(entries, "Looking for secure Node APIs and OAuth2 experience.");
    expect(ranking.map((row) => row.entry.id)).toEqual(["entry-a", "entry-b"]);
  });
});
