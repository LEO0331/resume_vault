import type { MatchGapItem, MatchReport, MatchTraceItem, ResumeEntry, ResumeTemplate } from "./types";

const STOP_WORDS = new Set(["and", "or", "the", "for", "with", "to", "in", "的", "與", "及", "和"]);
const PRIORITY_MARKERS = [
  "must",
  "required",
  "requirements",
  "requirement",
  "qualifications",
  "qualification",
  "responsibilities",
  "responsibility",
  "need to",
  "需求",
  "職責",
  "責任",
  "必須",
  "必備",
  "條件",
];
const MAX_SIGNAL_TOKENS = 24;
const META_TOKENS = new Set([
  "must",
  "required",
  "requirements",
  "requirement",
  "responsibilities",
  "responsibility",
  "qualifications",
  "qualification",
  "need",
  "需求",
  "職責",
  "責任",
  "必須",
  "必備",
  "條件",
]);

const lexicalCompare = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
};

const withoutMetaTokens = (tokens: string[]): string[] => tokens.filter((token) => !META_TOKENS.has(token));

export const tokenize = (input: string): string[] => {
  const zhChunks = input.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  const latin = input
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  return [...zhChunks, ...latin].filter((token) => !STOP_WORDS.has(token));
};

const overlapCount = (left: string[], right: string[]): number => {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let count = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      count += 1;
    }
  }
  return count;
};

const sortTokensByFrequency = (tokens: string[]): string[] => {
  const frequencies = new Map<string, number>();
  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }

  return Array.from(frequencies.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return lexicalCompare(a[0], b[0]);
    })
    .map(([token]) => token);
};

const extractPriorityLines = (jdText: string): string[] => {
  return jdText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const lower = line.toLowerCase();
      return PRIORITY_MARKERS.some((marker) => lower.includes(marker));
    });
};

const boundedRecencyBoost = (updatedAt: string, referenceTimeMs: number): number => {
  const parsed = Date.parse(updatedAt);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  const ageMs = Math.max(0, referenceTimeMs - parsed);
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 30) {
    return 2;
  }
  if (ageDays <= 90) {
    return 1;
  }
  return 0;
};

export type JdSignals = {
  generalTokens: string[];
  priorityTokens: string[];
  mediumTokens: string[];
};

export const extractJdSignals = (jdText: string): JdSignals => {
  const generalTokenFrequency = withoutMetaTokens(sortTokensByFrequency(tokenize(jdText)));
  const generalTokens = generalTokenFrequency.slice(0, MAX_SIGNAL_TOKENS);
  const priorityLines = extractPriorityLines(jdText);
  const priorityTokenFrequency = withoutMetaTokens(sortTokensByFrequency(tokenize(priorityLines.join(" "))));
  const priorityTokens = (priorityTokenFrequency.length > 0 ? priorityTokenFrequency : generalTokenFrequency).slice(0, 12);
  const mediumTokens = generalTokens.filter((token) => !priorityTokens.includes(token)).slice(0, 12);

  return {
    generalTokens,
    priorityTokens,
    mediumTokens,
  };
};

