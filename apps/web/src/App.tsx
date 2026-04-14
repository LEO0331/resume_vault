import { generateResume, type JobDescription, type ResumeEntry, type ResumeTemplate, type TemplateSection } from "@resume-vault/core";
import { useMemo, useState, type ChangeEvent } from "react";

type StoredState = {
  entries: ResumeEntry[];
  templates: ResumeTemplate[];
  jobs: JobDescription[];
};

const STORAGE_KEY = "resume-vault/state/v1";
const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_RESUME_EXTENSIONS = new Set([".md", ".txt"]);
const ALLOWED_STATE_EXTENSIONS = new Set([".json"]);

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

const initialState = safeParse();

const App = () => {
  const [entries, setEntries] = useState<ResumeEntry[]>(initialState.entries);
  const [templates, setTemplates] = useState<ResumeTemplate[]>(initialState.templates);
  const [jobs, setJobs] = useState<JobDescription[]>(initialState.jobs);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialState.templates[0]?.id ?? starterTemplates[0].id);
  const [selectedJobId, setSelectedJobId] = useState<string>("");

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
  const [dbJsonText, setDbJsonText] = useState("");
  const [importMessage, setImportMessage] = useState("");

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates[0],
    [templates, selectedTemplateId],
  );

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId), [jobs, selectedJobId]);

  const writeState = (next: StoredState) => {
    persist(next);
    setEntries(next.entries);
    setTemplates(next.templates);
    setJobs(next.jobs);

    if (!next.templates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(next.templates[0]?.id ?? starterTemplates[0].id);
    }

    if (!next.jobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId("");
    }
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
    setImportMessage("Starter templates ensured: Reverse Chronological + Hybrid.");
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

    const jd: JobDescription = {
      id: uid(),
      sourceType: jdUrl.trim() ? "url" : "paste",
      sourceUrl: jdUrl.trim() || undefined,
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
      setImportMessage("JD JSON imported.");
    } catch {
      setImportMessage("Invalid JD JSON format.");
    }
  };

  const importCustomResume = () => {
    if (!customResumeText.trim()) {
      return;
    }

    const importedEntries = parseImportedResume(customResumeText, customResumeLocale);
    if (importedEntries.length === 0) {
      setImportMessage("No parsable content found in imported resume.");
      return;
    }

    writeState({ entries: [...importedEntries, ...entries], templates, jobs });
    setImportMessage(`Imported ${importedEntries.length} entries from custom resume.`);
  };

  const importStateJson = (mode: "merge" | "replace") => {
    try {
      const parsed = normalizeState(parseJsonSafely<Partial<StoredState>>(dbJsonText));
      const nextState: StoredState =
        mode === "replace"
          ? parsed
          : {
              entries: [...parsed.entries, ...entries],
              templates: ensureStarterTemplates([...parsed.templates, ...templates]),
              jobs: [...parsed.jobs, ...jobs],
            };

      writeState(nextState);
      setImportMessage(`State JSON ${mode} completed.`);
    } catch {
      setImportMessage("Invalid state JSON format.");
    }
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
      setImportMessage(`Unsupported file type: ${extension || "unknown"}.`);
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setImportMessage("File too large. Max supported size is 2 MB.");
      event.target.value = "";
      return;
    }

    const text = await file.text();
    setter(text);
    event.target.value = "";
  };

  const runGenerate = () => {
    if (!selectedTemplate || !selectedJob) {
      return;
    }

    const result = generateResume(selectedJob, entries, selectedTemplate);
    setGeneratedMd(result.outputMd);
    setTraceJson(JSON.stringify(result.trace, null, 2));
  };

  const exportState = () => {
    const blob = new Blob([JSON.stringify({ entries, templates, jobs }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "resume-vault-data.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = () => {
    const blob = new Blob([generatedMd], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tailored-resume.md";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="layout">
      <header className="hero">
        <p className="eyebrow">Local Resume Intelligence System</p>
        <h1>Resume Vault</h1>
        <p className="hero-copy">GitHub Pages-ready local resume database with JD matching and custom import workflows.</p>
        <div className="stat-row">
          <article className="stat-card">
            <span>Entries</span>
            <strong>{entries.length}</strong>
          </article>
          <article className="stat-card">
            <span>Templates</span>
            <strong>{templates.length}</strong>
          </article>
          <article className="stat-card">
            <span>Job Descriptions</span>
            <strong>{jobs.length}</strong>
          </article>
        </div>
      </header>

      <div className="board">
        <section className="panel panel-wide">
          <h2>1) Resume Entries</h2>
          <div className="grid two">
            <input value={entryTitle} onChange={(event) => setEntryTitle(event.target.value)} placeholder="Title" />
            <select value={entryCategory} onChange={(event) => setEntryCategory(event.target.value as ResumeEntry["category"])}>
              <option value="summary">summary</option>
              <option value="experience">experience</option>
              <option value="project">project</option>
              <option value="skill">skill</option>
              <option value="achievement">achievement</option>
            </select>
          </div>
          <textarea value={entryContent} onChange={(event) => setEntryContent(event.target.value)} placeholder="Content" rows={3} />
          <div className="grid three">
            <input value={entryTags} onChange={(event) => setEntryTags(event.target.value)} placeholder="tags: react,typescript,api" />
            <select value={entryLocale} onChange={(event) => setEntryLocale(event.target.value as ResumeEntry["locale"])}>
              <option value="zh-TW">zh-TW</option>
              <option value="en-AU">en-AU</option>
            </select>
            <input
              type="number"
              value={entryWeight}
              onChange={(event) => setEntryWeight(Number(event.target.value || 1))}
              placeholder="weight"
            />
          </div>
          <button className="btn-primary" onClick={addEntry}>Add Entry</button>
          <ul>
            {entries.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.title}</strong> [{entry.category}] ({entry.locale})
                <div>{entry.content}</div>
                <small>{entry.tags.join(", ") || "no tags"}</small>
                <button className="btn-danger" onClick={() => removeEntry(entry.id)}>Delete</button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>2) Template Bank</h2>
          <p>Starter templates included: Reverse Chronological + Hybrid / Combination.</p>
          <button className="btn-secondary" onClick={installStarterTemplates}>Ensure Starter Templates</button>
          <div className="grid two">
            <input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" />
            <select value={templateLocale} onChange={(event) => setTemplateLocale(event.target.value as ResumeTemplate["locale"])}>
              <option value="zh-TW">zh-TW</option>
              <option value="en-AU">en-AU</option>
            </select>
          </div>
          <textarea
            rows={5}
            value={templateSections}
            onChange={(event) => setTemplateSections(event.target.value)}
            placeholder="summary|2|summary"
          />
          <button className="btn-primary" onClick={addTemplate}>Add Template</button>
          <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.locale})
              </option>
            ))}
          </select>
        </section>

        <section className="panel">
          <h2>3) Job Description</h2>
          <input value={jdUrl} onChange={(event) => setJdUrl(event.target.value)} placeholder="JD URL (optional)" />
          <textarea value={jdText} onChange={(event) => setJdText(event.target.value)} placeholder="Paste JD text" rows={6} />
          <button className="btn-primary" onClick={addJobFromPaste}>Save JD from text</button>
          <p>Import from jd-fetch JSON:</p>
          <textarea
            value={jdJson}
            onChange={(event) => setJdJson(event.target.value)}
            placeholder='{"url":"...","text":"..."}'
            rows={4}
          />
          <button className="btn-secondary" onClick={importJobJson}>Import JD JSON</button>
          <select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)}>
            <option value="">Select JD</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.sourceType} {job.sourceUrl ? `- ${job.sourceUrl}` : ""} ({new Date(job.createdAt).toLocaleString()})
              </option>
            ))}
          </select>
        </section>

        <section className="panel panel-wide">
          <h2>4) Import Custom Resume / DB</h2>
          <p>Upload custom resume markdown/text and convert into reusable entries.</p>
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
            placeholder="Paste resume markdown/text here"
            rows={8}
          />
          <button className="btn-primary" onClick={importCustomResume}>Import Resume to Entries</button>

          <hr />
          <p>Import external state JSON exported from another user/device.</p>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              void readUploadedText(event, setDbJsonText, ALLOWED_STATE_EXTENSIONS);
            }}
          />
          <textarea
            value={dbJsonText}
            onChange={(event) => setDbJsonText(event.target.value)}
            placeholder='{"entries":[],"templates":[],"jobs":[]}'
            rows={6}
          />
          <div className="actions two-actions">
            <button className="btn-secondary" onClick={() => importStateJson("merge")}>Import State (Merge)</button>
            <button className="btn-danger" onClick={() => importStateJson("replace")}>Import State (Replace)</button>
          </div>
          {importMessage ? <p className="import-status">{importMessage}</p> : null}
        </section>

        <section className="panel panel-wide">
          <h2>5) Generate Resume</h2>
          <div className="actions">
            <button className="btn-primary" onClick={runGenerate}>Generate</button>
            <button className="btn-secondary" onClick={exportMarkdown} disabled={!generatedMd}>Export Markdown</button>
            <button className="btn-secondary" onClick={exportState}>Export DB JSON</button>
          </div>
          <h3>Output Markdown</h3>
          <textarea value={generatedMd} readOnly rows={14} />
          <h3>Trace JSON</h3>
          <textarea value={traceJson} readOnly rows={10} />
        </section>
      </div>
    </main>
  );
};

export default App;
