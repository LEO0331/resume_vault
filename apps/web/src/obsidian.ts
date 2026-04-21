import type { JobDescription, ResumeTemplate } from "@resume-vault/core";

type BuildObsidianInput = {
  body: string;
  locale: "zh-TW" | "en-AU";
  template?: ResumeTemplate;
  job?: JobDescription;
  now?: Date;
};

const pad2 = (value: number): string => String(value).padStart(2, "0");

const slugify = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const yamlValue = (value: string): string => {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/"/g, '\\"');
  return `"${escaped}"`;
};

const dateStamp = (now: Date): string => {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

export const buildObsidianFilename = (now: Date): string => {
  return `tailored-resume-obsidian-${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}.md`;
};

export const buildObsidianMarkdown = ({ body, locale, template, job, now = new Date() }: BuildObsidianInput): string => {
  const localeTag = locale.toLowerCase();
  const tags = ["resume", "tailored", localeTag];
  const templateSlug = template?.name ? slugify(template.name) : "";
  if (templateSlug) {
    tags.push(`template-${templateSlug}`);
  }

  const frontmatter = [
    "---",
    `title: ${yamlValue(`Tailored Resume - ${dateStamp(now)}`)}`,
    `created: ${yamlValue(now.toISOString())}`,
    `locale: ${yamlValue(locale)}`,
    `template_id: ${yamlValue(template?.id ?? "")}`,
    `template_name: ${yamlValue(template?.name ?? "")}`,
    `jd_source_type: ${yamlValue(job?.sourceType ?? "")}`,
    `jd_source_url: ${yamlValue(job?.sourceUrl ?? "")}`,
    `tags: [${tags.map((tag) => yamlValue(tag)).join(", ")}]`,
    "---",
    "",
  ].join("\n");

  return `${frontmatter}\n${body}`;
};
