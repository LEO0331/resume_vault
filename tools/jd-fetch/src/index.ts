import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { resolveAdapter } from "./adapters/index.js";
import { assertSafeTargetUrl, shouldBlockRequestUrl } from "./network-safety.js";

const readArg = (name: string): string | undefined => {
  const index = process.argv.findIndex((arg) => arg === name);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
};

const hasFlag = (name: string): boolean => process.argv.includes(name);

const urlArg = readArg("--url");
const outputArg = readArg("--out") ?? "jd-capture.json";
const headed = hasFlag("--headed");
const wantsHelp = hasFlag("--help") || hasFlag("-h");
const allowPrivateNetwork = hasFlag("--allow-private-network");

if (wantsHelp) {
  console.log("Usage: npm run jd:fetch -- --url <job-url> [--out jd.json] [--headed] [--allow-private-network]");
  process.exit(0);
}

if (!urlArg) {
  console.error("Usage: npm run jd:fetch -- --url <job-url> [--out jd.json] [--headed] [--allow-private-network]");
  process.exit(1);
}

const run = async (): Promise<void> => {
  const url = new URL(urlArg);
  if (!allowPrivateNetwork) {
    await assertSafeTargetUrl(url.toString());
  }
  const adapter = resolveAdapter(url);

  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    if (!allowPrivateNetwork) {
      await context.route("**/*", async (route) => {
        const requestUrl = route.request().url();
        if (await shouldBlockRequestUrl(requestUrl)) {
          await route.abort("blockedbyclient");
          return;
        }

        await route.continue();
      });
    }

    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2000);

    const extracted = adapter
      ? await adapter.extract(page, url)
      : {
          domain: url.hostname,
          url: url.toString(),
          title: (await page.title()).trim(),
          text: (await page.locator("body").innerText()).trim(),
          warnings: ["No dedicated adapter found. Used generic body text extraction."],
        };

    await writeFile(outputArg, `${JSON.stringify(extracted, null, 2)}\n`, "utf-8");
    console.log(`Saved JD capture to ${outputArg}`);
    if (extracted.warnings.length > 0) {
      console.log(`Warnings: ${extracted.warnings.join(" | ")}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