export const scoreEntries = (jdText: string, entries: ResumeEntry[]): MatchTraceItem[] => {
  const signals = extractJdSignals(jdText);
  const generalSet = new Set(signals.generalTokens);
  const prioritySet = new Set(signals.priorityTokens);
  const validUpdatedTimes = entries
    .map((entry) => Date.parse(entry.updatedAt))
    .filter((value) => Number.isFinite(value));
  const recencyReferenceTime = validUpdatedTimes.length > 0 ? Math.max(...validUpdatedTimes) : 0;

  return entries
    .map((entry) => {
      const entryTokens = tokenize(`${entry.title} ${entry.content} ${entry.tags.join(" ")}`);
      const entryTokenSet = new Set(entryTokens);
      const matchedGeneralTokens = signals.generalTokens.filter((token) => entryTokenSet.has(token));
      const priorityMatchedTokens = signals.priorityTokens.filter((token) => entryTokenSet.has(token));
      const generalOverlap = overlapCount(entryTokens, signals.generalTokens);
      const priorityOverlap = overlapCount(entryTokens, signals.priorityTokens);
      const tagBoost = entry.tags.some((tag) => generalSet.has(tag.toLowerCase()) || prioritySet.has(tag.toLowerCase())) ? 1 : 0;
      const recencyBoost = boundedRecencyBoost(entry.updatedAt, recencyReferenceTime);
      const score = generalOverlap * 3 + priorityOverlap * 5 + tagBoost * 2 + entry.weight + recencyBoost;

      return {
        entryId: entry.id,
        score,
        reasons: [
          `overlap:${generalOverlap}`,
          `general_overlap:${generalOverlap}`,
          `priority_overlap:${priorityOverlap}`,
          `tagBoost:${tagBoost}`,
          `weight:${entry.weight}`,
          `recencyBoost:${recencyBoost}`,
        ],
        matchedTokens: matchedGeneralTokens,
        priorityMatchedTokens,
        missingPriorityTokens: signals.priorityTokens.filter((token) => !entryTokenSet.has(token)),
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return lexicalCompare(a.entryId, b.entryId);
    });
};

export const selectEntriesForTemplate = (
  trace: MatchTraceItem[],
  entries: ResumeEntry[],
  template: ResumeTemplate,
): ResumeEntry[] => {
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
  const used = new Set<string>();
  const selected: ResumeEntry[] = [];

  for (const section of template.sections) {
    const candidates = trace
      .map((item) => ({ item, entry: entryMap.get(item.entryId) }))
      .filter((row): row is { item: MatchTraceItem; entry: ResumeEntry } => Boolean(row.entry))
      .filter(({ entry }) => !used.has(entry.id))
      .filter(({ entry }) => {
        if (!section.preferredTags || section.preferredTags.length === 0) {
          return true;
        }

        const entryTags = new Set(entry.tags.map((tag) => tag.toLowerCase()));
        return section.preferredTags.some((tag) => entryTags.has(tag.toLowerCase()));
      })
      .slice(0, section.maxItems);

    for (const candidate of candidates) {
      used.add(candidate.entry.id);
      selected.push(candidate.entry);
    }
  }

  return selected;
};

const toGapList = (high: string[], medium: string[]): MatchGapItem[] => {
  return [
    ...high.map((token) => ({ token, priority: "high" as const })),
    ...medium.map((token) => ({ token, priority: "medium" as const })),
  ];
};

export const buildMatchReport = (
  jdText: string,
  selectedEntries: ResumeEntry[],
): MatchReport => {
  const signals = extractJdSignals(jdText);
  const selectedTokens = new Set(tokenize(selectedEntries.map((entry) => `${entry.title} ${entry.content} ${entry.tags.join(" ")}`).join(" ")));
  const matchedPriority = signals.priorityTokens.filter((token) => selectedTokens.has(token));
  const matchedMedium = signals.mediumTokens.filter((token) => selectedTokens.has(token));
  const missingPriority = signals.priorityTokens.filter((token) => !selectedTokens.has(token));
  const missingMedium = signals.mediumTokens.filter((token) => !selectedTokens.has(token));
  const weightedMatched = matchedPriority.length * 2 + matchedMedium.length;
  const weightedTotal = Math.max(1, signals.priorityTokens.length * 2 + signals.mediumTokens.length);
  const coverageScore = Math.round((weightedMatched / weightedTotal) * 100);
  const decision =
    coverageScore >= 70 && missingPriority.length <= 1
      ? "apply"
      : coverageScore >= 45
        ? "apply_with_gaps"
        : "stretch";

  return {
    coverageScore,
    decision,
    strengths: matchedPriority.slice(0, 5),
    gaps: toGapList(missingPriority.slice(0, 5), missingMedium.slice(0, 5)),
  };
};
