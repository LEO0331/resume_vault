# 履歷數據庫 Wiki（GitHub Pages 版）

## 1. 目標
建立一個可部署在 GitHub Pages 的本機優先履歷系統：
- 保存履歷詞條（skills/experience/projects/achievements）
- 匯入 JD（貼上文字 + URL 擷取）
- 依 JD 自動挑選詞條並產生履歷 Markdown
- 支援使用者上傳/匯入自訂履歷再轉為詞條

## 2. 為什麼用 GitHub Pages
- 免費、穩定、版本化部署
- 前端靜態站即可運作
- 敏感履歷資料可留在瀏覽器本地儲存（localStorage/IndexedDB）

## 3. 功能邊界（重要）
GitHub Pages 只能跑前端 JS，不能在站上直接跑 Playwright。

因此採雙軌：
1. 站上主流程：手動貼上 JD（穩定）
2. 本機輔助流程：用 `tools/jd-fetch`（Playwright）抓取 104/LinkedIn/Seek，再匯入網站

## 4. 起手模板（內建 2 種）
1. Reverse Chronological (ATS-friendly)
2. Hybrid / Combination (Skills + Impact)

兩者會在首次啟動和資料匯入後自動確保存在。

## 5. 匯入能力
1. 自訂履歷匯入：支援 `.md` / `.txt` 上傳或貼上，系統依標題區塊與條列項轉成 `resume_entries`。
2. 狀態資料匯入：支援外部 `resume-vault-data.json`。
- Merge：與目前資料合併
- Replace：以匯入資料覆蓋目前資料（仍保留 2 個 starter templates）

## 6. 資料模型
- `resume_entries`: 履歷詞條資料
- `templates`: 履歷模板（區塊規則）
- `job_descriptions`: JD 原文與解析結果
- `generated_resumes`: 生成履歷與匹配 trace

## 7. 匹配策略（MVP）
- 關鍵字重疊分數
- 區塊加權（required skills 優先）
- 條目權重 + 多樣性保護（避免同 tag 重複）
- 回傳 `trace_json` 供人工覆核

## 8. 支援來源
- 104（中文）
- LinkedIn（AU）
- Seek（AU）

備註：LinkedIn 常需登入，若遇到登入牆/captcha，請改用貼上流程。

## 9. 部署與執行
- 靜態網站：GitHub Actions 建置 `apps/web` 並部署到 GitHub Pages
- 本機抓 JD：`npm run jd:fetch -- --url <job-url>`
- 安全防護：預設阻擋 localhost / private network 目標；若你明確要抓內網來源，才使用 `--allow-private-network`
- 匯入流程：將輸出的 JSON 貼到網站「Import JD JSON」功能

## 10. 測試文件
- 測試與樣例結果請放在 `docs/test-results.md`
- 詞庫來源與可追溯性請一起記錄在該文件
