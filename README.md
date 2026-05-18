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

## Markdown Resume Tailor Flow

Use this local flow when you want a tailored `resume.md` that can be pasted into or rendered by [`junian/markdown-resume`](https://github.com/junian/markdown-resume).
The same run now also creates a deterministic `cover-letter.md` from the same JD and selected entries.

Source-of-truth rules:
- Resume Vault remains the source of truth for resume/profile/template data
- `markdown-resume` is only the rendering/export target
- No backend is required

Inputs:
- `--jd`: job description file (`.md`, `.txt`, or existing JD `.json`)
- `--resume`: current resume markdown
- `--template`: stored resume template (`.md` or `.json`)
- `--profile` (optional): extra profile/entry bank markdown
- `--contact` (optional): contact JSON

Example:
```bash
npm run ats:tailor -- \
  --jd docs/job.md \
  --resume docs/current-resume.md \
  --template docs/store-template.md \
  --out outputs/company-role
```

Optional prompt-based rewrite:
```bash
npm run ats:tailor -- \
  --jd docs/job.md \
  --resume docs/current-resume.md \
  --template docs/store-template.md \
  --model-cmd "my-local-llm-cli"
```

The model command must read the combined prompt from `stdin` and print the required `---RESUME_MD---` and `---ANALYSIS_JSON---` sections to `stdout`.
If no `--model-cmd` is provided, the flow still generates a deterministic fallback `resume.md` from the existing selected entries.

Outputs are written to `outputs/<safe-company-role-slug>/` by default, or to the path passed with `--out`:
- `resume.md`
- `cover-letter.md`
- `analysis.json`
- `jd.json` or `jd.md`
- `tailor-prompt.system.txt`
- `tailor-prompt.user.txt`
- `tailor-prompt.full.txt`
- `tailor-model-output.txt` when a model command is used

Optional local PDF rendering:
```bash
npm run ats:tailor:pdf -- \
  --jd docs/job.md \
  --resume docs/current-resume.md \
  --template docs/store-template.md \
  --out outputs/company-role
```

This PDF render is a convenience preview only. If built-in rendering fails, `resume.md` and `analysis.json` are still written. For your final polished export, paste `resume.md` into `markdown-resume` and export the PDF there.
`cover-letter.md` remains a separate Markdown output and is not bundled into the resume export.

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
