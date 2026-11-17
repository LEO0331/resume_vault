import type { JobDescription, ResumeEntry, ResumeProfile, ResumeTemplate } from "@resume-vault/core";
import { ensureStarterTemplates } from "./template-presets";

export type StoredState = {
  entries: ResumeEntry[];
  templates: ResumeTemplate[];
  jobs: JobDescription[];
  profile: ResumeProfile;
};

const profileFields = ["name", "email", "phone", "location", "linkedin", "website", "contactLine"] as const;
const entryCategories = new Set(["summary", "experience", "project", "skill", "achievement", "education"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isLocale = (value: unknown) => value === "zh-TW" || value === "en-AU";
const isString = (value: unknown): value is string => typeof value === "string";
const isOptionalString = (value: unknown) => value === undefined || isString(value);
const isStringList = (value: unknown) => Array.isArray(value) && value.every(isString);
const isFiniteNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value);

const isEntry = (value: unknown): value is ResumeEntry =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.category) && entryCategories.has(value.category) &&
  isString(value.title) &&
  isString(value.content) &&
  isLocale(value.locale) &&
  isStringList(value.tags) &&
  isFiniteNumber(value.weight) &&
  isString(value.updatedAt) &&
  ["organization", "position", "startDate", "endDate", "location", "parentId"]
    .every((key) => isOptionalString(value[key]));

const isSection = (value: unknown): boolean =>
  isRecord(value) &&
  isString(value.name) &&
  isFiniteNumber(value.maxItems) &&
  (value.preferredTags === undefined || isStringList(value.preferredTags));

const isTemplate = (value: unknown): value is ResumeTemplate =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.name) &&
  isLocale(value.locale) &&
  Array.isArray(value.sections) && value.sections.every(isSection);

const isJob = (value: unknown): value is JobDescription =>
  isRecord(value) &&
  isString(value.id) &&
  (value.sourceType === "paste" || value.sourceType === "url") &&
  isOptionalString(value.sourceUrl) &&
  isString(value.rawText) &&
  isString(value.createdAt);

const isProfile = (value: unknown): value is ResumeProfile =>
  isRecord(value) && profileFields.every((key) => isOptionalString(value[key]));

const validRecords = <T>(value: unknown, isValid: (item: unknown) => item is T): T[] =>
  Array.isArray(value) ? value.filter(isValid) : [];

// Keep the v1 storage key and entry objects intact; new fields are additive.
export const normalizeState = (state: Omit<Partial<StoredState>, "profile"> & { profile?: unknown }): StoredState => {
  const savedProfile = isRecord(state.profile) ? state.profile : {};
  const profile: ResumeProfile = {};
  for (const field of profileFields) {
    if (isString(savedProfile[field])) profile[field] = savedProfile[field];
  }
  return {
    entries: Array.isArray(state.entries) ? state.entries : [],
    templates: ensureStarterTemplates(Array.isArray(state.templates) ? state.templates : []),
    jobs: Array.isArray(state.jobs) ? state.jobs : [],
    profile,
  };
};

export const emptyState = (): StoredState => normalizeState({});

export const validateBackup = (value: unknown): StoredState => {
  if (
    !isRecord(value) ||
    !Array.isArray(value.entries) || !value.entries.every(isEntry) ||
    !Array.isArray(value.templates) || !value.templates.every(isTemplate) ||
    !Array.isArray(value.jobs) || !value.jobs.every(isJob) ||
    (value.profile !== undefined && !isProfile(value.profile))
  ) {
    throw new Error("Invalid resume vault backup");
  }

  return normalizeState({
    entries: value.entries,
    templates: value.templates,
    jobs: value.jobs,
    profile: value.profile,
  });
};

export const recoverStoredState = (value: unknown): StoredState => {
  if (!isRecord(value)) return emptyState();

  return normalizeState({
    entries: validRecords(value.entries, isEntry),
    templates: validRecords(value.templates, isTemplate),
    jobs: validRecords(value.jobs, isJob),
    profile: value.profile,
  });
};
