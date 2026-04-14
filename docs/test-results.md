# Resume Vault Test Results and Word Bank Log

## 1. Purpose
Track reproducible sample generation results and where the matching word bank came from.

## 2. Sample Test Case Template
- Date:
- JD source: (104 / LinkedIn / Seek / paste)
- JD URL or reference:
- Template used: (`starter-reverse-chronological` or `starter-hybrid-combination` or custom)
- Input entries count:
- Output file: (`tailored-resume.md`)
- Trace file: (`trace.json`)
- Reviewer notes:

## 3. Sample Result A (Example)
- Date: 2026-04-14
- JD source: Seek sample JD text
- JD URL or reference: `docs/samples/jd-seek-senior-frontend.txt`
- Template used: `starter-reverse-chronological`
- Input entries count: 12 (`docs/samples/entries-seed-au.json`)
- Output file: `docs/samples/generated-seek-resume-v1.md`
- Trace file: `docs/samples/generated-seek-trace-v1.json`
- Generated summary: `docs/samples/generated-seek-summary-v1.json`
- Selected entries: 10 / 12
- Top selected entry IDs: `entry-002`, `entry-001`, `entry-003`, `entry-006`, `entry-008`
- Output quality notes:
- Strong overlap for React / TypeScript / API collaboration / quality-delivery keywords
- Coverage includes projects, skills, and measurable impact bullets
- Lower score on cloud/security entries (`entry-011`, `entry-009`) due JD wording priority
- Action taken:
- Keep this as baseline v1 sample for regression comparison

## 4. Sample Result B (Planned Next)
- Date: TBD
- JD source: 104 (sample)
- Template used: `starter-hybrid-combination`
- Input entries count: TBD
- Output quality notes: pending run
- Action taken: pending run

## 5. Word Bank Sources
Record every source used to build/expand keyword matching vocabulary.

| Source Type | Source Name | Scope | Notes |
| --- | --- | --- | --- |
| Personal resume | Existing resume versions | Core achievements and project terms | Trusted primary source |
| JD corpus | 104 postings (Mandarin) | Chinese hiring vocabulary | Periodically refresh |
| JD corpus | LinkedIn AU postings | English role/action terms | May require manual paste |
| JD corpus | Seek AU postings | AU market keywords | Good for ATS phrasing |
| Manual curation | Reviewer-added tags | Missing terms from failed matches | Track rationale in notes |

### Word Bank Used in Sample A (v1)
- Base entry tags/content: `docs/samples/entries-seed-au.json`
- JD keyword source: `docs/samples/jd-seek-senior-frontend.txt`
- Template section preference tags: `docs/samples/template-starter-reverse-chronological.json`

## 6. Regression Checklist
For each release candidate:
1. Run one sample per source (104 / LinkedIn / Seek).
2. Keep generated markdown + trace snapshot.
3. Compare top selected tags against expected keyword focus.
4. Update this file if word bank changed.
