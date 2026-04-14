import type { Page } from "playwright";

export interface FetchResult {
  domain: string;
  url: string;
  title: string;
  text: string;
  warnings: string[];
}

export interface JobAdapter {
  name: string;
  supports(url: URL): boolean;
  extract(page: Page, url: URL): Promise<FetchResult>;
}
