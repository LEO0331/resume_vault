import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { markdownToHtml, parsePrivateProfileToEntries } from "./src/lib.mjs";
import {
  buildContactLine,
  buildDeterministicAnalysis,
  buildFallbackResumeMarkdown,
  buildSelectedEntriesText,
  extractJdMetadata,
  extractResumeHeader,
  fillPromptTemplate,
  mergeModelAnalysis,
  parseResumeMarkdownToEntries,
  parseTailorModelOutput,
  parseTemplateInput,
  sanitizeStringArray,
  slugifySegment,
  validateTailoredResume,
} from "./src/tailor-lib.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PROMPTS_DIR = resolve(ROOT_DIR, "tools/private-ats/prompts");
const TSC_BIN = resolve(ROOT_DIR, "node_modules/typescript/bin/tsc");
const DEFAULT_OUTPUT_ROOT = "outputs";
const DEFAULT_LOCALE = "en-AU";

const readArg = (name) => {
  const index = process.argv.findIndex((arg) => arg === name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
};

const hasFlag = (name) => process.argv.includes(name);

const runCommand = (cmd, args, cwd = ROOT_DIR, input = "") =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }
      rejectPromise(new Error(`Command failed (${cmd} ${args.join(" ")}): ${stderr || stdout}`));
    });
    child.stdin.end(input);
  });

