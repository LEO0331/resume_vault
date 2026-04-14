import { describe, expect, it } from "vitest";
import { extractBySelectors } from "../src/adapters/html-parser";

describe("extractBySelectors", () => {
  it("extracts by class and strips scripts/styles/entities", () => {
    const html = `
      <div class="target">
        Hello &amp; welcome
        <script>evil()</script>
        <style>.x{}</style>
      </div>
    `;

    const text = extractBySelectors(html, [{ type: "class", value: "target" }]);
    expect(text).toBe("Hello & welcome");
  });

  it("falls back to data-attribute selector", () => {
    const html = '<section data-automation="jobAdDetails">Data based text</section>';
    const text = extractBySelectors(html, [
      { type: "class", value: "none" },
      { type: "data", attr: "data-automation", value: "jobAdDetails" },
    ]);

    expect(text).toBe("Data based text");
  });

  it("falls back to tag selector and returns empty when nothing found", () => {
    const html = "<article>Tag text</article>";
    const byTag = extractBySelectors(html, [{ type: "tag", value: "article" }]);
    const missing = extractBySelectors(html, [{ type: "class", value: "missing" }]);

    expect(byTag).toBe("Tag text");
    expect(missing).toBe("");
  });
});
