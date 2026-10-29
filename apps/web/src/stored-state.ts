import type { JobDescription, ResumeEntry, ResumeProfile, ResumeTemplate } from "@resume-vault/core";
import { ensureStarterTemplates } from "./template-presets";

export type StoredState = {
  entries: ResumeEntry[];
  templates: ResumeTemplate[];
  jobs: JobDescription[];
  profile: ResumeProfile;
};

const profileFields = ["name", "email", "phone", "location", "linkedin", "website", "contactLine"] as const;

// Keep the v1 storage key and entry objects intact; new fields are additive.
export const normalizeState = (state: Partial<StoredState>): StoredState => {
  const profile: ResumeProfile = {};
  for (const field of profileFields) {
    if (typeof state.profile?.[field] === "string") profile[field] = state.profile[field];
  }
  return {
    entries: Array.isArray(state.entries) ? state.entries : [],
    templates: ensureStarterTemplates(Array.isArray(state.templates) ? state.templates : []),
    jobs: Array.isArray(state.jobs) ? state.jobs : [],
    profile,
  };
};

export const emptyState = (): StoredState => normalizeState({});
