import { URL } from "node:url";
import { buildFallbackResumeMarkdown } from "./tailor-lib.mjs";

/**
 * @typedef {{
 *   responsibilities: string[];
 *   experienceRequired: string[];
 *   qualifications: string[];
 * }} GuideSections
 */

const LEVEL_KEYWORDS = [
  "junior",
  "graduate",
  "entry",
  "entry-level",
  "associate",
  "mid",
  "mid-level",
  "intermediate",
];

const SECTION_RULES = [
  { key: "responsibilities", markers: ["responsibilities", "role", "what you'll do", "what you will do", "職責", "工作內容"] },
  { key: "experienceRequired", markers: ["experience required", "experience", "what you'll bring", "what you bring", "must have", "必備", "經驗"] },
  { key: "qualifications", markers: ["qualifications", "requirements", "requirement", "skills", "資格", "條件", "需求"] },
];

const parseBulletLines = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^[\-*•]/.test(line))
    .map((line) => line.replace(/^[\-*•]\s*/, "").trim())
    .filter(Boolean);

const tokenizeAlphaNum = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);

export const isSeekJobUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    return /(^|\.)seek\.com$/i.test(url.hostname) || /(^|\.)seek\.com\.au$/i.test(url.hostname) || /(^|\.)seek\.co\.nz$/i.test(url.hostname);
  } catch {
    return false;
  }
};

export const extractJobIdFromUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    const match = url.pathname.match(/\/job\/(\d+)/i);
    if (match?.[1]) {
      return match[1];
    }
    return url.searchParams.get("jobId") ?? "";
  } catch {
    return "";
  }
};

export const classifyRoleLevelByTitle = (title) => {
  const normalized = String(title || "").toLowerCase();
  return LEVEL_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

/** @returns {GuideSections} */
export const extractGuideSections = (jdText) => {
  const lines = String(jdText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  /** @type {GuideSections} */
  const sections = {
    responsibilities: [],
    experienceRequired: [],
    qualifications: [],
  };

  const used = new Set();
  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const rule of SECTION_RULES) {
      if (rule.markers.some((marker) => lower.includes(marker))) {
        if (!used.has(line)) {
          sections[rule.key].push(line);
          used.add(line);
        }
        break;
      }
    }
  }

  return sections;
};

export const buildOutputBaseName = (rawUrl, fallbackIndex) => {
  const jobId = extractJobIdFromUrl(rawUrl);
  if (jobId) {
    return `seek-job-${jobId}`;
  }
  return `seek-job-index-${String(fallbackIndex).padStart(2, "0")}`;
};

const headingToCategory = (heading) => {
  const normalized = heading.toLowerCase().replace(/[^a-z0-9\s\u4e00-\u9fff]/g, " ");
  if (normalized.includes("summary") || normalized.includes("profile") || normalized.includes("摘要")) return "summary";
  if (normalized.includes("experience") || normalized.includes("work") || normalized.includes("經歷")) return "experience";
  if (normalized.includes("project") || normalized.includes("專案")) return "project";
  if (normalized.includes("skill") || normalized.includes("技能")) return "skill";
  if (normalized.includes("education") || normalized.includes("學歷")) return "education";
  if (normalized.includes("achievement")) return "achievement";
  return "experience";
};

const sectionToTags = (category) => {
  switch (category) {
    case "summary":
      return ["summary", "profile"];
    case "experience":
      return ["experience", "work"];
    case "project":
      return ["project", "delivery"];
    case "skill":
      return ["skill", "tools", "tech", "strength", "domain"];
    case "education":
      return ["education"];
    case "achievement":
      return ["achievement", "impact", "award"];
    default:
      return ["experience"];
  }
};

export const parsePrivateProfileToEntries = (profileText, locale = "en-AU") => {
  const lines = String(profileText || "")
    .split(/\r?\n/)
    .map((line) => line.trim());
  const entries = [];
  let currentHeading = "Professional Summary";
  let bucket = [];

  const flushBucket = () => {
    if (bucket.length === 0) return;
    const category = headingToCategory(currentHeading);
    for (const item of bucket) {
      entries.push({
        id: `local-entry-${entries.length + 1}`,
        category,
        title: currentHeading,
        content: item,
        locale,
        tags: sectionToTags(category),
        weight: category === "experience" ? 4 : 3,
        updatedAt: new Date().toISOString(),
      });
    }
    bucket = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const isHeading =
      /:$/.test(line) ||
      /^(technical skills|education background|working experience|volunteer experience|projects|professional profile|專業摘要|技術技能|工作經歷|精選專案|學歷)$/i.test(line);

    if (isHeading && !/^[\-*•]/.test(line)) {
      flushBucket();
      currentHeading = line.replace(/:$/, "");
      continue;
    }

    if (/^[\-*•]/.test(line)) {
      bucket.push(line.replace(/^[\-*•]\s*/, "").trim());
      continue;
    }

    if (line.length >= 24) {
      bucket.push(line);
    }
  }

  flushBucket();
  return entries;
};

export const buildTailoredMarkdown = ({ contact, selectedEntries }) => buildFallbackResumeMarkdown({
  candidateName: contact?.name,
  contactLine: [contact?.location, contact?.email, contact?.phone, contact?.linkedin, contact?.website].filter(Boolean).join(" | "),
  selectedEntries,
  currentResumeMarkdown: "",
});

export const rankEntriesForJob = (entries, jdText) => {
  const jdTokens = new Set(tokenizeAlphaNum(jdText));

  return [...entries]
    .map((entry) => {
      const source = `${entry.title} ${entry.content} ${(entry.tags || []).join(" ")}`.toLowerCase();
      const tokens = tokenizeAlphaNum(source);
      const overlap = tokens.reduce((sum, token) => sum + (jdTokens.has(token) ? 1 : 0), 0);
      const score = overlap * 3 + (entry.weight || 0);
      return { entry, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.id.localeCompare(b.entry.id);
    });
};

// Education is factual background and must survive a JD ranking cutoff.
export const selectRankedResumeEntries = (ranking, maxItems = 24) => [
  ...ranking.slice(0, maxItems).map((row) => row.entry).filter((entry) => entry.category !== "education"),
  ...ranking.map((row) => row.entry).filter((entry) => entry.category === "education"),
];

export { markdownToHtml } from "./markdown.mjs";

export const parseSeekUrlList = (content) =>
  String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

export const extractBulletSignals = (jdText) => parseBulletLines(jdText);

export const isLikelyBotWall = ({ title, text }) => {
  const corpus = `${String(title || "")}\n${String(text || "")}`.toLowerCase();
  return (
    corpus.includes("just a moment") ||
    corpus.includes("confirm you are human") ||
    corpus.includes("help us keep seek secure") ||
    corpus.includes("attention required") ||
    corpus.includes("cloudflare")
  );
};

export const extractSeekLocation = ({ title, text }) => {
  const titleText = String(title || "").trim();
  const inMatch = titleText.match(/\bin\s+(.+?)(?:\s*-\s*SEEK|$)/i);
  if (inMatch?.[1]) {
    return inMatch[1].trim();
  }

  const candidates = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40);

  const locRegex = /\b([A-Za-z\s]+)\s+(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\b/;
  for (const line of candidates) {
    const m = line.match(locRegex);
    if (m?.[0]) {
      return m[0].trim();
    }
  }

  return "";
};
