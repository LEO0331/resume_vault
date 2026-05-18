import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const cleanupDirs: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("ats tailor cli", () => {
  it("writes cover-letter.md alongside resume and analysis outputs", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "resume-vault-tailor-cli-"));
    cleanupDirs.push(tempDir);

    const jdPath = join(tempDir, "job.md");
    const resumePath = join(tempDir, "resume.md");
    const templatePath = join(tempDir, "template.md");
    const outDir = join(tempDir, "outputs");

    await writeFile(
      jdPath,
      "Software Engineer at Example Co\nLooking for React and API delivery experience.\n",
      "utf-8",
    );
    await writeFile(
      resumePath,
      `# Candidate Name
candidate@example.com | 0400 000 000

## Summary
- Frontend engineer working across React and TypeScript.

## Core Skills
- React
- TypeScript

## Professional Experience
- Product Team Delivery: Delivered API-backed features with measurable quality gains.

## Education
- Bachelor of Information Technology
`,
      "utf-8",
    );
    await writeFile(
      templatePath,
      `## Summary

## Core Skills

## Professional Experience

## Education
`,
      "utf-8",
    );

    await execFileAsync(
      process.execPath,
      [
        "tools/private-ats/run-tailor-markdown-resume.mjs",
        "--jd",
        jdPath,
        "--resume",
        resumePath,
        "--template",
        templatePath,
        "--out",
        outDir,
      ],
      { cwd: ROOT_DIR },
    );

    const [resumeOutput, coverLetterOutput, analysisOutput] = await Promise.all([
      readFile(join(outDir, "resume.md"), "utf-8"),
      readFile(join(outDir, "cover-letter.md"), "utf-8"),
      readFile(join(outDir, "analysis.json"), "utf-8"),
    ]);

    expect(resumeOutput).toContain("# Candidate Name");
    expect(coverLetterOutput).toContain("Dear Hiring Manager,");
    expect(coverLetterOutput).toContain("Example Co");
    expect(coverLetterOutput).toContain("Candidate Name");
    expect(() => JSON.parse(analysisOutput)).not.toThrow();
  });
});
