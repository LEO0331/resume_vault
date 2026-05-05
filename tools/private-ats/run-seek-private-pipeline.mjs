import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import {
  buildOutputBaseName,
  buildTailoredMarkdown,
  classifyRoleLevelByTitle,
  extractBulletSignals,
  extractGuideSections,
  extractJobIdFromUrl,
  extractSeekLocation,
  isLikelyBotWall,
  isSeekJobUrl,
  markdownToHtml,
  parsePrivateProfileToEntries,
  parseSeekUrlList,
  rankEntriesForJob,
} from "./src/lib.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_INPUT = "docs/private-tests/seek-job-urls.local.txt";
const DEFAULT_PROFILE = "docs/private-tests/ats-screening-input.md";
const DEFAULT_CONTACT = "docs/private-tests/contact.local.json";
const DEFAULT_OUT_DIR = "docs/private-tests";
const DEFAULT_MAX_JOBS = 3;
const DEFAULT_DELAY_MS = 2000;

const readArg = (name) => {
  const index = process.argv.findIndex((arg) => arg === name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
};

const hasFlag = (name) => process.argv.includes(name);

const runCommand = (cmd, args, cwd = ROOT_DIR) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
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
  });

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const requiredContactFields = ["name", "email", "phone"];

const assertContact = (contact) => {
  for (const field of requiredContactFields) {
    if (!contact?.[field] || typeof contact[field] !== "string") {
      throw new Error(`Missing required contact field: ${field}`);
    }
  }
};

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

const isPrivateNetworkFalsePositive = (message) =>
  String(message || "").includes("Blocked localhost/private-network target");
const parsePositiveInteger = (rawValue, fallback) => {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const runJdFetch = async (url, jdOutPath, options = {}) => {
  const args = ["tools/jd-fetch/dist/index.js", "--url", url, "--out", jdOutPath];
  if (options.headed) {
    args.push("--headed");
  }
  if (options.allowPrivateNetwork) {
    args.push("--allow-private-network");
  }
  try {
    await runCommand("node", args, ROOT_DIR);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isPrivateNetworkFalsePositive(message) && isSeekJobUrl(url) && options.allowPrivateNetworkFallback) {
      await runCommand("node", [...args, "--allow-private-network"], ROOT_DIR);
      return;
    }
    throw error;
  }
};

const normalizeSeekJobUrlForFetch = (rawUrl) => {
  const jobId = extractJobIdFromUrl(rawUrl);
  if (!jobId) return rawUrl;
  return `https://www.seek.com.au/job/${jobId}`;
};

const clearPriorOutputFiles = async (outDir, baseName) => {
  const files = [
    `${baseName}-resume.md`,
    `${baseName}-resume.pdf`,
    `${baseName}-analysis.json`,
  ];
  await Promise.all(files.map((file) => rm(join(outDir, file), { force: true })));
};

