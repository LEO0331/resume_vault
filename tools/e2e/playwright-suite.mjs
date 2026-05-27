import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import process from "node:process";
import { chromium } from "playwright";

const HOST = "127.0.0.1";
const PREVIEW_PORT_CANDIDATES = ["4175", "4176", "4177", "4275"];
const NODE_BIN = process.env.NODE_BIN ?? process.execPath;
const RUN_LIVE_FETCH = process.env.E2E_RUN_LIVE_JD_FETCH === "1";
const LIVE_FETCH_URL = process.env.E2E_LIVE_JD_URL ?? "https://www.seek.com.au/jobs/software-developer";
const ROOT_DIR = fileURLToPath(new URL("../../", import.meta.url));
const JD_JSON_PLACEHOLDER = '{"url":"...","text":"..."}';
const JD_TEXT_LABEL = /^(Paste JD text|貼上職位描述內容|貼上 JD 內容)$/;
const SAVE_JD_BUTTON = /^(Save JD from text|儲存職位描述（文字）|儲存 JD（文字）)$/;
const IMPORT_JD_JSON_BUTTON = /^(Import JD JSON|匯入職位描述 JSON|匯入 JD JSON)$/;
const GENERATE_BUTTON = /^(Generate|生成履歷)$/;
const JD_SELECT_LABEL = /^(Select job description|選擇職位描述)$/;
const OBSIDIAN_EXPORT_BUTTON = /^(Export Obsidian Markdown|匯出 Obsidian Markdown)$/;
const COVER_LETTER_EXPORT_BUTTON = /^(Export Cover Letter|匯出 Cover Letter)$/;
const INVALID_JD_JSON_STATUS = /Invalid JD JSON format\.|職位描述 JSON 格式錯誤。/;

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const hasReasonPrefix = (traceItem, prefixes) =>
  Array.isArray(traceItem?.reasons)
  && traceItem.reasons.some((reason) => prefixes.some((prefix) => String(reason).startsWith(prefix)));

const runCommand = (cmd, args, cwd) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`Command failed (${cmd} ${args.join(" ")}): ${stderr || stdout}`));
    });
  });

const waitForServer = (child) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for Vite preview server to start."));
    }, 20_000);

    const onData = (buffer) => {
      const text = String(buffer);
      if (text.includes("Local:")) {
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        resolve(undefined);
      }
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", (buffer) => {
      const text = String(buffer);
      if (text.trim()) {
        process.stderr.write(text);
      }
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Vite preview exited before ready (code: ${code ?? "unknown"}).`));
    });
  });

const startPreviewOnPort = async (port) => {
  const child = spawn(
    NODE_BIN,
    ["../../node_modules/vite/bin/vite.js", "preview", "--host", HOST, "--port", port, "--strictPort"],
    {
      cwd: new URL("../../apps/web/", import.meta.url),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  await waitForServer(child);
  return child;
};

const startPreview = async () => {
  const errors = [];

  for (const port of PREVIEW_PORT_CANDIDATES) {
    try {
      const child = await startPreviewOnPort(port);
      return {
        child,
        appUrl: `http://${HOST}:${port}/`,
      };
    } catch (error) {
      errors.push(`${port}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Unable to start Vite preview on candidate ports. ${errors.join(" | ")}`);
};

const createFixtures = async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "resume-vault-e2e-"));
  const entries = JSON.parse(await readFile(join(ROOT_DIR, "docs/samples/entries-seed-au.json"), "utf-8"));
  const template = JSON.parse(await readFile(join(ROOT_DIR, "docs/samples/template-starter-ats-au-standard-en.json"), "utf-8"));
  const jdText = await readFile(join(ROOT_DIR, "docs/samples/jd-seek-senior-frontend.txt"), "utf-8");

  const dbStatePath = join(tempDir, "db-state.json");
  const jdJsonPath = join(tempDir, "jd-sample.json");
  const liveJdJsonPath = join(tempDir, "jd-live.json");

  await writeFile(
    dbStatePath,
    `${JSON.stringify({ entries, templates: [template], jobs: [] }, null, 2)}\n`,
    "utf-8",
  );
  await writeFile(
    jdJsonPath,
    `${JSON.stringify({ url: "https://www.seek.com.au/job/software-developer", text: jdText.trim() }, null, 2)}\n`,
    "utf-8",
  );

  return { tempDir, dbStatePath, jdJsonPath, liveJdJsonPath, jdText };
};

const switchToEnglish = async (page) => {
  const englishHint = page.getByText(/English mode supports LinkedIn and Seek JD URL sources\./);
  if (await englishHint.count()) {
    return;
  }

  const englishModeButton = page.getByRole("button", { name: /^(English Mode|英文模式)$/ });
  if (await englishModeButton.count()) {
    await englishModeButton.first().click();
    await page.waitForTimeout(200);
  }

  if (!(await englishHint.count())) {
    const localeButtons = page.locator(".locale-switch button");
    if (await localeButtons.count()) {
      await localeButtons.nth(1).click();
      await page.waitForTimeout(200);
    }
  }

  assert(await englishHint.count(), "Failed to switch to English mode before running E2E scenarios.");
};

