import { describe, expect, it } from "vitest";
import { buildObsidianFilename, buildObsidianMarkdown } from "./obsidian";

describe("obsidian export helpers", () => {
  it("builds balanced frontmatter and preserves body", () => {
    const now = new Date("2026-04-21T09:07:00.000Z");
    const body = "# Tailored Resume\n\n## Experience\n- Built React products";
    const output = buildObsidianMarkdown({
      body,
      locale: "en-AU",
      template: {
        id: "starter-reverse-chronological",
        name: "Reverse Chronological (ATS-friendly)",
        locale: "en-AU",
        sections: [],
      },
      job: {
        id: "jd-1",
        sourceType: "url",
        sourceUrl: "https://www.seek.com.au/job/software-engineer",
        rawText: "React TypeScript",
        createdAt: "2026-04-21T09:06:00.000Z",
      },
      now,
    });

    expect(output.startsWith("---\n")).toBe(true);
    expect(output).toContain('title: "Tailored Resume - 2026-04-21"');
    expect(output).toContain('created: "2026-04-21T09:07:00.000Z"');
    expect(output).toContain('locale: "en-AU"');
    expect(output).toContain('template_id: "starter-reverse-chronological"');
    expect(output).toContain('template_name: "Reverse Chronological (ATS-friendly)"');
    expect(output).toContain('jd_source_type: "url"');
    expect(output).toContain('jd_source_url: "https://www.seek.com.au/job/software-engineer"');
    expect(output).toContain('tags: ["resume", "tailored", "en-au", "template-reverse-chronological-ats-friendly"]');
    expect(output.endsWith(body)).toBe(true);
  });

  it("creates deterministic obsidian filename", () => {
    const now = new Date("2026-04-21T09:07:00+08:00");
    expect(buildObsidianFilename(now)).toBe("tailored-resume-obsidian-20260421-0907.md");
  });

  it("escapes newline and quote characters in frontmatter values", () => {
    const output = buildObsidianMarkdown({
      body: "# Tailored Resume",
      locale: "en-AU",
      template: {
        id: "template-1",
        name: "A \"quoted\"\nname",
        locale: "en-AU",
        sections: [],
      },
      job: {
        id: "jd-1",
        sourceType: "url",
        sourceUrl: "https://example.com/job?q=\"react\"\nnext",
        rawText: "React",
        createdAt: "2026-04-21T09:06:00.000Z",
      },
      now: new Date("2026-04-21T09:07:00+08:00"),
    });

    expect(output).toContain('template_name: "A \\"quoted\\"\\nname"');
    expect(output).toContain('jd_source_url: "https://example.com/job?q=\\"react\\"\\nnext"');
  });
});
