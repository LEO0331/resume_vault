import { describe, expect, it } from "vitest";
import { adapter104 } from "../src/adapters/a104";
import { linkedinAdapter } from "../src/adapters/linkedin";
import { seekAdapter } from "../src/adapters/seek";

type MockLocator = {
  first: () => MockLocator;
  innerText: () => Promise<string>;
};

const createPage = (opts: { title: string; html: string; textMap: Record<string, string> }) => {
  return {
    title: async () => opts.title,
    content: async () => opts.html,
    locator: (selector: string): MockLocator => ({
      first: () => ({
        first: () => {
          throw new Error("not used");
        },
        innerText: async () => opts.textMap[selector] ?? "",
      }),
      innerText: async () => opts.textMap[selector] ?? "",
    }),
  };
};

describe("adapter extract", () => {
  it("uses html extraction for 104 adapter", async () => {
    const page = createPage({
      title: "104 title",
      html: '<div class="job-description">Needed React TypeScript</div>',
      textMap: { body: "fallback" },
    });

    const result = await adapter104.extract(page as never, new URL("https://www.104.com.tw/job/1"));
    expect(result.title).toBe("104 title");
    expect(result.text).toContain("Needed React TypeScript");
    expect(result.warnings).toEqual([]);
  });

  it("adds warning when linkedin text is empty", async () => {
    const page = createPage({
      title: "linkedin title",
      html: "<main></main>",
      textMap: { ".show-more-less-html__markup": "", main: "", article: "", body: "" },
    });

    const result = await linkedinAdapter.extract(page as never, new URL("https://www.linkedin.com/jobs/view/1"));
    expect(result.text).toBe("");
    expect(result.warnings[0]).toContain("Could not extract LinkedIn description");
  });

  it("adds warning when seek text is empty", async () => {
    const page = createPage({
      title: "seek title",
      html: "<main></main>",
      textMap: { "[data-automation='jobAdDetails']": "", main: "", article: "", body: "" },
    });

    const result = await seekAdapter.extract(page as never, new URL("https://www.seek.com.au/job/1"));
    expect(result.text).toBe("");
    expect(result.warnings[0]).toContain("No text extracted from Seek selectors");
  });
});
