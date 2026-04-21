import { generateResume, type JobDescription, type ResumeEntry, type ResumeTemplate, type TemplateSection } from "@resume-vault/core";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { buildObsidianFilename, buildObsidianMarkdown } from "./obsidian";

type StoredState = {
  entries: ResumeEntry[];
  templates: ResumeTemplate[];
  jobs: JobDescription[];
};

type AppLocale = ResumeEntry["locale"];
type StatusTone = "success" | "error";

type UiText = {
  eyebrow: string;
  heroTitle: string;
  heroCopy: string;
  langZh: string;
  langEn: string;
  helpOpen: string;
  helpClose: string;
  sourceHint: string;
  statsEntries: string;
  statsTemplates: string;
  statsJobs: string;
  helpTitle: string;
  helpSteps: string[];
  quickStartTitle: string;
  quickStartEntries: string;
  quickStartJd: string;
  quickStartGenerate: string;
  modeSimple: string;
  modeFull: string;
  experienceBankHint: string;
  stickyLocale: string;
  stickyTemplate: string;
  stickyJd: string;
  stickyEntries: string;
  stickyNone: string;
  panelAdvanced: string;
  advancedOpen: string;
  advancedClose: string;
  emptyEntriesTitle: string;
  emptyEntriesBody: string;
  emptyJdTitle: string;
  emptyJdBody: string;
  emptyTemplateTitle: string;
  emptyTemplateBody: string;
  panelEntries: string;
  labelTitle: string;
  labelCategory: string;
  labelContent: string;
  labelTags: string;
  labelLocale: string;
  labelWeight: string;
  btnAddEntry: string;
  btnDelete: string;
  noTags: string;
  panelTemplates: string;
  templatesIntro: string;
  btnEnsureStarterTemplates: string;
  placeholderTemplateName: string;
  placeholderTemplateSections: string;
  btnAddTemplate: string;
  panelJob: string;
  jdUrlPlaceholder: string;
  jdTextPlaceholder: string;
  btnSaveJd: string;
  importFromJsonLabel: string;
  jdJsonPlaceholder: string;
  btnImportJdJson: string;
  selectJdPlaceholder: string;
  panelImport: string;
  importResumeIntro: string;
  resumeTextPlaceholder: string;
  btnImportResume: string;
  importResumeNote: string;
  panelGenerate: string;
  btnGenerate: string;
  btnExportMarkdown: string;
  btnExportObsidianMd: string;
  btnExportDbJson: string;
  btnImportDbJson: string;
  outputMarkdown: string;
  outputTrace: string;
  storageNoticePersist: string;
  storageNoticeLimit: string;
  msgStarterTemplatesEnsured: string;
  msgJdImported: string;
  msgInvalidJdJson: string;
  msgNoParsableResume: string;
  msgImportedResumeCount: (count: number) => string;
  msgUnsupportedFileType: (ext: string) => string;
  msgFileTooLarge: string;
  msgUrlSourceMismatch: string;
  msgImportedJdSourceMismatch: string;
  msgTemplateLocaleMismatch: string;
  msgSelectedJdSourceMismatch: string;
  msgDbImported: string;
  msgInvalidDbJson: string;
  catSummary: string;
  catExperience: string;
  catProject: string;
  catSkill: string;
  catAchievement: string;
  filterAll: string;
  filterExperience: string;
  filterSummary: string;
  filterProject: string;
  filterSkill: string;
  filterAchievement: string;
  msgTemplateCreated: string;
};

const STORAGE_KEY = "resume-vault/state/v1";
const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_RESUME_EXTENSIONS = new Set([".md", ".txt"]);
const JD_ALLOWED_DOMAINS: Record<AppLocale, string[]> = {
  "zh-TW": ["104.com.tw"],
  "en-AU": ["linkedin.com", "seek.com.au", "seek.co.nz"],
};