const importDbState = async (page, dbStatePath) => {
  const dbInput = page.locator("input[type='file'][accept*='application/json']");
  await dbInput.setInputFiles(dbStatePath);
  await page.waitForTimeout(300);
};

const saveJdFromText = async (page, jdText) => {
  await page.getByLabel(JD_TEXT_LABEL).fill(jdText);
  await page.getByRole("button", { name: SAVE_JD_BUTTON }).click();
};

const importJdJson = async (page, jdJsonPath) => {
  const jdJson = await readFile(jdJsonPath, "utf-8");
  await page.getByPlaceholder(JD_JSON_PLACEHOLDER).fill(jdJson);
  await page.getByRole("button", { name: IMPORT_JD_JSON_BUTTON }).click();
};

const importInvalidJdJsonAndAssert = async (page) => {
  await page.getByPlaceholder(JD_JSON_PLACEHOLDER).fill("{invalid");
  await page.getByRole("button", { name: IMPORT_JD_JSON_BUTTON }).click();
  const status = page.getByRole("status");
  await status.waitFor();
  const text = await status.textContent();
  assert(
    INVALID_JD_JSON_STATUS.test(String(text || "")),
    `ERROR: Invalid JD JSON should surface an import error.\nWHY: JD JSON textarea -> parser -> UI status boundary must reject malformed input without mutating job state.\nFIX: Check importJobJson error handling and status rendering before changing assertions.`,
  );
};

const selectMostRecentJob = async (page) => {
  const select = page.getByLabel(JD_SELECT_LABEL);
  const options = await select.locator("option").allTextContents();
  assert(
    options.length > 1,
    `ERROR: Expected at least one persisted job option besides the placeholder.\nWHY: localStorage restore must preserve saved job descriptions across reloads.\nFIX: Check persist()/safeParse()/normalizeState() and the job-select wiring before changing this test.`,
  );
  await select.selectOption({ index: 1 });
};

const assertPersistenceAfterReload = async (page) => {
  const statCards = page.locator(".stat-card strong");
  const counts = await statCards.allTextContents();
  assert(
    counts.length >= 3 && Number(counts[0]) > 0 && Number(counts[1]) > 0 && Number(counts[2]) > 0,
    `ERROR: Expected non-zero persisted counts after reload, got ${counts.join(", ")}.\nWHY: entries/templates/jobs must survive a browser reload on the same origin path.\nFIX: Check localStorage persistence and the initial-state hydration path before changing this assertion.`,
  );
};

