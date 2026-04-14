# Skill Draft: resume-db

## Purpose
讓 Codex/Claude 用固定流程操作履歷資料庫：
1. 匯入或抓取 JD
2. 匯入自訂履歷（選配）
3. 套用模板產生客製履歷
4. 匯出 markdown + trace

## Built-in Templates
- `starter-reverse-chronological`
- `starter-hybrid-combination`

## Inputs
- `jd_text` 或 `jd_url`
- `template_id`
- `locale` (`zh-TW` / `en-AU`)
- optional `custom_resume_markdown`

## Workflow
1. 若有 `jd_url`：先嘗試 `npm run jd:fetch -- --url <url>`（預設阻擋 localhost/private network）
2. 若抓取失敗：改用貼上 JD
3. 若有自訂履歷：匯入 markdown/txt，轉成 entries
4. 選模板（預設兩個 starter templates 之一）
5. 產生履歷，輸出 `output_md` + `trace_json`

## Guardrails
- 不捏造履歷內容
- 所有輸出都必須可追溯到本地詞條
- 生成後必須人工 preview

## Test Artifact
- 將測試輸出與詞庫來源記錄到 `docs/test-results.md`
