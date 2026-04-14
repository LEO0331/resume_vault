import type { MatchTraceItem, ResumeEntry, ResumeTemplate } from "./types";

const STOP_WORDS = new Set(["and", "or", "the", "for", "with", "to", "in", "的", "與", "及", "和"]);

const tokenize = (input: string): string[] => {
  const zhChunks = input.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  const latin = input
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  return [...zhChunks, ...latin].filter((token) => !STOP_WORDS.has(token));
};

const overlapCount = (left: string[], right: string[]): number => {
  const rightSet = new Set(right);
  return left.reduce((sum, token) => sum + (rightSet.has(token) ? 1 : 0), 0);
};

export const scoreEntries = (jdText: string, entries: ResumeEntry[]): MatchTraceItem[] => {
  const jdTokens = tokenize(jdText);

  return entries
    .map((entry) => {
      const entryTokens = tokenize(`${entry.title} ${entry.content} ${entry.tags.join(" ")}`);
      const overlap = overlapCount(entryTokens, jdTokens);
      const tagBoost = entry.tags.some((tag) => jdTokens.includes(tag.toLowerCase())) ? 1 : 0;
      const score = overlap * 3 + tagBoost * 2 + entry.weight;

      return {
        entryId: entry.id,
        score,
        reasons: [
          `overlap:${overlap}`,
          `tagBoost:${tagBoost}`,
          `weight:${entry.weight}`
        ]
      };
    })
    .sort((a, b) => b.score - a.score);
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

        return section.preferredTags.some((tag) => entry.tags.includes(tag));
      })
      .slice(0, section.maxItems);

    for (const candidate of candidates) {
      used.add(candidate.entry.id);
      selected.push(candidate.entry);
    }
  }

  return selected;
};
