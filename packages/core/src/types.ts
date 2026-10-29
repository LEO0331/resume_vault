export type EntryCategory = "summary" | "experience" | "project" | "skill" | "achievement" | "education";

/** Optional fields keep existing v1 banks and three-argument generation compatible. */
export interface ResumeProfile {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
  contactLine?: string;
}

export interface ResumeEntry {
  id: string;
  category: EntryCategory;
  title: string;
  content: string;
  locale: "zh-TW" | "en-AU";
  tags: string[];
  weight: number;
  updatedAt: string;
  organization?: string;
  position?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  /** ID of the experience entry associated with a project. */
  parentId?: string;
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
  matchedTokens?: string[];
  priorityMatchedTokens?: string[];
  missingPriorityTokens?: string[];
}

export type MatchDecision = "apply" | "apply_with_gaps" | "stretch";

export interface MatchGapItem {
  token: string;
  priority: "high" | "medium";
}

export interface MatchReport {
  coverageScore: number;
  decision: MatchDecision;
  strengths: string[];
  gaps: MatchGapItem[];
}

export interface GeneratedResume {
  outputMd: string;
  trace: MatchTraceItem[];
  matchReport?: MatchReport;
}

export interface GeneratedCoverLetter {
  outputMd: string;
  trace: MatchTraceItem[];
  matchReport?: MatchReport;
}
