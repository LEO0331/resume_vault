# Resume Vault

Turn your career highlights into reusable entries and generate a tailored resume for each job you apply to.
Bilingual (zh-TW / en-AU) local-first workflow with optional Playwright helper for job-description capture.

## Features

- Local resume entry bank (no required backend)
- Simple mode (3-step flow) and Full mode (advanced controls)
- Experience Bank-first UI with quick section jumps
- Starter templates:
  - AU ATS Standard (Chronological)
  - 澳洲 ATS 標準（時間倒序）
- JD input via paste or JSON import
- Optional JD URL capture (`104`, `LinkedIn`, `Seek`) using local `jd-fetch`
- Tailored resume generation (`markdown + trace json`)
- Optional Obsidian markdown export (YAML frontmatter + resume body)
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
npm run test:e2e
```

## Lighthouse CI Dashboard (Temporary URL)

- Workflow: `.github/workflows/lighthouse-ci.yml`
- Triggers: pull request, push to `main`, or manual dispatch
- The workflow publishes temporary public Lighthouse report links in the run summary (`Lighthouse Temporary Public Report URLs`).
- Target thresholds are configured in `lighthouserc.json` (set to warn at 90+ for Performance, Accessibility, Best Practices, and SEO).

Playwright E2E coverage (`npm run test:e2e`) includes:
- Import sample word bank (DB JSON) from `docs/samples`
- Run generation from pasted job description text
- Run generation from imported JD JSON and verify trace reasons

This live lane runs `jd-fetch` against a real job page, imports the fetched JSON, then verifies resume generation output.

## GitHub Pages Deployment

Deployment workflow: `.github/workflows/deploy-gh-pages.yml`

- Push to `main` to trigger deploy
- Build uses `VITE_BASE_PATH=/${repo-name}/`
- Output is published from `apps/web/dist`

## Sample Data and Outputs

- Inputs: `docs/samples/`
- Generated samples: `docs/samples/generated-*`
- Result log and word bank source tracking: `docs/test-results.md`

## Private ATS Pipeline (Seek, Local Only)

Use this when you want private, submission-ready tailored resumes for Seek roles.

1. Prepare private inputs:
- `docs/private-tests/seek-job-urls.local.txt` (one Seek job URL per line, from your filtered search page)
- `docs/private-tests/ats-screening-input.md` (your private resume/profile source)
- `docs/private-tests/contact.local.json` (personal contact info)

2. Run dry check:
```bash
npm run private:seek:ats -- --dry-run
```

3. Run generation:
```bash
npm run private:seek:ats
```

If Seek presents a human-check page, run headed mode to complete verification interactively:
```bash
npm run private:seek:ats -- --headed
```

If your environment falsely flags SEEK as private-network, opt in explicitly:
```bash
npm run private:seek:ats -- --allow-private-network-fallback
```

Output files are written to `docs/private-tests/`:
- `seek-job-<id>-jd.json`
- `seek-job-<id>-analysis.json`
- `seek-job-<id>-resume.md`
- `seek-job-<id>-resume.pdf`
- `seek-private-run-summary.json`

Notes:
- The pipeline only processes URLs you provide (no automated search-results crawling).