const main = async () => {
  const inputPath = resolve(ROOT_DIR, readArg("--input") ?? DEFAULT_INPUT);
  const profilePath = resolve(ROOT_DIR, readArg("--profile") ?? DEFAULT_PROFILE);
  const contactPath = resolve(ROOT_DIR, readArg("--contact") ?? DEFAULT_CONTACT);
  const outDir = resolve(ROOT_DIR, readArg("--out-dir") ?? DEFAULT_OUT_DIR);
  const maxJobs = parsePositiveInteger(readArg("--max-jobs") ?? DEFAULT_MAX_JOBS, DEFAULT_MAX_JOBS);
  const delayMs = parsePositiveInteger(readArg("--delay-ms") ?? DEFAULT_DELAY_MS, DEFAULT_DELAY_MS);
  const dryRun = hasFlag("--dry-run");
  const skipPdf = hasFlag("--skip-pdf");
  const headed = hasFlag("--headed");
  const allowPrivateNetwork = hasFlag("--allow-private-network");
  const allowPrivateNetworkFallback = hasFlag("--allow-private-network-fallback");

  await mkdir(outDir, { recursive: true });

  const urlContent = await readFile(inputPath, "utf-8");
  const allUrls = parseSeekUrlList(urlContent).filter((url) => isSeekJobUrl(url));
  if (allUrls.length === 0) {
    throw new Error("No valid Seek job URLs found. Provide URLs in docs/private-tests/seek-job-urls.local.txt");
  }

  const profileText = await readFile(profilePath, "utf-8");
  const entries = parsePrivateProfileToEntries(profileText, "en-AU");
  if (entries.length === 0) {
    throw new Error("No resume entries parsed from private profile input.");
  }

  if (dryRun) {
    const drySummary = {
      mode: "dry-run",
      urlsAccepted: allUrls.length,
      urls: allUrls.slice(0, maxJobs),
      parsedEntries: entries.length,
      outputDir: outDir,
    };
    const summaryPath = join(outDir, "seek-private-dry-run-summary.json");
    await writeFile(summaryPath, `${JSON.stringify(drySummary, null, 2)}\n`, "utf-8");
    console.log(`Dry-run summary written: ${summaryPath}`);
    return;
  }

  const contact = JSON.parse(await readFile(contactPath, "utf-8"));
  assertContact(contact);

  await runCommand("npm", ["--workspace", "tools/jd-fetch", "run", "build", "--silent"], ROOT_DIR);

  const processed = [];
  const skipped = [];
  let accepted = 0;

  for (let index = 0; index < allUrls.length && accepted < maxJobs; index += 1) {
    const url = allUrls[index];
    const fetchUrl = normalizeSeekJobUrlForFetch(url);
    const baseName = buildOutputBaseName(url, index + 1);
    const jdOutPath = join(outDir, `${baseName}-jd.json`);
    await clearPriorOutputFiles(outDir, baseName);

    try {
      await runJdFetch(fetchUrl, jdOutPath, { headed, allowPrivateNetwork, allowPrivateNetworkFallback });
      const jd = JSON.parse(await readFile(jdOutPath, "utf-8"));
      const title = String(jd.title || "").trim();
      if (isLikelyBotWall({ title, text: jd.text })) {
        skipped.push({ url, reason: "bot-wall", title });
        continue;
      }
      const hasExplicitJobId = Boolean(extractJobIdFromUrl(url));
      if (!hasExplicitJobId && !classifyRoleLevelByTitle(title)) {
        skipped.push({ url, reason: "role-level-filter", title });
        continue;
      }
      if (!jd.text || String(jd.text).trim().length === 0) {
        skipped.push({ url, reason: "empty-jd-text", title });
        continue;
      }

      const guideSections = extractGuideSections(jd.text);
      const ranking = rankEntriesForJob(entries, jd.text);
      const selectedEntries = ranking.slice(0, 24).map((row) => row.entry);
      const jdLocation = extractSeekLocation({ title, text: jd.text });
      const markdown = buildTailoredMarkdown({
        contact: {
          ...contact,
          location: jdLocation || contact.location || "",
        },
        templateName: "AU ATS Standard (Chronological)",
        jobUrl: jd.url || url,
        jobTitle: title || "Target Role",
        guideSections,
        selectedEntries,
      });

      const mdPath = join(outDir, `${baseName}-resume.md`);
      await writeFile(mdPath, markdown, "utf-8");

      const analysis = {
        sourceUrl: jd.url || url,
        sourceTitle: title,
        templateId: "starter-ats-au-standard-en",
        levelFilterPassed: true,
        guideSections,
        bulletSignals: extractBulletSignals(jd.text).slice(0, 80),
        topMatches: ranking.slice(0, 12).map((row) => ({
          entryId: row.entry.id,
          title: row.entry.title,
          category: row.entry.category,
          score: row.score,
        })),
      };
      const analysisPath = join(outDir, `${baseName}-analysis.json`);
      await writeFile(analysisPath, `${JSON.stringify(analysis, null, 2)}\n`, "utf-8");

      if (!skipPdf) {
        const pdfPath = join(outDir, `${baseName}-resume.pdf`);
        await renderPdf(markdown, pdfPath);
      }

      processed.push({
        url,
        title,
        files: {
          jd: `${baseName}-jd.json`,
          markdown: `${baseName}-resume.md`,
          pdf: skipPdf ? null : `${baseName}-resume.pdf`,
          analysis: `${baseName}-analysis.json`,
        },
      });
      accepted += 1;
      if (accepted < maxJobs) {
        await sleep(delayMs);
      }
    } catch (error) {
      skipped.push({
        url,
        reason: "fetch-or-generate-failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    maxJobs,
    requestedUrls: allUrls.length,
    processedCount: processed.length,
    processed,
    skipped,
  };
  const summaryPath = join(outDir, "seek-private-run-summary.json");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");
  console.log(`Private ATS run summary: ${summaryPath}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