const UI_TEXT: Record<AppLocale, UiText> = {
  "zh-TW": {
    eyebrow: "本機履歷智慧系統",
    heroTitle: "Resume Vault",
    heroCopy: "把你的履歷重點整理成可重用詞條，依據職位描述快速產生客製化履歷。",
    langZh: "中文模式",
    langEn: "英文模式",
    helpOpen: "使用說明",
    helpClose: "關閉說明",
    sourceHint: "中文模式只支援 104 職位描述網址來源。",
    statsEntries: "詞條數",
    statsTemplates: "模板數",
    statsJobs: "職位描述數",
    helpTitle: "快速使用說明",
    helpSteps: [
      "先選語言模式，中文模式只接受 104 URL。",
      "在 Resume Entries 建立或匯入中文履歷詞條。",
      "在職位描述區貼上內容或匯入 jd-fetch JSON。",
      "選擇中文模板後按 Generate。",
      "匯出 Markdown，並檢查 Trace JSON 選取理由。",
    ],
    quickStartTitle: "快速開始（3 步）",
    quickStartEntries: "1) 建立詞條",
    quickStartJd: "2) 加入職位描述",
    quickStartGenerate: "3) 產生履歷",
    modeSimple: "簡易模式",
    modeFull: "完整模式",
    experienceBankHint: "Experience Bank：你建立或匯入的詞條都在這裡。",
    stickyLocale: "語言",
    stickyTemplate: "模板",
    stickyJd: "職位描述",
    stickyEntries: "詞條",
    stickyNone: "未選擇",
    panelAdvanced: "進階設定",
    advancedOpen: "展開進階設定",
    advancedClose: "收合進階設定",
    emptyEntriesTitle: "目前還沒有詞條",
    emptyEntriesBody: "先新增一筆，或在進階設定匯入履歷。",
    emptyJdTitle: "目前還沒有職位描述",
    emptyJdBody: "貼上職位描述內容，或匯入 jd-fetch JSON。",
    emptyTemplateTitle: "沒有可用模板",
    emptyTemplateBody: "可在進階設定建立模板，或點「補齊內建模板」。",
    panelEntries: "1) Experience Bank / 履歷詞條",
    labelTitle: "標題",
    labelCategory: "分類",
    labelContent: "內容",
    labelTags: "標籤",
    labelLocale: "語系",
    labelWeight: "權重",
    btnAddEntry: "新增詞條",
    btnDelete: "刪除",
    noTags: "無標籤",
    panelTemplates: "2) 模板庫",
    templatesIntro: "內建起手模板：Reverse Chronological + Hybrid / Combination。",
    btnEnsureStarterTemplates: "補齊內建模板",
    placeholderTemplateName: "模板名稱",
    placeholderTemplateSections: "summary|2|summary",
    btnAddTemplate: "新增模板",
    panelJob: "3) 職位描述",
    jdUrlPlaceholder: "職位描述網址（可選）",
    jdTextPlaceholder: "貼上職位描述內容",
    btnSaveJd: "儲存職位描述（文字）",
    importFromJsonLabel: "從 jd-fetch JSON 匯入：",
    jdJsonPlaceholder: '{"url":"...","text":"..."}',
    btnImportJdJson: "匯入職位描述 JSON",
    selectJdPlaceholder: "選擇職位描述",
    panelImport: "4) 匯入自訂履歷（自動建模板）",
    importResumeIntro: "上傳或貼上履歷 markdown/text，轉為可重用詞條。",
    resumeTextPlaceholder: "在此貼上履歷 markdown/text",
    btnImportResume: "匯入履歷詞條",
    importResumeNote: "系統會自動解析段落結構，建立新的自訂模板並把條列內容加入詞條庫。",
    panelGenerate: "5) 生成履歷",
    btnGenerate: "生成履歷",
    btnExportMarkdown: "匯出 Markdown",
    btnExportObsidianMd: "匯出 Obsidian Markdown",
    btnExportDbJson: "匯出 DB JSON",
    btnImportDbJson: "匯入 DB JSON",
    outputMarkdown: "輸出 Markdown",
    outputTrace: "輸出 Trace JSON",
    storageNoticePersist: "同一台電腦、同一個瀏覽器、同一個網域路徑下，重開頁面資料會保留。",
    storageNoticeLimit: "清瀏覽器資料、換瀏覽器或換裝置後，不會自動帶入原資料。",
    msgStarterTemplatesEnsured: "已補齊內建模板：Reverse Chronological + Hybrid。",
    msgJdImported: "職位描述 JSON 已匯入。",
    msgInvalidJdJson: "職位描述 JSON 格式錯誤。",
    msgNoParsableResume: "找不到可解析的履歷內容。",
    msgImportedResumeCount: (count) => `已匯入 ${count} 筆履歷詞條。`,
    msgUnsupportedFileType: (ext) => `不支援的檔案類型：${ext || "未知"}。`,
    msgFileTooLarge: "檔案過大，最大支援 2 MB。",
    msgUrlSourceMismatch: "URL 來源與語言模式不符（中文模式只接受 104）。",
    msgImportedJdSourceMismatch: "匯入的職位描述網址與語言模式不符。",
    msgTemplateLocaleMismatch: "請選擇與目前語言模式一致的模板。",
    msgSelectedJdSourceMismatch: "所選職位描述來源與目前語言模式不符。",
    msgDbImported: "DB JSON 已匯入並回復。",
    msgInvalidDbJson: "DB JSON 格式錯誤。",
    catSummary: "摘要",
    catExperience: "經歷",
    catProject: "專案",
    catSkill: "技能",
    catAchievement: "成就",
    filterAll: "全部",
    filterExperience: "只看經歷",
    filterSummary: "只看摘要",
    filterProject: "只看專案",
    filterSkill: "只看技能",
    filterAchievement: "只看成就",
    msgTemplateCreated: "已根據匯入履歷建立自訂模板。",
  },
  "en-AU": {
    eyebrow: "Local Resume Intelligence System",
    heroTitle: "Resume Vault",
    heroCopy: "Turn your resume experience into reusable entries and generate tailored resumes from each job description in minutes.",
    langZh: "Chinese Mode",
    langEn: "English Mode",
    helpOpen: "Help",
    helpClose: "Close Help",
    sourceHint: "English mode supports LinkedIn and Seek JD URL sources.",
    statsEntries: "Entries",
    statsTemplates: "Templates",
    statsJobs: "Job Descriptions",
    helpTitle: "Quick Guide",
    helpSteps: [
      "Select language mode; English mode accepts LinkedIn/Seek URLs.",
      "Add or import English resume entries in Resume Entries.",
      "Paste JD text or import jd-fetch JSON in Job Description.",
      "Choose an English template and click Generate.",
      "Export Markdown and review Trace JSON selection reasons.",
    ],
    quickStartTitle: "Quick Start (3 steps)",
    quickStartEntries: "1) Add entries",
    quickStartJd: "2) Add JD",
    quickStartGenerate: "3) Generate",
    modeSimple: "Simple Mode",
    modeFull: "Full Mode",
    experienceBankHint: "Experience Bank: all reusable entries live in this section.",
    stickyLocale: "Locale",
    stickyTemplate: "Template",
    stickyJd: "JD",
    stickyEntries: "Entries",
    stickyNone: "none",
    panelAdvanced: "Advanced",
    advancedOpen: "Open Advanced",
    advancedClose: "Close Advanced",
    emptyEntriesTitle: "No entries yet",
    emptyEntriesBody: "Add your first entry or import a resume in Advanced.",
    emptyJdTitle: "No JD yet",
    emptyJdBody: "Paste JD text or import jd-fetch JSON.",
    emptyTemplateTitle: "No template available",
    emptyTemplateBody: "Create one in Advanced, or click Ensure Starter Templates.",
    panelEntries: "1) Experience Bank / Resume Entries",
    labelTitle: "Title",
    labelCategory: "Category",
    labelContent: "Content",
    labelTags: "Tags",
    labelLocale: "Locale",
    labelWeight: "Weight",
    btnAddEntry: "Add Entry",
    btnDelete: "Delete",
    noTags: "no tags",
    panelTemplates: "2) Template Bank",
    templatesIntro: "Starter templates included: Reverse Chronological + Hybrid / Combination.",
    btnEnsureStarterTemplates: "Ensure Starter Templates",
    placeholderTemplateName: "Template name",
    placeholderTemplateSections: "summary|2|summary",
    btnAddTemplate: "Add Template",
    panelJob: "3) Job Description",
    jdUrlPlaceholder: "JD URL (optional)",
    jdTextPlaceholder: "Paste JD text",
    btnSaveJd: "Save JD from text",
    importFromJsonLabel: "Import from jd-fetch JSON:",
    jdJsonPlaceholder: '{"url":"...","text":"..."}',
    btnImportJdJson: "Import JD JSON",
    selectJdPlaceholder: "Select JD",
    panelImport: "4) Import Custom Resume (Auto Template)",
    importResumeIntro: "Upload or paste resume markdown/text and convert into reusable entries.",
    resumeTextPlaceholder: "Paste resume markdown/text here",
    btnImportResume: "Import Resume to Entries",
    importResumeNote: "The app analyzes heading structure, creates a new custom template, and adds parsed bullets into your entry bank.",
    panelGenerate: "5) Generate Resume",
    btnGenerate: "Generate",
    btnExportMarkdown: "Export Markdown",
    btnExportObsidianMd: "Export Obsidian Markdown",
    btnExportDbJson: "Export DB JSON",
    btnImportDbJson: "Import DB JSON",
    outputMarkdown: "Output Markdown",
    outputTrace: "Trace JSON",
    storageNoticePersist: "On the same computer, browser, and site path, your data persists after reopening.",
    storageNoticeLimit: "Data does not carry over automatically after clearing browser data, switching browser, or switching device.",
    msgStarterTemplatesEnsured: "Starter templates ensured: Reverse Chronological + Hybrid.",
    msgJdImported: "JD JSON imported.",
    msgInvalidJdJson: "Invalid JD JSON format.",
    msgNoParsableResume: "No parsable content found in imported resume.",
    msgImportedResumeCount: (count) => `Imported ${count} entries from custom resume.`,
    msgUnsupportedFileType: (ext) => `Unsupported file type: ${ext || "unknown"}.`,
    msgFileTooLarge: "File too large. Max supported size is 2 MB.",
    msgUrlSourceMismatch: "URL source does not match English mode (LinkedIn/Seek only).",
    msgImportedJdSourceMismatch: "Imported JD URL does not match current language mode.",
    msgTemplateLocaleMismatch: "Please select a template that matches current language mode.",
    msgSelectedJdSourceMismatch: "Selected JD source does not match current language mode.",
    msgDbImported: "DB JSON imported and restored.",
    msgInvalidDbJson: "Invalid DB JSON format.",
    catSummary: "summary",
    catExperience: "experience",
    catProject: "project",
    catSkill: "skill",
    catAchievement: "achievement",
    filterAll: "All",
    filterExperience: "Experience",
    filterSummary: "Summary",
    filterProject: "Projects",
    filterSkill: "Skills",
    filterAchievement: "Achievements",
    msgTemplateCreated: "Created a custom template from imported resume structure.",
  },
};

