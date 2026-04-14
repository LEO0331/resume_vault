export type EntryCategory = "summary" | "experience" | "project" | "skill" | "achievement";

export interface ResumeEntry {
  id: string;
  category: EntryCategory;
  title: string;
  content: string;
  locale: "zh-TW" | "en-AU";
  tags: string[];
  weight: number;
  updatedAt: string;
}

export interface TemplateSection {
  name: string;
  maxItems: number;
  preferredTags?: string[];
}

export interface ResumeTemplate {
  id: string;
  name: string;
  locale: "zh-TW" | "en-AU";
  sections: TemplateSection[];
}

export interface JobDescription {
  id: string;
  sourceType: "paste" | "url";
  sourceUrl?: string;
  rawText: string;
  createdAt: string;
}

export interface MatchTraceItem {
  entryId: string;
  score: number;
  reasons: string[];
}

export interface GeneratedResume {
  outputMd: string;
  trace: MatchTraceItem[];
}
