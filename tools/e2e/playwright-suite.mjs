import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import process from "node:process";
import { chromium } from "playwright";

const HOST = "127.0.0.1";
const PORT = "4175";
const APP_URL = `http://${HOST}:${PORT}/`;
const NODE_BIN = process.env.NODE_BIN ?? process.execPath;
const RUN_LIVE_FETCH = process.env.E2E_RUN_LIVE_JD_FETCH === "1";
const LIVE_FETCH_URL = process.env.E2E_LIVE_JD_URL ?? "https://www.seek.com.au/jobs/software-developer";
const ROOT_DIR = fileURLToPath(new URL("../../", import.meta.url));

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

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

const startPreview = async () => {
  const child = spawn(
    NODE_BIN,
    ["../../node_modules/vite/bin/vite.js", "preview", "--host", HOST, "--port", PORT, "--strictPort"],
    {
      cwd: new URL("../../apps/web/", import.meta.url),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  await waitForServer(child);
  return child;
};

const createFixtures = async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "resume-vault-e2e-"));
  const entries = JSON.parse(await readFile(join(ROOT_DIR, "docs/samples/entries-seed-au.json"), "utf-8"));
  const template = JSON.parse(await readFile(join(ROOT_DIR, "docs/samples/template-starter-reverse-chronological.json"), "utf-8"));
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
  await page.getByLabel(/^(Paste JD text|貼上職位描述內容|貼上 JD 內容)$/).fill(jdText);
  await page.getByRole("button", { name: /^(Save JD from text|儲存職位描述（文字）|儲存 JD（文字）)$/ }).click();
};

const importJdJson = async (page, jdJsonPath) => {
  const jdJson = await readFile(jdJsonPath, "utf-8");
  await page.getByPlaceholder('{"url":"...","text":"..."}').fill(jdJson);
  await page.getByRole("button", { name: /^(Import JD JSON|匯入職位描述 JSON|匯入 JD JSON)$/ }).click();
};

const runGenerateAndAssert = async (page, expectationLabel) => {
  await page.getByRole("button", { name: /^(Generate|生成履歷)$/ }).click();

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
    trace.some((item) => Array.isArray(item.reasons) && item.reasons.some((reason) => String(reason).startsWith("overlap:"))),
    `${expectationLabel}: trace should contain overlap reason.`,
  );
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
  await runGenerateAndAssert(page, "live jd-fetch json");
};

const run = async () => {
  const fixtures = await createFixtures();
  const server = await startPreview();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await switchToEnglish(page);

    await importDbState(page, fixtures.dbStatePath);
    await saveJdFromText(page, fixtures.jdText.trim());
    await runGenerateAndAssert(page, "sample word bank + pasted jd");

    await page.reload({ waitUntil: "domcontentloaded" });
    await switchToEnglish(page);
    await importDbState(page, fixtures.dbStatePath);
    await importJdJson(page, fixtures.jdJsonPath);
    await runGenerateAndAssert(page, "sample word bank + imported jd json");

    await maybeRunLiveJdFetchScenario(page, fixtures);

    process.stdout.write("Playwright E2E suite passed.\n");
  } finally {
    await browser.close();
    server.kill("SIGTERM");
    await rm(fixtures.tempDir, { recursive: true, force: true });
  }
};

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
