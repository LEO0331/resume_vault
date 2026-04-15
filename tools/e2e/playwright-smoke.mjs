import { spawn } from "node:child_process";
import process from "node:process";
import { chromium } from "playwright";

const HOST = "127.0.0.1";
const PORT = "4175";
const APP_URL = `http://${HOST}:${PORT}/`;
const NODE_BIN = process.env.NODE_BIN ?? process.execPath;

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

const run = async () => {
  const server = await startPreview();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    const englishModeButton = page.getByRole("button", { name: /^English Mode$/ });
    if (await englishModeButton.count()) {
      await englishModeButton.click();
    } else {
      const zhEnglishModeButton = page.getByRole("button", { name: /^英文模式$/ });
      if (await zhEnglishModeButton.count()) {
        await zhEnglishModeButton.click();
      }
    }

    await page.getByLabel(/^(Title|標題)$/).fill("Senior Product Engineer");
    await page.getByLabel(/^(Content|內容)$/).fill("Built and shipped resume-matching workflows with measurable hiring impact.");
    await page.getByRole("button", { name: /^(Add Entry|新增詞條)$/ }).click();

    await page.getByLabel(/^(Paste JD text|貼上 JD 內容)$/).fill("Looking for a product engineer with React, analytics, and delivery experience.");
    await page.getByRole("button", { name: /^(Save JD from text|儲存 JD（文字）)$/ }).click();

    await page.getByRole("button", { name: /^(Generate|生成履歷)$/ }).click();

    const output = await page.locator("textarea[readonly][rows='14']").inputValue();
    if (!output.trim()) {
      throw new Error("Generated markdown is empty.");
    }

    if (!output.includes("#") && !output.includes("##")) {
      throw new Error("Generated markdown does not look like markdown output.");
    }

    process.stdout.write("Playwright E2E smoke passed.\n");
  } finally {
    await browser.close();
    server.kill("SIGTERM");
  }
};

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