const starterTemplates: ResumeTemplate[] = [
  {
    id: "starter-reverse-chronological",
    name: "Reverse Chronological (ATS-friendly)",
    locale: "en-AU",
    sections: [
      { name: "summary", maxItems: 2, preferredTags: ["summary", "profile"] },
      { name: "experience", maxItems: 5, preferredTags: ["experience", "work"] },
      { name: "project", maxItems: 2, preferredTags: ["project", "delivery"] },
      { name: "skill", maxItems: 8, preferredTags: ["skill", "tools", "tech"] },
      { name: "achievement", maxItems: 3, preferredTags: ["achievement", "impact"] },
    ],
  },
  {
    id: "starter-hybrid-combination",
    name: "Hybrid / Combination (Skills + Impact)",
    locale: "zh-TW",
    sections: [
      { name: "summary", maxItems: 2, preferredTags: ["summary", "profile"] },
      { name: "skill", maxItems: 10, preferredTags: ["skill", "strength", "domain"] },
      { name: "project", maxItems: 4, preferredTags: ["project", "portfolio"] },
      { name: "experience", maxItems: 4, preferredTags: ["experience", "work"] },
      { name: "achievement", maxItems: 3, preferredTags: ["achievement", "award", "impact"] },
    ],
  },
];

const ensureStarterTemplates = (templates: ResumeTemplate[]): ResumeTemplate[] => {
  const byId = new Map(templates.map((template) => [template.id, template]));
  for (const starter of starterTemplates) {
    if (!byId.has(starter.id)) {
      byId.set(starter.id, starter);
    }
  }

  return Array.from(byId.values());
};

