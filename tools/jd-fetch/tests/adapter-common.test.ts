import { describe, expect, it } from "vitest";
import { extractVisibleText } from "../src/adapters/common";

type MockLocator = {
  first: () => MockLocator;
  innerText: () => Promise<string>;
};

const createPage = (map: Record<string, string | Error>) => {
  return {
    locator: (selector: string): MockLocator => {
      const value = map[selector];
      return {
        first: () => ({
          first: () => {
            throw new Error("not used");
          },
          innerText: async () => {
            if (value instanceof Error) {
              throw value;
            }
            return value ?? "";
          },
        }),
        innerText: async () => {
          if (value instanceof Error) {
            throw value;
          }
          return value ?? "";
        },
      };
    },
  };
};

describe("extractVisibleText", () => {
  it("returns first non-empty selector text", async () => {
    const page = createPage({
      ".a": "",
      ".b": "  meaningful text  ",
      body: "fallback",
    });

    const text = await extractVisibleText(page as never, [".a", ".b"]);
    expect(text).toBe("meaningful text");
  });

  it("falls back to body when selectors fail", async () => {
    const page = createPage({
      ".a": new Error("boom"),
      ".b": "",
      body: "fallback body",
    });

    const text = await extractVisibleText(page as never, [".a", ".b"]);
    expect(text).toBe("fallback body");
  });

  it("returns empty string when body read fails", async () => {
    const page = createPage({
      ".a": "",
      body: new Error("boom"),
    });

    const text = await extractVisibleText(page as never, [".a"]);
    expect(text).toBe("");
  });
});