const renderPdf = async (markdownText, outputPath) => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(markdownToHtml(markdownText), { waitUntil: "domcontentloaded" });
    await page.pdf({
      path: outputPath,
      format: "A4",
      margin: { top: "16mm", right: "12mm", bottom: "16mm", left: "12mm" },
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
};

const firstErrorLine = (error) =>
  String(error instanceof Error ? error.message : error || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || "Unknown error";

const clearPriorOutputFiles = async (outputDir) => {
  const files = [
    "resume.md",
    "cover-letter.md",
    "resume.pdf",
    "analysis.json",
    "jd.json",
    "jd.md",
    "tailor-prompt.system.txt",
    "tailor-prompt.user.txt",
    "tailor-prompt.full.txt",
    "tailor-model-output.txt",
  ];
  await Promise.all(files.map((file) => rm(join(outputDir, file), { force: true })));
};

const loadOptionalJson = async (pathValue) => {
  if (!pathValue) {
    return null;
  }
  return JSON.parse(await readFile(resolve(ROOT_DIR, pathValue), "utf-8"));
};

const loadJdInput = async (pathValue) => {
  const absolutePath = resolve(ROOT_DIR, pathValue);
  const raw = await readFile(absolutePath, "utf-8");
  const extension = extname(absolutePath).toLowerCase();

  if (extension === ".json") {
    const parsed = JSON.parse(raw);
    const text = String(parsed.text || parsed.rawText || "").trim();
    if (!text) {
      throw new Error("JD JSON must include `text` or `rawText`.");
    }
    return {
      jd: {
        id: "tailor-jd",
        sourceType: parsed.url ? "url" : "paste",
        sourceUrl: parsed.url || undefined,
        rawText: text,
        createdAt: new Date().toISOString(),
      },
      artifactName: "jd.json",
      artifactContent: `${JSON.stringify(parsed, null, 2)}\n`,
      parsedJson: parsed,
    };
  }

  const text = raw.trim();
  if (!text) {
    throw new Error("JD input file is empty.");
  }
  return {
    jd: {
      id: "tailor-jd",
      sourceType: "paste",
      rawText: text,
      createdAt: new Date().toISOString(),
    },
    artifactName: "jd.md",
    artifactContent: `${raw.trim()}\n`,
    parsedJson: null,
  };
};

const ensureCoreRuntime = async () => {
  const outDir = await mkdtemp(join(tmpdir(), "resume-vault-core-runtime-"));
  await runCommand(
    "node",
    [
      TSC_BIN,
      "packages/core/src/index.ts",
      "packages/core/src/match.ts",
      "packages/core/src/template.ts",
      "packages/core/src/types.ts",
      "--outDir",
      outDir,
      "--module",
      "commonjs",
      "--moduleResolution",
      "node",
      "--target",
      "ES2022",
      "--declaration",
      "false",
      "--skipLibCheck",
      "true",
    ],
    ROOT_DIR,
  );

  const require = createRequire(import.meta.url);
  try {
    return require(join(outDir, "index.js"));
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
};

const runModelCommand = async (modelCmd, promptText) => {
  const shell = process.env.SHELL || "/bin/zsh";
  const { stdout } = await runCommand(shell, ["-lc", modelCmd], ROOT_DIR, promptText);
  return stdout.trim();
};

const buildPromptFiles = async (outputDir, promptText, systemPrompt, userPrompt) => {
  await writeFile(join(outputDir, "tailor-prompt.system.txt"), `${systemPrompt.trim()}\n`, "utf-8");
  await writeFile(join(outputDir, "tailor-prompt.user.txt"), `${userPrompt.trim()}\n`, "utf-8");
  await writeFile(join(outputDir, "tailor-prompt.full.txt"), `${promptText.trim()}\n`, "utf-8");
};

const main = async () => {
  const jdPath = readArg("--jd");
  const resumePath = readArg("--resume");
  const templatePath = readArg("--template");
  const profilePath = readArg("--profile");
  const contactPath = readArg("--contact");
  const locale = readArg("--locale") ?? DEFAULT_LOCALE;
  const requestedOutDir = readArg("--out");
  const modelCmd = readArg("--model-cmd") ?? process.env.RESUME_TAILOR_MODEL_CMD ?? "";
  const renderPdfFlag = hasFlag("--render-pdf");

  if (!jdPath || !resumePath || !templatePath) {
    throw new Error("Usage: npm run ats:tailor -- --jd <job.md|job.json> --resume <resume.md> --template <template.md|template.json> [--profile profile.md] [--contact contact.json] [--out outputs/company-role] [--model-cmd \"<local command>\"] [--render-pdf]");
  }

  const [jdInput, resumeMarkdown, templateMarkdown, profileMarkdown, contact, systemPromptTemplate, userPromptTemplate] = await Promise.all([
    loadJdInput(jdPath),
    readFile(resolve(ROOT_DIR, resumePath), "utf-8"),
    readFile(resolve(ROOT_DIR, templatePath), "utf-8"),
    profilePath ? readFile(resolve(ROOT_DIR, profilePath), "utf-8") : Promise.resolve(""),
    loadOptionalJson(contactPath),
    readFile(join(PROMPTS_DIR, "tailor-resume.system.txt"), "utf-8"),
    readFile(join(PROMPTS_DIR, "tailor-resume.user.txt"), "utf-8"),
  ]);

  const header = extractResumeHeader(resumeMarkdown, contact);
  const core = await ensureCoreRuntime();
  const allEntries = [
    ...parseResumeMarkdownToEntries(resumeMarkdown, locale),
    ...parsePrivateProfileToEntries(profileMarkdown, locale),
  ];
  if (allEntries.length === 0) {
    throw new Error("No reusable resume entries could be parsed from the provided resume/profile files.");
  }

  const template = parseTemplateInput(templateMarkdown, locale);
  const trace = core.scoreEntries(jdInput.jd.rawText, allEntries);
  const selectedEntries = core.selectEntriesForTemplate(trace, allEntries, template);
  const matchReport = core.buildMatchReport(jdInput.jd.rawText, selectedEntries);
  const jdMeta = extractJdMetadata({ jdText: jdInput.jd.rawText, jdJson: jdInput.parsedJson });
  const coverLetterOutput = core.generateCoverLetter({
    job: jdInput.jd,
    entries: allEntries,
    template,
    locale,
    candidateName: header.candidateName || String(contact?.name || "").trim() || undefined,
    companyName: jdMeta.company,
    roleTitle: jdMeta.role,
  });
  const slug = slugifySegment([jdMeta.company, jdMeta.role].filter(Boolean).join("-"));
  const outputDir = resolve(ROOT_DIR, requestedOutDir ?? join(DEFAULT_OUTPUT_ROOT, slug));
  const contactLine = header.contactLine || buildContactLine(contact);
  const contactFragments = [contact?.location, contact?.email, contact?.phone, contact?.linkedin]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const pdfRenderingNotes = [
    "This repository remains the source of truth.",
    "Use resume.md as the markdown-resume input for final PDF rendering.",
    renderPdfFlag
      ? "Built-in PDF rendering was requested for this run."
      : "If you want a local preview PDF, rerun with --render-pdf.",
  ];

  await mkdir(outputDir, { recursive: true });
  await clearPriorOutputFiles(outputDir);

  const promptValues = {
    JD_TEXT: jdInput.jd.rawText,
    MATCH_REPORT_JSON: JSON.stringify(
      {
        matchReport,
        trace: trace.filter((item) => selectedEntries.some((entry) => entry.id === item.entryId)).slice(0, 16),
      },
      null,
      2,
    ),
    SELECTED_ENTRIES: buildSelectedEntriesText(selectedEntries),
    CURRENT_RESUME_MD: resumeMarkdown.trim(),
    RESUME_TEMPLATE_MD: templateMarkdown.trim(),
    CONTACT_BLOCK: JSON.stringify(
      {
        ...(contact ?? {}),
        candidateName: header.candidateName,
        contactLine,
      },
      null,
      2,
    ),
    LOCALE: locale,
    CANDIDATE_NAME: header.candidateName || "Candidate",
    CONTACT_LINE: contactLine,
  };
  const userPrompt = fillPromptTemplate(userPromptTemplate, promptValues);
  const fullPrompt = `${systemPromptTemplate.trim()}\n\n${userPrompt.trim()}\n`;
  await buildPromptFiles(outputDir, fullPrompt, systemPromptTemplate, userPrompt);

  let resumeMarkdownOutput = buildFallbackResumeMarkdown({
    candidateName: header.candidateName || String(contact?.name || "").trim() || "Candidate",
    contactLine,
    selectedEntries,
    currentResumeMarkdown: resumeMarkdown,
  });

  let analysis = buildDeterministicAnalysis({
    jdTitle: jdMeta.role,
    jdCompany: jdMeta.company,
    matchReport,
    trace,
    selectedEntries,
    allEntries,
    slug,
    pdfRenderingNotes,
  });

  if (modelCmd) {
    try {
      const modelOutput = await runModelCommand(modelCmd, fullPrompt);
      await writeFile(join(outputDir, "tailor-model-output.txt"), `${modelOutput.trim()}\n`, "utf-8");
      const parsed = parseTailorModelOutput(modelOutput);
      resumeMarkdownOutput = parsed.resumeMarkdown;
      analysis = mergeModelAnalysis(analysis, parsed.analysis);
    } catch (error) {
      analysis.truthfulness_warnings = sanitizeStringArray([
        ...analysis.truthfulness_warnings,
        `Model tailoring step failed; deterministic fallback was used. ${error instanceof Error ? error.message : String(error)}`,
      ]);
    }
  } else {
    analysis.truthfulness_warnings = sanitizeStringArray([
      ...analysis.truthfulness_warnings,
      "No --model-cmd provided; deterministic fallback resume was used.",
    ]);
  }

  const validation = validateTailoredResume({
    resumeMarkdown: resumeMarkdownOutput,
    candidateName: header.candidateName || String(contact?.name || "").trim(),
    contactFragments,
  });
  analysis.truthfulness_warnings = sanitizeStringArray([
    ...analysis.truthfulness_warnings,
    ...validation.warnings,
  ]);

  if (validation.errors.length > 0) {
    throw new Error(`Tailored resume validation failed: ${validation.errors.join(" | ")}`);
  }

  await writeFile(join(outputDir, "resume.md"), `${resumeMarkdownOutput.trim()}\n`, "utf-8");
  await writeFile(join(outputDir, "cover-letter.md"), `${coverLetterOutput.outputMd.trim()}\n`, "utf-8");
  await writeFile(join(outputDir, jdInput.artifactName), jdInput.artifactContent, "utf-8");

  if (renderPdfFlag) {
    try {
      await renderPdf(resumeMarkdownOutput, join(outputDir, "resume.pdf"));
      analysis.pdf_rendering_notes = sanitizeStringArray([
        ...analysis.pdf_rendering_notes,
        "A local PDF was rendered with the built-in Playwright renderer. Compare it with markdown-resume before final submission.",
      ]);
    } catch (error) {
      const errorLine = firstErrorLine(error);
      analysis.pdf_rendering_notes = sanitizeStringArray([
        ...analysis.pdf_rendering_notes,
        `Built-in PDF rendering failed: ${errorLine}`,
      ]);
      console.warn(`Warning: built-in PDF rendering failed. Markdown output is still available. ${errorLine}`);
    }
  }

  await writeFile(join(outputDir, "analysis.json"), `${JSON.stringify(analysis, null, 2)}\n`, "utf-8");

  if (analysis.unsupported_jd_requirements.length > 0) {
    console.warn(`Warning: unsupported JD requirements detected: ${analysis.unsupported_jd_requirements.join(", ")}`);
  }

  console.log(`Tailored markdown-resume output written to ${outputDir}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
