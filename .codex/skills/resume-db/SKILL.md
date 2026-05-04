---
name: resume-db
description: Generate tailored resume from local resume database and job description (paste or Playwright fetch)
---

# Resume DB Skill

## When to use
- User wants to tailor a resume quickly for a specific JD.
- User provides JD text or JD URL (104 / LinkedIn / Seek).
- User wants to import an existing custom resume as reusable entries.

## Starter templates
- `starter-ats-au-standard-en` (AU ATS Standard, chronological)
- `starter-ats-au-standard-zh` (澳洲 ATS 標準，時間倒序)

## Steps
1. Validate input:
- If URL is provided, run `npm run jd:fetch -- --url <url>`.
- If fetch fails or requires auth, ask for pasted JD text.
2. Optional: import custom resume markdown/text into entries.
3. Ensure starter templates exist (AU ATS Standard EN + AU ATS Standard ZH).
4. Run generation pipeline with selected template.
5. Return artifacts:
- tailored resume markdown
- trace JSON (selected entry + reason + score)
6. Record sample output + word bank source in `docs/test-results.md`.

## Rules
- Keep all data local.
- Do not invent achievements or experience not in stored entries.
- Require user review before final export.

## Output format
- `output_md`
- `trace_json`
- `warnings` (e.g., missing skills, low-confidence match)
