# ATS resume output and local PDF verification

All files in this folder use fictional people, organisations, contact details and qualifications.

## Before and after

- `input.en.md` and `job.en.md` are the English source and JD.
- `before.en.md` applies the previous core renderer and previous ATS preset to the same parsed fictional bank. It illustrates the generic title, exported JD source, flattened roles and missing identity/education.
- `after.en.md` / `after.en.pdf` are the current local CLI outputs.
- `input.zh.md`, `job.zh.md`, `after.zh.md` / `after.zh.pdf` demonstrate Traditional Chinese output.

Reproduce the English output from the repository root:

```sh
npm ci
npx playwright install chromium
npm run ats:tailor:pdf -- --jd docs/samples/ats-quality/job.en.md --resume docs/samples/ats-quality/input.en.md --template docs/samples/template-starter-ats-au-standard-en.json --out outputs/fictional-en
```

For Chinese, use `input.zh.md`, `job.zh.md`, `--template docs/store-template.md --locale zh-TW` and a separate output directory.

## Data and template compatibility

The Experience Bank and scoring/ranking algorithms remain in place. `ResumeEntry` gains the `education` category and optional `organization`, `position`, `startDate`, `endDate`, `location` and `parentId` fields. Projects can reference an experience entry with `parentId`; the resume prints that role's context even when the role was not selected for its own section.

`generateResume(job, entries, template, profile?)` accepts an optional `ResumeProfile` with name and contacts. Existing three-argument callers continue to work. Missing source facts are omitted rather than filled with candidate, employer or education placeholders. Supply identity and a summary in the source data for a complete submission.

The web app keeps `resume-vault/state/v1`. Loading an old bank adds an empty profile, leaves entries and jobs intact, and refreshes only recognised starter presets. Custom templates retain their order and selection limits. JSON backup/export includes the new profile and optional entry metadata. Education is retained independently of relevance scores, including for older templates without an education section. The ATS presets order summary, skills, experience, projects, education, then achievements; empty sections are omitted.

The Markdown importer keeps candidate identity outside the scored bank, retains subsection role context, promotes explicit dates, and distinguishes repeated employment periods. CLI role blocks remain a selectable unit, retaining their achievement bullets. Selection is followed by reverse chronological presentation using known dates; undated legacy entries retain their relative selection order. Source prose is preserved: deterministic generation does not claim new outcomes or rewrite experience into invented metrics.

## PDF and ATS checks

Both existing CLI paths use the same Playwright renderer. Output is single-column A4 with 16 mm margins, 10.5 pt body text, local CJK font fallback, selectable text and PDF structure tags. Resume Markdown supports headings, paragraphs, bullet/numbered/nested lists, emphasis, inline code and safe links. Raw HTML is escaped; external images/resources are not loaded. The renderer blocks network requests.

English and Chinese CLI samples each produce one page. Both were rendered to PNG and visually checked for clipping, overlap and section spacing. A two-page bilingual stress sample was also visually checked. Regression checks cover the short one-page case, multi-page content, A4 dimensions, Unicode text maps, structure tags, complete extracted project bullets, nonblank pages and headings not stranded at page ends. With local `pypdf`, extracted text retains identity, contacts, experience and education. CJK text is normalised with NFKC during assertions because the Windows font maps some characters to Unicode compatibility radicals.

Matching traces, scores and gaps stay in analysis output or the web trace panel, outside ordinary exported resume Markdown/PDF. The optional Obsidian export deliberately retains its existing archival frontmatter, including JD provenance.

## Verification environment and limits

Validated on Windows with Node.js, the locked npm dependencies, installed Playwright Chromium and bundled Poppler/pypdf. Commands: `npm test`, `npm run typecheck`, `npm run build:web`, `npm run test:e2e`, plus both CLI PDF commands above. Final automated test total: 92 tests across 17 files.

The sandbox required `TEMP`/`TMP` redirected to a writable workspace folder for Vitest, `PLAYWRIGHT_BROWSERS_PATH` pointing to the installed Chromium cache, and localhost access for E2E. PDF extraction assertions are enabled with `RESUME_PDF_TEST_PYTHON` pointing to Python with `pypdf`; ordinary npm tests do not require Python. Vite emits an existing configuration-loader deprecation warning. Live external JD fetching was not enabled in E2E; stored JD fixtures exercise tailoring locally.

The attached reference PDF was accessible locally and used only to review general visual hierarchy. No personal information or assets from it are included here. The output follows single-column conventions rather than copying its multi-column skills layout. These checks establish selectable content and conventional reading order; no commercial ATS parser certification is claimed. Layout and CJK glyph selection depend on locally installed fonts. Unknown or ambiguous source dates remain verbatim and cannot always be sorted chronologically.
