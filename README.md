# Resume Vault

Local-first resume database with JD-driven resume generation.
Designed for GitHub Pages deployment with optional local Playwright helper for job-description capture.

## Features

- Local resume entry bank (no required backend)
- Simple mode (3-step flow) and Full mode (advanced controls)
- Experience Bank-first UI with quick section jumps
- Starter templates:
  - Reverse Chronological (ATS-friendly)
  - Hybrid / Combination (skills-focused)
- JD input via paste or JSON import
- Optional JD URL capture (`104`, `LinkedIn`, `Seek`) using local `jd-fetch`
- Tailored resume generation (`markdown + trace json`)
- Custom resume import (`.md` / `.txt`) and state import/export (`.json`)
- One-click DB restore via `Import DB JSON`

## Project Structure

- `apps/web` - React + Vite frontend (GitHub Pages target)
- `packages/core` - matching and resume generation logic
- `tools/jd-fetch` - local Playwright CLI for JD capture
- `docs` - wiki, skill notes, sample inputs/results, test result log

## Quick Start

```bash
npm install
npm run dev:web
```

Open the local URL shown by Vite.

Default flow:
1. Add entries in **Experience Bank**
2. Add JD text/JSON
3. Generate and export markdown

Advanced template editing and custom resume import are available in the **Advanced** section.

Storage behavior:
- On the same computer, browser, and site path, data persists after reopening the page.
- Data does not carry over automatically after clearing browser data, switching browser, or switching device.

## Build and Verify

```bash
npm run test
npm run typecheck
npm run build:web
```

## GitHub Pages Deployment

Deployment workflow: `.github/workflows/deploy-gh-pages.yml`

- Push to `main` to trigger deploy
- Build uses `VITE_BASE_PATH=/${repo-name}/`
- Output is published from `apps/web/dist`

## JD Fetch Helper (Local)

```bash
npm run jd:fetch -- --url "https://www.seek.com.au/job/..."
```

Optional flags:

- `--out <file>` output JSON path (default `jd-capture.json`)
- `--headed` run with visible browser
- `--allow-private-network` override localhost/private-network block (disabled by default)

If fetching fails (login wall/captcha/DOM change), paste JD text directly in the web UI.

## Sample Data and Outputs

- Inputs: `docs/samples/`
- Generated samples: `docs/samples/generated-*`
- Result log and word bank source tracking: `docs/test-results.md`