const emptyState = (): StoredState => ({
  entries: [],
  templates: ensureStarterTemplates([]),
  jobs: [],
});

const normalizeState = (state: Partial<StoredState>): StoredState => ({
  entries: Array.isArray(state.entries) ? state.entries : [],
  templates: ensureStarterTemplates(Array.isArray(state.templates) ? state.templates : []),
  jobs: Array.isArray(state.jobs) ? state.jobs : [],
});

const parseJsonSafely = <T,>(input: string): T => {
  return JSON.parse(input, (key, value) => {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error("Unsafe JSON key detected");
    }

    return value;
  }) as T;
};

const getFileExtension = (fileName: string): string => {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex === -1 ? "" : fileName.slice(dotIndex).toLowerCase();
};

const isAllowedJdDomain = (rawUrl: string, locale: AppLocale): boolean => {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return JD_ALLOWED_DOMAINS[locale].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
};

const safeParse = (): StoredState => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return emptyState();
  }

  try {
    const parsed = parseJsonSafely<Partial<StoredState>>(raw);
    return normalizeState(parsed);
  } catch {
    return emptyState();
  }
};

const persist = (state: StoredState): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const uid = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const parseSections = (input: string): TemplateSection[] => {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [namePart, maxPart, tagsPart] = line.split("|");
      return {
        name: (namePart ?? "experience").trim(),
        maxItems: Number(maxPart ?? 3),
        preferredTags: (tagsPart ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
    })
    .filter((section) => Number.isFinite(section.maxItems) && section.maxItems > 0);
};

const normalizeHeading = (heading: string): string => heading.toLowerCase().replace(/[^a-z\u4e00-\u9fff]+/g, "").trim();

const headingToCategory = (heading: string): ResumeEntry["category"] => {
  const normalized = normalizeHeading(heading);

  if (normalized.includes("summary") || normalized.includes("profile") || normalized.includes("自我") || normalized.includes("摘要")) {
    return "summary";
  }

  if (normalized.includes("experience") || normalized.includes("work") || normalized.includes("經歷") || normalized.includes("工作")) {
    return "experience";
  }

  if (normalized.includes("project") || normalized.includes("作品") || normalized.includes("專案")) {
    return "project";
  }

  if (normalized.includes("skill") || normalized.includes("技能") || normalized.includes("專長")) {
    return "skill";
  }

  if (normalized.includes("achievement") || normalized.includes("award") || normalized.includes("成就") || normalized.includes("獎")) {
    return "achievement";
  }

  return "experience";
};

const parseImportedResume = (text: string, locale: ResumeEntry["locale"]): ResumeEntry[] => {
  const lines = text.split(/\r?\n/);
  let currentHeading = "Imported";
  let currentCategory: ResumeEntry["category"] = "experience";
  const importedAt = new Date().toISOString();
  const items: ResumeEntry[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      currentHeading = headingMatch[1].trim();
      currentCategory = headingToCategory(currentHeading);
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/) ?? line.match(/^\d+\.\s+(.+)$/);
    const content = (bulletMatch ? bulletMatch[1] : line).trim();
    if (!content) {
      continue;
    }

    items.push({
      id: uid(),
      category: currentCategory,
      title: currentHeading,
      content,
      locale,
      tags: ["imported", "custom-resume", currentCategory],
      weight: 1,
      updatedAt: importedAt,
    });
  }

  return items;
};

const categoryLabelForTemplate = (category: ResumeEntry["category"]): string => {
  switch (category) {
    case "summary":
      return "summary";
    case "experience":
      return "experience";
    case "project":
      return "project";
    case "skill":
      return "skill";
    case "achievement":
      return "achievement";
    default:
      return "experience";
  }
};

const createTemplateFromImportedEntries = (
  importedEntries: ResumeEntry[],
  locale: AppLocale,
): ResumeTemplate => {
  const counts = new Map<ResumeEntry["category"], number>();
  const order: ResumeEntry["category"][] = [];

  for (const entry of importedEntries) {
    if (!counts.has(entry.category)) {
      counts.set(entry.category, 0);
      order.push(entry.category);
    }
    counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  }

  const sections: TemplateSection[] = order.map((category) => ({
    name: categoryLabelForTemplate(category),
    maxItems: Math.max(1, Math.min(8, counts.get(category) ?? 1)),
    preferredTags: [category],
  }));

  return {
    id: uid(),
    name: locale === "zh-TW" ? `custom-zh-${new Date().toISOString().slice(0, 10)}` : `custom-en-${new Date().toISOString().slice(0, 10)}`,
    locale,
    sections,
  };
};

const initialState = safeParse();