const runGenerateAndAssert = async (page, expectationLabel, tempDir) => {
  const obsidianButton = page.getByRole("button", { name: OBSIDIAN_EXPORT_BUTTON });
  const coverLetterButton = page.getByRole("button", { name: COVER_LETTER_EXPORT_BUTTON });
  assert(await obsidianButton.count(), `${expectationLabel}: obsidian export button is missing.`);
  assert(await coverLetterButton.count(), `${expectationLabel}: cover letter export button is missing.`);
  assert(await obsidianButton.isDisabled(), `${expectationLabel}: obsidian export button should be disabled before generation.`);
  assert(await coverLetterButton.isDisabled(), `${expectationLabel}: cover letter export button should be disabled before generation.`);

  await page.getByRole("button", { name: GENERATE_BUTTON }).click();

  const output = await page.locator("textarea[readonly][rows='14']").inputValue();
  assert(output.trim().length > 0, `${expectationLabel}: generated markdown is empty.`);
  assert(output.includes("# Tailored Resume"), `${expectationLabel}: missing Tailored Resume title.`);
  if (process.env.E2E_DEBUG === "1") {
    process.stdout.write(`\n--- ${expectationLabel} output ---\n${output}\n--- end output ---\n`);
  }
  assert(
    output.includes("Senior Frontend Engineer - Fintech Platform")
      || output.includes("Platform Collaboration")
      || output.includes("React, TypeScript"),
    `${expectationLabel}: expected useful experience content not found.`,
  );
  assert(
    output.toLowerCase().includes("react") || output.toLowerCase().includes("typescript"),
    `${expectationLabel}: expected React/TypeScript experience not selected.`,
  );

  const traceRaw = await page.locator("textarea[readonly][rows='10']").inputValue();
  const trace = JSON.parse(traceRaw);
  assert(Array.isArray(trace) && trace.length > 0, `${expectationLabel}: trace should not be empty.`);
  assert(
    trace.some((item) => hasReasonPrefix(item, ["overlap:", "general_overlap:", "priority_overlap:"])),
    `${expectationLabel}: trace should contain overlap reasons.`,
  );
  assert(
    trace.some((item) => hasReasonPrefix(item, ["overlap:"])),
    `${expectationLabel}: trace should preserve legacy overlap reason compatibility.`,
  );
  assert(
    trace.some((item) => hasReasonPrefix(item, ["general_overlap:", "priority_overlap:"])),
    `${expectationLabel}: trace should contain upgraded overlap reasons.`,
  );

  const coverLetter = await page.locator("textarea[readonly][rows='12']").inputValue();
  assert(coverLetter.trim().length > 0, `${expectationLabel}: generated cover letter is empty.`);
  assert(
    coverLetter.includes("Dear Hiring Manager,") || coverLetter.includes("您好，招募主管："),
    `${expectationLabel}: cover letter greeting is missing.`,
  );
  assert(
    coverLetter.toLowerCase().includes("react") || coverLetter.toLowerCase().includes("typescript") || coverLetter.includes("平台"),
    `${expectationLabel}: expected matched experience not reflected in cover letter.`,
  );

  const downloadPromise = page.waitForEvent("download");
  await obsidianButton.click();
  const download = await downloadPromise;
  const fileName = download.suggestedFilename();
  assert(fileName.startsWith("tailored-resume-obsidian-"), `${expectationLabel}: unexpected obsidian filename ${fileName}.`);
  assert(fileName.endsWith(".md"), `${expectationLabel}: obsidian export should be .md.`);
  const savedPath = join(tempDir, fileName);
  await download.saveAs(savedPath);
  const downloaded = await readFile(savedPath, "utf-8");
  assert(downloaded.startsWith("---\n"), `${expectationLabel}: obsidian export missing frontmatter delimiter.`);
  for (const key of ["title:", "created:", "locale:", "template_id:", "template_name:", "jd_source_type:", "jd_source_url:", "tags:"]) {
    assert(downloaded.includes(key), `${expectationLabel}: missing frontmatter key ${key}`);
  }
  assert(!downloaded.includes("resume/tailored"), `${expectationLabel}: tags should be simple non-namespaced values.`);
  assert(downloaded.includes(`\n${output}`), `${expectationLabel}: exported body should preserve generated markdown.`);

  const coverLetterDownloadPromise = page.waitForEvent("download");
  await coverLetterButton.click();
  const coverLetterDownload = await coverLetterDownloadPromise;
  const coverLetterFileName = coverLetterDownload.suggestedFilename();
  assert(coverLetterFileName === "tailored-cover-letter.md", `${expectationLabel}: unexpected cover letter filename ${coverLetterFileName}.`);
  const coverLetterPath = join(tempDir, coverLetterFileName);
  await coverLetterDownload.saveAs(coverLetterPath);
  const coverLetterDownloaded = await readFile(coverLetterPath, "utf-8");
  assert(coverLetterDownloaded === coverLetter, `${expectationLabel}: cover letter export should match generated output.`);
};

const reloadIntoEnglish = async (page) => {
  await page.reload({ waitUntil: "domcontentloaded" });
  await switchToEnglish(page);
};

const maybeRunLiveJdFetchScenario = async (page, fixtures) => {
  if (!RUN_LIVE_FETCH) {
    return;
  }

  await runCommand(
    NODE_BIN,
    ["tools/jd-fetch/dist/index.js", "--url", LIVE_FETCH_URL, "--out", fixtures.liveJdJsonPath],
    ROOT_DIR,
  );

  await importJdJson(page, fixtures.liveJdJsonPath);
  await runGenerateAndAssert(page, "live jd-fetch json", fixtures.tempDir);
};

const run = async () => {
  const fixtures = await createFixtures();
  const server = await startPreview();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto(server.appUrl, { waitUntil: "domcontentloaded" });
    await switchToEnglish(page);

    await importDbState(page, fixtures.dbStatePath);
    await importInvalidJdJsonAndAssert(page);
    await saveJdFromText(page, fixtures.jdText.trim());
    await selectMostRecentJob(page);
    await runGenerateAndAssert(page, "sample word bank + pasted jd", fixtures.tempDir);

    await reloadIntoEnglish(page);
    await assertPersistenceAfterReload(page);
    await selectMostRecentJob(page);
    await runGenerateAndAssert(page, "persisted state after reload", fixtures.tempDir);

    await reloadIntoEnglish(page);
    await importDbState(page, fixtures.dbStatePath);
    await importJdJson(page, fixtures.jdJsonPath);
    await selectMostRecentJob(page);
    await runGenerateAndAssert(page, "sample word bank + imported jd json", fixtures.tempDir);

    await maybeRunLiveJdFetchScenario(page, fixtures);

    process.stdout.write("Playwright E2E suite passed.\n");
  } finally {
    await browser.close();
    server.child.kill("SIGTERM");
    await rm(fixtures.tempDir, { recursive: true, force: true });
  }
};

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