const App = () => {
  const [entries, setEntries] = useState<ResumeEntry[]>(initialState.entries);
  const [templates, setTemplates] = useState<ResumeTemplate[]>(initialState.templates);
  const [jobs, setJobs] = useState<JobDescription[]>(initialState.jobs);
  const [activeLocale, setActiveLocale] = useState<AppLocale>("zh-TW");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialState.templates[0]?.id ?? starterTemplates[0].id);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [showHelp, setShowHelp] = useState(false);
  const [simpleMode, setSimpleMode] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [entryTitle, setEntryTitle] = useState("");
  const [entryContent, setEntryContent] = useState("");
  const [entryTags, setEntryTags] = useState("");
  const [entryCategory, setEntryCategory] = useState<ResumeEntry["category"]>("experience");
  const [entryLocale, setEntryLocale] = useState<ResumeEntry["locale"]>("zh-TW");
  const [entryWeight, setEntryWeight] = useState(1);

  const [templateName, setTemplateName] = useState("base-custom");
  const [templateLocale, setTemplateLocale] = useState<ResumeTemplate["locale"]>("zh-TW");
  const [templateSections, setTemplateSections] = useState("summary|2|summary\nexperience|4|experience\nproject|3|project\nskill|5|skill\nachievement|2|achievement");

  const [jdText, setJdText] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [jdJson, setJdJson] = useState("");
  const [generatedMd, setGeneratedMd] = useState("");
  const [traceJson, setTraceJson] = useState("[]");

  const [customResumeText, setCustomResumeText] = useState("");
  const [customResumeLocale, setCustomResumeLocale] = useState<ResumeEntry["locale"]>("zh-TW");
  const [entryFilter, setEntryFilter] = useState<"all" | ResumeEntry["category"]>("all");
  const [importMessage, setImportMessage] = useState("");
  const [importTone, setImportTone] = useState<StatusTone>("success");
  const dbImportInputRef = useRef<HTMLInputElement | null>(null);

  const text = UI_TEXT[activeLocale];

  const localeEntries = useMemo(() => entries.filter((entry) => entry.locale === activeLocale), [entries, activeLocale]);
  const visibleEntries = useMemo(
    () => (entryFilter === "all" ? localeEntries : localeEntries.filter((entry) => entry.category === entryFilter)),
    [entryFilter, localeEntries],
  );
  const localeTemplates = useMemo(() => templates.filter((template) => template.locale === activeLocale), [templates, activeLocale]);
  const localeJobs = useMemo(() => {
    if (activeLocale === "zh-TW") {
      return jobs.filter((job) => !job.sourceUrl || isAllowedJdDomain(job.sourceUrl, "zh-TW"));
    }
    return jobs.filter((job) => !job.sourceUrl || isAllowedJdDomain(job.sourceUrl, "en-AU"));
  }, [jobs, activeLocale]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId),
    [templates, selectedTemplateId],
  );

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId), [jobs, selectedJobId]);

  const setStatus = (message: string, tone: StatusTone): void => {
    setImportMessage(message);
    setImportTone(tone);
  };

  const jumpToSection = (id: string): void => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    setEntryLocale(activeLocale);
    setTemplateLocale(activeLocale);
    setCustomResumeLocale(activeLocale);
  }, [activeLocale]);

  useEffect(() => {
    const fallbackTemplate = localeTemplates[0];
    if (!selectedTemplate || selectedTemplate.locale !== activeLocale) {
      setSelectedTemplateId(fallbackTemplate?.id ?? "");
    }
    if (selectedJobId && !localeJobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(localeJobs[0]?.id ?? "");
    }
  }, [activeLocale, localeTemplates, localeJobs, selectedTemplate, selectedJobId]);

  useEffect(() => {
    if (!importMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setImportMessage("");
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [importMessage]);

  const writeState = (next: StoredState) => {
    persist(next);
    setEntries(next.entries);
    setTemplates(next.templates);
    setJobs(next.jobs);
  };

  const addEntry = () => {
    if (!entryTitle.trim() || !entryContent.trim()) {
      return;
    }

    const newEntry: ResumeEntry = {
      id: uid(),
      category: entryCategory,
      title: entryTitle.trim(),
      content: entryContent.trim(),
      locale: entryLocale,
      tags: entryTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      weight: entryWeight,
      updatedAt: new Date().toISOString(),
    };

    writeState({ entries: [newEntry, ...entries], templates, jobs });
    setEntryTitle("");
    setEntryContent("");
    setEntryTags("");
    setEntryWeight(1);
  };

  const removeEntry = (id: string) => {
    writeState({ entries: entries.filter((entry) => entry.id !== id), templates, jobs });
  };

  const installStarterTemplates = () => {
    const nextTemplates = ensureStarterTemplates(templates);
    writeState({ entries, templates: nextTemplates, jobs });
    setStatus(text.msgStarterTemplatesEnsured, "success");
  };

  const addTemplate = () => {
    const parsedSections = parseSections(templateSections);
    if (!templateName.trim() || parsedSections.length === 0) {
      return;
    }

    const template: ResumeTemplate = {
      id: uid(),
      name: templateName.trim(),
      locale: templateLocale,
      sections: parsedSections,
    };

    const nextTemplates = [template, ...templates];
    writeState({ entries, templates: nextTemplates, jobs });
    setSelectedTemplateId(template.id);
  };

  const addJobFromPaste = () => {
    if (!jdText.trim()) {
      return;
    }

    const normalizedUrl = jdUrl.trim();
    if (normalizedUrl && !isAllowedJdDomain(normalizedUrl, activeLocale)) {
      setStatus(text.msgUrlSourceMismatch, "error");
      return;
    }

    const jd: JobDescription = {
      id: uid(),
      sourceType: normalizedUrl ? "url" : "paste",
      sourceUrl: normalizedUrl || undefined,
      rawText: jdText.trim(),
      createdAt: new Date().toISOString(),
    };

    const nextJobs = [jd, ...jobs];
    writeState({ entries, templates, jobs: nextJobs });
    setSelectedJobId(jd.id);
    setJdText("");
    setJdUrl("");
  };

  const importJobJson = () => {
    try {
      const parsed = parseJsonSafely<{ text?: string; url?: string }>(jdJson);
      if (!parsed.text?.trim()) {
        return;
      }
      if (parsed.url && !isAllowedJdDomain(parsed.url, activeLocale)) {
        setStatus(text.msgImportedJdSourceMismatch, "error");
        return;
      }

      const jd: JobDescription = {
        id: uid(),
        sourceType: parsed.url ? "url" : "paste",
        sourceUrl: parsed.url,
        rawText: parsed.text,
        createdAt: new Date().toISOString(),
      };

      const nextJobs = [jd, ...jobs];
      writeState({ entries, templates, jobs: nextJobs });
      setSelectedJobId(jd.id);
      setJdJson("");
      setStatus(text.msgJdImported, "success");
    } catch {
      setStatus(text.msgInvalidJdJson, "error");
    }
  };

  const importCustomResume = () => {
    if (!customResumeText.trim()) {
      return;
    }

    const importedEntries = parseImportedResume(customResumeText, customResumeLocale);
    if (importedEntries.length === 0) {
      setStatus(text.msgNoParsableResume, "error");
      return;
    }

    const derivedTemplate = createTemplateFromImportedEntries(importedEntries, customResumeLocale);
    const nextTemplates = [derivedTemplate, ...templates];
    writeState({ entries: [...importedEntries, ...entries], templates: nextTemplates, jobs });
    setSelectedTemplateId(derivedTemplate.id);
    setStatus(`${text.msgImportedResumeCount(importedEntries.length)} ${text.msgTemplateCreated}`, "success");
  };

  const readUploadedText = async (
    event: ChangeEvent<HTMLInputElement>,
    setter: (value: string) => void,
    allowedExtensions: Set<string>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const extension = getFileExtension(file.name);
    if (!allowedExtensions.has(extension)) {
      setStatus(text.msgUnsupportedFileType(extension || "unknown"), "error");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setStatus(text.msgFileTooLarge, "error");
      event.target.value = "";
      return;
    }

    const textContent = await file.text();
    setter(textContent);
    event.target.value = "";
  };

  const runGenerate = () => {
    if (!selectedTemplate || !selectedJob) {
      return;
    }
    if (selectedTemplate.locale !== activeLocale) {
      setStatus(text.msgTemplateLocaleMismatch, "error");
      return;
    }
    if (selectedJob.sourceUrl && !isAllowedJdDomain(selectedJob.sourceUrl, activeLocale)) {
      setStatus(text.msgSelectedJdSourceMismatch, "error");
      return;
    }

    const result = generateResume(selectedJob, localeEntries, selectedTemplate);
    setGeneratedMd(result.outputMd);
    setTraceJson(JSON.stringify(result.trace, null, 2));
  };

  const exportState = () => {
    const blob = new Blob([JSON.stringify({ entries, templates, jobs }, null, 2)], { type: "application/json" });
    downloadBlob(blob, "resume-vault-data.json");
  };

  const downloadBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = () => {
    const blob = new Blob([generatedMd], { type: "text/markdown" });
    downloadBlob(blob, "tailored-resume.md");
  };

  const exportObsidianMarkdown = () => {
    if (!generatedMd) {
      return;
    }

    const now = new Date();
    const output = buildObsidianMarkdown({
      body: generatedMd,
      locale: activeLocale,
      template: selectedTemplate,
      job: selectedJob,
      now,
    });
    const blob = new Blob([output], { type: "text/markdown" });
    downloadBlob(blob, buildObsidianFilename(now));
  };

  const importStateFromFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const raw = await file.text();
      const parsed = parseJsonSafely<Partial<StoredState>>(raw);
      const restored = normalizeState(parsed);
      writeState(restored);
      setSelectedTemplateId(restored.templates[0]?.id ?? "");
      setSelectedJobId(restored.jobs[0]?.id ?? "");
      setStatus(text.msgDbImported, "success");
    } catch {
      setStatus(text.msgInvalidDbJson, "error");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <main className="layout">
      <header className="hero">
        <p className="eyebrow">{text.eyebrow}</p>
        <h1>{text.heroTitle}</h1>
        <p className="hero-copy">{text.heroCopy}</p>
        <div className="top-controls">
          <div className="locale-switch" role="tablist" aria-label="Language mode">
            <button className={activeLocale === "zh-TW" ? "chip active" : "chip"} onClick={() => setActiveLocale("zh-TW")} role="tab">
              {text.langZh}
            </button>
            <button className={activeLocale === "en-AU" ? "chip active" : "chip"} onClick={() => setActiveLocale("en-AU")} role="tab">
              {text.langEn}
            </button>
          </div>
          <div className="mode-switch" role="tablist" aria-label="Display mode">
            <button
              className={simpleMode ? "chip active" : "chip"}
              onClick={() => {
                setSimpleMode(true);
                setShowAdvanced(false);
              }}
              role="tab"
            >
              {text.modeSimple}
            </button>
            <button
              className={!simpleMode ? "chip active" : "chip"}
              onClick={() => {
                setSimpleMode(false);
                setShowAdvanced(true);
              }}
              role="tab"
            >
              {text.modeFull}
            </button>
          </div>
          <button className="help-btn" onClick={() => setShowHelp((current) => !current)} aria-expanded={showHelp}>
            {showHelp ? text.helpClose : text.helpOpen}
          </button>
        </div>
        <p className="source-hint">{text.sourceHint}</p>
        <p className="storage-note">{text.storageNoticePersist}</p>
        <p className="storage-note">{text.storageNoticeLimit}</p>
        <div className="quick-start">
          <strong>{text.quickStartTitle}</strong>
          <div className="quick-actions">
            <button className="chip" onClick={() => jumpToSection("entries-section")}>{text.quickStartEntries}</button>
            <button className="chip" onClick={() => jumpToSection("jd-section")}>{text.quickStartJd}</button>
            <button className="chip" onClick={() => jumpToSection("generate-section")}>{text.quickStartGenerate}</button>
          </div>
        </div>
        <div className="stat-row">
          <article className="stat-card">
            <span>{text.statsEntries}</span>
            <strong>{localeEntries.length}</strong>
          </article>
          <article className="stat-card">
            <span>{text.statsTemplates}</span>
            <strong>{localeTemplates.length}</strong>
          </article>
          <article className="stat-card">
            <span>{text.statsJobs}</span>
            <strong>{localeJobs.length}</strong>
          </article>
        </div>
      </header>

      <section className="sticky-summary">
        <span><strong>{text.stickyLocale}:</strong> {activeLocale}</span>
        <span><strong>{text.stickyTemplate}:</strong> {selectedTemplate?.name ?? text.stickyNone}</span>
        <span>
          <strong>{text.stickyJd}:</strong>{" "}
          {selectedJob ? new Date(selectedJob.createdAt).toLocaleString() : text.stickyNone}
        </span>
        <span><strong>{text.stickyEntries}:</strong> {localeEntries.length}</span>
      </section>

      {importMessage ? <p className={`import-status ${importTone === "error" ? "is-error" : "is-success"}`}>{importMessage}</p> : null}

      {showHelp ? (
        <section className="panel panel-wide help-panel">
          <h2>{text.helpTitle}</h2>
          <ol className="help-list">
            {text.helpSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="board">
        <section className="panel panel-wide" id="entries-section">
          <h2>{text.panelEntries}</h2>
          <p>{text.experienceBankHint}</p>
          <div className="grid two">
            <input aria-label={text.labelTitle} value={entryTitle} onChange={(event) => setEntryTitle(event.target.value)} placeholder={text.labelTitle} />
            <select aria-label={text.labelCategory} value={entryCategory} onChange={(event) => setEntryCategory(event.target.value as ResumeEntry["category"])}>
              <option value="summary">{text.catSummary}</option>
              <option value="experience">{text.catExperience}</option>
              <option value="project">{text.catProject}</option>
              <option value="skill">{text.catSkill}</option>
              <option value="achievement">{text.catAchievement}</option>
            </select>
          </div>
          <textarea aria-label={text.labelContent} value={entryContent} onChange={(event) => setEntryContent(event.target.value)} placeholder={text.labelContent} rows={3} />
          <div className="grid three">
            <input aria-label={text.labelTags} value={entryTags} onChange={(event) => setEntryTags(event.target.value)} placeholder={text.labelTags} />
            <select aria-label={text.labelLocale} value={entryLocale} onChange={(event) => setEntryLocale(event.target.value as ResumeEntry["locale"])}>
              <option value="zh-TW">zh-TW</option>
              <option value="en-AU">en-AU</option>
            </select>
            <input
              aria-label={text.labelWeight}
              type="number"
              value={entryWeight}
              onChange={(event) => setEntryWeight(Number(event.target.value || 1))}
              placeholder={text.labelWeight}
            />
          </div>
          <button className="btn-primary" onClick={addEntry}>{text.btnAddEntry}</button>
          <div className="entry-filters">
            <button className={entryFilter === "all" ? "chip active" : "chip"} onClick={() => setEntryFilter("all")}>
              {text.filterAll}
            </button>
            <button className={entryFilter === "experience" ? "chip active" : "chip"} onClick={() => setEntryFilter("experience")}>
              {text.filterExperience}
            </button>
            <button className={entryFilter === "summary" ? "chip active" : "chip"} onClick={() => setEntryFilter("summary")}>
              {text.filterSummary}
            </button>
            <button className={entryFilter === "project" ? "chip active" : "chip"} onClick={() => setEntryFilter("project")}>
              {text.filterProject}
            </button>
            <button className={entryFilter === "skill" ? "chip active" : "chip"} onClick={() => setEntryFilter("skill")}>
              {text.filterSkill}
            </button>
            <button className={entryFilter === "achievement" ? "chip active" : "chip"} onClick={() => setEntryFilter("achievement")}>
              {text.filterAchievement}
            </button>
          </div>
          {visibleEntries.length === 0 ? (
            <div className="empty-state">
              <strong>{text.emptyEntriesTitle}</strong>
              <p>{text.emptyEntriesBody}</p>
            </div>
          ) : (
            <ul>
              {visibleEntries.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.title}</strong> [{entry.category}] ({entry.locale})
                  <div>{entry.content}</div>
                  <small>{entry.tags.join(", ") || text.noTags}</small>
                  <button className="btn-danger" onClick={() => removeEntry(entry.id)}>{text.btnDelete}</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" id="jd-section">
          <h2>{text.panelJob}</h2>
          <input aria-label={text.jdUrlPlaceholder} value={jdUrl} onChange={(event) => setJdUrl(event.target.value)} placeholder={text.jdUrlPlaceholder} />
          <textarea aria-label={text.jdTextPlaceholder} value={jdText} onChange={(event) => setJdText(event.target.value)} placeholder={text.jdTextPlaceholder} rows={6} />
          <button className="btn-primary" onClick={addJobFromPaste}>{text.btnSaveJd}</button>
          <p>{text.importFromJsonLabel}</p>
          <textarea
            value={jdJson}
            onChange={(event) => setJdJson(event.target.value)}
            placeholder={text.jdJsonPlaceholder}
            rows={4}
          />
          <button className="btn-secondary" onClick={importJobJson}>{text.btnImportJdJson}</button>
          <select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)}>
            <option value="">{text.selectJdPlaceholder}</option>
            {localeJobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.sourceType} {job.sourceUrl ? `- ${job.sourceUrl}` : ""} ({new Date(job.createdAt).toLocaleString()})
              </option>
            ))}
          </select>
          {localeJobs.length === 0 ? (
            <div className="empty-state">
              <strong>{text.emptyJdTitle}</strong>
              <p>{text.emptyJdBody}</p>
            </div>
          ) : null}
        </section>

        <section className="panel panel-wide" id="generate-section">
          <h2>{text.panelGenerate}</h2>
          <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
            <option value="">{text.emptyTemplateTitle}</option>
            {localeTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.locale})
              </option>
            ))}
          </select>
          {localeTemplates.length === 0 ? (
            <div className="empty-state">
              <strong>{text.emptyTemplateTitle}</strong>
              <p>{text.emptyTemplateBody}</p>
            </div>
          ) : null}
          <div className="actions">
            <button className="btn-primary" onClick={runGenerate}>{text.btnGenerate}</button>
            <button className="btn-secondary" onClick={exportMarkdown} disabled={!generatedMd}>{text.btnExportMarkdown}</button>
            <button className="btn-secondary" onClick={exportObsidianMarkdown} disabled={!generatedMd}>{text.btnExportObsidianMd}</button>
            <button className="btn-secondary" onClick={exportState}>{text.btnExportDbJson}</button>
            <button className="btn-secondary" onClick={() => dbImportInputRef.current?.click()}>{text.btnImportDbJson}</button>
          </div>
          <input
            ref={dbImportInputRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(event) => {
              void importStateFromFile(event);
            }}
          />
          <h3>{text.outputMarkdown}</h3>
          <textarea value={generatedMd} readOnly rows={14} />
          <h3>{text.outputTrace}</h3>
          <textarea value={traceJson} readOnly rows={10} />
        </section>

        <section className="panel panel-wide advanced-panel" id="advanced-section">
          <div className="advanced-header">
            <h2>{text.panelAdvanced}</h2>
            <button className="btn-secondary" onClick={() => setShowAdvanced((current) => !current)}>
              {showAdvanced ? text.advancedClose : text.advancedOpen}
            </button>
          </div>
          {showAdvanced ? (
            <div className="advanced-grid">
              <section className="panel nested-panel">
                <h2>{text.panelTemplates}</h2>
                <p>{text.templatesIntro}</p>
                <button className="btn-secondary" onClick={installStarterTemplates}>{text.btnEnsureStarterTemplates}</button>
                <div className="grid two">
                  <input aria-label={text.placeholderTemplateName} value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder={text.placeholderTemplateName} />
                  <select aria-label={text.labelLocale} value={templateLocale} onChange={(event) => setTemplateLocale(event.target.value as ResumeTemplate["locale"])}>
                    <option value="zh-TW">zh-TW</option>
                    <option value="en-AU">en-AU</option>
                  </select>
                </div>
                <textarea
                  rows={5}
                  value={templateSections}
                  onChange={(event) => setTemplateSections(event.target.value)}
                  placeholder={text.placeholderTemplateSections}
                />
                <button className="btn-primary" onClick={addTemplate}>{text.btnAddTemplate}</button>
              </section>

              <section className="panel nested-panel">
                <h2>{text.panelImport}</h2>
                <p>{text.importResumeIntro}</p>
                <p>{text.importResumeNote}</p>
                <select value={customResumeLocale} onChange={(event) => setCustomResumeLocale(event.target.value as ResumeEntry["locale"])}>
                  <option value="zh-TW">zh-TW</option>
                  <option value="en-AU">en-AU</option>
                </select>
                <input
                  type="file"
                  accept=".md,.txt,text/markdown,text/plain"
                  onChange={(event) => {
                    void readUploadedText(event, setCustomResumeText, ALLOWED_RESUME_EXTENSIONS);
                  }}
                />
                <textarea
                  value={customResumeText}
                  onChange={(event) => setCustomResumeText(event.target.value)}
                  placeholder={text.resumeTextPlaceholder}
                  rows={8}
                />
                <button className="btn-primary" onClick={importCustomResume}>{text.btnImportResume}</button>
              </section>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
};

export default App;
